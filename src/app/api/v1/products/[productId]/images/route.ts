import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { extractProductDataFromImage } from "@/lib/vision/image-extraction-service";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { productId } = await params;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: membership.organizationId,
      },
      include: {
        materials: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const images = await prisma.productImage.findMany({
      where: {
        organizationId: membership.organizationId,
        productId,
      },
      orderBy: { createdAt: "desc" },
    });

    const supabase = getSupabaseAdminClient();
    const items = await Promise.all(
      images.map(async (image) => {
        const { data } = await supabase.storage
          .from("product-images")
          .createSignedUrl(image.storagePath, 3600);

        return {
          ...image,
          signedUrl: data?.signedUrl ?? null,
        };
      }),
    );

    return NextResponse.json({ images: items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { user, membership } = await requireApiAuth(request);
    const { productId } = await params;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: membership.organizationId,
      },
      include: {
        materials: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const formData = (await request.formData()) as globalThis.FormData;
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `${membership.organizationId}/product-images/${Date.now()}-${sha256.slice(0, 8)}.${extension}`;

    const supabase = getSupabaseAdminClient();
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    let extractedData: Awaited<
      ReturnType<typeof extractProductDataFromImage>
    >["extractedData"] = {};
    let ocrText = "";
    let confidence = 0;

    try {
      const extraction = await extractProductDataFromImage(buffer, file.type);
      extractedData = extraction.extractedData;
      ocrText = extraction.ocrText;
      confidence = extraction.confidence;
    } catch (error) {
      console.error("Image extraction failed:", error);
      ocrText = "Extraction failed";
    }

    const image = await prisma.productImage.create({
      data: {
        productId,
        organizationId: membership.organizationId,
        uploadedById: user.id,
        storagePath,
        contentType: file.type,
        sizeBytes: file.size,
        ocrText: ocrText || null,
        ocrConfidence: confidence || null,
        extractedData: extractedData as object,
      },
    });

    const existingMetadata =
      product.metadata && typeof product.metadata === "object"
        ? (product.metadata as Record<string, unknown>)
        : {};

    const compositionText = [
      stringValue((extractedData as Record<string, unknown>)?.compositionText),
      stringValue(ocrText),
      stringValue(existingMetadata.compositionText),
    ]
      .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index)
      .join("\n\n")
      .slice(0, 6000);

    const normalizedProductName = String(product.name || "").toLowerCase();
    const nextName =
      (normalizedProductName.startsWith("scanned product") ||
        normalizedProductName.startsWith("label scan")) &&
      (stringValue((extractedData as Record<string, unknown>)?.productName) ||
        stringValue((extractedData as Record<string, unknown>)?.name))
        ? (stringValue((extractedData as Record<string, unknown>)?.productName) ||
            stringValue((extractedData as Record<string, unknown>)?.name))!
        : product.name;

    await prisma.product.update({
      where: { id: productId },
      data: {
        name: nextName,
        description:
          stringValue((extractedData as Record<string, unknown>)?.description) ||
          product.description,
        intendedUse:
          stringValue((extractedData as Record<string, unknown>)?.intendedUse) ||
          product.intendedUse,
        metadata: {
          ...existingMetadata,
          originCountry:
            stringValue((extractedData as Record<string, unknown>)?.originCountry) ||
            stringValue(existingMetadata.originCountry) ||
            null,
          compositionText: compositionText || null,
        } as any,
      },
    });

    if (product.materials.length === 0) {
      const extractedMaterials = extractMaterials(
        (extractedData as Record<string, unknown>)?.materials,
      );

      if (extractedMaterials.length > 0) {
        await prisma.productMaterial.createMany({
          data: extractedMaterials.map((material) => ({
            productId,
            material: material.material,
            percentage: material.percentage,
          })),
          skipDuplicates: true,
        });
      }
    }

    const { data } = await supabase.storage
      .from("product-images")
      .createSignedUrl(storagePath, 3600);

    return NextResponse.json(
      {
        image: {
          ...image,
          signedUrl: data?.signedUrl ?? null,
        },
        extractedData,
        ocrText,
        confidence,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
