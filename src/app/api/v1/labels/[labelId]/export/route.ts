import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

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
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    return NextResponse.json({
      labelId,
      htmlUrl: bearerToken
        ? `/api/label/${labelId}/export?access_token=${encodeURIComponent(bearerToken)}`
        : `/api/label/${labelId}/export`,
      pdfUrl: bearerToken
        ? `/api/label/${labelId}/pdf?access_token=${encodeURIComponent(bearerToken)}`
        : `/api/label/${labelId}/pdf`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
