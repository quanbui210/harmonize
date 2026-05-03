import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDossierAction } from "@/server/actions/dossier";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classificationId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { classificationId } = await params;
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

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
      return jsonWithCors(
        request,
        { error: "Classification not found" },
        { status: 404 },
      );
    }

    const dossier = classification.dossier;
    return jsonWithCors(request, {
      dossier: dossier
        ? {
            id: dossier.id,
            generatedAt: dossier.generatedAt,
            previewUrl: `/api/dossier/${dossier.id}/preview`,
            pdfUrl: bearerToken
              ? `/api/dossier/${dossier.id}/pdf?access_token=${encodeURIComponent(bearerToken)}`
              : `/api/dossier/${dossier.id}/pdf`,
            exportUrl: `/api/dossier/${dossier.id}/export`,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error, request);
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
      return jsonWithCors(
        request,
        { error: "Classification not found" },
        { status: 404 },
      );
    }

    const dossier = await generateDossierAction({ classificationId });
    return jsonWithCors(request, { dossier }, { status: 201 });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
