"use server";

import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";

export interface ExtractedProductData {
  productName?: string;
  description?: string;
  materials?: Array<{ name: string; percentage?: number }>;
  compositionText?: string;
  specifications?: {
    weight?: string;
    dimensions?: string;
    powerSource?: string;
    voltage?: string;
    capacity?: string;
    [key: string]: string | undefined;
  };
  intendedUse?: string;
  originCountry?: string;
}

/**
 * Extract product information from an image using OpenAI Vision
 */
export async function extractProductDataFromImage(
  imageBuffer: Buffer,
  imageMimeType: string
): Promise<{
  extractedData: ExtractedProductData;
  ocrText: string;
  confidence: number;
}> {
  // Convert buffer to base64
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${imageMimeType};base64,${base64Image}`;

    const openai = createFeatureOpenAIClient("Image Extraction");
    const response = await openai.chat.completions.create({
    model: "gpt-4o", // Using gpt-4o for best vision accuracy
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this product image. This could be:
- A product package (e.g., dried mango package, vacuum cleaner box)
- A product label or ingredient list
- A product photo showing the actual item
- A specification sheet

Your task is to:
1. IDENTIFY what product this is (e.g., "dried mango", "robot vacuum cleaner", "cotton t-shirt")
2. EXTRACT all visible product information

Extract the following information if available:
1. Product name (what is this product? Be specific - e.g., "Dried Mango Slices" not just "Mango")
2. Product description (what does it do? what is it made of? key features)
3. Materials/ingredients with percentages (e.g., "70% cotton, 30% polyester" or "stainless steel, lithium battery")
4. Composition text (normalized format)
5. Key specifications:
   - Weight
   - Dimensions
   - Power source (battery, AC, etc.)
   - Voltage
   - Capacity
   - Any other technical specs visible
6. Intended use (what is this product used for? e.g., "household cleaning", "food consumption")
7. Country of origin (if mentioned on label/package)

IMPORTANT FOR PRODUCT IDENTIFICATION:
- Look at the actual product, not just text on labels
- If you see a vacuum cleaner, identify it as "robot vacuum cleaner" or "vacuum cleaner"
- If you see dried fruit, identify the specific type (e.g., "dried mango", "dried apricots")
- Describe what you see: shape, color, function, materials visible
- Use common product names that would be used in customs classification

Return a JSON object with this structure:
{
  "productName": "string or null (specific product name)",
  "description": "string or null (what it is, what it does, key features)",
  "materials": [{"name": "string", "percentage": number or null}],
  "compositionText": "string or null (normalized format like '70% cotton, 30% polyester')",
  "specifications": {
    "weight": "string or null",
    "dimensions": "string or null",
    "powerSource": "string or null",
    "voltage": "string or null",
    "capacity": "string or null"
  },
  "intendedUse": "string or null",
  "originCountry": "string or null"
}

Also provide the raw OCR text extracted from the image.

Important:
- If information is not visible or unclear, use null
- Normalize material percentages (ensure they add up to 100% if possible)
- Extract exact text as it appears, don't interpret or guess
- For compositionText, create a readable format like "70% cotton, 30% polyester" or "stainless steel housing, lithium battery, PCB"
- For productName, be specific about what the product is based on what you see in the image`,
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1, // Low temperature for accuracy
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI Vision");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    console.error("Failed to parse OpenAI JSON response:", content);
    throw new Error("OpenAI returned invalid JSON");
  }

  // Extract OCR text (if provided separately, otherwise use description)
  const ocrText =
    parsed.ocrText ||
    parsed.rawText ||
    `${parsed.productName || ""} ${parsed.description || ""}`.trim();

  // Normalize extracted data
  const extractedData: ExtractedProductData = {
    productName: parsed.productName || undefined,
    description: parsed.description || undefined,
    materials: Array.isArray(parsed.materials)
      ? parsed.materials.map((m: any) => ({
          name: m.name || m.material || "",
          percentage:
            typeof m.percentage === "number"
              ? m.percentage
              : typeof m.percentage === "string"
                ? parseFloat(m.percentage) || undefined
                : undefined,
        }))
      : undefined,
    compositionText: parsed.compositionText || undefined,
    specifications: parsed.specifications || undefined,
    intendedUse: parsed.intendedUse || undefined,
    originCountry: parsed.originCountry || undefined,
  };

  // Calculate confidence based on how much data was extracted
  const fieldsExtracted = [
    extractedData.productName,
    extractedData.description,
    extractedData.compositionText,
    extractedData.materials?.length,
    Object.keys(extractedData.specifications || {}).length,
  ].filter(Boolean).length;

  const confidence = Math.min(0.5 + fieldsExtracted * 0.1, 0.95); // 0.5-0.95 range

  return {
    extractedData,
    ocrText,
    confidence,
  };
}

