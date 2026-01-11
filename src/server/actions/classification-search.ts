"use server";

import { prisma } from "@/lib/prisma";
import { euClassificationEngine } from "@/lib/eu/classification-engine";
import { openaiService } from "@/lib/eu/openai-service";
import type { EUProductAttributes, CNCode } from "@/lib/eu/types";
import { MarketCode } from "@prisma/client";

/**
 * Search LegalSourceChunk for relevant content based on product information
 * Similar to compliance chat but optimized for classification
 */
async function searchLegalChunksForProduct(
  productName: string,
  description: string,
  compositionText?: string,
  limit: number = 10,
) {
  // Build search query from product information
  const searchTerms: string[] = [];
  
  // Extract keywords from product name and description
  const text = `${productName} ${description} ${compositionText || ""}`.toLowerCase();
  const words = text
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter((w) => !["product", "item", "goods", "article"].includes(w));
  
  searchTerms.push(...words.slice(0, 10)); // Limit to top 10 keywords
  
  // Extract potential CN codes mentioned
  const cnCodeMatches = text.match(/\b(\d{4}[\s\.]?\d{2}[\s\.]?\d{2})\b/g);
  const cnCodes: string[] = [];
  if (cnCodeMatches) {
    cnCodes.push(...cnCodeMatches.map((m) => m.replace(/[\s\.]/g, "")));
  }
  
  // Extract chapter numbers
  const chapterMatches = text.match(/\b(?:chapter|ch\.?)\s*(\d{1,2})\b/gi);
  const chapters: number[] = [];
  if (chapterMatches) {
    chapters.push(...chapterMatches.map((m) => parseInt(m.match(/\d+/)?.[0] || "0")).filter((n) => n > 0 && n <= 97));
  }

  const where: any = {
    source: "EUR_LEX",
    regulation: "EU_2021_1832",
    language: "EN",
  };

  const orConditions: any[] = [];

  // Search for CN codes
  for (const code of cnCodes) {
    orConditions.push({ content: { contains: code, mode: "insensitive" } });
    // Also search formatted versions
    if (code.length === 8) {
      orConditions.push({
        content: {
          contains: `${code.substring(0, 4)} ${code.substring(4, 6)} ${code.substring(6, 8)}`,
          mode: "insensitive",
        },
      });
    }
  }

  // Search for chapters
  for (const chapter of chapters) {
    orConditions.push({
      sectionPath: { contains: `CHAPTER ${chapter}`, mode: "insensitive" },
    });
    orConditions.push({
      content: { contains: `Chapter ${chapter}`, mode: "insensitive" },
    });
  }

  // Search for keywords
  for (const term of searchTerms) {
    orConditions.push({
      content: { contains: term, mode: "insensitive" },
    });
  }

  if (orConditions.length > 0) {
    where.OR = orConditions;
  }

  const chunks = await prisma.legalSourceChunk.findMany({
    where,
    take: limit,
    select: {
      id: true,
      sectionPath: true,
      content: true,
      pageStart: true,
      pageEnd: true,
    },
  });

  // Sort by relevance (CN codes first, then chapter matches, then keyword matches)
  chunks.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    const contentA = a.content.toLowerCase();
    const contentB = b.content.toLowerCase();
    const pathA = a.sectionPath.toLowerCase();
    const pathB = b.sectionPath.toLowerCase();

    // Boost for CN code matches
    for (const code of cnCodes) {
      if (contentA.includes(code)) scoreA += 20;
      if (contentB.includes(code)) scoreB += 20;
    }

    // Boost for chapter matches in sectionPath
    for (const chapter of chapters) {
      if (pathA.includes(`chapter ${chapter}`)) scoreA += 10;
      if (pathB.includes(`chapter ${chapter}`)) scoreB += 10;
    }

    // Boost for keyword matches
    for (const term of searchTerms) {
      if (contentA.includes(term)) scoreA += 1;
      if (contentB.includes(term)) scoreB += 1;
    }

    return scoreB - scoreA;
  });

  return chunks.map((chunk) => ({
    sectionPath: chunk.sectionPath,
    excerpt: chunk.content.slice(0, 800) + (chunk.content.length > 800 ? "..." : ""),
    pageStart: chunk.pageStart || undefined,
    pageEnd: chunk.pageEnd || undefined,
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

  const aiAnalysis = await openaiService.analyzeProduct(productAttributes, legalChunks);
  
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

  // If AI provided a full CN code, prioritize it over GRI result (but validate it first!)
  if (aiAnalysis.suggestedChapters.length > 0) {
    const topSuggestion = aiAnalysis.suggestedChapters[0];
    if (topSuggestion.cnCode && topSuggestion.cnCode.length === 8) {
      // AI provided a full 8-digit CN code - validate and use it
      const aiCnCode = topSuggestion.cnCode;
      const chapter = parseInt(aiCnCode.substring(0, 2), 10);
      const heading = parseInt(aiCnCode.substring(2, 4), 10);
      
      // Enhanced validation - check for invalid chapter/heading combinations
      const isValidHeading = (ch: number, h: number): boolean => {
        if (ch < 1 || ch > 97 || h < 1 || h > 99) return false;
        // Chapter 16 only has headings 01-05
        if (ch === 16 && h > 5) return false;
        return true;
      };
      
      if (isValidHeading(chapter, heading)) {
        console.log(`[Classification] Prioritizing AI-provided CN code: ${aiCnCode} over GRI result: ${classificationResult.cnCode}`);
        classificationResult = {
          ...classificationResult,
          cnCode: aiCnCode as CNCode,
          confidence: Math.max(classificationResult.confidence || 0, topSuggestion.confidence || 0.8),
          reasoningTrail: [
            ...(classificationResult.reasoningTrail || []),
            {
              griRule: "GRI_1",
              level: "SUBHEADING",
              selection: aiCnCode,
              rationale: `AI-provided CN Code ${aiCnCode}: ${topSuggestion.reason}`,
              score: topSuggestion.confidence || 0.8,
            },
          ],
        };
      } else {
        console.warn(`[Classification] Rejected invalid AI CN code: ${aiCnCode} (Chapter ${chapter}, Heading ${heading} is invalid)`);
      }
    }
  }

  // Validate CN code - check if it's a valid structure
  const cnCodeStr = classificationResult.cnCode || "";
  const isValidCNCode = (code: string): boolean => {
    if (!code || code.length !== 8) return false;
    // Check if code is all zeros or invalid patterns
    if (code === "00000000" || code === "0000000000") return false;
    // Check if chapter is valid (01-97 for HS)
    const chapter = parseInt(code.substring(0, 2), 10);
    if (chapter < 1 || chapter > 97) return false;
    // Check if heading is valid (01-99)
    const heading = parseInt(code.substring(2, 4), 10);
    if (heading < 1 || heading > 99) return false;
    // Check for obviously invalid codes like "1616" (chapter 16, heading 16 doesn't exist - chapter 16 ends at heading 05)
    // Chapter 16 valid headings: 01-05
    if (chapter === 16 && heading > 5) return false;
    return true;
  };

  const isWeakClassification = 
    !cnCodeStr || 
    cnCodeStr === "00" ||
    (cnCodeStr.startsWith("00") && cnCodeStr.length <= 2) ||
    cnCodeStr === "00000000" ||
    cnCodeStr === "0000000000" ||
    !isValidCNCode(cnCodeStr) ||
    (classificationResult.confidence || 0) < 0.5;
    
  // Always use AI suggestion if GRI failed, confidence is too low, or code is invalid
  if (isWeakClassification && aiAnalysis.suggestedChapters.length > 0) {
    const topSuggestion = aiAnalysis.suggestedChapters[0];
    if (topSuggestion && topSuggestion.chapter) {
      // Use AI-provided CN code if available, otherwise construct from chapter/heading/subheading
      let newCnCode: CNCode;
      let level: "CHAPTER" | "HEADING" | "SUBHEADING" = "CHAPTER";
      let selection = topSuggestion.chapter.toString().padStart(2, "0");
      
      if (topSuggestion.cnCode && topSuggestion.cnCode.length === 8) {
        // AI provided a full 8-digit CN code - VALIDATE IT FIRST!
        const aiCnCode = topSuggestion.cnCode;
        const chapter = parseInt(aiCnCode.substring(0, 2), 10);
        const heading = parseInt(aiCnCode.substring(2, 4), 10);
        
        // Validate chapter/heading combination
        const isValidHeading = (ch: number, h: number): boolean => {
          if (ch < 1 || ch > 97 || h < 1 || h > 99) return false;
          // Chapter 16 only has headings 01-05
          if (ch === 16 && h > 5) return false;
          return true;
        };
        
        if (isValidHeading(chapter, heading)) {
          newCnCode = aiCnCode as CNCode;
          level = "SUBHEADING";
          selection = newCnCode;
          console.log(`[Classification] Using AI-provided full CN code: ${newCnCode} (confidence: ${topSuggestion.confidence})`);
        } else {
          console.warn(`[Classification] Rejected invalid AI CN code: ${aiCnCode} (Chapter ${chapter}, Heading ${heading} is invalid)`);
          // Fall back to chapter-level only
          const chapterStr = chapter.toString().padStart(2, "0");
          newCnCode = `${chapterStr}000000` as CNCode;
          level = "CHAPTER";
          selection = chapterStr;
          console.log(`[Classification] Using chapter-only fallback: Chapter ${chapter} -> CN Code ${newCnCode}`);
        }
      } else if (topSuggestion.heading) {
        // Validate chapter/heading combination BEFORE using it
        const chapter = topSuggestion.chapter;
        const heading = topSuggestion.heading;
        
        // Validate heading exists for this chapter
        const isValidHeading = (ch: number, h: number): boolean => {
          // Chapter 16 only has headings 01-05
          if (ch === 16 && h > 5) return false;
          // Add more validations as needed
          return h >= 1 && h <= 99;
        };
        
        if (!isValidHeading(chapter, heading)) {
          console.warn(`[Classification] Invalid AI suggestion: Chapter ${chapter}, Heading ${heading} - rejecting and using fallback`);
          // Use chapter-level only as fallback
          const chapterStr = chapter.toString().padStart(2, "0");
          newCnCode = `${chapterStr}000000` as CNCode;
          level = "CHAPTER";
          selection = chapterStr;
          console.log(`[Classification] Using chapter-only fallback: Chapter ${chapter} -> CN Code ${newCnCode}`);
        } else {
          // AI provided valid chapter + heading - construct CN code
          const chapterStr = chapter.toString().padStart(2, "0");
          const headingStr = heading.toString().padStart(2, "0");
          const subheadingStr = topSuggestion.subheading ? topSuggestion.subheading.toString().padStart(2, "0") : "00";
          newCnCode = `${chapterStr}${headingStr}${subheadingStr}00`.substring(0, 8) as CNCode;
          level = topSuggestion.subheading ? "SUBHEADING" : "HEADING";
          selection = `${chapterStr}${headingStr}`;
          console.log(`[Classification] Using AI suggestion: Chapter ${chapter}, Heading ${heading} -> CN Code ${newCnCode} (confidence: ${topSuggestion.confidence})`);
        }
      } else {
        // Only chapter level - use fallback
        const chapterStr = topSuggestion.chapter.toString().padStart(2, "0");
        newCnCode = `${chapterStr}000000` as CNCode;
        console.log(`[Classification] Using AI fallback (chapter only): Chapter ${topSuggestion.chapter} -> CN Code ${newCnCode} (confidence: ${topSuggestion.confidence})`);
      }
      
      // Calculate confidence based on level of detail:
      // - Full CN code (8-digit): use AI confidence directly (high precision)
      // - Heading level: apply small penalty (0.95)
      // - Chapter only: apply larger penalty (0.85)
      let calculatedConfidence = topSuggestion.confidence;
      if (level === "SUBHEADING" && topSuggestion.cnCode) {
        // Full CN code - use AI confidence directly
        calculatedConfidence = topSuggestion.confidence;
      } else if (level === "HEADING") {
        // Heading level - small penalty
        calculatedConfidence = topSuggestion.confidence * 0.95;
      } else {
        // Chapter only - larger penalty
        calculatedConfidence = topSuggestion.confidence * 0.85;
      }
      
      // If GRI had some confidence, blend it with AI confidence
      if (classificationResult.confidence && classificationResult.confidence > 0.3) {
        calculatedConfidence = Math.max(classificationResult.confidence, calculatedConfidence);
      }
      
      classificationResult = {
        ...classificationResult,
        cnCode: newCnCode,
        confidence: calculatedConfidence,
        reasoningTrail: [
          ...(classificationResult.reasoningTrail || []),
          {
            griRule: "GRI_1",
            level,
            selection,
            rationale: `AI-suggested ${level === "SUBHEADING" && topSuggestion.cnCode ? `CN Code ${newCnCode}` : level === "HEADING" ? `Chapter ${topSuggestion.chapter}, Heading ${topSuggestion.heading}` : `Chapter ${topSuggestion.chapter}`}: ${topSuggestion.reason}`,
            score: topSuggestion.confidence,
          },
        ],
      };
    }
  }
  
  // Final validation - ensure we have a valid CN code (last resort)
  let validatedCnCode = classificationResult.cnCode || "";
  if (!validatedCnCode || validatedCnCode === "00" || (validatedCnCode.startsWith("00") && validatedCnCode.length <= 2)) {
    console.warn(`[Classification] Invalid CN code after processing: ${validatedCnCode}, using AI fallback`);
    // Use first AI suggestion as last resort
    if (aiAnalysis.suggestedChapters.length > 0) {
      const chapterStr = aiAnalysis.suggestedChapters[0].chapter.toString().padStart(2, "0");
      validatedCnCode = `${chapterStr}000000`;
      classificationResult.cnCode = validatedCnCode as CNCode;
      classificationResult.confidence = (aiAnalysis.suggestedChapters[0].confidence || 0.5) * 0.7;
    } else {
      // Ultimate fallback - use a generic code
      console.error(`[Classification] No AI suggestions available, using fallback code`);
      validatedCnCode = "99999999";
      classificationResult.cnCode = validatedCnCode as CNCode;
      classificationResult.confidence = 0.1;
    }
  }

  // Final validation - ensure CN code is valid before proceeding
  if (!validatedCnCode || validatedCnCode === "00" || (validatedCnCode.startsWith("00") && validatedCnCode.length <= 2)) {
    console.error(`[Classification] CRITICAL: Invalid CN code before candidate creation: ${validatedCnCode}`);
    throw new Error(`Classification failed: Unable to determine valid CN code. Please try again or provide more product details.`);
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

  // Generate professional legal rationale
  const legalInfo = await openaiService.generateLegalRationale(
    productAttributes,
    {
      cnCode: normalizedCnCode,
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
      dutyRate: classificationResult.dutySummary.baseDutyRate,
      vatRate: classificationResult.dutySummary.vatRate,
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

  if (classificationResult.dutySummary) {
    await prisma.dutySummary.create({
      data: {
        classificationId: classification.id,
        baseValue: 0,
        dutyRate: classificationResult.dutySummary.baseDutyRate,
        vatRate: classificationResult.dutySummary.vatRate,
        estimatedDuty: 0,
      },
    });
  }

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

