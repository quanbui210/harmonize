import { NextRequest, NextResponse } from "next/server";
import { getDashboardOverview } from "@/server/queries/dashboard";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const overview = await getDashboardOverview(membership.organizationId);
    return NextResponse.json(overview);
  } catch (error) {
    return handleApiError(error);
  }
}
