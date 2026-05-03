import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const { user, membership } = await requireApiAuth(request);

    return jsonWithCors(request, {
      user: {
        id: user.id,
        email: user.email ?? null,
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User",
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        logoUrl: membership.organization.logoUrl ?? null,
      },
      membership: {
        id: membership.id,
        role: membership.role,
      },
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}
