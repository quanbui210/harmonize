import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classificationId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { classificationId } = await params;

    const classification = await prisma.classification.findFirst({
      where: {
        id: classificationId,
        organizationId: membership.organizationId,
      },
      include: {
        product: {
          include: {
            materials: true,
            images: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
        },
        dutySummary: true,
        riskFlags: true,
        sources: true,
        dossier: true,
        labels: {
          orderBy: { generatedAt: "desc" },
          take: 5,
        },
      },
    });

    if (!classification) {
      return NextResponse.json(
        { error: "Classification not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ classification });
  } catch (error) {
    return handleApiError(error);
  }
}
