import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { updateProductPayloadSchema } from "@/lib/validation/product";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";
import { serializeProduct } from "@/lib/api/mobile-serializers";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
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
        images: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!product) {
      return jsonWithCors(request, { error: "Product not found" }, { status: 404 });
    }

    const supabase = getSupabaseAdminClient();
    const images = await Promise.all(
      product.images.map(async (image) => {
        const { data } = await supabase.storage
          .from("product-images")
          .createSignedUrl(image.storagePath, 3600);

        return {
          ...image,
          signedUrl: data?.signedUrl ?? null,
        };
      }),
    );

    return jsonWithCors(request, {
      product: serializeProduct({
        ...product,
        images,
      }),
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { productId } = await params;
    const body = await request.json();
    const payload = updateProductPayloadSchema.parse(body);

    const existing = await prisma.product.findFirst({
      where: {
        id: productId,
        organizationId: membership.organizationId,
      },
      select: { id: true },
    });

    if (!existing) {
      return jsonWithCors(request, { error: "Product not found" }, { status: 404 });
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        name: payload.name,
        description: payload.description,
        intendedUse: payload.intendedUse,
        targetMarkets: payload.targetMarkets,
        metadata: payload.metadata
          ? (payload.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await prisma.productMaterial.deleteMany({
      where: { productId },
    });

    if (payload.materials.length) {
      await prisma.productMaterial.createMany({
        data: payload.materials.map((material) => ({
          productId,
          material: material.material,
          percentage: material.percentage,
        })),
        skipDuplicates: true,
      });
    }

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { materials: true },
    });

    return jsonWithCors(request, { product: serializeProduct(product) });
  } catch (error) {
    return handleApiError(error, request);
  }
}
