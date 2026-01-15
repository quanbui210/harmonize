import OpenAI from "openai";
import type { EUProductAttributes } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProductAnalysisResult {
  keyAttributes: {
    primaryFunction: string;
    materials: Array<{ material: string; percentage: number }>;
    technicalFeatures: string[];
    intendedUse: string;
    essentialCharacter?: string;
  };
  suggestedChapters: Array<{
    chapter: number;
    heading?: number;
    subheading?: number;
    cnCode?: string;
    reason: string;
    confidence: number;
    legalBasis?: string;
    dutyRate?: number;
    isPrimary?: boolean;
  }>;
  classificationNotes: string[];
  alternativeClassifications?: Array<{
    cnCode: string;
    reason: string;
    confidence: number;
    dutyRate?: number;
    tradeOffs?: string;
  }>;
  clarifyingQuestion?: {
    question: string;
    explanation: string;
    options: Array<{ value: string; label: string; recommendedCode?: string }>;
  };
}

export class OpenAIClassificationService {
  async analyzeProduct(
    product: EUProductAttributes,
    legalChunks?: Array<{ sectionPath: string; excerpt: string }>,
  ): Promise<ProductAnalysisResult> {
    const systemPrompt = `You are an elite EU Customs Auditor. Your methodology must strictly follow the General Rules for the Interpretation (GRI) of the Combined Nomenclature.

CLASSIFICATION PROTOCOL (MUST FOLLOW SEQUENTIALLY):
1. GRI 1: Determine classification by the terms of the headings and Section/Chapter Notes.
   - First, identify the correct Chapter using Chapter Notes and Section Notes
   - Then, identify the correct Heading within that Chapter
   - Use the exact terms of the headings - do not guess
2. GRI 3: If goods are prima facie classifiable under two or more headings:
   - (a) Specific Description takes precedence
   - (b) Essential Character determines classification (for composite goods - products with multiple components/materials)
   - (c) Kinship rule applies
   - IMPORTANT: If the product is a composite good (e.g., toy with electronics, bag with electronics), you MUST apply GRI 3(b) to determine essential character
3. GRI 6: Determine subheading classification according to the terms of those subheadings.
   - Apply GRI 1-5 at the subheading level
   - Do not jump to subheadings without first determining the heading
   - IMPORTANT: Many classifications use BOTH GRI 1 (for heading) AND GRI 6 (for subheading)

CRITICAL CONSTRAINTS:
- Use the 8-digit Combined Nomenclature (CN) format: XX XX XX XX
- For each suggested CN code, provide the EU MFN (Most Favored Nation) duty rate if you know it
- Duty rates are specific to CN codes and vary by product type:
  * Chapter 20 (preparations of vegetables/fruit/nuts): Typically 7.5-12% MFN (average ~9.6%)
  * Chapter 3 (fish): Typically 0-25% depending on product type
  * Chapter 8 (edible fruit and nuts): Typically 0-12% depending on product
  * Textiles (Chapters 50-63): Typically 8-12% MFN
  * Electronics (Chapters 84-85): Typically 0-6.5%
  * Many products have non-zero rates (e.g., compressors often have 2.2% duty)
- If you cannot determine the exact rate, use the typical range for that chapter or leave it undefined
- Do NOT default to 0% unless you are certain the rate is actually 0%
- If the product contains multiple materials, identify the 'Essential Character' per GRI 3(b).
- Priority Hierarchy: Legal Sources > Chapter Notes > Section Notes > General Knowledge
- FORBIDDEN: If a CN code is found in Legal Sources, you MUST use it. Do NOT suggest a different code.
- FORBIDDEN: If Legal Sources contradict your suggestion, you MUST use the Legal Source code and explain why.
- CRITICAL: Validate chapter relevance. For example:
  * Trail mix (nuts, dried fruits) → Chapter 20 (preparations of vegetables/fruit/nuts), NOT Chapter 3 (fish)
  * Fish products → Chapter 3, NOT Chapter 20
  * Textiles → Chapters 50-63, NOT other chapters
  * If Legal Sources contain codes from wrong chapters (e.g., Chapter 3 codes for a trail mix), REJECT those codes and use your knowledge instead.

OUTPUT REQUIREMENTS:
- For each suggested code, cite the specific GRI rule used
- If multiple materials, explain Essential Character determination (GRI 3b)
- Provide structured reasoning trail showing GRI 1 → GRI 3 (if needed) → GRI 6
- CRITICAL: For products with classification ambiguity (e.g., robot vacuum cleaners that could be 8508 or 8509), provide MULTIPLE alternatives with:
  * Primary recommendation (highest confidence)
  * 2-3 alternative codes with explanations
  * Trade-offs (duty rates, legal justification)
  * Clarifying questions to help user choose (e.g., "Is mopping the primary function?")`;

    const legalContext = "\nNote: Rely on standard GRI rules and Chapter Notes from Regulation (EU) 2021/1832. Use your training knowledge of the Combined Nomenclature. Be extra cautious and cite your sources.";

    const userPrompt = `Analyze this product for EU CN classification and return the result as JSON:

Product Name: ${product.name}
Description: ${product.description}
Intended Use: ${product.intendedUse || "Not specified"}
Materials: ${JSON.stringify(product.materials)}
Additional Info: ${JSON.stringify(product.composition || product.technicalSpecs || {})}${legalContext}

Provide your response in JSON format with:
1. keyAttributes (primary function, materials breakdown, technical features, intended use)
2. suggestedChapters (array of objects with: chapter, heading (optional), subheading (optional), cnCode (8-digit if you can determine it), reason, confidence 0-1, dutyRate (optional number - EU MFN duty rate if known), isPrimary (boolean - true for primary recommendation))
3. classificationNotes (any special considerations, exclusions, or warnings)
4. alternativeClassifications (optional array of objects with: cnCode, reason, confidence, dutyRate, tradeOffs - for ambiguous cases like robot vacuums 8508 vs 8509)
5. clarifyingQuestion (optional object with: question, explanation, options - for ambiguous classifications that need user input)

IMPORTANT: 
- Try to provide specific CN codes (8-digit) when possible
- For ambiguous products (e.g., robot vacuum cleaners), provide PRIMARY recommendation + 2-3 ALTERNATIVES with:
  * Primary code (highest confidence, most common practice)
  * Alternative codes with explanations and trade-offs
  * Clarifying question to help user choose (e.g., "Is mopping the primary cleaning method?")
- For each suggested CN code, provide the duty rate if you know it
- Use your training knowledge of Regulation (EU) 2021/1832 Combined Nomenclature
- Example: Robot vacuum cleaner → Primary: 8508 11 00 (vacuum cleaner), Alternative: 8509 80 00 (if mopping is primary), with clarifying question`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        throw new Error("OpenAI returned invalid JSON");
      }
      
