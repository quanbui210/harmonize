import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { labelId } = await params;
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const label = await prisma.label.findFirst({
      where: {
        id: labelId,
        organizationId: membership.organizationId,
      },
      select: { id: true },
    });

    if (!label) {
      return jsonWithCors(request, { error: "Label not found" }, { status: 404 });
    }

    return jsonWithCors(request, {
      labelId,
      htmlUrl: bearerToken
        ? `/api/label/${labelId}/export?access_token=${encodeURIComponent(bearerToken)}`
        : `/api/label/${labelId}/export`,
      pdfUrl: bearerToken
        ? `/api/label/${labelId}/pdf?access_token=${encodeURIComponent(bearerToken)}`
        : `/api/label/${labelId}/pdf`,
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
