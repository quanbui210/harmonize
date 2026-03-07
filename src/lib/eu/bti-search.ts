
import { prisma } from "@/lib/prisma";
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";
import type { BtiRuling } from "@prisma/client";

export interface BtiSearchOptions {
  hsCodePrefix?: string; // 4-6 digits
  description: string;
  limit?: number;
  minSimilarity?: number;
}

// Result type omitting the raw vector data
export type BtiSearchResult = Omit<BtiRuling, "descriptionVector"> & {
  similarity: number;
  matchType: "EXACT_CODE" | "SEMANTIC" | "HYBRID";
};

/**
 * Search BTI rulings using hybrid search (SQL filtering + Vector similarity)
 */
export async function searchBtiRulings(
  options: BtiSearchOptions
): Promise<BtiSearchResult[]> {
  const { hsCodePrefix, description, limit = 10, minSimilarity = 0.5 } = options;

  // 1. Generate embedding for the description
  const openai = createFeatureOpenAIClient("BTI Search");
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: description,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const embeddingVectorStr = `[${queryEmbedding.join(",")}]`;

  // 2. Build SQL query
  // We prioritize:
  // 1. Finnish rulings (country = 'FI')
  // 2. Exact code matches (if hsCodePrefix is provided)
  // 3. Trusted authorities (DE, NL)
  // 4. Similarity score

  let whereClause = `WHERE "descriptionVector" IS NOT NULL`;
  
  if (hsCodePrefix) {
    // Broad pruning: Filter by first 4-6 digits if provided
    const broadPrefix = hsCodePrefix.substring(0, 4);
    whereClause += ` AND "hsCode" LIKE '${broadPrefix}%'`;
  }

  // Calculate similarity and rank
  const sql = `
    SELECT 
      id,
      reference,
      country,
      "hsCode",
      description,
      justification,
      "startDate",
      "endDate",
      language,
      "createdAt",
      "updatedAt",
      1 - ("descriptionVector" <=> '${embeddingVectorStr}'::vector) as similarity
    FROM "BtiRuling"
    ${whereClause}
    ORDER BY 
      CASE WHEN country = 'FI' THEN 1 ELSE 0 END DESC,
      CASE WHEN "hsCode" = '${hsCodePrefix || ""}' THEN 1 ELSE 0 END DESC,
      CASE WHEN country IN ('DE', 'NL') THEN 1 ELSE 0 END DESC,
      similarity DESC
    LIMIT ${limit}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<Array<any>>(sql);
    
    // Filter by similarity threshold manually if needed, or rely on LIMIT/ORDER
    // But adding a HAVING clause for similarity is tricky with vector ops sometimes, so filter here
    return results
      .filter((r: any) => r.similarity >= minSimilarity)
      .map((r: any) => ({
        id: r.id,
        reference: r.reference,
        country: r.country,
        hsCode: r.hsCode,
        description: r.description,
        justification: r.justification,
        startDate: r.startDate,
        endDate: r.endDate,
        language: r.language,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        similarity: r.similarity,
        matchType: "HYBRID"
      }));
  } catch (error) {
    console.error("[BtiSearch] Search failed:", error);
    return [];
  }
}

/**
 * Get statistics about BTI rulings
 */
export async function getBtiStats() {
  const total = await prisma.btiRuling.count();
  
  // Use raw query for aggregation as groupBy with count is simpler here
  const byCountry = await prisma.btiRuling.groupBy({
    by: ["country"],
    _count: {
      country: true
    },
    orderBy: {
      _count: {
        country: "desc"
      }
    },
    take: 10 // Top 10 countries
  });
  
  return {
    total,
    byCountry: byCountry.map(c => ({ country: c.country, count: c._count.country }))
  };
}