      const normalized: ProductAnalysisResult = {
        keyAttributes: parsed.keyAttributes || parsed.key_attributes || {
          primaryFunction: parsed.key_attributes?.primary_function || "",
          materials: parsed.key_attributes?.materials || [],
          technicalFeatures: parsed.key_attributes?.technical_features || [],
          intendedUse: parsed.key_attributes?.intended_use || "",
          essentialCharacter: parsed.key_attributes?.essentialCharacter || parsed.key_attributes?.essential_character || undefined,
        },
        suggestedChapters: parsed.suggestedChapters || parsed.suggested_chapters || [],
        classificationNotes: parsed.classificationNotes || parsed.classification_notes || [],
        alternativeClassifications: parsed.alternativeClassifications || parsed.alternative_classifications || undefined,
        clarifyingQuestion: (() => {
          const cq = parsed.clarifyingQuestion || parsed.clarifying_question;
          if (!cq) return undefined;
          
          // Normalize options array
          const options: Array<{ value: string; label: string; recommendedCode?: string }> = 
            (cq.options && Array.isArray(cq.options))
              ? cq.options.map((opt: any) => {
                  if (typeof opt === "string") {
                    return { value: opt, label: opt };
                  }
                  if (opt && typeof opt === "object") {
                    return {
                      value: opt.value || opt.label || String(opt),
                      label: opt.label || opt.value || String(opt),
                      recommendedCode: opt.recommendedCode || opt.recommended_code,
                    };
                  }
                  return { value: String(opt), label: String(opt) };
                }).filter((opt: any) => opt.value && opt.label)
              : [];
          
          if (options.length === 0) {
            console.log("[OpenAI] Clarifying question has empty options array. Raw options:", cq.options);
          }
          
          return {
            question: String(cq.question || cq.question_text || ""),
            explanation: String(cq.explanation || cq.explanation_text || ""),
            options: options,
          };
        })(),
      };
      
