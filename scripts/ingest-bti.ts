
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { PrismaClient } from "@prisma/client";
import { createFeatureOpenAIClient } from "../src/lib/langfuse/openai-wrapper";

const prisma = new PrismaClient();
const openai = createFeatureOpenAIClient("BTI Ingestion");

// Path to the CSV file
const CSV_FILE_PATH = path.resolve(
  process.cwd(),
  "data/bti-reference/EBTI_FI.csv"
);

// Batch size for processing
const BATCH_SIZE = 50;

// Function to parse date (DD/MM/YYYY)
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  
  // Assuming DD/MM/YYYY
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

// Function to clean HS code
function cleanHsCode(code: string): string {
  if (!code) return "";
  // Remove asterisks and keep only digits
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
  // Filter out rows with missing essential data
  const validRows = batch.filter(
    (row) => row.BTI_REFERENCE && row.DESCRIPTION_OF_GOODS
  );

  if (validRows.length === 0) return;

  console.log(`Processing batch of ${validRows.length} rows...`);

  // Generate embeddings for descriptions
  const descriptions = validRows.map((row) => row.DESCRIPTION_OF_GOODS);
  const embeddings = await generateEmbeddings(descriptions);

  // Prepare data for upsert
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
      // Use UPSERT (INSERT ... ON CONFLICT)
      // Note: We cast the embedding to vector type explicitly
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
    } catch (error) {
      console.error(`Error processing ruling ${reference}:`, error);
    }
  }
}

async function main() {
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`CSV file not found at: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`Starting ingestion from: ${CSV_FILE_PATH}`);

  const parser = fs.createReadStream(CSV_FILE_PATH).pipe(
    parse({
      columns: ["BTI_REFERENCE","ISSUING_COUNTRY","START_DATE_OF_VALIDITY","END_DATE_OF_VALIDITY","NOMENCLATURE_CODE","CLASSIFICATION_JUSTIFICATION","STATUS","INVALIDATION_REASON","INVALIDATION_JUSTIFICATION","LANGUAGE","PLACE_OF_ISSUE","DATE_OF_ISSUE","NAME_AND_ADDRESS","DESCRIPTION_OF_GOODS","KEYWORDS"],
      skip_empty_lines: true,
      trim: true,
      bom: true,
      from_line: 2,
      relax_quotes: true,
      relax_column_count: true
    })
  );

  let batch: any[] = [];
  let totalProcessed = 0;

  for await (const record of parser) {
    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      totalProcessed += batch.length;
      console.log(`Total processed: ${totalProcessed}`);
      batch = [];
    }
  }

  // Process remaining items
  if (batch.length > 0) {
    await processBatch(batch);
    totalProcessed += batch.length;
  }

  console.log(`Ingestion complete! Total processed: ${totalProcessed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
