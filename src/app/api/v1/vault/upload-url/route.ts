import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const createUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  scope: z.enum(["vault", "product-image"]).default("vault"),
});

export async function POST(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const body = await request.json();
    const payload = createUploadUrlSchema.parse(body);

    const extension = payload.fileName.split(".").pop() || "bin";
    const folder =
      payload.scope === "product-image" ? "product-images" : "vault-uploads";
    const bucket =
      payload.scope === "product-image" ? "product-images" : "vault-files";
    const storagePath = `${membership.organizationId}/${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${extension}`;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(error?.message || "Failed to create signed upload URL");
    }

    return NextResponse.json({
      bucket,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      contentType: payload.contentType,
      finalizeRequired: payload.scope === "vault",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
