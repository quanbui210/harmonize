import { ClassificationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export async function getDashboardOverview(organizationId: string) {
  const [approvedCount, pendingCount, missingReasonings, autoClassified] =
    await Promise.all([
      prisma.classification.count({
        where: { organizationId, status: ClassificationStatus.APPROVED },
      }),
      prisma.classification.count({
        where: {
          organizationId,
          status: { in: [ClassificationStatus.DRAFT, ClassificationStatus.NEEDS_REVIEW] },
        },
      }),
      prisma.classification.count({
        where: {
          organizationId,
          dossier: null,
        },
      }),
      prisma.classification.count({
        where: {
          organizationId,
          requiresReview: false,
        },
      }),
    ])

  const rulingsMatched = await prisma.classificationSource.count({
    where: {
      sourceType: "BINDING_RULING",
      classification: {
        organizationId,
      },
    },
  })

  const actionItems = await prisma.classification.findMany({
    where: {
      organizationId,
      OR: [{ dossier: null }, { status: { not: ClassificationStatus.APPROVED } }],
    },
    include: {
      product: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 5,
  })

  const activeImports = await prisma.classification.findMany({
    where: { organizationId },
    include: { product: true },
    orderBy: {
      createdAt: "desc",
    },
    take: 3,
  })

  const quickRulings = await prisma.bindingRuling.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    take: 3,
  })

  const totalReviewed = approvedCount + pendingCount
  const auditReadinessScore =
    totalReviewed === 0
      ? 0
      : Math.round((approvedCount / totalReviewed) * 100)

  return {
    auditReadinessScore,
    approvedCount,
    pendingCount,
    missingReasonings,
    autoClassified,
    rulingsMatched,
    actionItems,
    activeImports,
    quickRulings,
  }
}

