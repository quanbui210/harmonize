/**
 * AI-powered label generator with Finnish/Swedish translation
 * Uses RAG to search regulatory documents for accurate requirements
 */

import OpenAI from "openai";
import { searchRegulatoryDocuments } from "@/lib/rag/regulatory-search";
import { getRegulatoryProductType } from "@/lib/regulatory/product-type";
import type { LabelData } from "./compliance-checker";
import type { RegulatoryProductType } from "@/lib/regulatory/product-type";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProductData {
  name: string;
  description: string;
  originalIngredients?: string;
  nutrition?: {
    energy?: number;
    fat?: number;
    carbs?: number;
    protein?: number;
    salt?: number;
  };
  originCountry?: string;
  cnCode?: string;
}

/**
 * Generate compliant label using AI + RAG
 */
export async function generateCompliantLabel(
  product: ProductData,
  cnCode?: string
): Promise<LabelData> {
  // Determine product type from CN code
  const productType = cnCode ? getRegulatoryProductType(cnCode) : "GENERAL";

  // Search regulatory documents for relevant requirements
  const regulatoryChunks = await searchRegulatoryDocuments({
    productType,
    query: `Labeling requirements for ${product.name}. Ingredients: ${product.originalIngredients || "not specified"}`,
    language: "EN",
    maxResults: 5,
  });

  const systemPrompt = `You are a food labeling expert specializing in EU and Finnish regulations. 
You must generate a compliant label based on:
1. Product information provided
2. Regulatory requirements from Ruokavirasto Guide 17068/2
3. Regulation (EU) No 1169/2011

CRITICAL RULES:
- Labels MUST be in Finnish AND Swedish
- QUID percentages required if ingredient in product name
- High salt warning (>1.2%) must include "Voimakassuolainen / Kraftigt saltad"
- Allergens must be visually distinct
- EU importer address required
- E-codes must include functional class
- Font x-height must be ≥1.2mm

Use the provided regulatory chunks as your source of truth.`;

  const regulatoryContext = regulatoryChunks.length > 0
    ? `\n\nRegulatory Requirements:\n${regulatoryChunks.map(chunk => 
        `[${chunk.source} ${chunk.sectionPath}] ${chunk.content}`
      ).join("\n\n")}`
    : "";

  const userPrompt = `Generate a compliant label for:
Product: ${product.name}
Description: ${product.description}
Ingredients (original): ${product.originalIngredients || "Not specified"}
Nutrition: ${JSON.stringify(product.nutrition || {})}
Origin: ${product.originCountry || "Not specified"}
CN Code: ${cnCode || "Not specified"}${regulatoryContext}

Return JSON with this exact structure:
{
  "productName": {
    "original": "string",
    "translations": {
      "fi": "Finnish translation",
      "sv": "Swedish translation"
    }
  },
  "ingredients": [
    {
      "name": "Ingredient name",
      "percentage": 98,
      "code": "E621",
      "functionalClass": "Flavor enhancer",
      "isAllergen": false,
      "isHighlighted": false,
      "translations": {
        "fi": "Finnish name",
        "sv": "Swedish name"
      }
    }
  ],
  "nutritionInfo": {
    "energy": 250,
    "fat": 5.0,
    "carbs": 45.0,
    "protein": 3.0,
    "salt": 0.5
  },
  "warnings": ["Voimakassuolainen / Kraftigt saltad"],
  "importerAddress": "Company Name, Street Address, City, Finland",
  "bestBeforeDate": "2025-12-31",
  "labelDimensions": {
    "width": 100,
    "height": 150
  },
  "fontSize": 10
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const labelData = JSON.parse(content) as LabelData;
    return labelData;
  } catch (error) {
    console.error("[LabelGenerator] Failed to generate label:", error);
    throw new Error("Failed to generate compliant label");
  }
}

