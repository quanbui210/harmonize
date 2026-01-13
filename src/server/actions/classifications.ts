'use server'

import { prisma } from "@/lib/prisma"
import { classificationUpsertSchema } from "@/lib/validation/classification"
import { createAuditLogEntry } from "@/server/actions/audit-log"
import { ClassificationStatus, Prisma, RiskType } from "@prisma/client"
import { requireAuthenticatedUser } from "@/lib/supabase/auth"
import { getPrimaryMembership } from "@/server/queries/organizations"

const serializeConfidence = (confidence?: number | null) =>
  confidence === null || confidence === undefined
    ? undefined
    : Number(confidence.toFixed(10))

export async function upsertClassificationAction(input: unknown) {
  const payload = classificationUpsertSchema.parse(input)
  const { classificationId, sources, riskFlags, ...data } = payload

  if (classificationId) {
    return prisma.$transaction(async (tx: any) => {
      // Extract HS code from HTS code if provided
      const hsCode = data.htsCode ? data.htsCode.substring(0, 6) : null;
      
      const classification = await tx.classification.update({
        where: { id: classificationId },
        data: {
          organizationId: data.organizationId,
          productId: data.productId,
          reviewerId: data.reviewerId,
          market: data.market,
          hsCode: hsCode,
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
            metadata: source.metadata ? (source.metadata as Prisma.InputJsonValue) : undefined,
          })),
          skipDuplicates: true,
        })
      }

      if (riskFlags.length) {
        await tx.riskFlag.createMany({
          data: riskFlags.map((flag) => ({
            classificationId,
            riskType: flag.riskType as RiskType,
            label: flag.label,
            details: flag.details,
          })),
          skipDuplicates: true,
        })
      }

      // Log audit entry
      await createAuditLogEntry({
        organizationId: data.organizationId,
        userId: data.reviewerId || undefined,
        entityType: "CLASSIFICATION",
        entityId: classificationId,
        action: "UPDATE",
        payload: {
          htsCode: data.htsCode,
          status: data.status,
          market: data.market,
        },
      });

      return classification
    })
  }

  // Extract HS code from HTS code if provided
  const hsCode = data.htsCode ? data.htsCode.substring(0, 6) : null;
  
  const classification = await prisma.classification.create({
    data: {
      organizationId: data.organizationId,
      productId: data.productId,
      reviewerId: data.reviewerId,
      market: data.market,
      hsCode: hsCode,
      htsCode: data.htsCode,
      status: data.status as ClassificationStatus | undefined,
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
                metadata: source.metadata ? (source.metadata as Prisma.InputJsonValue) : undefined,
              })),
              skipDuplicates: true,
            },
          }
        : undefined,
      riskFlags: riskFlags.length
        ? {
            createMany: {
              data: riskFlags.map((flag) => ({
                riskType: flag.riskType as RiskType,
                label: flag.label,
                details: flag.details,
              })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  });

  // Log audit entry
  await createAuditLogEntry({
    organizationId: data.organizationId,
    userId: data.reviewerId || undefined,
    entityType: "CLASSIFICATION",
    entityId: classification.id,
    action: "CREATE",
    payload: {
      htsCode: data.htsCode,
      status: data.status,
      market: data.market,
    },
  });

  return classification;
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

export async function getClassificationAction(classificationId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  
  if (!membership?.organizationId) {
    throw new Error("User must belong to an organization");
  }

  const classification = await prisma.classification.findFirst({
    where: {
      id: classificationId,
      organizationId: membership.organizationId,
    },
    include: {
      product: true,
      dutySummary: true,
    },
  });

  if (!classification) {
    throw new Error("Classification not found");
  }

  return classification;
}

export async function getClassificationsForLabelAction() {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  
  if (!membership?.organizationId) {
    throw new Error("User must belong to an organization");
  }

  const classifications = await prisma.classification.findMany({
    where: {
      organizationId: membership.organizationId,
    },
    include: {
      product: true,
      dutySummary: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 100, // Limit to recent classifications
  });

  return classifications.map((c) => ({
    id: c.id,
    productName: c.product.name,
    cnCode: c.htsCode?.substring(0, 8) || "",
    description: c.product.description || "",
    originCountry: (c.product.metadata as any)?.originCountry || "",
    htsCode: c.htsCode || "",
    createdAt: c.createdAt,
  }));
}