      if (normalized.suggestedChapters.length > 0) {
        normalized.suggestedChapters = normalized.suggestedChapters.map((ch: any) => {
          const chapter = ch.chapter || ch.chapter_number || 0;
          const heading = ch.heading || ch.heading_number;
          const subheading = ch.subheading || ch.subheading_number;
          const cnCode = ch.cnCode || ch.cn_code || ch.cNCode;
          const dutyRate = ch.dutyRate || ch.duty_rate;
          
          let finalCnCode = cnCode;
          if (finalCnCode) {
            const digitsOnly = finalCnCode.replace(/\D/g, "");
            if (digitsOnly.length >= 8) {
              finalCnCode = digitsOnly.substring(0, 8);
            } else if (digitsOnly.length >= 6) {
              finalCnCode = digitsOnly.padEnd(8, "0");
            } else {
              finalCnCode = "";
            }
          }
          
          if (!finalCnCode && chapter) {
            const chapterStr = chapter.toString().padStart(2, "0");
            const headingStr = heading ? heading.toString().padStart(2, "0") : "00";
            const subheadingStr = subheading ? subheading.toString().padStart(2, "0") : "00";
            finalCnCode = `${chapterStr}${headingStr}${subheadingStr}00`.substring(0, 8);
          }
          
          let normalizedDutyRate: number | undefined = undefined;
          if (dutyRate !== undefined && dutyRate !== null) {
            if (typeof dutyRate === "number") {
              normalizedDutyRate = dutyRate;
            } else if (typeof dutyRate === "string") {
              const parsed = parseFloat(dutyRate);
              if (!isNaN(parsed)) {
                normalizedDutyRate = parsed;
              }
            }
          }
          
          return {
            chapter,
            heading,
            subheading,
            cnCode: finalCnCode || "",
            reason: ch.reason || ch.reasoning || "",
            confidence: ch.confidence || 0.5,
            legalBasis: ch.legalBasis || ch.legal_basis || undefined,
            dutyRate: normalizedDutyRate,
          };
        });
      }
      
      if (!normalized.suggestedChapters || !Array.isArray(normalized.suggestedChapters)) {
        throw new Error("OpenAI response missing suggestedChapters array");
      }
      
      if (normalized.suggestedChapters.length === 0) {
        throw new Error("OpenAI response has no suggested chapters");
      }
      
