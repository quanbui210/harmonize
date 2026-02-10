"use server";

import { prisma } from "@/lib/prisma";
import { euClassificationEngine } from "@/lib/eu/classification-engine";
import { openaiService } from "@/lib/eu/openai-service";
import type { EUProductAttributes, CNCode } from "@/lib/eu/types";
import { MarketCode } from "@prisma/client";
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";

/**
 * RAG-based search using vector similarity (cosine similarity)
 * Uses OpenAI embeddings to find semantically similar content in legal documents
 */
async function searchLegalChunksForProduct(
  productName: string,
  description: string,
  compositionText?: string,
  limit: number = 10,
) {
  // Build query from product information - enhance with product type keywords
  // Add context to help vector search find relevant chapters
  const baseQuery = `${productName}. ${description}${compositionText ? `. Materials: ${compositionText}` : ""}`.trim();
  
  // Add context to help vector search find relevant chapters
  const productTypeHints: string[] = [];
  const lowerName = productName.toLowerCase();
  const lowerDesc = description.toLowerCase();
  
  // Detect product categories to improve search
  if (lowerName.includes("trail mix") || lowerName.includes("snack") || 
      lowerDesc.includes("nuts") || lowerDesc.includes("dried fruit") ||
      (lowerDesc.includes("fruit") && !lowerDesc.includes("fish")) || 
      (lowerDesc.includes("vegetable") && !lowerDesc.includes("fish"))) {
    productTypeHints.push("preparations of vegetables fruit nuts", "Chapter 20");
  }
  if (lowerName.includes("fish") || lowerDesc.includes("fish") || lowerDesc.includes("seafood") || lowerDesc.includes("aquatic")) {
    productTypeHints.push("fish aquatic products", "Chapter 3");
  }
  if (lowerName.includes("textile") || lowerDesc.includes("fabric") || lowerDesc.includes("cotton") || lowerDesc.includes("wool")) {
    productTypeHints.push("textiles", "Chapter 50-63");
  }
  if (lowerName.includes("electronic") || lowerDesc.includes("battery") || lowerDesc.includes("circuit")) {
    productTypeHints.push("electrical machinery", "Chapter 85");
  }
  
  const query = productTypeHints.length > 0 
    ? `${baseQuery}. Product category: ${productTypeHints.join(", ")}`
    : baseQuery;
  
  // Step 1: Generate embedding for the user query
  const openai = createFeatureOpenAIClient("Classification Search Embeddings");
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  
  const queryEmbedding = embeddingResponse.data[0].embedding;
  
  // Step 2: Format embedding as PostgreSQL vector array string
  const embeddingVectorStr = `[${queryEmbedding.join(",")}]`;
  
  // Step 3: Use vector similarity search (cosine distance) with pgvector
  let chunks: Array<{
    id: string;
    sectionPath: string;
    content: string;
    pageStart: number | null;
    pageEnd: number | null;
    similarity: number;
  }>;
  
  try {
    // Use pgvector cosine distance operator (<=>) for similarity search
    // 1 - distance = similarity (higher is more similar)
    const sql = `
      SELECT 
        id,
        "sectionPath",
        content,
        "pageStart",
        "pageEnd",
        1 - (embedding <=> '${embeddingVectorStr}'::vector) as similarity
      FROM "LegalSourceChunk"
      WHERE 
        source = 'EUR_LEX'
        AND regulation = 'EU_2021_1832'
        AND language = 'EN'
        AND embedding IS NOT NULL
      ORDER BY embedding <=> '${embeddingVectorStr}'::vector
      LIMIT ${limit}
    `;
    
    chunks = await prisma.$queryRawUnsafe<Array<{
      id: string;
      sectionPath: string;
      content: string;
      pageStart: number | null;
      pageEnd: number | null;
      similarity: number;
    }>>(sql);
    
    console.log(`[RAG] Vector search found ${chunks.length} chunks with similarity scores`);
    
    if (chunks.length === 0) {
      console.log("[RAG] No chunks with embeddings found, falling back to keyword search");
      const fallbackChunks = await prisma.legalSourceChunk.findMany({
        where: {
    source: "EUR_LEX",
    regulation: "EU_2021_1832",
    language: "EN",
        },
    take: limit,
    select: {
      id: true,
      sectionPath: true,
      content: true,
      pageStart: true,
      pageEnd: true,
    },
  });

      chunks = fallbackChunks.map((chunk) => ({
        ...chunk,
        similarity: 0.5, // Default similarity for fallback
      }));
      
      console.log(`[RAG] Fallback keyword search found ${chunks.length} chunks`);
    }
  } catch (error) {
    console.error("[RAG] Vector search failed (embeddings may not be populated):", error);
    // Fallback: return empty or use basic search
    chunks = await prisma.legalSourceChunk.findMany({
      where: {
        source: "EUR_LEX",
        regulation: "EU_2021_1832",
        language: "EN",
      },
      take: limit,
      select: {
        id: true,
        sectionPath: true,
        content: true,
        pageStart: true,
        pageEnd: true,
      },
    }).then((chunks) => chunks.map((chunk) => ({
      ...chunk,
      similarity: 0.5, // Default similarity for fallback
    })));
    
    console.log(`[RAG] Error fallback found ${chunks.length} chunks`);
  }

  return chunks.map((chunk) => ({
    sectionPath: chunk.sectionPath,
    excerpt: chunk.content.slice(0, 800) + (chunk.content.length > 800 ? "..." : ""),
    pageStart: chunk.pageStart || undefined,
    pageEnd: chunk.pageEnd || undefined,
    fullContent: chunk.content,
    similarity: chunk.similarity || 0,
  }));
}


