"use server";

import { generateCompliantLabel } from "@/lib/labeling/label-generator";
import { generateEnhancedLabel, type EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { generateLabelPDF, generateLabelSVG } from "@/lib/labeling/label-renderer";
import {
  calculateComplianceScore,
  runComplianceChecks,
  type LabelData,
} from "@/lib/labeling/compliance-checker";
import { getRegulatoryProductType } from "@/lib/regulatory/product-type";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import OpenAI from "openai";

export interface GenerateLabelInput {
  productName: string;
  description?: string;
  originCountry?: string;
  destinationCountry?: string;
  cnCode?: string;
  originalLabelText?: string;
  nutrition?: {
    energy?: number;
    fat?: number;
    carbs?: number;
    protein?: number;
    salt?: number;
  };
  productCategory?: string; // user-selected category (e.g., food, electronics, textiles)
  labelSize?: {
    width: number; // mm
    height: number; // mm
  };
  importerAddress?: string; // EU importer address provided by user
  bestBeforeDate?: string; // Best before date (YYYY-MM-DD)
  netQuantity?: string; // Net quantity in grams
}

export async function generateLabelAction(
  input: GenerateLabelInput,
): Promise<{
  label: EnhancedLabelData;
  complianceScore: number;
  complianceResults: ReturnType<typeof runComplianceChecks>;
}> {
  await requireAuthenticatedUser();

  const productType = resolveProductType(input.productCategory, input.cnCode);
  const labelSize = input.labelSize || { width: 100, height: 150 };

  // Use enhanced generator with RAG validation
  const label = await generateEnhancedLabel(
    {
      name: input.productName,
      description: input.description || "",
      originalIngredients: input.originalLabelText,
      nutrition: input.nutrition,
      originCountry: input.originCountry,
      cnCode: input.cnCode,
      productCategory: input.productCategory || "food",
      importerAddress: input.importerAddress, // Pass user-provided address
      bestBeforeDate: input.bestBeforeDate,
      netQuantity: input.netQuantity,
    },
    labelSize,
  );

  // Convert to LabelData for compliance checks
  const labelDataForChecks: LabelData = {
    productName: label.productName,
    ingredients: label.ingredients,
    nutritionInfo: label.nutritionInfo || {
      energy: 0,
      fat: 0,
      carbs: 0,
      protein: 0,
      salt: 0,
    },
    warnings: label.warnings,
    importerAddress: label.importerAddress || "",
    bestBeforeDate: label.bestBeforeDate || "",
    labelDimensions: label.labelDimensions,
    fontSize: label.fontSize,
  };

  const complianceResults = runComplianceChecks(labelDataForChecks, productType);
  const complianceScore = calculateComplianceScore(complianceResults);

  return {
    label,
    complianceScore,
    complianceResults,
  };
}

export async function exportLabelPDFAction(
  labelData: EnhancedLabelData,
  productCategory: string,
): Promise<Uint8Array> {
  await requireAuthenticatedUser();
  return await generateLabelPDF(labelData, productCategory);
}

export async function exportLabelSVGAction(
  labelData: EnhancedLabelData,
  productCategory: string,
): Promise<string> {
  await requireAuthenticatedUser();
  return generateLabelSVG(labelData, productCategory);
}

function resolveProductType(
  category?: string,
  cnCode?: string,
): ReturnType<typeof getRegulatoryProductType> {
  const normalized = (category || "").toLowerCase();
  if (normalized.includes("food") || normalized.includes("beverage") || normalized.includes("drink") || normalized.includes("meat") || normalized.includes("dried") || normalized.includes("snack")) {
    return "FOOD";
  }
  if (normalized.includes("cosmetic")) {
    return "COSMETICS";
  }
  if (normalized.includes("toy")) {
    return "TOYS";
  }
  if (
    normalized.includes("electronic") ||
    normalized.includes("appliance") ||
    normalized.includes("battery") ||
    normalized.includes("machinery") ||
    normalized.includes("device")
  ) {
    return "ELECTRONICS";
  }
  // fallback to CN-based inference or GENERAL
  return cnCode ? getRegulatoryProductType(cnCode) : "GENERAL";
}

export async function extractLabelTextAction(imageBase64: string): Promise<string> {
  await requireAuthenticatedUser();
  if (!imageBase64) {
    throw new Error("No image provided");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert OCR assistant. Extract the full label text from the image and identify key information. Return a JSON object with: { text: 'full label text', bestBeforeDate: 'YYYY-MM-DD or empty string if not found', netQuantity: 'number with unit like 200g or empty string if not found' }.",
      },
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: `Extract all readable text from this label image. Also identify:
1. Best Before Date: Look for "BEST BEFORE", "USE BY", "EXP", "EXPIRY", or similar. Extract the date and format as YYYY-MM-DD. If no date is found or only text like "BEST BEFORE:" without a date, return empty string.
2. Net Quantity: Look for weight/volume like "200g", "500ml", "240g", "1kg", etc. Return the full value with unit (e.g., "240g"). If not found, return empty string.

Return JSON only in this exact format:
{
  "text": "full extracted text",
  "bestBeforeDate": "YYYY-MM-DD or empty string",
  "netQuantity": "value with unit or empty string"
}` 
          },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      },
    ],
    temperature: 0,
  });

  let content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OCR failed to return text");
  }
  
  // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
  content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  
  // Try to parse as JSON first (for structured data)
  try {
    const parsed = JSON.parse(content);
    if (parsed.text) {
      // Return JSON string with structured data
      return JSON.stringify({
        text: parsed.text,
        bestBeforeDate: parsed.bestBeforeDate || "",
        netQuantity: parsed.netQuantity || "",
      });
    }
  } catch {
    // If not JSON, return as plain text wrapped in JSON (backward compatibility)
    return JSON.stringify({ text: content, bestBeforeDate: "", netQuantity: "" });
  }
  
  // Fallback: return content as plain text wrapped in JSON
  return JSON.stringify({ text: content, bestBeforeDate: "", netQuantity: "" });
}

