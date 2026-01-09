'use server'

import { prisma } from "@/lib/prisma"
import {
  CreateProductInput,
  createProductSchema,
  updateProductSchema,
} from "@/lib/validation/product"

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
      metadata: payload.metadata,
      materials: mapMaterialPayload(payload.materials),
    },
    include: {
      materials: true,
    },
  })

  return product
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
        metadata: payload.metadata,
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

    return tx.product.findUnique({
      where: { id: payload.productId },
      include: { materials: true },
    })
  })
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