import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";

interface RefinementQuestion {
  question: string;
  explanation: string;
  options: Array<{ value: string; label: string }>;
  field: string;
}

interface ClassificationCandidate {
  htsCode: string;
  cnCode: string;
  confidence: number;
  description: string;
  dutyRate: number;
  vatRate: number;
  precedent?: string;
  reasoning: string;
  legalRationale?: string;
  distinctions?: Array<{
    heading: string;
    reason: string;
  }>;
  keyFeatures?: string[];
  griRule?: string;
  notes?: string;
  isPrimary?: boolean; // True for primary recommendation
  // Import guidance fields
  importGuidance?: {
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
  };
}

interface AlternativeClassification {
  cnCode: string;
  htsCode: string;
  reason: string;
  confidence: number;
  dutyRate: number;
  tradeOffs?: string;
}

export async function searchAndClassifyAction(input: {
  productName: string;
  description: string;
  intendedUse?: string;
  materials?: Array<{ material: string; percentage: number }>;
  compositionText?: string;
  originCountry?: string;
  destinationCountry?: string;
  market: MarketCode;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership) {
    throw new Error("No organization found");
  }

  const productAttributes: EUProductAttributes = {
    name: input.productName,
    description: input.description,
    intendedUse: input.intendedUse,
    materials: input.materials || [],
    technicalSpecs: input.compositionText
      ? { compositionText: input.compositionText }
      : undefined,
  };

 
  const aiAnalysis = await openaiService.analyzeProduct(productAttributes, []);
  
  if (!aiAnalysis || !aiAnalysis.suggestedChapters || !Array.isArray(aiAnalysis.suggestedChapters)) {
    throw new Error("Invalid AI analysis response: missing suggestedChapters");
  }

  const aiSuggestedChapters = new Set(
    aiAnalysis.suggestedChapters
      .map((ch) => ch.chapter)
      .filter((ch): ch is number => typeof ch === "number" && ch > 0 && ch <= 97)
  );
  
  console.log(`[Classification] AI suggested chapters: ${Array.from(aiSuggestedChapters).join(", ")}`);
  
  const needsChapterRefinement =
    aiAnalysis.suggestedChapters.length > 1 &&
    aiAnalysis.suggestedChapters[0]?.confidence < 0.85;

  const shouldAskComposition = shouldAskForComposition(
    input.description,
    aiAnalysis.suggestedChapters[0]?.chapter,
    input.compositionText,
    input.materials,
  );

  // Parse AI clarifying question if available
  const aiRefinementQuestion = aiAnalysis.clarifyingQuestion ? {
    question: aiAnalysis.clarifyingQuestion.question,
    explanation: aiAnalysis.clarifyingQuestion.explanation,
    options: (aiAnalysis.clarifyingQuestion.options || []).map(opt => {
      if (typeof opt === "string") return { value: opt, label: opt };
      if (opt && typeof opt === "object") {
        return {
          value: opt.value || opt.label || String(opt),
          label: opt.label || opt.value || String(opt),
        };
      }
      return { value: String(opt), label: String(opt) };
    }).filter(opt => opt.value && opt.label),
    field: "classification",
  } : null;

  let refinementQuestion: RefinementQuestion | null = null;
  
  // Logic for selecting the best refinement question:
  // 1. If it's a textile missing composition, FORCE the specific composition question (critical for duty rates)
  // 2. If the AI provided a clarifying question in the analysis, use that (now handles missing info for all products)
  // 3. If confidence is low and no question yet, generate one dynamically
  
  if (shouldAskComposition) {
    refinementQuestion = {
      question: "What is the primary material / fiber content by weight?",
      explanation:
        "For textiles and certain apparel categories, material composition changes the legal code and duty rate. Provide the primary material so we can classify accurately.",
      options: [
        { value: "100% cotton", label: "Cotton (mostly / 100%)" },
        { value: "synthetic (polyester/nylon)", label: "Synthetic (polyester / nylon)" },
        { value: "wool", label: "Wool" },
        { value: "silk", label: "Silk" },
        { value: "other", label: "Other / I&apos;ll type it" },
      ],
      field: "compositionText",
    };
  } else if (aiRefinementQuestion) {
    refinementQuestion = aiRefinementQuestion;
  } else if (needsChapterRefinement) {
    const topChapters = aiAnalysis.suggestedChapters.slice(0, 2);
    const question = await generateRefinementQuestion(
      productAttributes,
      topChapters,
    );
    refinementQuestion = question;
  }

  let classificationResult = await euClassificationEngine.classifyProduct(
    productAttributes,
  );

  let validatedCnCode = classificationResult.cnCode || "";
  
  // NEW PRIORITY: Use LLM knowledge as primary source (most reliable)
  // Legal sources are used for validation/enhancement, not as primary source
  
  // Priority 1: Use AI-provided CN code (LLM knowledge - most reliable)
  if (aiAnalysis.suggestedChapters.length > 0) {
    const topSuggestion = aiAnalysis.suggestedChapters[0];
    
    // Normalize CN code (remove spaces, dots, etc.)
    // Note: openai-service.ts should already normalize, but do it again here for safety
    let normalizedAiCode = topSuggestion.cnCode || "";
    if (normalizedAiCode) {
      // Remove all non-digit characters
      const digitsOnly = normalizedAiCode.replace(/\D/g, "");
      if (digitsOnly.length >= 8) {
        normalizedAiCode = digitsOnly.substring(0, 8);
      } else if (digitsOnly.length >= 6) {
        normalizedAiCode = digitsOnly.padEnd(8, "0");
      } else {
        normalizedAiCode = "";
      }
      console.log(`[Classification] Normalized AI CN code: "${topSuggestion.cnCode}" → "${normalizedAiCode}"`);
    }
    
    if (normalizedAiCode && normalizedAiCode.length === 8 && normalizedAiCode !== "00000000") {
      validatedCnCode = normalizedAiCode;
      console.log(`[Classification] Using AI-provided CN code (not found in document): ${validatedCnCode}`);
        classificationResult = {
          ...classificationResult,
        cnCode: validatedCnCode as CNCode,
          confidence: Math.max(classificationResult.confidence || 0, topSuggestion.confidence || 0.8),
          reasoningTrail: [
            ...(classificationResult.reasoningTrail || []),
            {
              griRule: "GRI_1",
              level: "SUBHEADING",
            selection: validatedCnCode,
            rationale: `AI-provided CN Code ${validatedCnCode}: ${topSuggestion.reason}`,
              score: topSuggestion.confidence || 0.8,
            },
          ],
        };
    } 
    // Priority 2: If AI provided chapter/heading but no valid CN code, construct it from components
    else if (topSuggestion.chapter && topSuggestion.chapter > 0 && topSuggestion.chapter <= 97) {
      // Construct CN code from chapter/heading/subheading if provided
      const chapterStr = topSuggestion.chapter.toString().padStart(2, "0");
      
      // Parse heading - might be string like "20 08" or number like 8
      // Note: TypeScript types heading as number | undefined, but AI might return string
      let headingNum: number | null = null;
      const headingValue: unknown = (topSuggestion as any).heading;
      if (headingValue !== undefined && headingValue !== null) {
        if (typeof headingValue === "string") {
          // Extract last 2 digits from string like "20 08" -> 8
          const headingDigits = headingValue.replace(/\D/g, "");
          if (headingDigits.length >= 2) {
            headingNum = parseInt(headingDigits.slice(-2), 10);
          } else if (headingDigits.length > 0) {
            headingNum = parseInt(headingDigits, 10);
          }
        } else if (typeof headingValue === "number") {
          headingNum = headingValue;
        }
      }
      const headingStr = headingNum !== null ? headingNum.toString().padStart(2, "0") : "00";
      
      // Parse subheading - might be string like "20 08 19" or number like 19
      // Note: TypeScript types subheading as number | undefined, but AI might return string
      let subheadingNum: number | null = null;
      const subheadingValue: unknown = (topSuggestion as any).subheading;
      if (subheadingValue !== undefined && subheadingValue !== null) {
        if (typeof subheadingValue === "string") {
          // Extract last 2 digits from string like "20 08 19" -> 19
          const subheadingDigits = subheadingValue.replace(/\D/g, "");
          if (subheadingDigits.length >= 2) {
            subheadingNum = parseInt(subheadingDigits.slice(-2), 10);
          } else if (subheadingDigits.length > 0) {
            subheadingNum = parseInt(subheadingDigits, 10);
          }
        } else if (typeof subheadingValue === "number") {
          subheadingNum = subheadingValue;
        }
      }
      const subheadingStr = subheadingNum !== null ? subheadingNum.toString().padStart(2, "0") : "00";
      
      // Construct 8-digit code: chapter (2) + heading (2) + subheading (2) + "00"
      validatedCnCode = `${chapterStr}${headingStr}${subheadingStr}00`.substring(0, 8);
      
      console.log(`[Classification] Constructed CN code from AI components: ${validatedCnCode} (Chapter ${topSuggestion.chapter}, Heading ${headingNum || "N/A"}, Subheading ${subheadingNum || "N/A"})`);
      
      classificationResult = {
        ...classificationResult,
        cnCode: validatedCnCode as CNCode,
        confidence: Math.max(classificationResult.confidence || 0, topSuggestion.confidence || 0.8),
        reasoningTrail: [
          ...(classificationResult.reasoningTrail || []),
          {
            griRule: "GRI_1",
            level: "SUBHEADING",
            selection: validatedCnCode,
            rationale: `Constructed CN Code ${validatedCnCode} from AI analysis: ${topSuggestion.reason}`,
            score: topSuggestion.confidence || 0.8,
          },
        ],
      };
    }
  }
  
  // Priority 3: Use classification engine result as fallback (if LLM didn't provide valid code)
  // Note: RAG search removed - was causing latency and most codes were rejected
  
  // Final validation - ensure we have a valid CN code
  if (!validatedCnCode || validatedCnCode.length !== 8 || validatedCnCode === "00000000" || validatedCnCode === "00" || (validatedCnCode.startsWith("00") && validatedCnCode.length <= 2)) {
    console.error(`[Classification] CRITICAL: No valid CN code found.`);
    console.error(`[Classification] validatedCnCode: "${validatedCnCode}" (length: ${validatedCnCode?.length || 0})`);
    console.error(`[Classification] AI suggestions:`, JSON.stringify(aiAnalysis.suggestedChapters, null, 2));
    console.error(`[Classification] GRI result:`, classificationResult.cnCode);
    
    // Last resort: try to use the first AI suggestion's chapter to construct a basic code
    if (aiAnalysis.suggestedChapters.length > 0 && aiAnalysis.suggestedChapters[0].chapter) {
      const fallbackChapter = aiAnalysis.suggestedChapters[0].chapter;
      if (fallbackChapter > 0 && fallbackChapter <= 97) {
        validatedCnCode = `${fallbackChapter.toString().padStart(2, "0")}000000`.substring(0, 8);
        console.warn(`[Classification] Using fallback code from chapter only: ${validatedCnCode}`);
      classificationResult.cnCode = validatedCnCode as CNCode;
      } else {
        throw new Error(`Classification failed: Unable to determine valid CN code. The AI did not provide a valid classification code. Please try again or provide more product details.`);
      }
    } else {
      throw new Error(`Classification failed: Unable to determine valid CN code. The AI did not provide a valid classification code. Please try again or provide more product details.`);
    }
  }

  // Update classificationResult with validated code
  classificationResult.cnCode = validatedCnCode as CNCode;

  console.log(`[Classification] Final CN Code: ${validatedCnCode}, will pad to HTS: ${validatedCnCode.padEnd(10, "0")}`);

  // Get description from database cache or TARIC API (Phase 1)
  const description = await getDescriptionForCNCode(validatedCnCode);

  // Ensure CN code is exactly 8 digits before padding
  const normalizedCnCode = validatedCnCode.length === 8 ? validatedCnCode : validatedCnCode.padEnd(8, "0").substring(0, 8);
  // Extract HS code (first 6 digits of CN code)
  const hsCode = normalizedCnCode.substring(0, 6);
  // Pad CN to HTS (10 digits)
  const htsCode = normalizedCnCode.padEnd(10, "0");

  console.log(`[Classification] HS: ${hsCode}, CN: ${normalizedCnCode}, HTS: ${htsCode}`);

  // Fetch CN code description to provide context to LLM
  const cnCodeDescription = await getDescriptionForCNCode(normalizedCnCode);

  // Get duty rate from AI analysis if available (Priority 1), otherwise from classification result
  const aiDutyRate = aiAnalysis.suggestedChapters[0]?.dutyRate;
  const classificationDutyRate = classificationResult.dutySummary?.baseDutyRate;
  const initialDutyRate = aiDutyRate !== undefined ? aiDutyRate : (classificationDutyRate !== undefined ? classificationDutyRate : undefined);
  
  console.log(`[Classification] Duty rate sources - AI: ${aiDutyRate}, Classification: ${classificationDutyRate}, Using: ${initialDutyRate}`);

  // Generate professional legal rationale and import guidance in parallel
  const [legalInfo, importGuidance] = await Promise.all([
    openaiService.generateLegalRationale(
    productAttributes,
    {
      cnCode: normalizedCnCode,
        cnCodeDescription,
        dutyRate: initialDutyRate, // Pass AI-provided duty rate if available
        vatRate: classificationResult.dutySummary?.vatRate,
      reasoningTrail: classificationResult.reasoningTrail || [],
      exclusionNotes: classificationResult.exclusionNotes || [],
      sources: classificationResult.sources || [],
    },
    ),
    openaiService.generateImportGuidance(
      productAttributes,
      {
        cnCode: normalizedCnCode,
        cnCodeDescription,
        dutyRate: aiDutyRate !== undefined 
          ? aiDutyRate 
          : (classificationResult.dutySummary?.baseDutyRate !== undefined 
              ? classificationResult.dutySummary.baseDutyRate 
              : undefined),
        originCountry: input.originCountry,
      },
    ),
  ]);

  let finalVatRate = 20; 
  if (input.destinationCountry) {
    const { getVATRate, detectProductTypeForVAT } = await import("@/lib/eu/vat-rates");
    const productType = detectProductTypeForVAT(input.productName, input.description);
    finalVatRate = getVATRate(input.destinationCountry, productType);
    console.log(`[Classification] Using destination-specific VAT rate: ${finalVatRate}% for ${input.destinationCountry} (product type: ${productType})`);
  } else {
    finalVatRate = legalInfo.vatRate !== undefined ? legalInfo.vatRate : (classificationResult.dutySummary?.vatRate || 20);
  }

  const primaryCandidate: ClassificationCandidate = {
      htsCode,
      cnCode: normalizedCnCode,
      confidence: classificationResult.confidence || 0,
      description,
    dutyRate: aiDutyRate !== undefined 
      ? aiDutyRate 
      : (legalInfo.dutyRate !== undefined 
          ? legalInfo.dutyRate 
          : (classificationResult.dutySummary?.baseDutyRate || 0)),
    vatRate: finalVatRate,
      precedent: classificationResult.sources.find(
        (s) => s.sourceType === "BINDING_RULING",
      )?.referenceId,
      reasoning: (classificationResult.reasoningTrail || [])
        .map((r) => r.rationale)
        .join(" "),
      legalRationale: legalInfo.legalRationale,
      distinctions: legalInfo.distinctions,
      keyFeatures: legalInfo.keyFeatures,
      griRule: legalInfo.griRule,
      notes: legalInfo.notes,
    importGuidance,
    isPrimary: true,
  };

  const alternativeCandidates: ClassificationCandidate[] = [];
  if (aiAnalysis.alternativeClassifications && aiAnalysis.alternativeClassifications.length > 0) {
    for (const alt of aiAnalysis.alternativeClassifications) {
      const altCnCode = alt.cnCode.replace(/\D/g, "").substring(0, 8).padEnd(8, "0");
      const altHtsCode = altCnCode.padEnd(10, "0");
      
      alternativeCandidates.push({
        htsCode: altHtsCode,
        cnCode: altCnCode,
        confidence: alt.confidence,
        description: `Alternative classification: ${altCnCode}`,
        dutyRate: alt.dutyRate || 0,
        vatRate: finalVatRate, 
        reasoning: alt.reason,
        notes: alt.tradeOffs,
        isPrimary: false,
      });
    }
  }

  const candidates: ClassificationCandidate[] = [primaryCandidate, ...alternativeCandidates];

  const product = await prisma.product.create({
    data: {
      organizationId: membership.organizationId,
      createdById: user.id,
      name: input.productName,
      description: input.description,
      intendedUse: input.intendedUse,
      targetMarkets: [input.market],
      metadata: {
        originCountry: input.originCountry || null,
        compositionText: input.compositionText || null,
      },
      ...(input.materials && input.materials.length > 0
        ? {
            materials: {
              createMany: {
                data: input.materials.map((m) => ({
                  material: m.material,
                  percentage: m.percentage,
                })),
              },
            },
          }
        : {}),
    },
  });

  // Use the normalized codes from candidates
  const candidate = candidates[0];
  if (!candidate || !candidate.htsCode || candidate.htsCode === "0000000000") {
    console.error(`[Classification] CRITICAL: Invalid candidate HTS code: ${candidate?.htsCode}`);
    throw new Error(`Classification failed: Invalid HTS code generated. Please try again.`);
  }

  const classification = await prisma.classification.create({
    data: {
      organizationId: membership.organizationId,
      productId: product.id,
      market: input.market,
      hsCode: hsCode, // Store HS code (6 digits)
      htsCode: candidate.htsCode,
      confidence: candidate.confidence,
      summary: `CN Code: ${candidate.cnCode}`,
      reasoningTrail: classificationResult.reasoningTrail as any,
      exclusionNotes: classificationResult.exclusionNotes as any,
      refinementQuestion: refinementQuestion ? JSON.stringify(refinementQuestion) : null,
      requiresReview: candidate.confidence < 0.8,
      status: refinementQuestion ? "NEEDS_REVIEW" : "DRAFT",
      // Store legal rationale and related data
      legalRationale: legalInfo.legalRationale,
      distinctions: legalInfo.distinctions as any,
      keyFeatures: legalInfo.keyFeatures as any,
      griRule: legalInfo.griRule,
      notes: legalInfo.notes,
      // Store import guidance and alternatives in humanNotes (temporary - we'll add proper fields later)
      humanNotes: JSON.stringify({
        importGuidance: importGuidance || null,
        alternativeClassifications: alternativeCandidates.length > 0 ? alternativeCandidates.map(alt => ({
          cnCode: alt.cnCode,
          htsCode: alt.htsCode,
          confidence: alt.confidence,
          dutyRate: alt.dutyRate,
          vatRate: alt.vatRate,
          reasoning: alt.reasoning,
          tradeOffs: alt.notes,
        })) : null,
      }),
    } as any,
  });

  await prisma.classificationSource.createMany({
    data: classificationResult.sources.map((source) => ({
      classificationId: classification.id,
      sourceType: source.sourceType,
      referenceId: source.referenceId,
      excerpt: source.excerpt,
      metadata: source.metadata as any,
    })),
  });


  const finalDutyRate = primaryCandidate.dutyRate;
  
  console.log(`[Classification] Final duty rate: ${finalDutyRate}% (AI initial: ${aiDutyRate}, Legal rationale: ${legalInfo.dutyRate}, Classification: ${classificationResult.dutySummary?.baseDutyRate})`);
  console.log(`[Classification] Final VAT rate: ${primaryCandidate.vatRate}% (destination: ${input.destinationCountry || "default"})`);
  
    await prisma.dutySummary.create({
      data: {
        classificationId: classification.id,
        baseValue: 0,
      dutyRate: finalDutyRate,
      vatRate: primaryCandidate.vatRate,
        estimatedDuty: 0,
      },
  });

  // Debug: Log if question exists
  if (refinementQuestion) {
    console.log("[Classification] Refinement question generated:", {
      question: refinementQuestion.question,
      explanation: refinementQuestion.explanation,
      optionsCount: refinementQuestion.options?.length || 0,
      options: refinementQuestion.options,
      field: refinementQuestion.field,
    });
  } else {
    console.log("[Classification] No refinement question generated");
  }

  return {
    productId: product.id,
    classificationId: classification.id,
    candidates,
    refinementQuestion: refinementQuestion,
    needsRefinement: !!refinementQuestion,
  };
}

