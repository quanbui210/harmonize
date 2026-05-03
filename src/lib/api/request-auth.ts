import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { ApiRouteError } from "@/lib/api/mobile-auth";
import { getMembership, getPrimaryMembership } from "@/server/queries/organizations";

function getRequestToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const queryToken = request.nextUrl.searchParams.get("access_token")?.trim();
  if (queryToken) return queryToken;

  return null;
}

async function getUserFromToken(token: string): Promise<User | null> {
  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

async function getUserFromServerSession(): Promise<User | null> {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function authenticateRequest(request: NextRequest) {
  const token = getRequestToken(request);
  const user = token ? await getUserFromToken(token) : await getUserFromServerSession();

  if (!user) {
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

  return { user, membership, token };
}
