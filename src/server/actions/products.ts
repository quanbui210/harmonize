'use server'

import { prisma } from "@/lib/prisma"
import {
  CreateProductInput,
  createProductSchema,
  updateProductSchema,
} from "@/lib/validation/product"
import { createAuditLogEntry } from "@/server/actions/audit-log"
import { Prisma } from "@prisma/client"

function mapMaterialPayload(materials: CreateProductInput["materials"]) {
  if (!materials.length) {
    return undefined
  }

  return {
    createMany: {
      data: materials.map((material) => ({
        material: material.material,
        percentage: material.percentage,
      })),
      skipDuplicates: true,
    },
  }
}

export async function createProductAction(input: unknown) {
  const payload = createProductSchema.parse(input)

  const product = await prisma.product.create({
    data: {
      organizationId: payload.organizationId,
      createdById: payload.createdById,
      name: payload.name,
      description: payload.description,
      intendedUse: payload.intendedUse,
      targetMarkets: payload.targetMarkets,
      metadata: payload.metadata ? (payload.metadata as Prisma.InputJsonValue) : undefined,
      materials: mapMaterialPayload(payload.materials),
    },
    include: {
      materials: true,
    },
  });

  // Log audit entry
  await createAuditLogEntry({
    organizationId: payload.organizationId,
    userId: payload.createdById,
    entityType: "PRODUCT",
    entityId: product.id,
    action: "CREATE",
    payload: {
      productName: product.name,
      targetMarkets: payload.targetMarkets,
    },
  });

  return product;
}

export async function updateProductAction(input: unknown) {
  const payload = updateProductSchema.parse(input)

  return prisma.$transaction(async (tx: any) => {
    const existing = await tx.product.findUniqueOrThrow({
      where: {
        id: payload.productId,
      },
      select: {
        organizationId: true,
      },
    })

    if (existing.organizationId !== payload.organizationId) {
      throw new Error("Product not found in organization")
    }

    await tx.product.update({
      where: { id: payload.productId },
      data: {
        name: payload.name,
        description: payload.description,
        intendedUse: payload.intendedUse,
        targetMarkets: payload.targetMarkets,
        metadata: payload.metadata ? (payload.metadata as Prisma.InputJsonValue) : undefined,
      },
    })

    await tx.productMaterial.deleteMany({
      where: { productId: payload.productId },
    })

    if (payload.materials.length) {
      await tx.productMaterial.createMany({
        data: payload.materials.map((material) => ({
          productId: payload.productId,
          material: material.material,
          percentage: material.percentage,
        })),
        skipDuplicates: true,
      })
    }

    const updated = await tx.product.findUnique({
      where: { id: payload.productId },
      include: { materials: true },
    });

    // Log audit entry (outside transaction to avoid issues)
    // Note: updateProductSchema omits createdById, so we don't have userId for updates
    await createAuditLogEntry({
      organizationId: payload.organizationId,
      userId: undefined, // Update actions don't include userId in schema
      entityType: "PRODUCT",
      entityId: payload.productId,
      action: "UPDATE",
      payload: {
        productName: payload.name,
      },
    });

    return updated;
  });
}

export async function listProductsAction(organizationId: string) {
  if (!organizationId) {
    throw new Error("organizationId is required")
  }

  return prisma.product.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      materials: true,
    },
  })
}

