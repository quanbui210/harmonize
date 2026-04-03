/**
 * Enhanced label generator with RAG validation for marks/symbols
 * Uses GPT-4o for maximum accuracy and validates all marks against regulatory documents
 */

import { searchRegulatoryDocuments } from "@/lib/rag/regulatory-search";
import { getRegulatoryProductType } from "@/lib/regulatory/product-type";
import type { RegulatoryProductType } from "@/lib/regulatory/product-type";
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";
import { getRenderLocales, resolveEUMarketProfile } from "@/lib/labeling/eu-market";
import type { LabelEndUse } from "@/lib/labeling/compliance-checker";

export interface RequiredMarks {
  ceMarking?: boolean;
  ukcaMarking?: boolean;
  ageWarning?: string; // e.g., "0-3 years"
  recyclingSymbol?: boolean;
  batterySymbol?: boolean;
  weeeSymbol?: boolean;
  allergenWarning?: boolean;
  highSaltWarning?: boolean;
  organicSymbol?: boolean;
  originMarking?: boolean;
  fiberComposition?: boolean;
  careSymbols?: boolean;
  otherMarks?: string[]; // Additional required marks
}

export interface EnhancedLabelData {
  productName: {
    original: string;
    translations: Record<string, string | undefined>;
  };
  ingredients: Array<{
    name: string;
    percentage?: number;
    code?: string;
    functionalClass?: string;
    isAllergen: boolean;
    isHighlighted: boolean;
    translations: Record<string, string | undefined>;
  }>;
  nutritionInfo?: {
    energy: number;
    fat: number;
    carbs: number;
    protein: number;
    salt: number;
  };
  warnings: string[];
  importerAddress: string;
  originCountry?: string;
  bestBeforeDate?: string;
  batchNumber?: string;
  netQuantity?: string;
  storageInstructions?: string;
  tradeDocuments?: {
    importerAddress?: string;
    originCountry?: string;
    cnCode?: string;
    notes?: string;
  };
  requiredMarks: RequiredMarks;
  labelDimensions: {
    width: number; // mm
    height: number; // mm
  };
  fontSize: number; // pt
  regulatorySources: Array<{
    source: string;
    section: string;
    requirement: string;
  }>;
  market?: {
    destinationCountry?: string;
    countryCode?: string;
    requiredLocales: string[];
    renderLocales: string[];
  };
}

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
  productCategory: string;
  importerAddress?: string; // User-provided EU importer address
  bestBeforeDate?: string; // Best before date (YYYY-MM-DD)
  netQuantity?: string; // Net quantity in grams
  quidIngredientName?: string;
  quidPercentage?: number;
  destinationCountry?: string;
  endUse: LabelEndUse;
}

/**
 * Search RAG specifically for required marks and symbols
 */
async function searchRequiredMarks(
  productType: RegulatoryProductType,
  productCategory: string
): Promise<Array<{ source: string; section: string; requirement: string }>> {
  const queries = [
    `Required marks symbols labels ${productCategory}`,
    `Mandatory symbols CE marking ${productCategory}`,
    `Warning symbols age restrictions ${productCategory}`,
    `Recycling symbols WEEE battery ${productCategory}`,
    `High salt warning voimakassuolainen kraftigt saltad ${productCategory}`,
    `Organic symbol origin marking required ${productCategory}`,
    `Allergen warning symbol required labels ${productCategory}`,
  ];

  const allChunks: Array<{ source: string; section: string; requirement: string }> = [];

  for (const query of queries) {
    const chunks = await searchRegulatoryDocuments({
      productType,
      query,
      language: "EN",
      maxResults: 5,
    });

    for (const chunk of chunks) {
      // Extract mark/symbol requirements from chunk
      if (
        chunk.content.toLowerCase().includes("symbol") ||
        chunk.content.toLowerCase().includes("mark") ||
        chunk.content.toLowerCase().includes("warning") ||
        chunk.content.toLowerCase().includes("ce") ||
        chunk.content.toLowerCase().includes("recycling")
      ) {
        allChunks.push({
          source: chunk.source,
          section: chunk.sectionPath,
          requirement: chunk.content,
        });
      }
    }
  }

  // Deduplicate by section
  const unique = new Map<string, { source: string; section: string; requirement: string }>();
  for (const chunk of allChunks) {
    const key = `${chunk.source}-${chunk.section}`;
    if (!unique.has(key)) {
      unique.set(key, chunk);
    }
  }

  return Array.from(unique.values());
}

