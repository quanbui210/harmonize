"use server";

import { prisma } from "@/lib/prisma";
import { euClassificationEngine } from "@/lib/eu/classification-engine";
import { openaiService } from "@/lib/eu/openai-service";
import type { EUProductAttributes, CNCode } from "@/lib/eu/types";
import { MarketCode } from "@prisma/client";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  // Build query from product information - use as-is, no keyword extraction
  const query = `${productName}. ${description}${compositionText ? `. Materials: ${compositionText}` : ""}`.trim();
  
  // Step 1: Generate embedding for the user query
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

/**
 * Extract CN codes directly from legal document chunks using RAG
 * The document has CN codes in table format like:
 *   CN code: 4202 21 00
 *   Description: ...
 * Or in table rows where code is at the start of the line
 */
function extractCNCodesFromChunks(chunks: Array<{ sectionPath: string; excerpt: string; fullContent?: string }>): string[] {
  const cnCodes: Set<string> = new Set();
  
  for (const chunk of chunks) {
    const content = chunk.fullContent || chunk.excerpt;
    
    // Pattern 1: "CN code: 4202 21 00" or "4202 21 00" (with or without spaces/dots)
    const pattern1 = /(?:CN\s+code|code)[:\s]*(\d{4}[\s\.]?\d{2}[\s\.]?\d{2})\b/gi;
    const matches1 = content.matchAll(pattern1);
    for (const match of matches1) {
      const code = match[1].replace(/[\s\.]/g, "");
      if (code.length === 8 && code !== "00000000") {
        const chapter = parseInt(code.substring(0, 2), 10);
        if (chapter >= 1 && chapter <= 97) {
          cnCodes.add(code);
        }
      }
    }
    
    // Pattern 2: Table format - code at start of line followed by description
    // Example from document: "4202 21 00" or "8901 10 10" at line start
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      // Match CN code at start of line (with optional whitespace, optional "CN code:" prefix)
      // Format: "4202 21 00" or "42022100" or "CN code: 4202 21 00"
      const lineMatch = line.match(/^(?:\s*CN\s+code[:\s]+)?(\d{4}[\s\.]?\d{2}[\s\.]?\d{2})\b/);
      if (lineMatch) {
        const code = lineMatch[1].replace(/[\s\.]/g, "");
        if (code.length === 8 && code !== "00000000") {
          const chapter = parseInt(code.substring(0, 2), 10);
          if (chapter >= 1 && chapter <= 97) {
            cnCodes.add(code);
          }
        }
      }
    }
    
    // Pattern 3: Any 8-digit code in the content (more permissive, but validate chapter)
    const pattern3 = /\b(\d{4}[\s\.]?\d{2}[\s\.]?\d{2})\b/g;
    const matches3 = content.matchAll(pattern3);
    for (const match of matches3) {
      const code = match[1].replace(/[\s\.]/g, "");
      if (code.length === 8 && code !== "00000000") {
        const chapter = parseInt(code.substring(0, 2), 10);
        if (chapter >= 1 && chapter <= 97) {
          cnCodes.add(code);
        }
      }
    }
  }
  
  // Return sorted by relevance (longer codes first, then by chapter)
  return Array.from(cnCodes).sort((a, b) => {
    // Prefer codes that are more specific (higher subheading digits)
    const aSpecificity = parseInt(a.substring(4, 8), 10);
    const bSpecificity = parseInt(b.substring(4, 8), 10);
    if (bSpecificity !== aSpecificity) return bSpecificity - aSpecificity;
    // Then by chapter
    return parseInt(a.substring(0, 2), 10) - parseInt(b.substring(0, 2), 10);
  });
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
}

