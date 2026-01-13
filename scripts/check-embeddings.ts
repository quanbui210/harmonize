/**
 * Check if embeddings exist in LegalSourceChunk table
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkEmbeddings() {
  console.log("Checking embedding status...\n");

  // Count total chunks
  const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count
    FROM "LegalSourceChunk"
    WHERE source = 'EUR_LEX'
      AND regulation = 'EU_2021_1832'
      AND language = 'EN'
  `;

  const total = Number(totalResult[0]?.count || 0);
  console.log(`Total chunks: ${total}`);

  // Count chunks with embeddings
  const withEmbeddingsResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count
    FROM "LegalSourceChunk"
    WHERE source = 'EUR_LEX'
      AND regulation = 'EU_2021_1832'
      AND language = 'EN'
      AND embedding IS NOT NULL
  `;

  const withEmbeddings = Number(withEmbeddingsResult[0]?.count || 0);
  console.log(`Chunks with embeddings: ${withEmbeddings}`);
  console.log(`Chunks without embeddings: ${total - withEmbeddings}`);

  // Check if pgvector extension exists
  try {
    const extensionResult = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as exists
    `;
    const hasExtension = extensionResult[0]?.exists || false;
    console.log(`\npgvector extension installed: ${hasExtension ? "✅ Yes" : "❌ No"}`);
    
    if (!hasExtension) {
      console.log("\n⚠️  WARNING: pgvector extension is not installed!");
      console.log("   Run this SQL in your database:");
      console.log("   CREATE EXTENSION IF NOT EXISTS vector;");
    }
  } catch (error) {
    console.log("\n⚠️  Could not check pgvector extension:", error);
  }

  // Test a sample query
  if (withEmbeddings > 0) {
    console.log("\nTesting vector search query...");
    try {
      // Generate a test embedding
      const testQuery = "test product classification";
      const testEmbedding = new Array(1536).fill(0.1).join(",");
      const testVector = `[${testEmbedding}]`;

      const testResult = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
        SELECT COUNT(*)::int as count
        FROM "LegalSourceChunk"
        WHERE source = 'EUR_LEX'
          AND regulation = 'EU_2021_1832'
          AND language = 'EN'
          AND embedding IS NOT NULL
          AND embedding <=> '${testVector}'::vector < 1.0
        LIMIT 5
      `);

      console.log(`✅ Vector search test successful: Found ${testResult[0]?.count || 0} results`);
    } catch (error: any) {
      console.log(`❌ Vector search test failed: ${error.message}`);
      console.log("   This might indicate a problem with the vector column or pgvector extension");
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (withEmbeddings === 0 && total > 0) {
    console.log("❌ No embeddings found!");
    console.log("   Run: npm run generate:embeddings");
  } else if (withEmbeddings === total && total > 0) {
    console.log("✅ All chunks have embeddings!");
  } else if (withEmbeddings > 0 && withEmbeddings < total) {
    console.log(`⚠️  Partial: ${withEmbeddings}/${total} chunks have embeddings`);
    console.log("   Run: npm run generate:embeddings to complete");
  } else {
    console.log("ℹ️  No chunks found in database");
  }
}

async function main() {
  try {
    await checkEmbeddings();
  } catch (error) {
    console.error("Error checking embeddings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


