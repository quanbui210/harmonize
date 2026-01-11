"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { VaultTag } from "@prisma/client";
import { createHash } from "crypto";
import { createAuditLogEntry } from "@/server/actions/audit-log";
// Note: JSZip needs to be installed: npm install jszip
// For now, we'll use a simpler approach with native Node.js

export async function getVaultFilesAction(input: { organizationId: string }) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new Error("Unauthorized");
  }

  return prisma.vaultFile.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getComplianceStatusAction(input: { organizationId: string }) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new Error("Unauthorized");
  }

  // Check HTS Logic Tree Analysis: Has classifications with dossiers
  const hasDossiers = await prisma.classification.count({
    where: {
      organizationId: input.organizationId,
      dossier: { isNot: null },
    },
  }) > 0;

  // Check Supplier MSDS: Has files with LAB_TEST tag
  const hasMSDS = await prisma.vaultFile.count({
    where: {
      organizationId: input.organizationId,
      tag: "LAB_TEST",
    },
  }) > 0;

  // Check Factory Evidence: Has files with SPEC tag
  const hasFactoryEvidence = await prisma.vaultFile.count({
    where: {
      organizationId: input.organizationId,
      tag: "SPEC",
    },
  }) > 0;

  return {
    htsLogicTreeAnalysis: hasDossiers,
    supplierMSDS: hasMSDS,
    factoryEvidence: hasFactoryEvidence,
  };
}

export async function updateVaultFileTagAction(input: {
  fileId: string;
  organizationId: string;
  tag: VaultTag;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new Error("Unauthorized");
  }

  // Verify file belongs to organization
  const file = await prisma.vaultFile.findFirst({
    where: {
      id: input.fileId,
      organizationId: input.organizationId,
    },
  });

  if (!file) {
    throw new Error("File not found");
  }

  const updatedFile = await prisma.vaultFile.update({
    where: { id: input.fileId },
    data: { tag: input.tag },
  });

  // Log audit entry
  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: user.id,
    entityType: "VAULT_FILE",
    entityId: input.fileId,
    action: "UPDATE",
    payload: {
      fileName: updatedFile.label,
      oldTag: file.tag,
      newTag: input.tag,
    },
  });

  return updatedFile;
}

export async function generateSupplierLinkAction(input: {
  organizationId: string;
}): Promise<string> {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new Error("Unauthorized");
  }

  const token = createHash("sha256")
    .update(`${input.organizationId}-${Date.now()}-${Math.random()}`)
    .digest("hex")
    .substring(0, 32);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${baseUrl}/vault/upload/${token}?org=${input.organizationId}`;

  // Log audit entry
  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: user.id,
    entityType: "SUPPLIER_LINK",
    entityId: token,
    action: "GENERATE",
    payload: {
      token: token.substring(0, 8),
    },
  });

  return link;
}

export async function exportAuditPackageAction(input: {
  organizationId: string;
}): Promise<string | null> {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new Error("Unauthorized");
  }

  const [classifications, files] = await Promise.all([
    prisma.classification.findMany({
      where: { organizationId: input.organizationId },
      include: {
        product: true,
        dossier: true,
        sources: true,
        dutySummary: true,
      },
    }),
    prisma.vaultFile.findMany({
      where: { organizationId: input.organizationId },
    }),
  ]);

  // TODO: Install jszip: npm install jszip @types/jszip
  // For now, create a manifest file and return a placeholder
  const supabase = getSupabaseAdminClient();

  const manifest = {
    exportedAt: new Date().toISOString(),
    organizationId: input.organizationId,
    classifications: classifications.map((c) => ({
      productName: c.product.name,
      htsCode: c.htsCode,
      market: c.market,
      status: c.status,
      dossierPath: c.dossier?.storagePath,
    })),
    files: files.map((f) => ({
      label: f.label,
      tag: f.tag,
      sha256: f.sha256,
      storagePath: f.storagePath,
    })),
  };

  // Store manifest as JSON file for now
  // In production, use JSZip to create a proper zip file
  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
  const manifestHash = createHash("sha256").update(manifestBuffer).digest("hex");

  const storagePath = `${input.organizationId}/audit-packages/${Date.now()}-${manifestHash.substring(0, 8)}.json`;

  const { error } = await supabase.storage
    .from("audit-packages")
    .upload(storagePath, manifestBuffer, {
      contentType: "application/json",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload audit package: ${error.message}`);
  }

  const { data } = await supabase.storage
    .from("audit-packages")
    .createSignedUrl(storagePath, 3600);

  // Log audit entry
  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: user.id,
    entityType: "AUDIT_PACKAGE",
    entityId: storagePath,
    action: "EXPORT",
    payload: {
      classificationsCount: classifications.length,
      filesCount: files.length,
      storagePath,
    },
  });

  return data?.signedUrl || null;
}

/**
 * Upload file from supplier via secure link
 * This is a public action (no auth required) - secured by token in URL
 * 
 * NOTE: Token validation should be added in production to verify the token
 * matches the organizationId. For now, we trust the organizationId from the URL.
 */
export async function uploadSupplierFileAction(formData: FormData) {
  const file = formData.get("file") as File;
  const token = formData.get("token") as string;
  const organizationId = formData.get("organizationId") as string;
  const label = formData.get("label") as string || file.name;
  const tag = (formData.get("tag") as string) || "OTHER";

  if (!file || !organizationId || !token) {
    throw new Error("Missing required fields");
  }

  // Validate organizationId exists
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new Error("Invalid organization");
  }

  // Validate file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error("File size exceeds 50MB limit");
  }

  // Calculate SHA-256 hash
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // Check if file already exists (by hash)
  const existingFile = await prisma.vaultFile.findFirst({
    where: {
      sha256,
      organizationId,
    },
  });

  if (existingFile) {
    throw new Error("This file has already been uploaded");
  }

  // Upload to Supabase storage using admin client (bypasses RLS for public uploads)
  const supabase = getSupabaseAdminClient();
  const fileExtension = file.name.split(".").pop() || "bin";
  const storagePath = `${organizationId}/supplier-uploads/${Date.now()}-${sha256.substring(0, 8)}.${fileExtension}`;

  const { error: uploadError } = await supabase.storage
    .from("vault-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Save file record to database
  // Note: uploadedById is null since supplier is not authenticated
  const vaultFile = await prisma.vaultFile.create({
    data: {
      organizationId,
      tag: tag as VaultTag,
      label,
      storagePath,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      sha256,
      uploadedById: null, // Supplier uploads don't have a user ID
      metadata: {
        uploadedVia: "supplier-link",
        token: token.substring(0, 8), // Store partial token for reference
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      } as any,
    },
  });

  // Log audit entry
  await createAuditLogEntry({
    organizationId,
    userId: null, // Supplier uploads don't have user ID
    entityType: "VAULT_FILE",
    entityId: vaultFile.id,
    action: "UPLOAD",
    payload: {
      fileName: file.name,
      tag,
      sizeBytes: file.size,
      uploadedVia: "supplier-link",
    },
  });

  return { success: true, fileName: file.name };
}

