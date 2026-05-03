import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getMembership, getPrimaryMembership } from "@/server/queries/organizations";
import { jsonWithCors } from "@/lib/api/cors";

export class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ApiAuthContext = {
  user: User;
  membership: NonNullable<Awaited<ReturnType<typeof getPrimaryMembership>>>;
};

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    throw new ApiRouteError(401, "Missing bearer token");
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new ApiRouteError(401, "Invalid bearer token");
  }

  return token;
}

export async function requireApiAuth(
  request: NextRequest,
): Promise<ApiAuthContext> {
  const token = getBearerToken(request);
  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new ApiRouteError(401, "Unauthorized");
  }

  const requestedOrganizationId =
    request.headers.get("x-organization-id") ||
    request.nextUrl.searchParams.get("organizationId") ||
    null;

  const membership = requestedOrganizationId
    ? await getMembership(user.id, requestedOrganizationId)
    : await getPrimaryMembership(user.id);

  if (!membership) {
    throw new ApiRouteError(403, "User does not belong to an organization");
  }

  return { user, membership };
}

export function handleApiError(error: unknown, request?: NextRequest) {
  if (error instanceof ApiRouteError) {
    return request
      ? jsonWithCors(request, { error: error.message }, { status: error.status })
      : NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return request
    ? jsonWithCors(request, { error: message }, { status: 500 })
    : NextResponse.json({ error: message }, { status: 500 });
}
