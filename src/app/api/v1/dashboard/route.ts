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
    const overview = await getDashboardOverview(membership.organizationId, {
      includeActiveImports: false,
      includeRecentShipments: false,
      actionItemsLimit: 8,
    });
    return jsonWithCors(request, {
      auditReadinessScore: overview.auditReadinessScore,
      approvedCount: overview.approvedCount,
      pendingCount: overview.pendingCount,
      missingReasonings: overview.missingReasonings,
      autoClassified: overview.autoClassified,
      totalLabels: overview.totalLabels,
      actionItems: overview.actionItems,
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}
