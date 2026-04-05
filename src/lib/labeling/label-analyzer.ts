/**
 * Analyzes original label against destination-market EU requirements.
 * Detects missing fields and generates questions for user input.
 */

import { searchRegulatoryDocuments } from "@/lib/rag/regulatory-search";
import { getRegulatoryProductType } from "@/lib/regulatory/product-type";
import type { RegulatoryProductType } from "@/lib/regulatory/product-type";
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";

export interface MissingField {
  fieldId: string;
  fieldName: string;
  category: "CRITICAL" | "REQUIRED" | "RECOMMENDED";
  description: string;
  question: string;
  inputType: "text" | "number" | "textarea" | "date" | "select";
  options?: string[]; // For select inputs
  placeholder?: string;
  unit?: string; // e.g., "g/100g", "kcal", "%"
  regulatorySource: string; // Which regulation requires this
}

export interface LabelAnalysis {
  completeness: number; // 0-100
  missingFields: MissingField[];
  detectedFields: {
    productName?: boolean;
    ingredients?: boolean;
    nutrition?: {
      energy?: boolean;
      fat?: boolean;
      carbs?: boolean;
      protein?: boolean;
      salt?: boolean;
    };
    importerAddress?: boolean;
    bestBeforeDate?: boolean;
    netQuantity?: boolean;
    warnings?: boolean;
  };
  recommendations: string[];
}

/**
 * Analyze original label text against EU requirements
 */
export async function analyzeLabel(
  originalLabelText: string,
  productCategory: string,
  cnCode?: string,
  destinationCountry?: string,
): Promise<LabelAnalysis> {
  // Determine product type
  const productType = cnCode
    ? getRegulatoryProductType(cnCode)
    : productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet"
    ? "FOOD"
    : productCategory === "electronics"
    ? "ELECTRONICS"
    : productCategory === "toys"
    ? "TOYS"
    : productCategory === "cosmetics"
    ? "COSMETICS"
    : "GENERAL";

  // Search regulatory documents for required fields
  const regulatoryChunks = await searchRegulatoryDocuments({
    productType,
    query: `Mandatory required fields information labels ${productCategory} for destination market ${destinationCountry || "EU"}. What information must be included on the label?`,
    language: "EN",
    maxResults: 10,
  });

  const regulatoryContext = regulatoryChunks
    .map((c) => `[${c.source} ${c.sectionPath}] ${c.content}`)
    .join("\n\n");

  // Use GPT-4o to analyze the label
  const systemPrompt = `You are an expert EU regulatory compliance analyst. Your job is to analyze an original product label (possibly from a non-EU country like Vietnam) and compare it against destination-market mandatory requirements.

CRITICAL: You must ONLY identify fields that are EXPLICITLY required in the regulatory context provided. Do NOT hallucinate requirements.

For each missing field, provide:
1. Field ID (e.g., "nutrition_energy", "importer_address")
2. Field name (human-readable)
3. Category: CRITICAL (legally mandatory), REQUIRED (mandatory but can be estimated), RECOMMENDED (best practice)
4. Description of what's missing
5. A clear question to ask the user
6. Input type (text, number, textarea, date, select)
7. Placeholder/unit if applicable
8. Regulatory source citation

Return JSON with this structure:
{
  "detectedFields": {
    "productName": true/false,
    "ingredients": true/false,
    "nutrition": {
      "energy": true/false,
      "fat": true/false,
      "carbs": true/false,
      "protein": true/false,
      "salt": true/false
    },
    "importerAddress": true/false,
    "bestBeforeDate": true/false,
    "netQuantity": true/false,
    "warnings": true/false
  },
  "missingFields": [
    {
      "fieldId": "nutrition_energy",
      "fieldName": "Energy (kcal/100g)",
      "category": "REQUIRED",
      "description": "Energy content per 100g is mandatory for food products in EU",
      "question": "What is the energy content per 100g? (in kcal)",
      "inputType": "number",
      "unit": "kcal/100g",
      "placeholder": "e.g., 250",
      "regulatorySource": "Regulation (EU) No 1169/2011, Article 30"
    }
  ],
  "recommendations": ["List of recommendations"]
}`;

  const userPrompt = `Analyze this original label text against destination-market EU requirements:

Original Label Text:
${originalLabelText}

Product Category: ${productCategory}
CN Code: ${cnCode || "Not specified"}
Destination Country: ${destinationCountry || "Not specified (default EU guidance)"}

Regulatory Requirements:
${regulatoryContext}

Identify:
1. What fields are present in the original label
2. What mandatory fields are MISSING (compare against regulatory requirements)
3. Generate user-friendly questions for missing fields
4. Calculate completeness score (0-100)

Return JSON only.`;

  try {
    const openai = createFeatureOpenAIClient("Label Analyzer");
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Best model for accuracy
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

    const analysis = JSON.parse(content) as LabelAnalysis;

    // Calculate completeness
    const totalRequired = analysis.missingFields.filter(
      (f) => f.category === "CRITICAL" || f.category === "REQUIRED"
    ).length;
    const missingRequired = analysis.missingFields.filter(
      (f) => f.category === "CRITICAL" || f.category === "REQUIRED"
    ).length;
    analysis.completeness = totalRequired > 0
      ? Math.round(((totalRequired - missingRequired) / totalRequired) * 100)
      : 100;

    return analysis;
  } catch (error) {
    console.error("[LabelAnalyzer] Failed to analyze label:", error);
    throw new Error("Failed to analyze label");
  }
}

