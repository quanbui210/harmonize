import { ClassificationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export async function getDashboardOverview(organizationId: string) {
  const [missingReasonings, autoClassified] =
    await Promise.all([
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

  // Calculate audit readiness based on classifications with dossiers
  const totalWithDossiers = await prisma.classification.count({
    where: {
      organizationId,
      dossier: { isNot: null }, // Has a dossier
    },
  })

  const totalClassifications = await prisma.classification.count({
    where: { organizationId },
  })

  const approvedCount = totalWithDossiers // Classifications with dossiers are "approved"
  const pendingCount = totalClassifications - totalWithDossiers // Classifications without dossiers are "pending"

  const rulingsMatched = await prisma.classificationSource.count({
    where: {
      sourceType: "BINDING_RULING",
      classification: {
        organizationId,
      },
    },
  })

  // Get recent classifications for dashboard (limited to 12, use "View all" for more)
  const actionItems = await prisma.classification.findMany({
    where: {
      organizationId,
    },
    include: {
      product: true,
      dossier: true, // Include dossier relation to check if it exists
      dutySummary: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 12, // Limit to 12 items on dashboard
  })

  const activeImports = await prisma.classification.findMany({
    where: { organizationId },
    include: { product: true },
    orderBy: {
      createdAt: "desc",
    },
    take: 3,
  })

  // Get recent active shipments (not cancelled)
  const recentShipments = await (prisma as any).shipment.findMany({
    where: {
      organizationId,
      status: {
        not: "CANCELLED",
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
        take: 1, // Just get count
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 3,
  })

  const auditReadinessScore =
    totalClassifications === 0
      ? 0
      : Math.round((totalWithDossiers / totalClassifications) * 100)

  return {
    auditReadinessScore,
    approvedCount,
    pendingCount,
    missingReasonings,
    autoClassified,
    rulingsMatched,
    actionItems,
    activeImports,
    recentShipments,
  }
}

