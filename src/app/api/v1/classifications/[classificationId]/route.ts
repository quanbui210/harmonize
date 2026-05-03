import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";
import { serializeClassification, serializeProduct } from "@/lib/api/mobile-serializers";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

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
      return jsonWithCors(
        request,
        { error: "Classification not found" },
        { status: 404 },
      );
    }

    return jsonWithCors(request, {
      classification: serializeClassification({
        ...classification,
        product: classification.product
          ? serializeProduct(classification.product)
          : classification.product,
      }),
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classificationId: string }> },
) {
  try {
    const { membership, user } = await requireApiAuth(request);
    const { classificationId } = await params;

    const classification = await prisma.classification.findFirst({
      where: {
        id: classificationId,
        organizationId: membership.organizationId,
      },
      include: {
        product: {
          include: {
            _count: {
              select: {
                classifications: true,
              },
            },
          },
        },
        dossier: true,
      },
    });

    if (!classification) {
      return jsonWithCors(request, { error: "Classification not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipmentItem.updateMany({
        where: { classificationId },
        data: { classificationId: null },
      });

      await tx.label.updateMany({
        where: { classificationId },
        data: { classificationId: null },
      });

      await tx.classificationSource.deleteMany({
        where: { classificationId },
      });

      await tx.riskFlag.deleteMany({
        where: { classificationId },
      });

      await tx.dutySummary.deleteMany({
        where: { classificationId },
      });

      if (classification.dossier) {
        await tx.dossier.delete({
          where: { id: classification.dossier.id },
        });
      }

      await tx.classification.delete({
        where: { id: classificationId },
      });

      if (classification.product._count.classifications === 1) {
        await tx.productMaterial.deleteMany({
          where: { productId: classification.product.id },
        });
        await tx.product.delete({
          where: { id: classification.product.id },
        });
      }
    });

    return jsonWithCors(request, {
      success: true,
      deletedClassificationId: classificationId,
      deletedByUserId: user.id,
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}
