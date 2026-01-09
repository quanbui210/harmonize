'use server'

import { prisma } from "@/lib/prisma"
import { classificationUpsertSchema } from "@/lib/validation/classification"

const serializeConfidence = (confidence?: number | null) =>
  confidence === null || confidence === undefined
    ? undefined
    : Number(confidence.toFixed(10))

export async function upsertClassificationAction(input: unknown) {
  const payload = classificationUpsertSchema.parse(input)
  const { classificationId, sources, riskFlags, ...data } = payload

  if (classificationId) {
    return prisma.$transaction(async (tx: any) => {
      const classification = await tx.classification.update({
        where: { id: classificationId },
        data: {
          organizationId: data.organizationId,
          productId: data.productId,
          reviewerId: data.reviewerId,
          market: data.market,
          htsCode: data.htsCode,
          status: data.status,
          confidence: serializeConfidence(data.confidence),
          summary: data.summary,
          reasoningTrail: data.reasoningTrail,
          exclusionNotes: data.exclusionNotes,
          humanNotes: data.humanNotes,
          requiresReview: data.requiresReview ?? false,
        },
      })

      await tx.classificationSource.deleteMany({
        where: { classificationId },
      })

      await tx.riskFlag.deleteMany({
        where: { classificationId },
      })

      if (sources.length) {
        await tx.classificationSource.createMany({
          data: sources.map((source) => ({
            classificationId,
            sourceType: source.sourceType,
            referenceId: source.referenceId,
            excerpt: source.excerpt,
            metadata: source.metadata,
          })),
          skipDuplicates: true,
        })
      }

      if (riskFlags.length) {
        await tx.riskFlag.createMany({
          data: riskFlags.map((flag) => ({
            classificationId,
            riskType: flag.riskType,
            label: flag.label,
            details: flag.details,
          })),
          skipDuplicates: true,
        })
      }

      return classification
    })
  }

  const classification = await prisma.classification.create({
    data: {
      organizationId: data.organizationId,
      productId: data.productId,
      reviewerId: data.reviewerId,
      market: data.market,
      htsCode: data.htsCode,
      status: data.status,
      confidence: serializeConfidence(data.confidence),
      summary: data.summary,
      reasoningTrail: data.reasoningTrail,
      exclusionNotes: data.exclusionNotes,
      humanNotes: data.humanNotes,
      requiresReview: data.requiresReview ?? false,
      sources: sources.length
        ? {
            createMany: {
              data: sources.map((source) => ({
                sourceType: source.sourceType,
                referenceId: source.referenceId,
                excerpt: source.excerpt,
                metadata: source.metadata,
              })),
              skipDuplicates: true,
            },
          }
        : undefined,
      riskFlags: riskFlags.length
        ? {
            createMany: {
              data: riskFlags.map((flag) => ({
                riskType: flag.riskType,
                label: flag.label,
                details: flag.details,
              })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  })

  return classification
}

export async function listClassificationsAction(organizationId: string) {
  if (!organizationId) {
    throw new Error("organizationId is required")
  }

  return prisma.classification.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      product: true,
      dutySummary: true,
      riskFlags: true,
    },
  })
}

