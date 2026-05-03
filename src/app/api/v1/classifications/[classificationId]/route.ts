import { NextRequest, NextResponse } from "next/server";
import { MarketCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";
import { serializeClassification, serializeProduct } from "@/lib/api/mobile-serializers";
import { getCNCodeDescription } from "@/server/actions/cn-descriptions";

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
        ...(await getClassificationCodeMeta(classification)),
        product: classification.product
          ? serializeProduct(classification.product)
          : classification.product,
      }),
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}

function normalizeCodeDigits(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function formatCodeForDisplay(code: string) {
  if (code.length <= 2) return code;
  if (code.length <= 4) return code;
  if (code.length <= 6) return `${code.slice(0, 4)} ${code.slice(4, 6)}`;
  return `${code.slice(0, 4)} ${code.slice(4, 6)} ${code.slice(6, 8)}`;
}

function fallbackBreakdownDescription(level: "chapter" | "heading" | "subheading" | "commodity") {
  switch (level) {
    case "chapter":
      return "Main product chapter";
    case "heading":
      return "Product group";
    case "subheading":
      return "Narrowed product group";
    case "commodity":
      return "Most specific code match";
  }
}

function sanitizeCodeDescription(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value) return fallback;
  const cleaned = value
    .replace(/^CN Code\s+\d+\s*-\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /description not available/i.test(cleaned)) {
    return fallback;
  }

  return cleaned;
}

async function getClassificationCodeMeta(classification: {
  cnCode?: string | null;
  htsCode?: string | null;
  hsCode?: string | null;
  market?: MarketCode | string | null;
}) {
  const rawCnCode =
    normalizeCodeDigits(classification.cnCode) ||
    normalizeCodeDigits(classification.htsCode).slice(0, 8) ||
    normalizeCodeDigits(classification.hsCode).slice(0, 6).padEnd(8, "0");

  if (rawCnCode.length !== 8 || rawCnCode === "00000000") {
    return {
      cnCodeDescription: null,
      codeBreakdown: [],
    };
  }

  const market =
    classification.market === MarketCode.US ? MarketCode.US : MarketCode.EU;

  const steps = [
    {
      level: "chapter" as const,
      rawCode: rawCnCode.slice(0, 2),
      lookupCode: `${rawCnCode.slice(0, 2)}000000`,
      title: "Chapter",
    },
    {
      level: "heading" as const,
      rawCode: rawCnCode.slice(0, 4),
      lookupCode: `${rawCnCode.slice(0, 4)}0000`,
      title: "Heading",
    },
    {
      level: "subheading" as const,
      rawCode: rawCnCode.slice(0, 6),
      lookupCode: `${rawCnCode.slice(0, 6)}00`,
      title: "Subheading",
    },
    {
      level: "commodity" as const,
      rawCode: rawCnCode,
      lookupCode: rawCnCode,
      title: "Commodity",
    },
  ];

  const descriptions = await Promise.all(
    steps.map(async (step) => {
      try {
        return await getCNCodeDescription(step.lookupCode as any, market);
      } catch {
        return null;
      }
    }),
  );

  const codeBreakdown = steps.map((step, index) => ({
    level: step.level,
    code: formatCodeForDisplay(step.rawCode),
    title: step.title,
    description: sanitizeCodeDescription(
      descriptions[index],
      fallbackBreakdownDescription(step.level),
    ),
  }));

  return {
    cnCodeDescription: codeBreakdown[codeBreakdown.length - 1]?.description || null,
    codeBreakdown,
  };
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