/**
 * Generate compliant label with RAG-validated marks
 */
export async function generateEnhancedLabel(
  product: ProductData,
  labelSize: { width: number; height: number }
): Promise<EnhancedLabelData> {
  const market = resolveEUMarketProfile(product.destinationCountry);
  const requiredLocales = market.requiredLocales;
  const renderLocales = getRenderLocales(requiredLocales);
  const localeList = requiredLocales.join(", ");

  // Determine product type from CN code or category
  const productType = product.cnCode
    ? getRegulatoryProductType(product.cnCode)
    : product.productCategory === "food" || product.productCategory === "meat" || product.productCategory === "supplements" || product.productCategory === "pet"
    ? "FOOD"
    : product.productCategory === "electronics"
    ? "ELECTRONICS"
    : product.productCategory === "toys"
    ? "TOYS"
    : product.productCategory === "cosmetics"
    ? "COSMETICS"
    : "GENERAL";

  // Search for required marks/symbols FIRST - this is critical for accuracy
  const marksRequirements = await searchRequiredMarks(productType, product.productCategory);

  // Search for comprehensive labeling requirements with multiple specific queries
  const labelingQueries = [
    `Complete labeling requirements for ${product.name}. Category: ${product.productCategory}. Include all mandatory marks, symbols, warnings, and text requirements.`,
    `Mandatory information fields food labels ingredients nutrition table QUID percentage ${product.productCategory}`,
    `Language requirements for ${market.countryName} mandatory consumer language Article 15 Regulation 1169/2011 ${product.productCategory}`,
    `Font size minimum requirements label text readability ${product.productCategory}`,
    `Allergen labeling requirements highlighting bold text ${product.productCategory}`,
    `Importer address manufacturer information required labels ${product.productCategory}`,
    `Best before date batch number net quantity labeling requirements ${product.productCategory}`,
  ];

  const allRegulatoryChunks: Array<{ source: string; sectionPath: string; content: string }> = [];
  
  // Search with multiple queries to get comprehensive coverage
  for (const query of labelingQueries) {
    const chunks = await searchRegulatoryDocuments({
      productType,
      query,
      language: "EN",
      maxResults: 5, // Smaller per query to avoid duplicates
    });
    allRegulatoryChunks.push(...chunks);
  }

  // Deduplicate chunks by content hash
  const uniqueChunks = new Map<string, typeof allRegulatoryChunks[0]>();
  for (const chunk of allRegulatoryChunks) {
    const key = `${chunk.source}-${chunk.sectionPath}-${chunk.content.substring(0, 100)}`;
    if (!uniqueChunks.has(key)) {
      uniqueChunks.set(key, chunk);
    }
  }

  const regulatoryChunks = Array.from(uniqueChunks.values());

  // Combine marks requirements with general requirements
  const allRequirements = [
    ...marksRequirements.map((m) => `[${m.source} ${m.section}] ${m.requirement}`),
    ...regulatoryChunks.map((c) => `[${c.source} ${c.sectionPath}] ${c.content}`),
  ].join("\n\n");

  const systemPrompt = `You are an expert EU food labeling compliance specialist. Your job is to generate a compliant, ready-to-print product label.

CRITICAL ACCURACY REQUIREMENTS:
1. You MUST use ONLY the regulatory requirements provided in the context below
2. DO NOT hallucinate marks, symbols, or requirements - if not in the regulatory context, do not include it
3. For marks/symbols: Only include what is explicitly required in the regulatory documents
4. Mandatory label text must be translated for destination market required locales: ${localeList}
5. Cite the exact regulatory source for each requirement

TRANSLATION REQUIREMENTS:
- Product names: Provide translations for each required locale in ${localeList}
- Ingredients: Translate each ingredient for each required locale in ${localeList}
- Use proper food terminology for target locales and do not transliterate blindly

REGULATORY CONTEXT (YOUR SOURCE OF TRUTH):
${allRequirements}

OUTPUT REQUIREMENTS:
- Return structured JSON with all label elements
- Include requiredMarks object with ONLY marks that are explicitly required in the regulatory context
- Include regulatorySources array citing where each requirement comes from
- For food: Include nutrition table if nutrition data provided
- For food QUID: Include ingredient percentages only when legally required (ingredient emphasized in product name, text, or imagery)
- For electronics: Include CE marking ONLY if required in regulatory context
- For toys: Include age warnings ONLY if required in regulatory context
- All translations must be accurate for required locales ${localeList}`;

  const userPrompt = `Generate a compliant label for:
Product: ${product.name}
Description: ${product.description}
Category: ${product.productCategory}
End use: ${product.endUse}
Ingredients (original): ${product.originalIngredients || "Not specified"}
Nutrition: ${JSON.stringify(product.nutrition || {})}
Origin: ${product.originCountry || "Not specified"}
Destination market: ${product.destinationCountry || market.countryName}
CN Code: ${product.cnCode || "Not specified"}
${product.importerAddress ? `IMPORTER ADDRESS (USE THIS EXACT ADDRESS): ${product.importerAddress}` : "Importer Address: Generate a generic EU importer address"}
${product.bestBeforeDate ? `Best Before Date (USE THIS EXACT DATE): ${product.bestBeforeDate}` : "Best Before Date: Generate if required"}
${product.netQuantity ? `Net Quantity (USE THIS EXACT QUANTITY): ${product.netQuantity}` : "Net Quantity: Generate if required"}
${product.quidIngredientName && typeof product.quidPercentage === "number" ? `QUID MANDATORY INPUT: ${product.quidIngredientName} must be declared as ${product.quidPercentage}% in ingredients` : "QUID: If ingredient is emphasized in product name/text/image, include % in ingredient list"}
Label Size: ${labelSize.width}mm x ${labelSize.height}mm

CRITICAL TRANSLATION INSTRUCTIONS:
- Required locales: ${localeList}
- Include all required locales under productName.translations and each ingredient.translations
- Do not just repeat original text, translate for each required locale
- Use terminology commonly used on food labels in destination market
- If End use is B2B or internal, you may keep consumer-pack wording shorter but still keep key traceability data accurate

Return JSON with this exact structure:
{
  "productName": {
    "original": "Original product name (e.g., Vietnamese)",
    "translations": {
      "${requiredLocales[0] || "en"}": "Translated product name for required locale 1"${requiredLocales[1] ? `,
      "${requiredLocales[1]}": "Translated product name for required locale 2"` : ""}
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
        "${requiredLocales[0] || "en"}": "Translated ingredient for required locale 1"${requiredLocales[1] ? `,
        "${requiredLocales[1]}": "Translated ingredient for required locale 2"` : ""}
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
  "warnings": ["Market-appropriate mandatory warnings in required locales"],
  "importerAddress": "Company Name, Street Address, City, Finland",
  "manufacturerAddress": "Original manufacturer address from label (optional)",
  "bestBeforeDate": "2025-12-31",
  "batchNumber": "LOT12345",
  "netQuantity": "200g",
  "storageInstructions": "Store in a cool, dry place",
  "preparationInstructions": "Cooking/preparation instructions if provided",
  "requiredMarks": {
    "ceMarking": false,
    "ageWarning": "0-3 years",
    "recyclingSymbol": true,
    "allergenWarning": true,
    "highSaltWarning": false
  },
  "labelDimensions": {
    "width": 100,
    "height": 150
  },
  "fontSize": 10,
  "regulatorySources": [
    {
      "source": "RUOKAVIRASTO",
      "section": "Section 5.3",
      "requirement": "QUID percentage required"
    }
  ],
  "market": {
    "destinationCountry": "${product.destinationCountry || market.countryName}",
    "countryCode": "${market.countryCode}",
    "requiredLocales": ${JSON.stringify(requiredLocales)},
    "renderLocales": ${JSON.stringify(renderLocales)}
  }
}`;

  try {
    // Use GPT-4o for maximum accuracy
    const openai = createFeatureOpenAIClient("Label Generator Enhanced");
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Best model for accuracy
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for consistency
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const labelData = JSON.parse(content) as EnhancedLabelData;

    if (!labelData.productName?.translations || typeof labelData.productName.translations !== "object") {
      labelData.productName.translations = {};
    }
    for (const locale of requiredLocales) {
      if (!labelData.productName.translations[locale]) {
        labelData.productName.translations[locale] = labelData.productName.original;
      }
    }
    for (const ingredient of labelData.ingredients || []) {
      if (!ingredient.translations || typeof ingredient.translations !== "object") {
        ingredient.translations = {};
      }
      for (const locale of requiredLocales) {
        if (!ingredient.translations[locale]) {
          ingredient.translations[locale] = ingredient.name;
        }
      }
    }
    
    // Add origin country from product data
    labelData.originCountry = product.originCountry;
    
    // Use user-provided importer address if available (override AI-generated)
    if (product.importerAddress) {
      labelData.importerAddress = product.importerAddress;
    }
    labelData.market = {
      destinationCountry: product.destinationCountry || market.countryName,
      countryCode: market.countryCode,
      requiredLocales,
      renderLocales,
    };
    if (product.endUse !== "B2C") {
      labelData.tradeDocuments = {
        importerAddress: product.importerAddress,
        originCountry: product.originCountry,
        cnCode: product.cnCode,
        notes:
          product.endUse === "B2B"
            ? "B2B workflow: support final shipment with trade/commercial documentation."
            : "Internal workflow: draft output for internal review only.",
      };
    }
    
    // Validate that requiredMarks only contains what was in regulatory context
    // This is a safety check to prevent hallucinations
    const validatedMarks = validateMarksAgainstSources(
      labelData.requiredMarks,
      marksRequirements
    );
    labelData.requiredMarks = validatedMarks;

    return labelData;
  } catch (error) {
    console.error("[LabelGenerator] Failed to generate label:", error);
    throw new Error("Failed to generate compliant label");
  }
}

