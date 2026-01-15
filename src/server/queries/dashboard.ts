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
  // Handle orphaned classifications (where product was deleted) by using raw query or filtering
  let actionItems: any[] = [];
  let activeImports: any[] = [];
  
  try {
    // First, get product IDs that exist
    const existingProductIds = await prisma.product.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const productIdSet = new Set(existingProductIds.map(p => p.id));
    
    // Get classifications and filter by existing products
    const allActionItems = await prisma.classification.findMany({
      where: {
        organizationId,
        productId: {
          in: Array.from(productIdSet),
        },
      },
      include: {
        product: true,
        dossier: true,
        dutySummary: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 12,
    });
    
    actionItems = allActionItems;

    const allActiveImportsData = await prisma.classification.findMany({
      where: { 
        organizationId,
        productId: {
          in: Array.from(productIdSet),
        },
      },
      include: { product: true },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });
    
    activeImports = allActiveImportsData;
  } catch (error) {
    // Fallback: if there's an error, return empty arrays
    console.error("Error fetching dashboard classifications:", error);
    actionItems = [];
    activeImports = [];
  }

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