export async function searchAndClassifyAction(input: {
  productName: string;
  description: string;
  intendedUse?: string;
  materials?: Array<{ material: string; percentage: number }>;
  compositionText?: string;
  originCountry?: string;
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

  // Search legal source chunks (like the chat does) to get accurate CN codes
  const legalChunks = await searchLegalChunksForProduct(
    input.productName,
    input.description,
    input.compositionText,
  );

  // Extract CN codes directly from legal document chunks (RAG-based extraction)
  const extractedCNCodes = extractCNCodesFromChunks(legalChunks);
  console.log(`[Classification] Extracted CN codes from legal document: ${extractedCNCodes.join(", ")}`);

  // If no chunks found from vector search, use LLM knowledge directly (like ChatGPT)
  let aiAnalysis;
  if (legalChunks.length === 0) {
    console.log(`[Classification] No chunks found from RAG, using LLM knowledge directly`);
    // Use LLM without legal chunks - it will use its training knowledge
    aiAnalysis = await openaiService.analyzeProduct(productAttributes, []);
  } else {
    aiAnalysis = await openaiService.analyzeProduct(productAttributes, legalChunks);
  }
  
  if (!aiAnalysis || !aiAnalysis.suggestedChapters || !Array.isArray(aiAnalysis.suggestedChapters)) {
    throw new Error("Invalid AI analysis response: missing suggestedChapters");
  }
  
  const needsChapterRefinement =
    aiAnalysis.suggestedChapters.length > 1 &&
    aiAnalysis.suggestedChapters[0]?.confidence < 0.85;

  const shouldAskComposition = shouldAskForComposition(
    input.description,
    aiAnalysis.suggestedChapters[0]?.chapter,
    input.compositionText,
    input.materials,
  );

  let refinementQuestion: RefinementQuestion | null = null;
  
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
        { value: "other", label: "Other / I’ll type it" },
      ],
      field: "compositionText",
    };
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
  
  // Priority 1: Use CN codes extracted directly from legal document (RAG)
  if (extractedCNCodes.length > 0) {
    // Use the first extracted code (most relevant based on search ranking)
    validatedCnCode = extractedCNCodes[0];
    console.log(`[Classification] Using CN code extracted from legal document (RAG): ${validatedCnCode}`);
    classificationResult = {
      ...classificationResult,
      cnCode: validatedCnCode as CNCode,
      confidence: 0.95, // High confidence when found in official document
      reasoningTrail: [
        ...(classificationResult.reasoningTrail || []),
        {
          griRule: "GRI_1",
          level: "SUBHEADING",
          selection: validatedCnCode,
          rationale: `CN Code ${validatedCnCode} extracted directly from Regulation (EU) 2021/1832 legal document`,
          score: 0.95,
        },
      ],
    };
  }
  // Priority 2: Use AI-provided CN code if no code found in document
  else if (aiAnalysis.suggestedChapters.length > 0) {
    const topSuggestion = aiAnalysis.suggestedChapters[0];
    
    if (topSuggestion.cnCode && topSuggestion.cnCode.length === 8 && topSuggestion.cnCode !== "00000000") {
      validatedCnCode = topSuggestion.cnCode;
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
    // Priority 3: If AI provided chapter/heading but no full CN code, ask LLM directly for the code
    else if (topSuggestion.chapter && topSuggestion.chapter > 0 && topSuggestion.chapter <= 97) {
      // Don't construct codes - if AI didn't provide full CN code, it's not reliable
      // Instead, throw error to force user to provide more details or use LLM directly
      console.warn(`[Classification] AI provided chapter ${topSuggestion.chapter} but no valid CN code. Using LLM to determine exact code.`);
      
      // Ask LLM directly for the exact CN code
      const directCodePrompt = `What is the exact 8-digit CN code (Combined Nomenclature) for this product?
Product: ${input.productName}
Description: ${input.description}
${input.compositionText ? `Materials: ${input.compositionText}` : ""}
${topSuggestion.chapter ? `Suggested Chapter: ${topSuggestion.chapter}` : ""}
${topSuggestion.heading ? `Suggested Heading: ${topSuggestion.heading}` : ""}

Return ONLY the 8-digit CN code (e.g., "42022100" for leather handbags), nothing else.`;

      try {
        const codeResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are an EU customs classification expert. Return only the 8-digit CN code." },
            { role: "user", content: directCodePrompt },
          ],
          temperature: 0.1,
        });
        
        const codeText = codeResponse.choices[0]?.message?.content?.trim() || "";
        // Extract 8-digit code from response
        const codeMatch = codeText.match(/\b(\d{8})\b/);
        if (codeMatch && codeMatch[1] !== "00000000") {
          validatedCnCode = codeMatch[1];
          console.log(`[Classification] LLM provided CN code directly: ${validatedCnCode}`);
          classificationResult = {
            ...classificationResult,
            cnCode: validatedCnCode as CNCode,
            confidence: Math.max(classificationResult.confidence || 0, topSuggestion.confidence || 0.8),
          };
        } else {
          throw new Error("LLM did not provide a valid CN code");
        }
      } catch (llmError) {
        console.error("[Classification] Failed to get CN code from LLM:", llmError);
        throw new Error(`Classification failed: Unable to determine valid CN code. Please provide more product details.`);
      }
    }
  }
  
  // Final validation - ensure we have a valid CN code
  if (!validatedCnCode || validatedCnCode === "00000000" || validatedCnCode === "00" || (validatedCnCode.startsWith("00") && validatedCnCode.length <= 2)) {
    console.error(`[Classification] CRITICAL: No valid CN code found. AI suggestions:`, aiAnalysis.suggestedChapters);
    console.error(`[Classification] GRI result:`, classificationResult.cnCode);
    throw new Error(`Classification failed: Unable to determine valid CN code. The AI did not provide a valid classification code. Please try again or provide more product details.`);
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

  // Generate professional legal rationale
  const legalInfo = await openaiService.generateLegalRationale(
    productAttributes,
    {
      cnCode: normalizedCnCode,
      cnCodeDescription,
      dutyRate: classificationResult.dutySummary?.baseDutyRate,
      vatRate: classificationResult.dutySummary?.vatRate,
      reasoningTrail: classificationResult.reasoningTrail || [],
      exclusionNotes: classificationResult.exclusionNotes || [],
      sources: classificationResult.sources || [],
    },
  );

  const candidates: ClassificationCandidate[] = [
    {
      htsCode,
      cnCode: normalizedCnCode,
      confidence: classificationResult.confidence || 0,
      description,
      // Use duty rate from legal rationale (LLM-generated) if available, otherwise fall back to classification result
      dutyRate: legalInfo.dutyRate !== undefined ? legalInfo.dutyRate : (classificationResult.dutySummary?.baseDutyRate || 0),
      vatRate: legalInfo.vatRate !== undefined ? legalInfo.vatRate : (classificationResult.dutySummary?.vatRate || 20),
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
    },
  ];

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

  // Create or update duty summary with rates from legal rationale (LLM-generated)
  // Use legalInfo rates if available (from LLM), otherwise use classificationResult rates
  // Note: dutyRate can be 0 (free), so we check for !== undefined, not truthy
  const finalDutyRate = legalInfo.dutyRate !== undefined 
    ? legalInfo.dutyRate 
    : (classificationResult.dutySummary?.baseDutyRate !== undefined 
        ? classificationResult.dutySummary.baseDutyRate 
        : 0);
  const finalVatRate = legalInfo.vatRate !== undefined 
    ? legalInfo.vatRate 
    : (classificationResult.dutySummary?.vatRate !== undefined 
        ? classificationResult.dutySummary.vatRate 
        : 20);
  
  console.log(`[Classification] Duty rate: ${finalDutyRate}% (from LLM: ${legalInfo.dutyRate}, from classification: ${classificationResult.dutySummary?.baseDutyRate})`);
  
  await prisma.dutySummary.create({
    data: {
      classificationId: classification.id,
      baseValue: 0,
      dutyRate: finalDutyRate,
      vatRate: finalVatRate,
      estimatedDuty: 0,
    },
  });

  return {
    productId: product.id,
    classificationId: classification.id,
    candidates,
    refinementQuestion,
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

