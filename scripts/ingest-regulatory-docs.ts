/**
 * Ingest regulatory PDFs into database with embeddings
 * Downloads, parses, chunks, and generates embeddings for Ruokavirasto, Tukes, and EU documents
 */

import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { statSync } from "fs";

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, "\\\\");
}

interface DocumentConfig {
  source: string;
  documentType: string;
  title: string;
  language: string;
  pdfUrl?: string;
  fileName: string;
  version?: string;
  effectiveDate?: Date;
}

/**
 * Auto-detect document metadata from filename
 */
function detectDocumentMetadata(fileName: string): DocumentConfig | null {
  const lower = fileName.toLowerCase();
  const title = fileName.replace(/\.pdf$/i, "");
  
  // EU regulations (check first - they often contain "regulation")
  if (lower.includes("regulation") && (lower.includes("1169") || lower.includes("2023") || lower.includes("eur-lex"))) {
    const is2023 = lower.includes("2023") || lower.includes("988");
    return {
      source: "EU",
      documentType: is2023 ? "SAFETY_REGULATION" : "FOOD_GUIDE",
      title: title,
      language: lower.includes("-fi") || lower.includes("finnish") ? "FI" : "EN",
      fileName,
    };
  }
  
  // Ruokavirasto documents
  if (lower.includes("ruokavirasto") || lower.includes("elintarvike") || 
      lower.includes("food-information") || lower.includes("pakkausmerkintojen") ||
      lower.includes("opas_elintarvikkeista") || lower.includes("mandatory-information")) {
    const isFinnish = lower.includes("_fi") || lower.includes("-fi") || 
                      lower.includes("finnish") || lower.includes("suomi") ||
                      lower.includes("opas") || lower.includes("pakkausmerkintojen");
    return {
      source: "RUOKAVIRASTO",
      documentType: "FOOD_GUIDE",
      title: title,
      language: isFinnish ? "FI" : "EN",
      fileName,
    };
  }
  
  // Tukes documents
  if (lower.includes("tukes") || (lower.includes("safety") && lower.includes("product"))) {
    return {
      source: "TUKES",
      documentType: "SAFETY_REGULATION",
      title: title,
      language: lower.includes("fi") || lower.includes("finnish") ? "FI" : "EN",
      fileName,
    };
  }
  
  // Tulli/Customs documents
  if (lower.includes("tulli") || lower.includes("customs") || lower.includes("taric")) {
    return {
      source: "TULLI",
      documentType: "CUSTOMS_GUIDE",
      title: title,
      language: lower.includes("fi") || lower.includes("finnish") ? "FI" : "EN",
      fileName,
    };
  }
  
  // Generic EU regulations
  if (lower.includes("eu") || lower.includes("regulation") || lower.includes("directive")) {
    return {
      source: "EU",
      documentType: "SAFETY_REGULATION",
      title: title,
      language: lower.includes("fi") || lower.includes("finnish") ? "FI" : "EN",
      fileName,
    };
  }
  
  // Default fallback - assume Ruokavirasto food guide
  console.warn(`[Ingest] Could not auto-detect source for ${fileName}, defaulting to RUOKAVIRASTO FOOD_GUIDE`);
  return {
    source: "RUOKAVIRASTO",
    documentType: "FOOD_GUIDE",
    title: title,
    language: lower.includes("fi") || lower.includes("finnish") ? "FI" : "EN",
    fileName,
  };
}

/**
 * Parse PDF text using pdf-parse
 */
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  try {
    // pdf-parse v2.4.5 uses class-based API
    const pdfParseModule = require("pdf-parse");
    const PDFParse = pdfParseModule.PDFParse || pdfParseModule;
    
    if (typeof PDFParse !== "function") {
      throw new Error(`PDFParse is not available. Got: ${typeof PDFParse}`);
    }
    
    const dataBuffer = await readFile(pdfPath);
    
    // Use class-based API (same as ingest-eurlex script)
    const parser = new PDFParse({ data: dataBuffer });
    const textResult = await parser.getText();
    await parser.destroy();
    
    // Return combined text from all pages
    return textResult.text || "";
  } catch (error) {
    console.error(`[Ingest] Failed to parse PDF ${pdfPath}:`, error);
    throw error;
  }
}

/**
 * Split text into semantic chunks
 */
function chunkText(text: string, maxChunkSize: number = 800): Array<{ text: string; sectionPath: string; pageNumber?: number }> {
  const chunks: Array<{ text: string; sectionPath: string; pageNumber?: number }> = [];
  
  // Simple paragraph-based chunking
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = "";
  let currentSection = "Introduction";
  let pageNumber: number | undefined;

  for (const para of paragraphs) {
    // Detect section headers (e.g., "Section 5.3", "Chapter 2.1")
    const sectionMatch = para.match(/(?:Section|Chapter|§)\s*(\d+(?:\.\d+)*)/i);
    if (sectionMatch) {
      currentSection = sectionMatch[0];
    }

    // Detect page numbers
    const pageMatch = para.match(/\[?Page\s+(\d+)\]?/i);
    if (pageMatch) {
      pageNumber = parseInt(pageMatch[1], 10);
    }

    if (currentChunk.length + para.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        sectionPath: currentSection,
        pageNumber,
      });
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      sectionPath: currentSection,
      pageNumber,
    });
  }

  return chunks;
}

