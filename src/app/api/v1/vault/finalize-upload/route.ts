import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { VaultTag } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

const finalizeUploadSchema = z.object({
  path: z.string().min(1),
  bucket: z.literal("vault-files").default("vault-files"),
  label: z.string().min(1),
  tag: z.nativeEnum(VaultTag).default(VaultTag.OTHER),
  productId: z.string().cuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, membership } = await requireApiAuth(request);
    const body = await request.json();
    const payload = finalizeUploadSchema.parse(body);

    if (!payload.path.startsWith(`${membership.organizationId}/`)) {
      return jsonWithCors(
        request,
        { error: "Upload path does not belong to the current organization" },
        { status: 403 },
      );
    }

    if (payload.productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: payload.productId,
          organizationId: membership.organizationId,
        },
        select: { id: true },
      });

      if (!product) {
        return jsonWithCors(request, { error: "Product not found" }, { status: 404 });
      }
    }

    const supabase = getSupabaseAdminClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(payload.bucket)
      .download(payload.path);

    if (downloadError || !fileData) {
      throw new Error(downloadError?.message || "Failed to download uploaded file");
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    const existing = await prisma.vaultFile.findFirst({
      where: {
        organizationId: membership.organizationId,
        sha256,
      },
    });

    if (existing) {
      return jsonWithCors(
        request,
        { error: "This file has already been uploaded", fileId: existing.id },
        { status: 409 },
      );
    }

    const contentType =
      fileData.type || request.headers.get("x-upload-content-type") || "application/octet-stream";
    const sizeBytes = buffer.byteLength;

    const file = await prisma.vaultFile.create({
      data: {
        organizationId: membership.organizationId,
        productId: payload.productId || null,
        uploadedById: user.id,
        tag: payload.tag,
        label: payload.label,
        storagePath: payload.path,
        contentType,
        sizeBytes,
        sha256,
        metadata: {
          uploadedVia: "mobile-signed-upload",
          finalizedAt: new Date().toISOString(),
          ...payload.metadata,
        },
      },
    });

    const { data: signedUrlData } = await supabase.storage
      .from(payload.bucket)
      .createSignedUrl(payload.path, 3600);

    return jsonWithCors(
      request,
      {
        file: {
          ...file,
          signedUrl: signedUrlData?.signedUrl ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, request);
  }
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
