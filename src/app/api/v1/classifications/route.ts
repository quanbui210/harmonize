import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MarketCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";
import { serializeClassification } from "@/lib/api/mobile-serializers";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const basicClassifyRequestSchema = z.object({
  productId: z.string().cuid(),
});

const enhancedClassifyRequestSchema = z.object({
  productId: z.string().cuid(),
  productName: z.string().min(1),
  description: z.string().min(1),
  intendedUse: z.string().optional(),
  materials: z
    .array(
      z.object({
        material: z.string().min(1),
        percentage: z.number().min(0).max(100),
      }),
    )
    .optional(),
  compositionText: z.string().optional(),
  originCountry: z.string().optional(),
  destinationCountry: z.string().optional(),
  imageIds: z.array(z.string().cuid()).optional(),
  market: z.nativeEnum(MarketCode).default(MarketCode.EU),
});

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function resolveLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseCursor(value: string | null) {
  if (!value) return null;
  const [updatedAtText, id] = value.split("|");
  if (!updatedAtText || !id) {
    throw new Error("Invalid cursor");
  }
  const updatedAt = new Date(updatedAtText);
  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error("Invalid cursor");
  }
  return { updatedAt, id };
}

function makeCursor(value: { updatedAt: Date; id: string }) {
  return `${value.updatedAt.toISOString()}|${value.id}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractMaterials(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const material = stringValue(record.name) || stringValue(record.material);
      const percentageValue =
        typeof record.percentage === "number"
          ? record.percentage
          : typeof record.percentage === "string"
            ? Number.parseFloat(record.percentage)
            : Number.NaN;

      if (!material) return null;

      return {
        material,
        percentage: Number.isFinite(percentageValue) ? percentageValue : 0,
      };
    })
    .filter((item): item is { material: string; percentage: number } => Boolean(item));
}

function mergeUniqueMaterials(
  existing: Array<{ material: string; percentage: number }>,
  incoming: Array<{ material: string; percentage: number }>,
) {
  const byName = new Map<string, { material: string; percentage: number }>();

  for (const item of [...existing, ...incoming]) {
    const key = String(item?.material || "").trim().toLowerCase();
    if (!key) continue;
    byName.set(key, {
      material: String(item?.material || "").trim(),
      percentage: Number.isFinite(item?.percentage) ? item.percentage : 0,
    });
  }

  return Array.from(byName.values());
}

function buildCompositionTextFromImages(
  images: Array<{ ocrText: string | null; extractedData: unknown }>,
  existingComposition?: string | null,
) {
  const sections: string[] = [];
  const seen = new Set<string>();

  const push = (value?: string | null) => {
    const normalized = stringValue(value);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    sections.push(normalized);
  };

  push(existingComposition);

  for (const image of images) {
    const extractedData =
      image.extractedData && typeof image.extractedData === "object"
        ? (image.extractedData as Record<string, unknown>)
        : {};

    push(stringValue(extractedData.compositionText));

    const specifications = extractedData.specifications;
    if (specifications && typeof specifications === "object" && !Array.isArray(specifications)) {
      const lines = Object.entries(specifications as Record<string, unknown>)
        .map(([key, value]) => {
          const normalizedValue = stringValue(value);
          return normalizedValue ? `${key}: ${normalizedValue}` : null;
        })
        .filter((line): line is string => Boolean(line));

      push(lines.join("\n"));
    }

    push(image.ocrText);
  }

  const combined = sections.join("\n\n").trim();
  return combined ? combined.slice(0, 6000) : null;
}

function mergeProductEvidence(product: {
  name: string;
  description: string;
  intendedUse: string | null;
  metadata: unknown;
  materials: Array<{ material: string; percentage: unknown }>;
  images: Array<{ id: string; ocrText: string | null; extractedData: unknown }>;
}) {
  const metadata =
    product.metadata && typeof product.metadata === "object"
      ? (product.metadata as Record<string, unknown>)
      : {};

  const existingMaterials = product.materials.map((material) => ({
    material: material.material,
    percentage:
      typeof material.percentage === "number"
        ? material.percentage
        : Number(material.percentage) || 0,
  }));

  const mergedData = product.images.reduce(
    (acc, image) => {
      const extractedData =
        image.extractedData && typeof image.extractedData === "object"
          ? (image.extractedData as Record<string, unknown>)
          : {};

      return {
        productName:
          acc.productName ||
          stringValue(extractedData.productName) ||
          stringValue(extractedData.name) ||
          "",
        description:
          acc.description ||
          stringValue(extractedData.description) ||
          "",
        intendedUse:
          acc.intendedUse ||
          stringValue(extractedData.intendedUse) ||
          "",
        originCountry:
          acc.originCountry ||
          stringValue(extractedData.originCountry) ||
          "",
        destinationCountry:
          acc.destinationCountry ||
          stringValue(extractedData.destinationCountry) ||
          "",
        materials: mergeUniqueMaterials(
          acc.materials,
          extractMaterials(extractedData.materials),
        ),
      };
    },
    {
      productName: "",
      description: "",
      intendedUse: "",
      originCountry: "",
      destinationCountry: "",
      materials: existingMaterials,
    },
  );

  return {
    productName: mergedData.productName || product.name,
    description:
      mergedData.description ||
      stringValue(metadata.description) ||
      product.description ||
      product.name,
    intendedUse:
      mergedData.intendedUse ||
      stringValue(metadata.intendedUse) ||
      product.intendedUse ||
      undefined,
    originCountry:
      mergedData.originCountry ||
      stringValue(metadata.originCountry) ||
      undefined,
    destinationCountry:
      mergedData.destinationCountry ||
      stringValue(metadata.destinationCountry) ||
      undefined,
    compositionText: buildCompositionTextFromImages(
      product.images,
      stringValue(metadata.compositionText),
    ),
    materials: mergedData.materials,
    imageIds: product.images.map((image) => image.id),
  };
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const limit = resolveLimit(request.nextUrl.searchParams.get("limit"));
    const cursor = parseCursor(request.nextUrl.searchParams.get("cursor"));

    const classifications = await prisma.classification.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                {
                  updatedAt: cursor.updatedAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      include: {
        product: {
          include: {
            images: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        dutySummary: true,
        riskFlags: true,
        dossier: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const hasMore = classifications.length > limit;
    const pageItems = hasMore ? classifications.slice(0, limit) : classifications;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem ? makeCursor(lastItem) : null;

    const supabase = getSupabaseAdminClient();
    const serializedItems = await Promise.all(
      pageItems.map(async (classification) => {
        const productImages = classification.product?.images ?? [];
        const productImagesWithSignedUrls = await Promise.all(
          productImages.map(async (image) => {
            const { data } = await supabase.storage
              .from("product-images")
              .createSignedUrl(image.storagePath, 3600);

            return {
              ...image,
              signedUrl: data?.signedUrl ?? null,
            };
          }),
        );

        return serializeClassification({
          ...classification,
          product: classification.product
            ? {
                ...classification.product,
                images: productImagesWithSignedUrls,
              }
            : classification.product,
        });
      }),
    );

    return jsonWithCors(request, {
      items: serializedItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const body = await request.json();

    const enhancedPayload = enhancedClassifyRequestSchema.safeParse(body);
    if (enhancedPayload.success) {
      const { searchAndClassifyAction } = await import(
        "@/server/actions/classification-search"
      );

      const result = await searchAndClassifyAction({
        productName: enhancedPayload.data.productName,
        description: enhancedPayload.data.description,
        intendedUse: enhancedPayload.data.intendedUse,
        materials: enhancedPayload.data.materials,
        compositionText: enhancedPayload.data.compositionText,
        originCountry: enhancedPayload.data.originCountry,
        destinationCountry: enhancedPayload.data.destinationCountry,
        imageIds: enhancedPayload.data.imageIds,
        market: enhancedPayload.data.market,
      });

      const classification = await prisma.classification.findFirst({
        where: {
          id: result.classificationId,
          organizationId: membership.organizationId,
        },
        include: {
          product: true,
          dutySummary: true,
          riskFlags: true,
          dossier: true,
        },
      });

      if (!classification) {
        throw new Error("Classification was created but could not be loaded.");
      }

      if (result.productId !== enhancedPayload.data.productId) {
        await prisma.product.deleteMany({
          where: {
            id: enhancedPayload.data.productId,
            organizationId: membership.organizationId,
            classifications: {
              none: {},
            },
            images: {
              none: {},
            },
          },
        });
      }

      return jsonWithCors(
        request,
        {
          result: {
            productId: result.productId,
            classificationId: result.classificationId,
            needsRefinement: result.needsRefinement,
            refinementQuestion: result.refinementQuestion ?? null,
            classification: serializeClassification(classification),
          },
        },
        { status: 201 },
      );
    }

    const { productId } = basicClassifyRequestSchema.parse(body);
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: membership.organizationId,
      },
      include: {
        materials: true,
        images: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            ocrText: true,
            extractedData: true,
          },
        },
      },
    });

    if (!product) {
      return jsonWithCors(request, { error: "Product not found" }, { status: 404 });
    }

    const { searchAndClassifyAction } = await import(
      "@/server/actions/classification-search"
    );
    const merged = mergeProductEvidence(product);

    const result = await searchAndClassifyAction({
      productId,
      productName: merged.productName,
      description: merged.description,
      intendedUse: merged.intendedUse,
      materials: merged.materials,
      compositionText: merged.compositionText || undefined,
      originCountry: merged.originCountry,
      destinationCountry: merged.destinationCountry,
      imageIds: merged.imageIds,
      market: MarketCode.EU,
    });

    const classification = await prisma.classification.findFirst({
      where: {
        id: result.classificationId,
        organizationId: membership.organizationId,
      },
      include: {
        product: true,
        dutySummary: true,
        riskFlags: true,
        dossier: true,
      },
    });

    if (!classification) {
      throw new Error("Classification was created but could not be loaded.");
    }

    return jsonWithCors(
      request,
      {
        result: {
          productId: result.productId,
          classificationId: result.classificationId,
          needsRefinement: result.needsRefinement,
          refinementQuestion: result.refinementQuestion ?? null,
          classification: serializeClassification(classification),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, request);
  }
}