function shouldAskForComposition(
  description: string,
  topChapter?: number,
  compositionText?: string,
  materials?: Array<{ material: string; percentage: number }>,
): boolean {
  if (materials && materials.length > 0) return false;
  if (compositionText && compositionText.trim().length > 0) return false;

  const text = (description || "").toLowerCase();

  const textileKeywords = [
    "shirt",
    "t-shirt",
    "t shirt",
    "hoodie",
    "jacket",
    "coat",
    "pants",
    "trousers",
    "jeans",
    "dress",
    "skirt",
    "sock",
    "glove",
    "hat",
    "cap",
    "scarf",
    "sweater",
    "knit",
    "woven",
    "textile",
    "fabric",
    "garment",
    "apparel",
    "clothing",
  ];

  const isTextileByChapter = typeof topChapter === "number" && topChapter >= 50 && topChapter <= 67;
  const isTextileByText = textileKeywords.some((k) => text.includes(k));

  return isTextileByChapter || isTextileByText;
}

async function generateRefinementQuestion(
  product: EUProductAttributes,
  chapters: Array<{ chapter: number; reason: string; confidence: number }>,
): Promise<RefinementQuestion> {
  // Use AI to generate a smart, product-specific refinement question
  try {
    const question = await openaiService.generateRefinementQuestion(product, chapters);
    return question;
  } catch (error) {
    console.error("Failed to generate AI refinement question, using fallback:", error);
    // Fallback to generic question
    const chapter1 = chapters[0];
    const chapter2 = chapters[1];
    return {
      question: `Which classification best matches this product?`,
      explanation: `The product "${product.name}" could be classified under Chapter ${chapter1.chapter} or Chapter ${chapter2.chapter}. Please select the most accurate classification.`,
      options: [
        { value: `chapter_${chapter1.chapter}`, label: `Chapter ${chapter1.chapter}: ${chapter1.reason}` },
        { value: `chapter_${chapter2.chapter}`, label: `Chapter ${chapter2.chapter}: ${chapter2.reason}` },
      ],
      field: "classification",
    };
  }
}

