"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";

export async function getAuditLogsAction(input: {
  organizationId: string;
  limit?: number;
  offset?: number;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new Error("Unauthorized");
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: input.organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: input.limit || 100,
    skip: input.offset || 0,
  });

  return logs;
}

/**
 * Helper function to create audit log entries
 * This should be called from server actions when important events occur
 */
export async function createAuditLogEntry(input: {
  organizationId: string;
  userId?: string;
  entityType: string; // e.g., "CLASSIFICATION", "DOSSIER", "VAULT_FILE", "PRODUCT"
  entityId: string;
  action: string; // e.g., "CREATE", "UPDATE", "DELETE", "GENERATE", "EXPORT"
  payload?: Record<string, any>;
}) {
  try {
    const result = await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId || null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        payload: input.payload || undefined,
      },
    });
    console.log("✅ Audit log entry created:", result.id, input.action, input.entityType);
    return result;
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    // But log more details to help debug
    console.error(" Failed to create audit log entry:", {
      error: error instanceof Error ? error.message : String(error),
      input: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
      },
    });
    return null;
  }
}

