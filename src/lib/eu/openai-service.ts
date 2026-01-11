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
  };
  suggestedChapters: Array<{
    chapter: number;
    heading?: number;
    subheading?: number;
    cnCode?: string; // 8-digit CN code if AI can determine it
    reason: string;
    confidence: number;
  }>;
  classificationNotes: string[];
}

export class OpenAIClassificationService {
  async analyzeProduct(
    product: EUProductAttributes,
    legalChunks?: Array<{ sectionPath: string; excerpt: string }>,
  ): Promise<ProductAnalysisResult> {
    const systemPrompt = `You are an expert EU customs classification specialist. Your task is to analyze product descriptions and suggest appropriate CN (Combined Nomenclature) classification codes.

EU CN codes are 8-digit codes following the Harmonized System (HS) structure:
- First 2 digits: Chapter (01-97)
- Next 2 digits: Heading (within chapter)
- Next 2 digits: Subheading (within heading)
- Last 2 digits: EU-specific subdivision

Key Chapters and Valid Headings:
- Chapter 16: Preparations of meat, fish, etc. (Headings: 01-05 ONLY - Chapter 16 does NOT have heading 06 or higher!)
  * Heading 01: Sausages and similar products of meat (1601)
  * Heading 02: Other prepared or preserved meat (1602)
  * Heading 03: Extracts and juices of meat (1603)
  * Heading 04: Prepared or preserved fish (1604)
  * Heading 05: Crustaceans, molluscs, etc. (1605)
- Chapter 88: Aircraft, spacecraft, and parts thereof (Headings: 01-07)
- Chapter 85: Electrical machinery and equipment (Headings: 01-48)
- Chapter 84: Nuclear reactors, machinery (Headings: 01-94)
- Chapter 90: Optical, photographic, measuring instruments (Headings: 01-33)
- Chapter 95: Toys, games, sports requisites (Headings: 01-08)

CRITICAL VALIDATION RULES:
- Chapter 16 ONLY has headings 01-05. NEVER suggest heading 06 or higher for Chapter 16!
- For sausages and meat preparations: ALWAYS use Chapter 16, Heading 01 (1601) - NEVER heading 16!
- Examples:
  * Sausage → Chapter 16, Heading 01 (1601)
  * Canned meat → Chapter 16, Heading 02 (1602)
  * Meat extract → Chapter 16, Heading 03 (1603)
- Always verify heading numbers exist in the HS nomenclature before suggesting them
- If unsure about heading validity, provide only the chapter number

IMPORTANT: For products like drones, unmanned aircraft, or UAVs, you MUST suggest Chapter 88, Heading 06 (8806) with appropriate subheadings based on weight and features.

Provide structured analysis focusing on:
1. Primary function and intended use
2. Material composition (by percentage if available)
3. Technical features that affect classification
4. Suggested CN codes (8-digit) with confidence scores (0-1) and reasoning
5. If you can only determine the chapter, provide the chapter number and heading number if possible`;

    const legalContext = legalChunks && legalChunks.length > 0
      ? `\n\nRELEVANT LEGAL SOURCES from Regulation (EU) 2021/1832:\n${legalChunks.map((chunk, idx) => `[Source ${idx + 1}: ${chunk.sectionPath}]\n${chunk.excerpt}`).join("\n\n---\n\n")}\n\nCRITICAL: ALWAYS prioritize CN codes found in the legal sources above. If a specific CN code is mentioned in the sources for this product type, use that code. The legal sources contain the official Combined Nomenclature and take precedence over general knowledge.`
      : "";

    const userPrompt = `Analyze this product for EU CN classification and return the result as JSON:

Product Name: ${product.name}
Description: ${product.description}
Intended Use: ${product.intendedUse || "Not specified"}
Materials: ${JSON.stringify(product.materials)}
Additional Info: ${JSON.stringify(product.composition || product.technicalSpecs || {})}${legalContext}

Provide your response in JSON format with:
1. keyAttributes (primary function, materials breakdown, technical features, intended use)
2. suggestedChapters (array of objects with: chapter, heading (optional), subheading (optional), cnCode (8-digit if you can determine it), reason, confidence 0-1)
3. classificationNotes (any special considerations, exclusions, or warnings)

IMPORTANT: 
- If legal sources are provided above, ALWAYS prioritize CN codes found in those sources
- For example, if sources mention "0804 50 00" for dried mango, use that code (not "0813 40 00")
- Try to provide specific CN codes (8-digit) when possible, especially for well-known product categories like drones (8806), electronics (8504, 8517, etc.), or machinery (8414, 8421, etc.)
- When legal sources are available, cite them in your reasoning`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
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
        console.error("Failed to parse OpenAI JSON response:", content);
        throw new Error("OpenAI returned invalid JSON");
      }
      
      // Normalize snake_case to camelCase (OpenAI often returns snake_case)
      const normalized: ProductAnalysisResult = {
        keyAttributes: parsed.keyAttributes || parsed.key_attributes || {
          primaryFunction: parsed.key_attributes?.primary_function || "",
          materials: parsed.key_attributes?.materials || [],
          technicalFeatures: parsed.key_attributes?.technical_features || [],
          intendedUse: parsed.key_attributes?.intended_use || "",
        },
        suggestedChapters: parsed.suggestedChapters || parsed.suggested_chapters || [],
        classificationNotes: parsed.classificationNotes || parsed.classification_notes || [],
      };
      