      return normalized;
    } catch (error) {
      throw new Error("Failed to analyze product with AI");
    }
  }

  async generateRefinementQuestion(
    product: EUProductAttributes,
    chapters: Array<{ chapter: number; reason: string; confidence: number }>,
  ): Promise<{
    question: string;
    explanation: string;
    options: Array<{ value: string; label: string }>;
    field: string;
  }> {
    const systemPrompt = `You are an expert EU customs classification specialist. Your task is to generate a clear, product-specific refinement question when classification is ambiguous.

The question should:
1. Be specific to the product being classified
2. Help distinguish between the ambiguous classification options
3. Be easy for a non-expert to understand
4. Have 2-3 clear answer options
5. Identify which product attribute (intendedUse, function, materials, etc.) would help resolve the ambiguity

Return your response as JSON with: question, explanation, options (array of {value, label}), and field (the product attribute to update).`;

    const userPrompt = `Generate a refinement question for this product classification ambiguity:

Product: ${product.name}
Description: ${product.description}
Intended Use: ${product.intendedUse || "Not specified"}

Ambiguous Classification Options:
1. Chapter ${chapters[0].chapter}: ${chapters[0].reason} (${Math.round(chapters[0].confidence * 100)}% confidence)
2. Chapter ${chapters[1].chapter}: ${chapters[1].reason} (${Math.round(chapters[1].confidence * 100)}% confidence)

Generate a smart, product-specific question that will help determine the correct classification. The question should be relevant to THIS specific product, not generic.

Return your response as JSON with: question, explanation, options (array of {value, label}), and field.`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const parsed = JSON.parse(content);
      
      return {
        question: parsed.question || parsed.question_text || "Which classification best matches this product?",
        explanation: parsed.explanation || parsed.explanation_text || "Multiple classification options are possible.",
        options: parsed.options || parsed.answer_options || [
          { value: "option1", label: `Chapter ${chapters[0].chapter}: ${chapters[0].reason}` },
          { value: "option2", label: `Chapter ${chapters[1].chapter}: ${chapters[1].reason}` },
        ],
        field: parsed.field || parsed.attribute_field || "classification",
      };
    } catch (error) {
      throw error;
    }
  }

  async generateImportGuidance(
    product: EUProductAttributes,
    classification: {
      cnCode: string;
      cnCodeDescription?: string;
      dutyRate?: number;
      originCountry?: string;
    },
  ): Promise<{
    importStatus: "ALLOWED" | "RESTRICTED" | "PROHIBITED";
    importStatusMessage: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    requiredDocuments: string[];
    foodSafetyRisks?: Array<{
      risk: string;
      level: "LOW" | "MEDIUM" | "HIGH";
      reason: string;
    }>;
    recommendedTests?: string[];
    labellingRequirements?: string[];
    borderControlLikelihood: "LOW" | "MEDIUM" | "HIGH";
    borderControlReason?: string;
    nextActions: string[];
  }> {
    const systemPrompt = `You are an expert EU import compliance specialist. Your job is to provide actionable import guidance for products entering the EU market.

You must analyze:
1. Product type (food, electronics, textiles, etc.)
2. CN code classification
3. Origin country
4. EU regulations applicable to this product category

Provide comprehensive, practical guidance that helps importers understand:
- Whether the product is allowed
- What documents they need
- What risks exist
- What tests might be required
- What labeling is needed
- Likelihood of border inspection
- Next steps to take

Be specific and actionable. For food products, consider food safety regulations, mycotoxins, pesticides, allergens. For electronics, consider CE marking, RoHS, WEEE. For textiles, consider REACH, labeling requirements.

Return your response as JSON with the structure specified in the user prompt.`;

    const userPrompt = `Generate comprehensive import guidance for this product:

Product: ${product.name}
Description: ${product.description}
Intended Use: ${product.intendedUse || "Not specified"}
CN Code: ${classification.cnCode}
${classification.cnCodeDescription ? `CN Code Description: ${classification.cnCodeDescription}` : ""}
${classification.originCountry ? `Origin Country: ${classification.originCountry}` : ""}
${classification.dutyRate !== undefined ? `Duty Rate: ${classification.dutyRate}%` : ""}

Provide a JSON response with:
1. importStatus: "ALLOWED" | "RESTRICTED" | "PROHIBITED"
2. importStatusMessage: Brief explanation of import status
3. riskLevel: "LOW" | "MEDIUM" | "HIGH" - overall risk level for this import
4. requiredDocuments: Array of required documents (e.g., "Commercial invoice", "Packing list", "Phytosanitary certificate", "Certificate of Analysis")
5. foodSafetyRisks: Array of {risk: string, level: "LOW"|"MEDIUM"|"HIGH", reason: string} - only if this is a food product
6. recommendedTests: Array of recommended lab tests (e.g., "Aflatoxins B1/B2/G1/G2", "Pesticide multi-residue screen") - only if applicable
7. labellingRequirements: Array of labeling requirements (e.g., "Ingredient list in descending order", "Allergen highlighting", "CE marking required") - only if applicable
8. borderControlLikelihood: "LOW" | "MEDIUM" | "HIGH" - probability of physical inspection
9. borderControlReason: Explanation of why inspection is likely/unlikely
10. nextActions: Array of actionable next steps (e.g., "Request COA from supplier", "Verify label compliance", "Book freight forwarder")

Be specific and practical. Focus on what the importer needs to know and do.`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const parsed = JSON.parse(content);

      return {
        importStatus: parsed.importStatus || "ALLOWED",
        importStatusMessage: parsed.importStatusMessage || "Product is allowed for import into the EU",
        riskLevel: parsed.riskLevel || "MEDIUM",
        requiredDocuments: Array.isArray(parsed.requiredDocuments) ? parsed.requiredDocuments : [],
        foodSafetyRisks: Array.isArray(parsed.foodSafetyRisks) ? parsed.foodSafetyRisks : undefined,
        recommendedTests: Array.isArray(parsed.recommendedTests) ? parsed.recommendedTests : undefined,
        labellingRequirements: Array.isArray(parsed.labellingRequirements) ? parsed.labellingRequirements : undefined,
        borderControlLikelihood: parsed.borderControlLikelihood || "MEDIUM",
        borderControlReason: parsed.borderControlReason,
        nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : [],
      };
    } catch (error) {
      return {
        importStatus: "ALLOWED",
        importStatusMessage: "Product appears to be allowed for import into the EU",
        riskLevel: "MEDIUM",
        requiredDocuments: ["Commercial invoice", "Packing list", "Bill of lading"],
        borderControlLikelihood: "MEDIUM",
        nextActions: ["Verify all required documents are available", "Confirm compliance with EU regulations"],
      };
    }
  }

  async generateLegalRationale(
    product: EUProductAttributes,
    classification: {
      cnCode: string;
      cnCodeDescription?: string;
      dutyRate?: number;
      vatRate?: number;
      reasoningTrail: Array<{
        griRule: string;
        level: string;
        selection: string;
        rationale: string;
        score: number;
      }>;
      exclusionNotes: string[];
      sources: Array<{
        sourceType: string;
        referenceId?: string;
        excerpt: string;
      }>;
    },
  ): Promise<{
    legalRationale: string;
    distinctions: Array<{ heading: string; reason: string }>;
    keyFeatures: string[];
    griRule: string;
    dutyRate?: number;
    vatRate?: number;
    notes?: string;
  }> {
    const systemPrompt = `You are an expert EU customs classification specialist with access to current EU TARIC (Tariff Integrated of the European Communities) data. Generate a professional legal rationale for a CN code classification that can be used in audit defense.

IMPORTANT DUTY RATE GUIDELINES:
- Chapter 20 (preparations of vegetables, fruit, nuts): Typically 7.5-12% MFN duty rate (average ~9.6%)
- Chapter 3 (fish): Typically 0-25% depending on product type
- Chapter 8 (edible fruit and nuts): Typically 0-12% depending on product
- Textiles (Chapters 50-63): Typically 8-12% MFN
- Electronics (Chapters 84-85): Typically 0-6.5%
- If you cannot determine the exact rate, use the typical range for that chapter and note it in the rationale

CRITICAL REQUIREMENTS:
- The CN code provided is CORRECT and comes from the official Regulation (EU) 2021/1832 document
- You MUST provide 100% accurate duty rate information based on the CN code provided
- Use your knowledge of current EU tariff rates - do NOT guess or assume rates
- Duty rates are specific to CN codes and can vary even within the same heading
- If you are uncertain about the exact duty rate, state that clearly rather than providing incorrect information
- The CN code is already determined from the legal document - your job is to explain WHY it's correct and provide the duty rate

Your response must include:
1. Legal Rationale - Clear explanation using GRI rules for THIS SPECIFIC CN CODE
2. Distinctions - Why this heading over competing headings (e.g., "8806 vs 9503")
3. Key Features - Product characteristics that support the classification
4. GRI Rule - Which GRI rule(s) were applied:
   - Use "GRI_1" for simple classification by heading terms
   - Use "GRI_3B" for composite goods where essential character determines classification
   - Use "GRI_1_AND_6" or "GRI_1_6" when both GRI 1 (heading) and GRI 6 (subheading) apply
   - Use "GRI_6" when subheading-level classification is the key determination
5. Duty Rate - The EXACT EU MFN (Most Favored Nation) duty rate for this CN code (as a number, e.g., 12.0 for 12%, 2.2 for 2.2%, 0.0 for 0%)
   - CRITICAL: Look up the actual duty rate - many products have non-zero rates (e.g., compressors often have 2.2% duty)
   - Do NOT default to 0% unless you are certain the rate is actually 0%
6. VAT Rate - The standard EU VAT rate (typically 20% but may vary by country)
7. Notes - Any relevant updates or special considerations

Return your response as JSON with: legalRationale, distinctions (array of {heading, reason}), keyFeatures (array), griRule, dutyRate (number), vatRate (number), and notes (optional).`;

    const userPrompt = `Generate a professional legal rationale for this classification:

Product: ${product.name}
Description: ${product.description}
Intended Use: ${product.intendedUse || "Not specified"}

Classification Result:
CN Code: ${classification.cnCode}
${classification.cnCodeDescription ? `CN Code Description: ${classification.cnCodeDescription}` : ""}
GRI Reasoning Trail: ${JSON.stringify(classification.reasoningTrail, null, 2)}
Exclusion Notes: ${JSON.stringify(classification.exclusionNotes, null, 2)}
Sources: ${JSON.stringify(classification.sources.slice(0, 3), null, 2)}

CRITICAL: You MUST provide the EXACT EU MFN duty rate for CN code ${classification.cnCode}. 
- Look up the current duty rate for this specific CN code
- Do NOT guess or assume - use your knowledge of current EU tariff rates
- If the rate is 0%, state it as 0.0
- Include the standard EU VAT rate (typically 20%)

Generate a professional, audit-ready legal rationale that:
- Explains the GRI rule application
- Distinguishes this classification from competing headings
- Lists key product features that support the classification
- Provides the EXACT duty rate for this CN code (must be accurate)
- Notes any relevant HS/CN updates or special considerations

Return your response as JSON with dutyRate and vatRate as numbers.`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        let fixedContent = content.trim();
        
        fixedContent = fixedContent.replace(/"([^"\\]*(?:\\.[^"\\]*)*)'([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, before, after) => {
          return `"${before.replace(/'/g, "\\'")}${after.replace(/'/g, "\\'")}"`;
        });
        
        const endsWithUnclosedString = /"[^"]*":\s*"[^"]*$/.test(fixedContent);
        
        if (endsWithUnclosedString || !fixedContent.endsWith("}")) {
          const stringFieldRegex = /"([^"]+)":\s*"([^"]*)/g;
          const matches: Array<{ field: string; value: string; index: number }> = [];
          let match;
          
          while ((match = stringFieldRegex.exec(fixedContent)) !== null) {
            matches.push({
              field: match[1],
              value: match[2],
              index: match.index,
            });
          }
          
          if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            const incompleteValue = lastMatch.value;
            
            const beforeIncomplete = fixedContent.substring(0, lastMatch.index);
            
            const escapedValue = incompleteValue
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"')
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r")
              .replace(/\t/g, "\\t");
            
            fixedContent = beforeIncomplete + `"${lastMatch.field}": "${escapedValue}",\n`;
            
            if (!fixedContent.includes('"distinctions"')) {
              fixedContent += '"distinctions": [],\n';
            }
            if (!fixedContent.includes('"keyFeatures"')) {
              fixedContent += '"keyFeatures": [],\n';
            }
            if (!fixedContent.includes('"griRule"')) {
              fixedContent += '"griRule": "GRI_1",\n';
            }
            if (!fixedContent.includes('"dutyRate"')) {
              fixedContent += '"dutyRate": null,\n';
            }
            if (!fixedContent.includes('"vatRate"')) {
              fixedContent += '"vatRate": 20\n';
            }
            fixedContent += "}";
          }
        }
        
        if (!fixedContent.endsWith("}") && !fixedContent.endsWith("}\n")) {
          const lastCompleteField = fixedContent.lastIndexOf('",');
          if (lastCompleteField > 0) {
            fixedContent = fixedContent.substring(0, lastCompleteField + 1);
            
            if (!fixedContent.includes('"distinctions"')) {
              fixedContent += ',\n"distinctions": []';
            }
            if (!fixedContent.includes('"keyFeatures"')) {
              fixedContent += ',\n"keyFeatures": []';
            }
            if (!fixedContent.includes('"griRule"')) {
              fixedContent += ',\n"griRule": "GRI_1"';
            }
            if (!fixedContent.includes('"dutyRate"')) {
              fixedContent += ',\n"dutyRate": null';
            }
            if (!fixedContent.includes('"vatRate"')) {
              fixedContent += ',\n"vatRate": 20';
            }
            fixedContent += "\n}";
          } else {
            
            if (fixedContent.includes('"legalRationale"')) {
              const rationaleMatch = fixedContent.match(/"legalRationale":\s*"([^"]*)/);
              const rationaleText = rationaleMatch ? rationaleMatch[1].replace(/"/g, '\\"').replace(/'/g, "\\'") : "";
              fixedContent = `{\n"legalRationale": "${rationaleText}",\n"distinctions": [],\n"keyFeatures": [],\n"griRule": "GRI_1",\n"dutyRate": null,\n"vatRate": 20\n}`;
            } else {
              fixedContent = `{\n"legalRationale": "",\n"distinctions": [],\n"keyFeatures": [],\n"griRule": "GRI_1",\n"dutyRate": null,\n"vatRate": 20\n}`;
            }
          }
        }
        
        try {
          parsed = JSON.parse(fixedContent);
        } catch (e) {
          const jsonMatch = fixedContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[1]);
            } catch (e2) {
              const jsonObjectMatch = fixedContent.match(/\{[\s\S]*\}/);
              if (jsonObjectMatch) {
                try {
                  parsed = JSON.parse(jsonObjectMatch[0]);
                } catch (e3) {
                  parsed = {
                    legalRationale: "Legal rationale generation encountered a parsing error. Please review the classification manually.",
                    distinctions: [],
                    keyFeatures: [],
                    griRule: "GRI_1",
                    dutyRate: undefined,
                    vatRate: 20,
                  };
                }
              } else {
                parsed = {
                  legalRationale: "Legal rationale generation encountered a parsing error. Please review the classification manually.",
                  distinctions: [],
                  keyFeatures: [],
                  griRule: "GRI_1",
                  dutyRate: 0,
                  vatRate: 20,
                };
              }
            }
          } else {
            parsed = {
              legalRationale: "Legal rationale generation encountered a parsing error. Please review the classification manually.",
              distinctions: [],
              keyFeatures: [],
              griRule: "GRI_1",
              dutyRate: 0,
              vatRate: 20,
            };
          }
        }
      }
      
      const rationaleText = (parsed.legalRationale || parsed.legal_rationale || "").toLowerCase();
      const notesText = (parsed.notes || "").toLowerCase();
      const combinedText = `${rationaleText} ${notesText}`;
      
      const dutyRatePatterns = [
        /duty\s+rate\s+(?:is|of|:)\s*(\d+\.?\d*)\s*%/i,
        /(\d+\.?\d*)\s*%\s*(?:ad\s+valorem\s+)?duty/i,
        /duty[:\s]+(\d+\.?\d*)\s*%/i,
        /(\d+\.?\d*)\s*%\s*duty\s+rate/i,
        /duty\s+rate\s+for\s+cn\s+code[^%]*is\s*(\d+\.?\d*)\s*%/i,
      ];
      
      let extractedDutyRate: number | undefined = undefined;
      for (const pattern of dutyRatePatterns) {
        const match = combinedText.match(pattern);
        if (match && match[1]) {
          const rate = parseFloat(match[1]);
          if (!isNaN(rate)) {
            extractedDutyRate = rate;
            break;
          }
        }
      }

      
      let extractedVatRate: number | undefined = undefined;
      for (const pattern of [
        /vat\s+rate\s+(?:is|of|:)\s*(\d+\.?\d*)\s*%/i,
        /(\d+\.?\d*)\s*%\s*vat/i,
        /vat[:\s]+(\d+\.?\d*)\s*%/i,
      ]) {
        const match = combinedText.match(pattern);
        if (match && match[1]) {
          const rate = parseFloat(match[1]);
          if (!isNaN(rate)) {
            extractedVatRate = rate;
            break;
          }
        }
      }

      
      let dutyRate = extractedDutyRate !== undefined
        ? extractedDutyRate
        : (parsed.dutyRate !== undefined 
            ? (typeof parsed.dutyRate === "number" ? parsed.dutyRate : parseFloat(parsed.dutyRate) || undefined)
            : undefined);
      
      let vatRate = extractedVatRate !== undefined
        ? extractedVatRate
        : (parsed.vatRate !== undefined
            ? (typeof parsed.vatRate === "number" ? parsed.vatRate : parseFloat(parsed.vatRate) || undefined)
            : undefined);

      let griRule = parsed.griRule || parsed.gri_rule;
      
      if (!griRule) {
        const rationaleText = (parsed.legalRationale || parsed.legal_rationale || "").toLowerCase();
        const notesText = (parsed.notes || "").toLowerCase();
        const combinedText = `${rationaleText} ${notesText}`;
        
        const griPatterns = [
          /gri\s*[_\s]?(\d+)/i,
          /general\s+rule\s+(?:of\s+interpretation\s+)?(\d+)/i,
          /rule\s+(\d+)\s+(?:of|for)/i,
        ];
        
        for (const pattern of griPatterns) {
          const match = combinedText.match(pattern);
          if (match && match[1]) {
            const griNum = parseInt(match[1], 10);
            if (griNum >= 1 && griNum <= 6) {
              griRule = `GRI_${griNum}`;
              break;
            }
          }
        }
      }
      
      if (!griRule && classification.reasoningTrail && classification.reasoningTrail.length > 0) {
        
        const hasGRI3B = classification.reasoningTrail.some((step: any) => 
          step.griRule === "GRI_3B" || step.griRule === "GRI_3b"
        );
        const hasGRI3 = classification.reasoningTrail.some((step: any) => 
          step.griRule === "GRI_3" || step.griRule === "GRI_3A" || step.griRule === "GRI_3C"
        );
        const hasGRI6 = classification.reasoningTrail.some((step: any) => 
          step.griRule === "GRI_6" || step.level === "SUBHEADING"
        );
        const hasHeading = classification.reasoningTrail.some((step: any) => 
          step.level === "HEADING" || step.level === "CHAPTER"
        );
        
        if (hasGRI3B) {
          griRule = "GRI_3B";
        } else if (hasGRI3) {
          griRule = "GRI_3";
        } else if (hasHeading && hasGRI6) {
          griRule = "GRI_1_AND_6";
        } else if (hasGRI6) {
          griRule = "GRI_6";
        } else {
          griRule = "GRI_1";
        }
      }
      
      if (!griRule || griRule === "GRI_1") {
        const productName = (product.name || "").toLowerCase();
        const productDesc = (product.description || "").toLowerCase();
        const combined = `${productName} ${productDesc}`;
        
        const compositeIndicators = [
          /toy.*(?:with|and|integrated).*(?:speaker|electronic|bluetooth|battery)/i,
          /(?:with|and|integrated).*(?:speaker|electronic|bluetooth).*(?:toy|doll|bear)/i,
          /(?:bag|handbag).*(?:with|and|integrated).*(?:electronic|battery|charger)/i,
        ];
        
        if (compositeIndicators.some(pattern => pattern.test(combined))) {
          griRule = "GRI_3B";
        }
      }
      
      if (!griRule) {
        griRule = "GRI_1";
      }

      if (dutyRate === undefined) {
        
        const cnCodeStr = classification.cnCode || "";
        if (cnCodeStr.length >= 2) {
          const chapter = parseInt(cnCodeStr.substring(0, 2), 10);
          if (chapter === 20) {
            dutyRate = 9.6;
          } else if (chapter >= 50 && chapter <= 63) {
            dutyRate = 10.0;
          } else if (chapter >= 84 && chapter <= 85) {
            dutyRate = 0.0;
          } else if (chapter >= 1 && chapter <= 24 && chapter !== 20) {
            dutyRate = 8.0;
          }
        }
      }

      return {
        legalRationale: parsed.legalRationale || parsed.legal_rationale || "",
        distinctions: parsed.distinctions || parsed.distinction_notes || [],
        keyFeatures: parsed.keyFeatures || parsed.key_features || [],
        griRule,
        dutyRate,
        vatRate,
        notes: parsed.notes || undefined,
      };
    } catch (error) {
      return {
        legalRationale: `Classification determined by ${classification.reasoningTrail[0]?.griRule || "GRI_1"}. ${classification.reasoningTrail[0]?.rationale || ""}`,
        distinctions: [],
        keyFeatures: [],
        griRule: classification.reasoningTrail[0]?.griRule || "GRI_1",
      };
    }
  }

  async generateReasoningDossier(
    product: EUProductAttributes,
    classificationResult: {
      cnCode: string;
      reasoningTrail: Array<{
        griRule: string;
        level: string;
        selection: string;
        rationale: string;
        score: number;
      }>;
      sources: Array<{
        sourceType: string;
        referenceId?: string;
        excerpt: string;
      }>;
      legalRationale?: string;
      distinctions?: Array<{ heading: string; reason: string }>;
      keyFeatures?: string[];
      alternativeClassifications?: Array<{
        cnCode: string;
        confidence: number;
        dutyRate: number;
        reasoning: string;
        tradeOffs?: string;
      }>;
      dutyRate?: number;
      vatRate?: number;
    },
  ): Promise<string> {
    const systemPrompt = `You are a customs broker preparing a formal Reasoning Dossier for EU customs authorities. This document must demonstrate that the CN code classification is correct and legally defensible.

Format the dossier as a professional document with:
1. Executive Summary
2. Product Description
3. GRI Analysis (step-by-step application of General Rules of Interpretation)
4. Alternative Classifications Analysis (if alternatives exist - compare primary vs alternatives with duty rates, trade-offs, and recommendations)
5. Source Attribution (legal notes, binding rulings, TARIC measures)
6. Duty and Tax Breakdown (duty rate, VAT rate, total cost impact)
7. Conclusion

Be precise, cite sources, and follow EU customs documentation standards.`;

    const alternativesSection = classificationResult.alternativeClassifications && classificationResult.alternativeClassifications.length > 0
      ? `\n\nAlternative Classifications:\n${JSON.stringify(classificationResult.alternativeClassifications, null, 2)}\n\nFor each alternative, explain:\n- Why it could be valid\n- Trade-offs (duty rate differences, legal risks)\n- When to consider applying for BTI (Binding Tariff Information)\n- Recommendation: which code to use and why`
      : "";

    const userPrompt = `Generate a Reasoning Dossier for this classification:

Product: ${product.name}
Description: ${product.description}

Classification Result:
CN Code: ${classificationResult.cnCode}
Duty Rate: ${classificationResult.dutyRate !== undefined ? `${classificationResult.dutyRate}%` : "Not specified"}
VAT Rate: ${classificationResult.vatRate !== undefined ? `${classificationResult.vatRate}%` : "Not specified"}
GRI Reasoning Trail: ${JSON.stringify(classificationResult.reasoningTrail, null, 2)}
Sources: ${JSON.stringify(classificationResult.sources, null, 2)}${alternativesSection}

Generate a comprehensive, professional dossier that can be submitted to EU customs authorities. Include a detailed comparison table if alternatives exist, showing duty rates, confidence levels, and trade-offs.`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      });

      return response.choices[0]?.message?.content || "Failed to generate dossier";
    } catch (error) {
      throw new Error("Failed to generate reasoning dossier");
    }
  }
}

export const openaiService = new OpenAIClassificationService();