/**
 * Generate embedding for a chunk
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Ingest a single document
 */
async function ingestDocument(config: DocumentConfig, text: string): Promise<void> {
  console.log(`[Ingest] Processing: ${config.title}`);

  // Create or update document record
  const document = await prisma.regulatoryDocument.upsert({
    where: {
      source_documentType_language: {
        source: config.source,
        documentType: config.documentType,
        language: config.language,
      },
    },
    create: {
      source: config.source,
      documentType: config.documentType,
      title: config.title,
      language: config.language,
      pdfUrl: config.pdfUrl,
      storagePath: config.fileName,
      version: config.version,
      effectiveDate: config.effectiveDate,
    },
    update: {
      title: config.title,
      pdfUrl: config.pdfUrl,
      storagePath: config.fileName,
      version: config.version,
      effectiveDate: config.effectiveDate,
    },
  });

  // Delete existing chunks
  await prisma.regulatoryDocumentChunk.deleteMany({
    where: { documentId: document.id },
  });

  // Chunk text
  const chunks = chunkText(text);
  console.log(`[Ingest] Created ${chunks.length} chunks`);

  // Process chunks in batches
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`[Ingest] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

    const chunkPromises = batch.map(async (chunk, index) => {
      const embedding = await generateEmbedding(chunk.text);
      return {
        documentId: document.id,
        chunkIndex: i + index,
        sectionPath: chunk.sectionPath,
        content: chunk.text,
        pageNumber: chunk.pageNumber,
        embedding: `[${embedding.join(",")}]`,
        metadata: {
          section: chunk.sectionPath,
          language: config.language,
        },
      };
    });

    const chunkData = await Promise.all(chunkPromises);

    // Insert chunks
    for (const chunk of chunkData) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "RegulatoryDocumentChunk" (
          id, "documentId", "chunkIndex", "sectionPath", content, "pageNumber", embedding, metadata
        ) VALUES (
          gen_random_uuid(),
          '${escapeSqlString(chunk.documentId)}',
          ${chunk.chunkIndex},
          '${escapeSqlString(chunk.sectionPath)}',
          '${escapeSqlString(chunk.content)}',
          ${chunk.pageNumber || "NULL"},
          '${chunk.embedding}'::vector,
          '${escapeSqlString(JSON.stringify(chunk.metadata))}'::jsonb
        )
      `);
    }
  }

  console.log(`[Ingest] Completed: ${config.title}`);
}

/**
 * Main ingestion function - processes all PDFs in data/regulatory-docs folder
 */
async function main() {
  console.log("[Ingest] Starting regulatory document ingestion...");
  
  const docsFolder = join(process.cwd(), "data", "regulatory-docs");
  
  try {
    // Check if folder exists, try both spellings
    let folderPath = docsFolder;
    try {
      statSync(folderPath);
    } catch {
      // Try alternative spelling
      folderPath = join(process.cwd(), "data", "regolatory-docs");
      try {
        statSync(folderPath);
      } catch {
        console.error(`[Ingest] Folder not found: ${docsFolder} or ${folderPath}`);
        console.error(`[Ingest] Please create the folder and add PDF files`);
        return;
      }
    }
    
    // Read all files in folder
    const files = await readdir(folderPath);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith(".pdf"));
    
    if (pdfFiles.length === 0) {
      console.warn(`[Ingest] No PDF files found in ${folderPath}`);
      return;
    }
    
    console.log(`[Ingest] Found ${pdfFiles.length} PDF file(s)`);
    
    // Process each PDF
    for (const fileName of pdfFiles) {
      try {
        console.log(`\n[Ingest] Processing: ${fileName}`);
        
        // Auto-detect metadata from filename
        const config = detectDocumentMetadata(fileName);
        if (!config) {
          console.warn(`[Ingest] Could not auto-detect metadata for ${fileName}, skipping`);
          continue;
        }
        
        const pdfPath = join(folderPath, fileName);
        const text = await extractTextFromPDF(pdfPath);
        
        if (!text || text.trim().length < 100) {
          console.warn(`[Ingest] Extracted text too short for ${fileName}, skipping`);
          continue;
        }
        
        await ingestDocument(config, text);
      } catch (error) {
        console.error(`[Ingest] Failed to process ${fileName}:`, error);
      }
    }
    
    console.log("\n[Ingest] Done!");
  } catch (error) {
    console.error("[Ingest] Error:", error);
  }
}

if (require.main === module) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

