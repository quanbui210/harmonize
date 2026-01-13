"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { extractProductDataFromImage } from "@/lib/vision/image-extraction-service";
import { createHash } from "crypto";

export interface UploadImageResult {
  imageId: string;
  extractedData: {
    productName?: string;
    description?: string;
    materials?: Array<{ name: string; percentage?: number }>;
    compositionText?: string;
    specifications?: Record<string, string>;
    intendedUse?: string;
    originCountry?: string;
  };
  ocrText: string;
  confidence: number;
}

/**
 * Upload product image and extract data using Vision AI
 */
export async function uploadProductImageAction(
  formData: FormData
): Promise<UploadImageResult> {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    throw new Error("No organization found");
  }

  const file = formData.get("image") as File;
  if (!file) {
    throw new Error("No image file provided");
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      `Invalid file type. Allowed: ${allowedTypes.join(", ")}`
    );
  }

  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error("File size exceeds 10MB limit");
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Calculate SHA-256 hash
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // Upload to Supabase Storage
  const supabase = getSupabaseAdminClient();
  const fileExtension = file.name.split(".").pop() || "jpg";
  const storagePath = `${membership.organizationId}/product-images/${Date.now()}-${sha256.substring(0, 8)}.${fileExtension}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // Check if bucket doesn't exist
    if (
      uploadError.message?.includes("not found") ||
      uploadError.message?.includes("Bucket")
    ) {
      throw new Error(
        `Storage bucket 'product-images' not found. Please create it in Supabase Storage → Buckets.`
      );
    }
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  // Extract data using Vision AI
  let extractedData;
  let ocrText = "";
  let confidence = 0;

  try {
    const extractionResult = await extractProductDataFromImage(
      buffer,
      file.type
    );
    extractedData = extractionResult.extractedData;
    ocrText = extractionResult.ocrText;
    confidence = extractionResult.confidence;
  } catch (error: any) {
    console.error("Vision extraction error:", error);
    // Continue even if extraction fails - user can still use the image
    extractedData = {};
    ocrText = "Extraction failed";
    confidence = 0;
  }

  // Save to database
  const productImage = await prisma.productImage.create({
    data: {
      organizationId: membership.organizationId,
      uploadedById: user.id,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      ocrText: ocrText || null,
      ocrConfidence: confidence > 0 ? confidence : null,
      extractedData: extractedData ? (extractedData as any) : null,
    },
  });

  // Filter out undefined values from specifications
  const specifications = extractedData?.specifications
    ? Object.fromEntries(
        Object.entries(extractedData.specifications).filter(
          ([_, value]) => value !== undefined
        )
      )
    : undefined;

  return {
    imageId: productImage.id,
    extractedData: {
      productName: extractedData?.productName,
      description: extractedData?.description,
      materials: extractedData?.materials,
      compositionText: extractedData?.compositionText,
      specifications: specifications as Record<string, string> | undefined,
      intendedUse: extractedData?.intendedUse,
      originCountry: extractedData?.originCountry,
    },
    ocrText,
    confidence,
  };
}

