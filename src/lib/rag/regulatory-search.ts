/**
 * Regulatory document search using RAG
 * Searches Ruokavirasto, Tukes, and EU regulatory PDFs
 */

import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import type { RegulatoryProductType } from "@/lib/regulatory/product-type";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RegulatoryChunk {
  id: string;
  content: string;
  sectionPath: string;
  pageNumber?: number;
  title: string;
  source: string;
  language: string;
  similarity: number;
}

interface RegulatorySearchOptions {
  productType: RegulatoryProductType;
  query: string;
  language?: "FI" | "SV" | "EN";
  documentSources?: string[];
  maxResults?: number;
}

/**
 * Translate query to Finnish for better search results
 */
async function translateToFinnish(query: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Translate the following English query to Finnish. Return only the translation, no explanation.",
        },
        { role: "user", content: query },
      ],
      temperature: 0.1,
    });
    return response.choices[0]?.message?.content || query;
  } catch (error) {
    console.error("[RegulatorySearch] Translation failed, using original query:", error);
    return query;
  }
}

/**
 * Search regulatory documents using vector similarity
 */
export async function searchRegulatoryDocuments(
  options: RegulatorySearchOptions
): Promise<RegulatoryChunk[]> {
  const { productType, query, language = "FI", documentSources, maxResults = 10 } = options;

  // Translate query to Finnish for better results
  const searchQuery = language === "FI" ? query : await translateToFinnish(query);

  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: searchQuery,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const embeddingVectorStr = `[${queryEmbedding.join(",")}]`;

  // Determine document sources based on product type
  const sources = documentSources || getDefaultSources(productType);

  // Build SQL query with filters
  const sql = `
    SELECT 
      c.id,
      c.content,
      c."sectionPath",
      c."pageNumber",
      d.title,
      d.source,
      d.language,
      1 - (c.embedding <=> '${embeddingVectorStr}'::vector) as similarity
    FROM "RegulatoryDocumentChunk" c
    JOIN "RegulatoryDocument" d ON c."documentId" = d.id
    WHERE 
      d.source = ANY(ARRAY[${sources.map((s) => `'${s}'`).join(",")}])
      AND c.embedding IS NOT NULL
      ${getProductTypeFilter(productType)}
    ORDER BY c.embedding <=> '${embeddingVectorStr}'::vector
    LIMIT ${maxResults}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      content: string;
      sectionPath: string;
      pageNumber: number | null;
      title: string;
      source: string;
      language: string;
      similarity: number;
    }>>(sql);

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      sectionPath: r.sectionPath,
      pageNumber: r.pageNumber || undefined,
      title: r.title,
      source: r.source,
      language: r.language,
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error("[RegulatorySearch] Vector search failed:", error);
    return [];
  }
}

function getDefaultSources(productType: RegulatoryProductType): string[] {
  switch (productType) {
    case "FOOD":
      return ["RUOKAVIRASTO", "EU"];
    case "ELECTRONICS":
    case "TOYS":
      return ["TUKES", "EU"];
    default:
      return ["TULLI", "EU"];
  }
}

function getProductTypeFilter(productType: RegulatoryProductType): string {
  switch (productType) {
    case "FOOD":
      return `AND d."documentType" = 'FOOD_GUIDE'`;
    case "ELECTRONICS":
    case "TOYS":
      return `AND d."documentType" = 'SAFETY_REGULATION'`;
    default:
      return `AND (d."documentType" = 'CUSTOMS_GUIDE' OR d."documentType" = 'SAFETY_REGULATION')`;
  }
}

