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
    essentialCharacter?: string; // GRI 3(b) determination for multi-material products
  };
  suggestedChapters: Array<{
    chapter: number;
    heading?: number;
    subheading?: number;
    cnCode?: string; // 8-digit CN code if AI can determine it
    reason: string; // Must cite specific GRI rule
    confidence: number;
    legalBasis?: string; // Specific legal reference (Chapter Note, Heading, Legal Source ID)
  }>;
  classificationNotes: string[]; // Includes rejected alternatives and explanations
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
- NEVER guess a duty rate. If not explicitly provided in the 'Legal Sources' context, state that rates must be verified via the official TARIC database.
- If the product contains multiple materials, identify the 'Essential Character' per GRI 3(b).
- Priority Hierarchy: Legal Sources > Chapter Notes > Section Notes > General Knowledge
- FORBIDDEN: If a CN code is found in Legal Sources, you MUST use it. Do NOT suggest a different code.
- FORBIDDEN: If Legal Sources contradict your suggestion, you MUST use the Legal Source code and explain why.

OUTPUT REQUIREMENTS:
- For each suggested code, cite the specific GRI rule used
- If a code is found in Legal Sources, cite the source path
- If multiple materials, explain Essential Character determination (GRI 3b)
- Provide structured reasoning trail showing GRI 1 → GRI 3 (if needed) → GRI 6`;

    const legalContext = legalChunks && legalChunks.length > 0
      ? `\n\n### MANDATORY LEGAL SOURCES (Regulation EU 2021/1832) - ABSOLUTE AUTHORITY\n${legalChunks.map((chunk, idx) => `[ID: ${idx + 1}] Path: ${chunk.sectionPath}\nContent: ${chunk.excerpt}`).join("\n\n---\n\n")}\n\nCRITICAL RULES FOR LEGAL SOURCES:
