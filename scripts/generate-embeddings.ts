/**
 * Generate embeddings for LegalSourceChunk records that don't have them
 * This script processes chunks in batches and generates OpenAI embeddings
 */

import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BATCH_SIZE = 100; // Process 100 chunks at a time
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536; // text-embedding-3-small dimension

async function generateEmbeddings() {
  console.log("Starting embedding generation...");

  // Count chunks without embeddings
  const totalWithoutEmbeddings = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count
    FROM "LegalSourceChunk"
    WHERE source = 'EUR_LEX'
      AND regulation = 'EU_2021_1832'
      AND language = 'EN'
      AND embedding IS NULL
  `;

  const total = Number(totalWithoutEmbeddings[0]?.count || 0);
  console.log(`Found ${total} chunks without embeddings`);

  if (total === 0) {
    console.log("All chunks already have embeddings!");
    return;
  }

  let processed = 0;
  let offset = 0;

  while (offset < total) {
    // Fetch batch of chunks without embeddings
    const chunks = await prisma.$queryRawUnsafe<Array<{
      id: string;
      content: string;
    }>>(`
      SELECT id, content
      FROM "LegalSourceChunk"
      WHERE source = 'EUR_LEX'
        AND regulation = 'EU_2021_1832'
        AND language = 'EN'
        AND embedding IS NULL
      ORDER BY id
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `);

    if (chunks.length === 0) {
      break;
    }

    console.log(`Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${chunks.length} chunks)...`);

    // Generate embeddings for this batch
    const texts = chunks.map((c) => c.content);
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    // Update each chunk with its embedding
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddingResponse.data[i]?.embedding;

      if (!embedding) {
        console.error(`No embedding for chunk ${chunk.id}`);
        continue;
      }

      // Format as PostgreSQL vector array
      const embeddingVectorStr = `[${embedding.join(",")}]`;

      // Update chunk with embedding using raw SQL (Prisma doesn't support vector directly)
      await prisma.$executeRawUnsafe(`
        UPDATE "LegalSourceChunk"
        SET embedding = '${embeddingVectorStr}'::vector
        WHERE id = '${chunk.id}'
      `);

      processed++;
    }

    offset += chunks.length;
    console.log(`Processed ${processed}/${total} chunks (${((processed / total) * 100).toFixed(1)}%)`);

    // Rate limiting: wait a bit between batches to avoid API limits
    if (offset < total) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  console.log(`\n✅ Completed! Generated embeddings for ${processed} chunks.`);
}

async function main() {
  try {
    await generateEmbeddings();
  } catch (error) {
    console.error("Error generating embeddings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


