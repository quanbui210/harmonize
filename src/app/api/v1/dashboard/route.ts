import { NextRequest, NextResponse } from "next/server";
import { getDashboardOverview } from "@/server/queries/dashboard";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const overview = await getDashboardOverview(membership.organizationId);
    return jsonWithCors(request, overview);
  } catch (error) {
    return handleApiError(error, request);
  }
}