/**
 * Validate marks against regulatory sources - prevent hallucinations
 */
function validateMarksAgainstSources(
  marks: RequiredMarks,
  sources: Array<{ source: string; section: string; requirement: string }>
): RequiredMarks {
  const validated: RequiredMarks = {};
  const sourceText = sources.map((s) => s.requirement.toLowerCase()).join(" ");

  // Only include marks that are mentioned in regulatory sources
  if (marks.ceMarking && (sourceText.includes("ce") || sourceText.includes("ce marking"))) {
    validated.ceMarking = true;
  }
  if (marks.ukcaMarking && sourceText.includes("ukca")) {
    validated.ukcaMarking = true;
  }
  if (marks.ageWarning && (sourceText.includes("age") || sourceText.includes("year"))) {
    validated.ageWarning = marks.ageWarning;
  }
  if (marks.recyclingSymbol && sourceText.includes("recycling")) {
    validated.recyclingSymbol = true;
  }
  if (marks.batterySymbol && sourceText.includes("battery")) {
    validated.batterySymbol = true;
  }
  if (marks.weeeSymbol && sourceText.includes("weee")) {
    validated.weeeSymbol = true;
  }
  if (marks.allergenWarning && (sourceText.includes("allergen") || sourceText.includes("allergy"))) {
    validated.allergenWarning = true;
  }
  if (marks.highSaltWarning && (sourceText.includes("salt") || sourceText.includes("suola"))) {
    validated.highSaltWarning = true;
  }
  if (marks.organicSymbol && sourceText.includes("organic")) {
    validated.organicSymbol = true;
  }
  if (marks.originMarking && sourceText.includes("origin")) {
    validated.originMarking = true;
  }
  if (marks.fiberComposition && sourceText.includes("fiber") || sourceText.includes("composition")) {
    validated.fiberComposition = true;
  }
  if (marks.careSymbols && sourceText.includes("care")) {
    validated.careSymbols = true;
  }

  return validated;
}
