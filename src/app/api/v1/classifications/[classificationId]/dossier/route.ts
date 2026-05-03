import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDossierAction } from "@/server/actions/dossier";
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
        dossier: true,
      },
    });

    if (!classification) {
      return NextResponse.json(
        { error: "Classification not found" },
        { status: 404 },
      );
    }

    const dossier = classification.dossier;
    return NextResponse.json({
      dossier: dossier
        ? {
            id: dossier.id,
            generatedAt: dossier.generatedAt,
            previewUrl: `/api/dossier/${dossier.id}/preview`,
            pdfUrl: `/api/dossier/${dossier.id}/pdf`,
            exportUrl: `/api/dossier/${dossier.id}/export`,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
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
      select: { id: true },
    });

    if (!classification) {
      return NextResponse.json(
        { error: "Classification not found" },
        { status: 404 },
      );
    }

    const dossier = await generateDossierAction({ classificationId });
    return NextResponse.json({ dossier }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