export interface SaveLabelInput {
  labelData: EnhancedLabelData;
  complianceScore: number;
  complianceResults: ReturnType<typeof runComplianceChecks>;
  productName: string;
  productCategory?: string;
  originCountry?: string;
  destinationCountry?: string;
  cnCode?: string;
  classificationId?: string;
}

export async function saveLabelAction(input: SaveLabelInput): Promise<string> {
  const user = await requireAuthenticatedUser();
  
  // Get user's organization via membership
  const membership = await getPrimaryMembership(user.id);
  if (!membership?.organizationId) {
    throw new Error("User must belong to an organization");
  }

  // Save label to database with metadata
  const labelDataWithMetadata = {
    ...input.labelData,
    productName: input.productName,
    productCategory: input.productCategory,
    originCountry: input.originCountry,
    destinationCountry: input.destinationCountry,
    cnCode: input.cnCode,
    complianceResults: input.complianceResults,
  };

  const label = await prisma.label.create({
    data: {
      organizationId: membership.organizationId,
      classificationId: input.classificationId || null,
      labelData: labelDataWithMetadata as any, // JSON field
      complianceScore: input.complianceScore,
      isDraft: false,
      version: 1,
    },
  });

  return label.id;
}

export async function getLabelAction(labelId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  
  if (!membership?.organizationId) {
    throw new Error("User must belong to an organization");
  }

  const label = await prisma.label.findFirst({
    where: {
      id: labelId,
      organizationId: membership.organizationId,
    },
  });

  if (!label) {
    throw new Error("Label not found");
  }

  return label;
}

export async function getProductImagesForClassificationAction(classificationId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  
  if (!membership?.organizationId) {
    throw new Error("User must belong to an organization");
  }

  // Get classification with product
  const classification = await prisma.classification.findFirst({
    where: {
      id: classificationId,
      organizationId: membership.organizationId,
    },
    include: {
      product: {
        include: {
          images: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!classification) {
    throw new Error("Classification not found");
  }

  // Only get images that are directly linked to this product
  // This ensures we only show images belonging to the selected classification
  const productImages = classification.product.images || [];

  if (productImages.length === 0) {
    return [];
  }

  // Get signed URLs for images
  const supabase = getSupabaseAdminClient();
  const imagesWithUrls = await Promise.all(
    productImages.map(async (image) => {
      const { data } = await supabase.storage
        .from("product-images")
        .createSignedUrl(image.storagePath, 3600); // 1 hour expiry

      return {
        id: image.id,
        url: data?.signedUrl || null,
        ocrText: image.ocrText,
        createdAt: image.createdAt,
      };
    })
  );

  return imagesWithUrls.filter((img) => img.url !== null);
}