1. If a specific CN code (8-digit) is mentioned in the Legal Sources above, you MUST use that exact code
2. If the Legal Sources describe the product and provide a code, that code is MANDATORY
3. If your initial suggestion contradicts the Legal Sources, you MUST use the Legal Source code instead
4. Cite the Legal Source path (e.g., "Chapter 42, Note 3(a)") in your reasoning
5. The Legal Sources are the official Combined Nomenclature - they override any general knowledge`
      : "\nNote: No specific legal chunks provided. Rely on standard GRI rules and Chapter Notes. Be extra cautious and cite your sources.";

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
        temperature: 0.1, // Lower temperature for legal work - reduces hallucination, increases consistency
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
          essentialCharacter: parsed.key_attributes?.essentialCharacter || parsed.key_attributes?.essential_character || undefined,
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
            legalBasis: ch.legalBasis || ch.legal_basis || undefined,
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
        temperature: 0.1, // Lower temperature for legal work
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
        temperature: 0.1, // Lower temperature for legal work
        response_format: { type: "json_object" },
        max_tokens: 2000, // Increase to prevent truncation of legal rationale
      });

      const content = response.choices[0]?.message?.content;
      
      // Check if response was truncated
      if (response.choices[0]?.finish_reason === "length") {
        console.warn("[OpenAI] Response was truncated due to token limit. Consider increasing max_tokens.");
      }
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error("Failed to parse OpenAI JSON response for legal rationale:", {
          error: parseError,
          contentLength: content.length,
          contentPreview: content.substring(0, 500),
          contentSuffix: content.substring(Math.max(0, content.length - 200)),
        });
        
        // Try to fix the JSON
        let fixedContent = content.trim();
        
        // Step 1: Fix unescaped single quotes inside double-quoted strings
        // This regex finds strings that contain unescaped single quotes and escapes them
        fixedContent = fixedContent.replace(/"([^"\\]*(?:\\.[^"\\]*)*)'([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, before, after) => {
          return `"${before.replace(/'/g, "\\'")}${after.replace(/'/g, "\\'")}"`;
        });
        
        // Step 2: Handle truncated strings - find incomplete string fields and close them
        // Look for patterns like: "legalRationale": "text that ends without closing quote
        // First, check if the content ends mid-string (no closing quote before the end)
        const endsWithUnclosedString = /"[^"]*":\s*"[^"]*$/.test(fixedContent);
        
        if (endsWithUnclosedString || !fixedContent.endsWith("}")) {
          // Find all string field patterns
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
            // Get the last (potentially incomplete) string field
            const lastMatch = matches[matches.length - 1];
            const incompleteValue = lastMatch.value;
            
            // Extract everything before the incomplete field
            const beforeIncomplete = fixedContent.substring(0, lastMatch.index);
            
            // Close the incomplete string properly (escape any quotes/special chars)
            const escapedValue = incompleteValue
              .replace(/\\/g, "\\\\")  // Escape backslashes first
              .replace(/"/g, '\\"')    // Escape double quotes
              .replace(/\n/g, "\\n")    // Escape newlines
              .replace(/\r/g, "\\r")    // Escape carriage returns
              .replace(/\t/g, "\\t");   // Escape tabs
            
            // Rebuild the JSON with the closed string and all required fields
            fixedContent = beforeIncomplete + `"${lastMatch.field}": "${escapedValue}",\n`;
            
            // Add remaining required fields with defaults if missing
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
        
        // Step 3: If content doesn't end with }, try to close it properly
        if (!fixedContent.endsWith("}") && !fixedContent.endsWith("}\n")) {
          // Find the last complete field before truncation
          const lastCompleteField = fixedContent.lastIndexOf('",');
          if (lastCompleteField > 0) {
            // Extract up to the last complete field and close the JSON
            fixedContent = fixedContent.substring(0, lastCompleteField + 1);
            // Add missing required fields if needed
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
            // Last resort: create minimal valid JSON
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
          // Try extracting JSON from markdown code blocks
          const jsonMatch = fixedContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[1]);
            } catch (e2) {
              // Last resort: try to find and parse any JSON object
              const jsonObjectMatch = fixedContent.match(/\{[\s\S]*\}/);
              if (jsonObjectMatch) {
                try {
                  parsed = JSON.parse(jsonObjectMatch[0]);
                } catch (e3) {
                  console.error("All JSON parsing attempts failed:", e3);
                  // Return a minimal valid response instead of throwing
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
                // Return minimal valid response
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
            // Return minimal valid response
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
      
      // Validate that the response doesn't mention a different CN code
      const legalRationaleText = (parsed.legalRationale || parsed.legal_rationale || "").toLowerCase();
      const distinctionsText = JSON.stringify(parsed.distinctions || parsed.distinction_notes || []).toLowerCase();
      const fullText = `${legalRationaleText} ${distinctionsText}`;
      
 
      
 
      

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
            console.log(`[OpenAI] Extracted duty rate ${extractedDutyRate}% from legal rationale text`);
            break;
          }
        }
      }

      // Extract VAT rate from text
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
            console.log(`[OpenAI] Extracted VAT rate ${extractedVatRate}% from legal rationale text`);
            break;
          }
        }
      }

      // Normalize response - prefer extracted from text, then JSON, then undefined
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

      // Extract GRI rule from text if not in JSON, or determine from reasoning trail
      let griRule = parsed.griRule || parsed.gri_rule;
      
      // If not in JSON, try to extract from legal rationale text
      if (!griRule) {
        const rationaleText = (parsed.legalRationale || parsed.legal_rationale || "").toLowerCase();
        const notesText = (parsed.notes || "").toLowerCase();
        const combinedText = `${rationaleText} ${notesText}`;
        
        // Look for GRI rule mentions: "GRI 1", "GRI_1", "General Rule 1", "Rule 1", etc.
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
              console.log(`[OpenAI] Extracted GRI rule ${griRule} from legal rationale text`);
              break;
            }
          }
        }
      }
      
      // If still not found, determine from reasoning trail or product characteristics
      if (!griRule && classification.reasoningTrail && classification.reasoningTrail.length > 0) {
        // Check if any step used GRI_3 (multiple headings) or GRI_6 (subheading)
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
        
        // Determine combined rules
        if (hasGRI3B) {
          griRule = "GRI_3B"; // Essential character for composite goods
        } else if (hasGRI3) {
          griRule = "GRI_3";
        } else if (hasHeading && hasGRI6) {
          griRule = "GRI_1_AND_6"; // Both GRI 1 (heading) and GRI 6 (subheading)
        } else if (hasGRI6) {
          griRule = "GRI_6";
        } else {
          // Default to GRI_1 (most common - used for chapter/heading determination)
          griRule = "GRI_1";
        }
        
        console.log(`[OpenAI] Determined GRI rule ${griRule} from reasoning trail`);
      }
      
      // Also check product characteristics for composite goods (toy + electronics, etc.)
      if (!griRule || griRule === "GRI_1") {
        const productName = (product.name || "").toLowerCase();
        const productDesc = (product.description || "").toLowerCase();
        const combined = `${productName} ${productDesc}`;
        
        // Check if it's a composite good that might need GRI 3(b)
        const compositeIndicators = [
          /toy.*(?:with|and|integrated).*(?:speaker|electronic|bluetooth|battery)/i,
          /(?:with|and|integrated).*(?:speaker|electronic|bluetooth).*(?:toy|doll|bear)/i,
          /(?:bag|handbag).*(?:with|and|integrated).*(?:electronic|battery|charger)/i,
        ];
        
        if (compositeIndicators.some(pattern => pattern.test(combined))) {
          griRule = "GRI_3B";
          console.log(`[OpenAI] Detected composite good, using GRI_3B for essential character determination`);
        }
      }
      
      // Final fallback
      if (!griRule) {
        griRule = "GRI_1"; // Most products are classified under GRI 1
      }

      // Log if duty rate is still missing
      if (dutyRate === undefined) {
        console.warn(`[OpenAI] Duty rate not found in legal rationale response for CN code ${classification.cnCode}`);
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
        temperature: 0.1, // Lower temperature for legal work
      });

      return response.choices[0]?.message?.content || "Failed to generate dossier";
    } catch (error) {
      console.error("OpenAI dossier generation error:", error);
      throw new Error("Failed to generate reasoning dossier");
    }
  }
}

export const openaiService = new OpenAIClassificationService();

