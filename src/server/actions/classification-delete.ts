"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAuditLogEntry } from "@/server/actions/audit-log";

export async function deleteClassificationAction(classificationId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  // Verify the classification belongs to the user's organization
  const classification = await prisma.classification.findFirst({
    where: {
      id: classificationId,
      organizationId: membership.organizationId,
    },
    include: {
      product: {
        include: {
          _count: {
            select: {
              classifications: true,
            },
          },
        },
      },
      dossier: true,
    },
  });

  if (!classification) {
    throw new Error("Classification not found or access denied");
  }

  // Delete dossier from storage if it exists
  if (classification.dossier) {
    const supabase = getSupabaseAdminClient();
    try {
      await supabase.storage
        .from("dossiers")
        .remove([classification.dossier.storagePath]);
    } catch (error) {
      console.error("Failed to delete dossier from storage:", error);
      // Continue with deletion even if storage deletion fails
    }
  }

  // Delete related records
  await prisma.$transaction(async (tx) => {
    // Delete classification sources
    await tx.classificationSource.deleteMany({
      where: { classificationId },
    });

    // Delete risk flags
    await tx.riskFlag.deleteMany({
      where: { classificationId },
    });

    // Delete duty summary
    await tx.dutySummary.deleteMany({
      where: { classificationId },
    });

    // Delete dossier record
    if (classification.dossier) {
      await tx.dossier.delete({
        where: { id: classification.dossier.id },
      });
    }

    // Delete the classification
    await tx.classification.delete({
      where: { id: classificationId },
    });

    // Delete the product if it has no other classifications
    if (classification.product._count.classifications === 1) {
      // This is the only classification, so delete the product and its materials
      await tx.productMaterial.deleteMany({
        where: { productId: classification.product.id },
      });
      await tx.product.delete({
        where: { id: classification.product.id },
      });
    }
  });

  // Log audit entry
  await createAuditLogEntry({
    organizationId: membership.organizationId,
    userId: user.id,
    entityType: "CLASSIFICATION",
    entityId: classificationId,
    action: "DELETE",
    payload: {
      productName: classification.product.name,
      htsCode: classification.htsCode,
      market: classification.market,
    },
  });

  revalidatePath("/classify");
  revalidatePath("/dashboard");

  return { success: true };
}