import { getCNCodeDescription } from "./cn-descriptions";

async function getDescriptionForCNCode(cnCode: string): Promise<string> {
  return getCNCodeDescription(cnCode as CNCode, MarketCode.EU);
}

export async function answerRefinementQuestionAction(input: {
  classificationId: string;
  answer: string;
  field: string;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership) {
    throw new Error("No organization found");
  }

  const classification = await prisma.classification.findFirst({
    where: {
      id: input.classificationId,
      organizationId: membership.organizationId,
    },
    include: {
      product: true,
    },
  });

  if (!classification) {
    throw new Error("Classification not found");
  }

  const nextMetadata = {
    ...(classification.product.metadata as Record<string, unknown> | null),
  } as Record<string, unknown>;

  if (input.field === "compositionText") {
    nextMetadata.compositionText = input.answer;
  }

  if (Object.keys(nextMetadata).length > 0) {
    await prisma.product.update({
      where: { id: classification.product.id },
      data: {
        metadata: nextMetadata as any,
      },
    });
  }

  await prisma.classification.update({
    where: { id: classification.id },
    data: {
      refinementAnswer: JSON.stringify({
        field: input.field,
        answer: input.answer,
        answeredAt: new Date().toISOString(),
      }),
      refinementQuestion: null, // Clear the question after it's answered
      status: "DRAFT",
    } as any,
  });

  const productAttributes: EUProductAttributes = {
    name: classification.product.name,
    description: classification.product.description,
    intendedUse: classification.product.intendedUse || undefined,
    materials: [],
    technicalSpecs:
      input.field === "compositionText"
        ? { compositionText: input.answer }
        : (classification.product.metadata as any)?.compositionText
          ? { compositionText: (classification.product.metadata as any).compositionText }
          : undefined,
  };

  const updatedResult = await euClassificationEngine.classifyProduct(
    productAttributes,
  );

  const hsCode = updatedResult.cnCode.substring(0, 6);
  const htsCode = updatedResult.cnCode.padEnd(10, "0");
  
  await prisma.classification.update({
    where: { id: classification.id },
    data: {
      hsCode: hsCode,
      htsCode: htsCode,
      confidence: updatedResult.confidence,
      summary: `CN Code: ${updatedResult.cnCode}`,
      reasoningTrail: updatedResult.reasoningTrail as any,
      requiresReview: updatedResult.confidence < 0.8,
      status: updatedResult.confidence < 0.8 ? "NEEDS_REVIEW" : "DRAFT",
    },
  });

  return {
    classificationId: classification.id,
    updatedHtsCode: updatedResult.cnCode.padEnd(10, "0"),
    confidence: updatedResult.confidence,
  };
}