      // Normalize chapter objects if they're in snake_case
      if (normalized.suggestedChapters.length > 0) {
        normalized.suggestedChapters = normalized.suggestedChapters.map((ch: any) => {
          const chapter = ch.chapter || ch.chapter_number || 0;
          const heading = ch.heading || ch.heading_number;
          const subheading = ch.subheading || ch.subheading_number;
          const cnCode = ch.cnCode || ch.cn_code || ch.cNCode;
          
          // If AI provided a CN code, use it; otherwise construct from chapter/heading/subheading
          let finalCnCode = cnCode;
          if (!finalCnCode && chapter) {
            const chapterStr = chapter.toString().padStart(2, "0");
            const headingStr = heading ? heading.toString().padStart(2, "0") : "00";
            const subheadingStr = subheading ? subheading.toString().padStart(2, "0") : "00";
            finalCnCode = `${chapterStr}${headingStr}${subheadingStr}00`.substring(0, 8);
          }
          
          return {
            chapter,
            heading,
            subheading,
            cnCode: finalCnCode,
            reason: ch.reason || ch.reasoning || "",
            confidence: ch.confidence || 0.5,
          };
        });
      }
      
      if (!normalized.suggestedChapters || !Array.isArray(normalized.suggestedChapters)) {
        console.error("Invalid OpenAI response structure. Expected suggestedChapters array, got:", {
          hasSuggestedChapters: !!normalized.suggestedChapters,
          type: typeof normalized.suggestedChapters,
          fullResponse: parsed,
        });
        throw new Error("OpenAI response missing suggestedChapters array");
      }
      
      if (normalized.suggestedChapters.length === 0) {
        console.warn("OpenAI response has no suggested chapters:", parsed);
        throw new Error("OpenAI response has no suggested chapters");
      }
      
      return normalized;
    } catch (error) {
      console.error("OpenAI classification error:", error);
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
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const parsed = JSON.parse(content);
      
      // Normalize response (handle both camelCase and snake_case)
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
      console.error("OpenAI refinement question error:", error);
      throw error;
    }
  }

  async generateLegalRationale(
    product: EUProductAttributes,
    classification: {
      cnCode: string;
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
    notes?: string;
  }> {
    const systemPrompt = `You are an expert EU customs classification specialist. Generate a professional legal rationale for a CN code classification that can be used in audit defense.

Your response must include:
1. Legal Rationale - Clear explanation using GRI rules
2. Distinctions - Why this heading over competing headings (e.g., "8806 vs 9503")
3. Key Features - Product characteristics that support the classification
4. GRI Rule - Which GRI rule was applied
5. Notes - Any relevant updates or special considerations

Return your response as JSON with: legalRationale, distinctions (array of {heading, reason}), keyFeatures (array), griRule, and notes (optional).`;

    const userPrompt = `Generate a professional legal rationale for this classification:

Product: ${product.name}
Description: ${product.description}
Intended Use: ${product.intendedUse || "Not specified"}

Classification Result:
CN Code: ${classification.cnCode}
GRI Reasoning Trail: ${JSON.stringify(classification.reasoningTrail, null, 2)}
Exclusion Notes: ${JSON.stringify(classification.exclusionNotes, null, 2)}
Sources: ${JSON.stringify(classification.sources.slice(0, 3), null, 2)}

Generate a professional, audit-ready legal rationale that:
- Explains the GRI rule application
- Distinguishes this classification from competing headings
- Lists key product features that support the classification
- Notes any relevant HS/CN updates or special considerations

Return your response as JSON.`;

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
      
      // Normalize response
      return {
        legalRationale: parsed.legalRationale || parsed.legal_rationale || "",
        distinctions: parsed.distinctions || parsed.distinction_notes || [],
        keyFeatures: parsed.keyFeatures || parsed.key_features || [],
        griRule: parsed.griRule || parsed.gri_rule || "GRI_1",
        notes: parsed.notes || undefined,
      };
    } catch (error) {
      console.error("OpenAI legal rationale error:", error);
      // Fallback
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
    },
  ): Promise<string> {
    const systemPrompt = `You are a customs broker preparing a formal Reasoning Dossier for EU customs authorities. This document must demonstrate that the CN code classification is correct and legally defensible.

Format the dossier as a professional document with:
1. Executive Summary
2. Product Description
3. GRI Analysis (step-by-step application of General Rules of Interpretation)
4. Source Attribution (legal notes, binding rulings, TARIC measures)
5. Conclusion

Be precise, cite sources, and follow EU customs documentation standards.`;

    const userPrompt = `Generate a Reasoning Dossier for this classification:

Product: ${product.name}
Description: ${product.description}

Classification Result:
CN Code: ${classificationResult.cnCode}
GRI Reasoning Trail: ${JSON.stringify(classificationResult.reasoningTrail, null, 2)}
Sources: ${JSON.stringify(classificationResult.sources, null, 2)}

Generate a comprehensive, professional dossier that can be submitted to EU customs authorities.`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      });

      return response.choices[0]?.message?.content || "Failed to generate dossier";
    } catch (error) {
      console.error("OpenAI dossier generation error:", error);
      throw new Error("Failed to generate reasoning dossier");
    }
  }
}

export const openaiService = new OpenAIClassificationService();