/**
 * Generate category-specific required fields template
 */
export function getRequiredFieldsTemplate(productCategory: string): MissingField[] {
  const templates: Record<string, MissingField[]> = {
    food: [
      {
        fieldId: "nutrition_energy",
        fieldName: "Energy (kcal/100g)",
        category: "REQUIRED",
        description: "Energy content per 100g is mandatory",
        question: "What is the energy content per 100g? (in kcal)",
        inputType: "number",
        unit: "kcal/100g",
        placeholder: "e.g., 250",
        regulatorySource: "Regulation (EU) No 1169/2011",
      },
      {
        fieldId: "nutrition_fat",
        fieldName: "Fat (g/100g)",
        category: "REQUIRED",
        description: "Fat content per 100g is mandatory",
        question: "What is the fat content per 100g? (in grams)",
        inputType: "number",
        unit: "g/100g",
        placeholder: "e.g., 5.0",
        regulatorySource: "Regulation (EU) No 1169/2011",
      },
      {
        fieldId: "nutrition_carbs",
        fieldName: "Carbohydrates (g/100g)",
        category: "REQUIRED",
        description: "Carbohydrate content per 100g is mandatory",
        question: "What is the carbohydrate content per 100g? (in grams)",
        inputType: "number",
        unit: "g/100g",
        placeholder: "e.g., 45.0",
        regulatorySource: "Regulation (EU) No 1169/2011",
      },
      {
        fieldId: "nutrition_protein",
        fieldName: "Protein (g/100g)",
        category: "REQUIRED",
        description: "Protein content per 100g is mandatory",
        question: "What is the protein content per 100g? (in grams)",
        inputType: "number",
        unit: "g/100g",
        placeholder: "e.g., 3.0",
        regulatorySource: "Regulation (EU) No 1169/2011",
      },
      {
        fieldId: "nutrition_salt",
        fieldName: "Salt (g/100g)",
        category: "REQUIRED",
        description: "Salt content per 100g is mandatory",
        question: "What is the salt content per 100g? (in grams or %)",
        inputType: "number",
        unit: "g/100g or %",
        placeholder: "e.g., 0.5",
        regulatorySource: "Regulation (EU) No 1169/2011",
      },
      {
        fieldId: "importer_address",
        fieldName: "EU Importer Address",
        category: "CRITICAL",
        description: "EU-based importer address is mandatory",
        question: "What is the EU importer's full address?",
        inputType: "textarea",
        placeholder: "Company Name, Street, City, Country",
        regulatorySource: "Ruokavirasto Guide 17068/2",
      },
      {
        fieldId: "best_before_date",
        fieldName: "Best Before Date",
        category: "REQUIRED",
        description: "Best before or use-by date is required for perishable foods",
        question: "What is the best before date?",
        inputType: "date",
        regulatorySource: "Regulation (EU) No 1169/2011",
      },
      {
        fieldId: "net_quantity",
        fieldName: "Net Quantity",
        category: "REQUIRED",
        description: "Net quantity/weight is mandatory",
        question: "What is the net quantity/weight?",
        inputType: "text",
        unit: "g, kg, ml, L",
        placeholder: "e.g., 200g",
        regulatorySource: "Regulation (EU) No 1169/2011",
      },
    ],
    electronics: [
      {
        fieldId: "ce_marking",
        fieldName: "CE Marking",
        category: "CRITICAL",
        description: "CE marking is mandatory for electronics in EU",
        question: "Do you have a CE marking certificate? (Yes/No)",
        inputType: "select",
        options: ["Yes", "No"],
        regulatorySource: "EU 2023/988 (GPSR)",
      },
      {
        fieldId: "voltage_power",
        fieldName: "Voltage / Power Rating",
        category: "REQUIRED",
        description: "Voltage and power rating must be displayed",
        question: "What is the voltage and power rating?",
        inputType: "text",
        placeholder: "e.g., 220V, 50Hz, 100W",
        regulatorySource: "EU 2023/988 (GPSR)",
      },
      {
        fieldId: "importer_address",
        fieldName: "EU Importer Address",
        category: "CRITICAL",
        description: "EU-based importer address is mandatory",
        question: "What is the EU importer's full address?",
        inputType: "textarea",
        placeholder: "Company Name, Street, City, Country",
        regulatorySource: "Finnish Product Safety Act 184/2025",
      },
    ],
    toys: [
      {
        fieldId: "age_warning",
        fieldName: "Age Warning",
        category: "CRITICAL",
        description: "Age warning is mandatory for toys with small parts",
        question: "What age warning is required?",
        inputType: "select",
        options: ["0-3 years", "3+ years", "Not applicable"],
        regulatorySource: "EU Toy Safety Directive 2009/48/EC",
      },
      {
        fieldId: "ce_marking",
        fieldName: "CE Marking",
        category: "CRITICAL",
        description: "CE marking is mandatory for toys",
        question: "Do you have a CE marking certificate? (Yes/No)",
        inputType: "select",
        options: ["Yes", "No"],
        regulatorySource: "EU Toy Safety Directive 2009/48/EC",
      },
      {
        fieldId: "importer_address",
        fieldName: "EU Importer Address",
        category: "CRITICAL",
        description: "EU-based importer address is mandatory",
        question: "What is the EU importer's full address?",
        inputType: "textarea",
        placeholder: "Company Name, Street, City, Country",
        regulatorySource: "Finnish Product Safety Act 184/2025",
      },
    ],
  };

  return templates[productCategory] || templates.food; // Default to food template
}
