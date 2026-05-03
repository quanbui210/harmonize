import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createProductPayloadSchema } from "@/lib/validation/product";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";
import { serializeProduct } from "@/lib/api/mobile-serializers";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const products = await prisma.product.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        materials: true,
      },
    });

    const serializedProducts = products.map((product) => serializeProduct(product));

    return jsonWithCors(request, { products: serializedProducts });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, membership } = await requireApiAuth(request);
    const body = await request.json();
    const payload = createProductPayloadSchema.parse(body);
    const { createAuditLogEntry } = await import("@/server/actions/audit-log");

    const product = await prisma.product.create({
      data: {
        organizationId: membership.organizationId,
        createdById: user.id,
        name: payload.name,
        description: payload.description,
        intendedUse: payload.intendedUse,
        targetMarkets: payload.targetMarkets,
        metadata: payload.metadata
          ? (payload.metadata as Prisma.InputJsonValue)
          : undefined,
        materials: payload.materials?.length
          ? {
              createMany: {
                data: payload.materials.map((material) => ({
                  material: material.material,
                  percentage: material.percentage,
                })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: {
        materials: true,
      },
    });

    await createAuditLogEntry({
      organizationId: membership.organizationId,
      userId: user.id,
      entityType: "PRODUCT",
      entityId: product.id,
      action: "CREATE",
      payload: {
        productName: product.name,
        targetMarkets: payload.targetMarkets,
      },
    });

    return jsonWithCors(
      request,
      { product: serializeProduct(product) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, request);
  }
}
