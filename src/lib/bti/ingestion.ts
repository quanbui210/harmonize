
import { parse } from "csv-parse";
import { prisma } from "@/lib/prisma";
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";

const openai = createFeatureOpenAIClient("BTI Ingestion");
const BATCH_SIZE = 50;

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; 
  const year = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

function cleanHsCode(code: string): string {
  if (!code) return "";
  return code.replace(/\*/g, "").trim();
}

async function generateEmbeddings(texts: string[]) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("Error generating embeddings:", error);
    return new Array(texts.length).fill(null);
  }
}

async function processBatch(batch: any[]) {
  const validRows = batch.filter(
    (row) => row.BTI_REFERENCE && row.DESCRIPTION_OF_GOODS
  );

  if (validRows.length === 0) return 0;

  const descriptions = validRows.map((row) => row.DESCRIPTION_OF_GOODS);
  const embeddings = await generateEmbeddings(descriptions);

  let processedCount = 0;

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const embedding = embeddings[i];

    if (!embedding) continue;

    const reference = row.BTI_REFERENCE;
    const country = row.ISSUING_COUNTRY;
    const hsCode = cleanHsCode(row.NOMENCLATURE_CODE);
    const description = row.DESCRIPTION_OF_GOODS;
    const justification = row.CLASSIFICATION_JUSTIFICATION;
    const startDate = parseDate(row.START_DATE_OF_VALIDITY);
    const endDate = parseDate(row.END_DATE_OF_VALIDITY);
    const language = row.LANGUAGE || "EN";

    try {
      await prisma.$executeRaw`
        INSERT INTO "BtiRuling" (
          id,
          reference,
          country,
          "hsCode",
          description,
          justification,
          "startDate",
          "endDate",
          language,
          "descriptionVector",
          "createdAt",
          "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${reference},
          ${country},
          ${hsCode},
          ${description},
          ${justification},
          ${startDate},
          ${endDate},
          ${language},
          ${JSON.stringify(embedding)}::vector,
          NOW(),
          NOW()
        )
        ON CONFLICT (reference) DO UPDATE SET
          country = EXCLUDED.country,
          "hsCode" = EXCLUDED."hsCode",
          description = EXCLUDED.description,
          justification = EXCLUDED.justification,
          "startDate" = EXCLUDED."startDate",
          "endDate" = EXCLUDED."endDate",
          language = EXCLUDED.language,
          "descriptionVector" = EXCLUDED."descriptionVector",
          "updatedAt" = NOW();
      `;
      processedCount++;
    } catch (error) {
      console.error(`Error processing ruling ${reference}:`, error);
    }
  }

  return processedCount;
}

export async function ingestBtiCsv(csvContent: string) {
  const parser = parse(csvContent, {
    columns: ["BTI_REFERENCE","ISSUING_COUNTRY","START_DATE_OF_VALIDITY","END_DATE_OF_VALIDITY","NOMENCLATURE_CODE","CLASSIFICATION_JUSTIFICATION","STATUS","INVALIDATION_REASON","INVALIDATION_JUSTIFICATION","LANGUAGE","PLACE_OF_ISSUE","DATE_OF_ISSUE","NAME_AND_ADDRESS","DESCRIPTION_OF_GOODS","KEYWORDS"],
    skip_empty_lines: true,
    trim: true,
    bom: true,
    from_line: 2,
    relax_quotes: true,
    relax_column_count: true
  });

  let batch: any[] = [];
  let totalProcessed = 0;

  for await (const record of parser) {
    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      const count = await processBatch(batch);
      totalProcessed += count;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const count = await processBatch(batch);
    totalProcessed += count;
  }

  return totalProcessed;
}
