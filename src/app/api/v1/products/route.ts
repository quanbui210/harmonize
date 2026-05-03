import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createProductPayloadSchema } from "@/lib/validation/product";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";
import { serializeProduct } from "@/lib/api/mobile-serializers";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function resolveLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseCursor(value: string | null) {
  if (!value) return null;
  const [createdAtText, id] = value.split("|");
  if (!createdAtText || !id) {
    throw new Error("Invalid cursor");
  }
  const createdAt = new Date(createdAtText);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("Invalid cursor");
  }
  return { createdAt, id };
}

function makeCursor(value: { createdAt: Date; id: string }) {
  return `${value.createdAt.toISOString()}|${value.id}`;
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const limit = resolveLimit(request.nextUrl.searchParams.get("limit"));
    const cursor = parseCursor(request.nextUrl.searchParams.get("cursor"));
    const products = await prisma.product.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        materials: true,
      },
    });

    const hasMore = products.length > limit;
    const pageItems = hasMore ? products.slice(0, limit) : products;
    const serializedProducts = pageItems.map((product) => serializeProduct(product));
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem ? makeCursor(lastItem) : null;

    return jsonWithCors(request, {
      items: serializedProducts,
      nextCursor,
      hasMore,
    });
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
