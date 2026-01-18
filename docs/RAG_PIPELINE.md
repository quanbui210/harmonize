# RAG Pipeline: Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Document Ingestion Pipeline](#document-ingestion-pipeline)
3. [Embedding Generation](#embedding-generation)
4. [Vector Similarity Search](#vector-similarity-search)
5. [User Flows & Request Handling](#user-flows--request-handling)
6. [Database Schema](#database-schema)
7. [Code Walkthrough](#code-walkthrough)

---

## Overview

HarmonizeAI uses a **Retrieval-Augmented Generation (RAG)** pipeline to provide accurate, source-backed compliance information. The system ingests regulatory documents, chunks them into manageable pieces, generates vector embeddings, and uses semantic search to retrieve relevant context for LLM responses.

### Key Components

1. **Two Document Systems**:
   - **Regulatory Documents** (`RegulatoryDocument` + `RegulatoryDocumentChunk`): Food/safety regulatory documents (Ruokavirasto, Tukes, Tulli, EU)
   - **Legal Sources** (`LegalSourceChunk`): EU customs classification regulation (EUR-Lex Regulation EU 2021/1832)

2. **Vector Storage**: PostgreSQL with `pgvector` extension
3. **Embedding Model**: OpenAI `text-embedding-3-small` (1536 dimensions)
4. **Search Method**: Cosine similarity using pgvector's `<=>` operator

---

## Document Ingestion Pipeline

### 1. Regulatory Documents Ingestion

**Script**: `scripts/ingest-regulatory-docs.ts`

#### Step 1: Document Discovery

```typescript
// Location: scripts/ingest-regulatory-docs.ts, lines 291-320

const docsFolder = join(process.cwd(), "data", "regulatory-docs");
const files = await readdir(folderPath);
const pdfFiles = files.filter(f => f.toLowerCase().endsWith(".pdf"));
```

The script scans the `data/regulatory-docs/` folder for PDF files and processes each one.

#### Step 2: Metadata Detection

```typescript
// Location: scripts/ingest-regulatory-docs.ts, lines 36-110

function detectDocumentMetadata(fileName: string): DocumentConfig | null {
  const lower = fileName.toLowerCase();
  
  // EU regulations
  if (lower.includes("regulation") && (lower.includes("1169") || lower.includes("2023"))) {
    return {
      source: "EU",
      documentType: is2023 ? "SAFETY_REGULATION" : "FOOD_GUIDE",
      title: title,
      language: lower.includes("-fi") ? "FI" : "EN",
      fileName,
    };
  }
  
  // Ruokavirasto documents
  if (lower.includes("ruokavirasto") || lower.includes("elintarvike")) {
    return {
      source: "RUOKAVIRASTO",
      documentType: "FOOD_GUIDE",
      language: isFinnish ? "FI" : "EN",
      fileName,
    };
  }
  
  // Tukes documents
  if (lower.includes("tukes") || (lower.includes("safety") && lower.includes("product"))) {
    return {
      source: "TUKES",
      documentType: "SAFETY_REGULATION",
      language: lower.includes("fi") ? "FI" : "EN",
      fileName,
    };
  }
  
  // Tulli/Customs documents
  if (lower.includes("tulli") || lower.includes("customs")) {
    return {
      source: "TULLI",
      documentType: "CUSTOMS_GUIDE",
      language: lower.includes("fi") ? "FI" : "EN",
      fileName,
    };
  }
}
```

Metadata is auto-detected from filename patterns, including:
- **Source**: RUOKAVIRASTO, TUKES, TULLI, EU
- **Document Type**: FOOD_GUIDE, SAFETY_REGULATION, CUSTOMS_GUIDE
- **Language**: FI, SV, EN

#### Step 3: PDF Text Extraction

```typescript
// Location: scripts/ingest-regulatory-docs.ts, lines 115-138

async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const pdfParseModule = require("pdf-parse");
  const PDFParse = pdfParseModule.PDFParse || pdfParseModule;
  
  const dataBuffer = await readFile(pdfPath);
  
  // Use class-based API (pdf-parse v2.4.5+)
  const parser = new PDFParse({ data: dataBuffer });
  const textResult = await parser.getText();
  await parser.destroy();
  
  return textResult.text || "";
}
```

Uses the `pdf-parse` library to extract text from PDF files. The library handles:
- Text layer extraction
- Page-by-page parsing
- Metadata extraction

#### Step 4: Text Chunking

```typescript
// Location: scripts/ingest-regulatory-docs.ts, lines 143-186

function chunkText(text: string, maxChunkSize: number = 800): Array<{ 
  text: string; 
  sectionPath: string; 
  pageNumber?: number 
}> {
  const chunks: Array<{ text: string; sectionPath: string; pageNumber?: number }> = [];
  
  // Split by paragraphs (double newlines)
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

    // If adding this paragraph would exceed maxChunkSize, save current chunk
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

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      sectionPath: currentSection,
      pageNumber,
    });
  }

  return chunks;
}
```

**Chunking Strategy**:
- **Max chunk size**: 800 characters (configurable)
- **Method**: Paragraph-based chunking (splits on double newlines)
- **Section tracking**: Detects section headers (e.g., "Section 5.3", "Chapter 2.1")
- **Page tracking**: Extracts page numbers when available
- **Overlap**: None (simple sequential chunking)

#### Step 5: Embedding Generation & Storage

```typescript
// Location: scripts/ingest-regulatory-docs.ts, lines 191-197, 248-282

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// In ingestDocument function:
const batchSize = 10;
for (let i = 0; i < chunks.length; i += batchSize) {
  const batch = chunks.slice(i, i + batchSize);
  
  const chunkPromises = batch.map(async (chunk, index) => {
    const embedding = await generateEmbedding(chunk.text);
    return {
      documentId: document.id,
      chunkIndex: i + index,
      sectionPath: chunk.sectionPath,
      content: chunk.text,
      pageNumber: chunk.pageNumber,
      embedding: `[${embedding.join(",")}]`, // Format as PostgreSQL vector
      metadata: {
        section: chunk.sectionPath,
        language: config.language,
      },
    };
  });

  const chunkData = await Promise.all(chunkPromises);

  // Insert chunks using raw SQL (Prisma doesn't support vector type directly)
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
```

**Key Points**:
- **Batch processing**: 10 chunks at a time to avoid API rate limits
- **Embedding model**: `text-embedding-3-small` (1536 dimensions)
- **Storage format**: PostgreSQL `vector` type (cast from array string)
- **Metadata**: Stored as JSONB for flexible querying

#### Complete Flow Diagram

```
PDF File (data/regulatory-docs/)
    ↓
[1] Auto-detect metadata from filename
    ↓
[2] Extract text using pdf-parse
    ↓
[3] Chunk text (800 chars, paragraph-based)
    ↓
[4] Generate embeddings (batch of 10)
    ↓
[5] Store in RegulatoryDocument + RegulatoryDocumentChunk tables
```

---

### 2. Legal Sources Ingestion (EUR-Lex Regulation)

**Script**: `scripts/ingest-eurlex-2021-1832.ts`

This script processes the EUR-Lex Regulation EU 2021/1832 (Combined Nomenclature) for customs classification.

#### Step 1: Document Source

The script can process either:
- **PDF**: `public/docs/2021-1832.pdf`
- **HTML**: `data/legal-sources/eurlex.html` (preferred, better text extraction)

```typescript
// Location: scripts/ingest-eurlex-2021-1832.ts, lines 374-484

if (useHtml) {
  const html = await fs.readFile(htmlPath, "utf-8");
  const fullText = extractTextFromHtml(html);
  const chunkInputs = chunkTextWithMarkers(fullText);
} else {
  const buffer = await fs.readFile(pdfPath);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  // ... process PDF
}
```

#### Step 2: Text Extraction & Cleaning

```typescript
// Location: scripts/ingest-eurlex-2021-1832.ts, lines 27-92

function normalizeText(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripPdfArtifacts(input: string) {
  return input
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.includes("file:///")) return false;
      if (t.includes("EUR-Lex")) return false;
      if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(t) && /\bAM\b|\bPM\b/.test(t))
        return false;
      return true;
    })
    .join("\n");
}

function extractTextFromHtml(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;

  const withoutScripts = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const withNewlines = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/td>/gi, "\t");

  const stripped = withNewlines.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(stripped);
  return normalizeText(decoded);
}
```

**Cleaning Steps**:
1. Normalize line endings (`\r\n` → `\n`)
2. Remove PDF artifacts (file paths, timestamps, headers)
3. Extract HTML body content
4. Remove scripts, styles, noscript tags
5. Convert HTML tags to newlines/whitespace
6. Decode HTML entities (`&nbsp;`, `&#123;`, etc.)

#### Step 3: Structured Chunking

The legal document uses a sophisticated chunking strategy that preserves document structure:

```typescript
// Location: scripts/ingest-eurlex-2021-1832.ts, lines 94-178

function chunkTextWithMarkers(fullText: string) {
  const maxLen = 4500; // Larger chunks for legal documents
  const paragraphs = fullText.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);

  const ctx: { part?: string; section?: string; chapter?: string; annex?: string } = {};
  const chunks: Array<{ sectionPath: string; content: string }> = [];
  let buffer = "";
  let bufferPath = "DOC";

  // Track document structure markers
  for (const p of paragraphs) {
    const line = p.replace(/\s+/g, " ").trim();

    // Detect structure markers
    const partMatch = line.match(/^PART\s+(ONE|TWO|THREE)\b/i);
    const sectionMatch = line.match(/^SECTION\s+([IVX]+)\b/i);
    const chapterMatch = line.match(/^CHAPTER\s+(\d{1,3})\b/i);
    const annexMatch = line.match(/^ANNEX\s+([0-9IVX]+)\b/i);

    const isMarker = !!(partMatch || sectionMatch || chapterMatch || annexMatch);
    
    if (isMarker) {
      // Flush current buffer before starting new section
      flush();
      
      // Update context
      if (partMatch) {
        ctx.part = `PART ${partMatch[1].toUpperCase()}`;
        ctx.section = undefined;
        ctx.chapter = undefined;
      }
      if (sectionMatch) {
        ctx.section = `SECTION ${sectionMatch[1].toUpperCase()}`;
        ctx.chapter = undefined;
      }
      if (chapterMatch) {
        ctx.chapter = `CHAPTER ${chapterMatch[1]}`;
      }
      if (annexMatch) {
        ctx.annex = `ANNEX ${annexMatch[1].toUpperCase()}`;
      }
      
      setPath(); // Update bufferPath based on ctx
      buffer = `${line}\n\n`;
      continue;
    }

    // Add paragraph to buffer
    if (buffer.length + p.length + 2 > maxLen * 3) {
      flush(); // Flush if buffer too large
      setPath();
      buffer = "";
    }

    buffer += `${p}\n\n`;
  }

  flush(); // Final flush
  return chunks;
}
```

**Chunking Strategy**:
- **Max chunk size**: 4500 characters (larger than regulatory docs)
- **Structure-aware**: Tracks PART, SECTION, CHAPTER, ANNEX markers
- **Section path**: Builds hierarchical paths like `"PART ONE > SECTION I > A > rule 1"`
- **Context preservation**: Maintains document structure in `sectionPath`

#### Step 4: Special Handling for PART ONE

The script has special logic for PART ONE (General Rules for Interpretation):

```typescript
// Location: scripts/ingest-eurlex-2021-1832.ts, lines 196-274

function chunkPartOneStructured(partOneText: string) {
  // Split by sections
  const sectionI = text.slice(sectionIIdx, sectionIIIdx);
  const sectionII = text.slice(sectionIIIdx);

  // Section I: Split by A, B, C blocks
  if (sectionI) {
    const aBlock = sectionI.slice(aIdx, bIdx);
    const bBlock = sectionI.slice(bIdx, cIdx);
    const cBlock = sectionI.slice(cIdx);

    // Block A: Split by numbered GRI rules (1., 2., ..., 6.)
    if (aBlock) {
      const parts = aBlock.split(/\n(?=\d+\.)/g);
      const header = parts.shift() || "";
      pushChunk("PART ONE > SECTION I > A > header", header);
      for (const p of parts) {
        const m = p.match(/^\s*(\d+)\./);
        const ruleNo = m ? m[1] : "x";
        pushChunk(`PART ONE > SECTION I > A > rule ${ruleNo}`, p);
      }
    }

    if (bBlock) pushChunk("PART ONE > SECTION I > B", bBlock);
    if (cBlock) pushChunk("PART ONE > SECTION I > C", cBlock);
  }

  // Section II: Split by lettered subsections (A., B., C., etc.)
  if (sectionII) {
    const parts = sectionII.split(/\n(?=[A-F]\.\s)/g);
    const header = parts.shift() || "";
    pushChunk("PART ONE > SECTION II > header", header);
    for (const p of parts) {
      const m = p.match(/^\s*([A-F])\./);
      const letter = m ? m[1] : "X";
      pushChunk(`PART ONE > SECTION II > ${letter}`, p);
    }
  }
}
```

This ensures GRI (General Rules for Interpretation) rules are properly chunked and searchable.

#### Step 5: Storage

```typescript
// Location: scripts/ingest-eurlex-2021-1832.ts, lines 316-351

async function insertChunks(chunks: Chunk[], options: { mode: "upsert" | "createMany" }) {
  const prisma = new PrismaClient();
  
  if (options.mode === "upsert") {
    // Upsert by sha256 hash (prevents duplicates)
    for (const c of chunks) {
      await prisma.legalSourceChunk.upsert({
        where: { sha256: c.sha256 },
        create: c,
        update: {
          content: c.content,
          sectionPath: c.sectionPath,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
        },
      });
    }
  } else {
    // Batch insert
    const batchSize = 250;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await prisma.legalSourceChunk.createMany({
        data: batch as any,
        skipDuplicates: true,
      });
    }
  }
}
```

**Key Points**:
- **Deduplication**: Uses SHA256 hash of content to prevent duplicates
- **Batch insert**: 250 chunks at a time for efficiency
- **No embeddings**: Embeddings are generated separately (see next section)

---

## Embedding Generation

### For Legal Source Chunks

**Script**: `scripts/generate-embeddings.ts`

Legal source chunks are ingested **without embeddings** initially. Embeddings are generated in a separate step:

```typescript
// Location: scripts/generate-embeddings.ts, lines 18-105

async function generateEmbeddings() {
  // Find all chunks without embeddings
  const totalWithoutEmbeddings = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count
    FROM "LegalSourceChunk"
    WHERE source = 'EUR_LEX'
      AND regulation = 'EU_2021_1832'
      AND language = 'EN'
      AND embedding IS NULL
  `;

  const total = Number(totalWithoutEmbeddings[0]?.count || 0);
  
  let processed = 0;
  let offset = 0;

  while (offset < total) {
    // Fetch batch of 100 chunks
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
      LIMIT 100
      OFFSET ${offset}
    `);

    // Generate embeddings for batch
    const texts = chunks.map((c) => c.content);
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts, // Batch API call
    });

    // Update each chunk with its embedding
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddingResponse.data[i]?.embedding;

      // Format as PostgreSQL vector array
      const embeddingVectorStr = `[${embedding.join(",")}]`;

      // Update using raw SQL (Prisma doesn't support vector type)
      await prisma.$executeRawUnsafe(`
        UPDATE "LegalSourceChunk"
        SET embedding = '${embeddingVectorStr}'::vector
        WHERE id = '${chunk.id}'
      `);

      processed++;
    }

    offset += chunks.length;
    
    // Rate limiting: 1 second delay between batches
    if (offset < total) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
```

**Key Points**:
- **Batch size**: 100 chunks per batch
- **Model**: `text-embedding-3-small` (1536 dimensions)
- **Rate limiting**: 1 second delay between batches
- **Batch API**: Uses OpenAI's batch embedding API for efficiency

### For Regulatory Document Chunks

Regulatory document chunks get embeddings **during ingestion** (see Step 5 in Document Ingestion Pipeline above). No separate script needed.

---

## Vector Similarity Search

### How It Works

All vector searches use **pgvector's cosine distance operator** (`<=>`) for similarity matching:

```sql
-- Similarity formula: 1 - (distance) = similarity score
-- Higher score = more similar (range: 0-1)

SELECT 
  content,
  1 - (embedding <=> '${queryEmbedding}'::vector) as similarity
FROM "TableName"
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '${queryEmbedding}'::vector
LIMIT 10
```

**Formula**:
- `embedding <=> queryEmbedding` = cosine distance (0 = identical, 1 = orthogonal)
- `1 - distance` = similarity score (1 = identical, 0 = orthogonal)

### Implementation: Regulatory Document Search

**Location**: `src/lib/rag/regulatory-search.ts`

```typescript
// Location: src/lib/rag/regulatory-search.ts, lines 56-124

export async function searchRegulatoryDocuments(
  options: RegulatorySearchOptions
): Promise<RegulatoryChunk[]> {
  const { productType, query, language = "FI", documentSources, maxResults = 10 } = options;

  // Step 1: Translate query to Finnish for better results (if needed)
  const searchQuery = language === "FI" ? query : await translateToFinnish(query);

  // Step 2: Generate embedding for the query
  const openai = createFeatureOpenAIClient("Regulatory Search Embeddings");
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: searchQuery,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;
  const embeddingVectorStr = `[${queryEmbedding.join(",")}]`;

  // Step 3: Determine document sources based on product type
  const sources = documentSources || getDefaultSources(productType);
  // FOOD → ["RUOKAVIRASTO", "EU"]
  // ELECTRONICS/TOYS → ["TUKES", "EU"]
  // GENERAL → ["TULLI", "EU"]

  // Step 4: Build SQL query with filters
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

  // Step 5: Execute query and return results
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
}
```

**Key Features**:
1. **Query translation**: Translates English queries to Finnish for better results
2. **Source filtering**: Filters by document source (RUOKAVIRASTO, TUKES, TULLI, EU)
3. **Product type filtering**: Filters by document type (FOOD_GUIDE, SAFETY_REGULATION, etc.)
4. **Similarity scoring**: Returns chunks sorted by similarity (highest first)

### Implementation: Legal Source Search

**Location**: `src/server/actions/classification-search.ts`

```typescript
// Location: src/server/actions/classification-search.ts, lines 14-163

async function searchLegalChunksForProduct(
  productName: string,
  description: string,
  compositionText?: string,
  limit: number = 10,
) {
  // Step 1: Build enhanced query with product type hints
  const baseQuery = `${productName}. ${description}${compositionText ? `. Materials: ${compositionText}` : ""}`.trim();
  
  // Add product category hints to improve search
  const productTypeHints: string[] = [];
  const lowerName = productName.toLowerCase();
  const lowerDesc = description.toLowerCase();
  
  if (lowerName.includes("trail mix") || lowerDesc.includes("nuts")) {
    productTypeHints.push("preparations of vegetables fruit nuts", "Chapter 20");
  }
  if (lowerName.includes("fish") || lowerDesc.includes("seafood")) {
    productTypeHints.push("fish aquatic products", "Chapter 3");
  }
  // ... more hints
  
  const query = productTypeHints.length > 0 
    ? `${baseQuery}. Product category: ${productTypeHints.join(", ")}`
    : baseQuery;
  
  // Step 2: Generate embedding
  const openai = createFeatureOpenAIClient("Classification Search Embeddings");
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  
  const queryEmbedding = embeddingResponse.data[0].embedding;
  const embeddingVectorStr = `[${queryEmbedding.join(",")}]`;
  
  // Step 3: Vector similarity search
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
  
  const chunks = await prisma.$queryRawUnsafe<Array<{
    id: string;
    sectionPath: string;
    content: string;
    pageStart: number | null;
    pageEnd: number | null;
    similarity: number;
  }>>(sql);
  
  // Step 4: Fallback to keyword search if no results
  if (chunks.length === 0) {
    console.log("[RAG] No chunks with embeddings found, falling back to keyword search");
    const fallbackChunks = await prisma.legalSourceChunk.findMany({
      where: {
        source: "EUR_LEX",
        regulation: "EU_2021_1832",
        language: "EN",
      },
      take: limit,
    });
    
    return fallbackChunks.map((chunk) => ({
      ...chunk,
      similarity: 0.5, // Default similarity for fallback
    }));
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
```

**Key Features**:
1. **Query enhancement**: Adds product type hints to improve search accuracy
2. **Fallback**: Falls back to keyword search if no embeddings found
3. **Excerpt generation**: Returns first 800 characters as excerpt

---

## User Flows & Request Handling

### Flow 1: Product Classification

**Entry Point**: `src/server/actions/classification-search.ts` → `searchAndClassifyAction()`

```
User submits product information
    ↓
[1] Build enhanced query (product name + description + composition + hints)
    ↓
[2] Generate query embedding (text-embedding-3-small)
    ↓
[3] Vector search LegalSourceChunk (EUR-Lex Regulation)
    ↓
[4] Retrieve top 10 chunks by similarity
    ↓
[5] Pass chunks to LLM for classification
    ↓
[6] LLM analyzes chunks + product info → suggests CN code
    ↓
[7] Return classification result with legal rationale
```

**Note**: As of the latest code, RAG search is **skipped for performance** in classification. The LLM uses its training knowledge directly. However, the RAG infrastructure is still in place and can be re-enabled.

### Flow 2: Label Generation

**Entry Point**: `src/lib/labeling/label-generator-enhanced.ts` → `generateEnhancedLabel()`

```
User requests label generation
    ↓
[1] Detect product type (FOOD, ELECTRONICS, TOYS, etc.)
    ↓
[2] Search RegulatoryDocumentChunk for:
    - Marks/symbols requirements
    - General labeling requirements
    ↓
[3] Generate query: "labeling requirements for [product type]"
    ↓
[4] Vector search RegulatoryDocumentChunk
    - Filter by source (RUOKAVIRASTO, TUKES, etc.)
    - Filter by product type
    ↓
[5] Retrieve top chunks with similarity scores
    ↓
[6] Pass chunks + product info to LLM
    ↓
[7] LLM generates compliant label using regulatory context
    ↓
[8] Return label data with regulatory sources cited
```

**Code Reference**:

```typescript
// Location: src/lib/labeling/label-generator-enhanced.ts, lines 150-212

// Search for marks/symbols requirements
const marksSearchQuery = `What marks, symbols, or certifications are required for ${product.productCategory} products in Finland? Include CE marking, age warnings, recycling symbols, allergen warnings, etc.`;
const marksChunks = await searchRegulatoryDocuments({
  productType,
  query: marksSearchQuery,
  maxResults: 5,
});

// Search for general labeling requirements
const generalSearchQuery = `What are the mandatory labeling requirements for ${product.productCategory} products in Finland? Include language requirements, ingredient lists, nutrition information, etc.`;
const regulatoryChunks = await searchRegulatoryDocuments({
  productType,
  query: generalSearchQuery,
  maxResults: 10,
});

// Combine all requirements
const allRequirements = [
  ...marksChunks.map((c) => `[${c.source} ${c.sectionPath}] ${c.content}`),
  ...regulatoryChunks.map((c) => `[${c.source} ${c.sectionPath}] ${c.content}`),
].join("\n\n");

// Pass to LLM with regulatory context
const systemPrompt = `You are an expert EU/Finnish regulatory compliance specialist. Your job is to generate a 100% compliant, ready-to-print product label.

REGULATORY CONTEXT (YOUR SOURCE OF TRUTH):
${allRequirements}

CRITICAL ACCURACY REQUIREMENTS:
1. You MUST use ONLY the regulatory requirements provided in the context below
2. DO NOT hallucinate marks, symbols, or requirements - if not in the regulatory context, do not include it
3. All text MUST be in Finnish AND Swedish (bilingual requirement for Finland)
4. Cite the exact regulatory source for each requirement
`;
```

### Flow 3: Compliance Chat

**Entry Point**: `src/server/actions/compliance-chat.ts` → `chatAction()`

```
User asks compliance question
    ↓
[1] Detect product type from query
    ↓
[2] Search BOTH document systems in parallel:
    - LegalSourceChunk (50% of results)
    - RegulatoryDocumentChunk (50% of results)
    ↓
[3] Generate embeddings for query
    ↓
[4] Vector search both systems
    ↓
[5] Combine and sort by similarity
    ↓
[6] Pass top chunks + question to LLM
    ↓
[7] LLM generates answer with citations
    ↓
[8] Return answer with source references
```

**Code Reference**:

```typescript
// Location: src/server/actions/compliance-chat.ts, lines 276-319

async function searchComplianceDocuments(query: string, limit: number = 10) {
  // Search legal sources (customs classification) - 50% of results
  const legalChunks = await searchLegalChunksVector(query, Math.ceil(limit / 2));
  
  // Detect product type to route to appropriate regulatory documents
  const productType = detectProductTypeFromQuery(query);
  
  // Search regulatory documents (labeling, safety, customs) - 50% of results
  const regulatoryResults = await searchRegulatoryDocuments({
    productType,
    query,
    maxResults: Math.ceil(limit / 2),
  });
  
  // Combine and sort by similarity (relevance)
  const allChunks = [...legalChunks, ...regulatoryChunks]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return allChunks;
}
```

---

## Database Schema

### RegulatoryDocument

```prisma
model RegulatoryDocument {
  id            String   @id @default(cuid())
  source        String   // "RUOKAVIRASTO", "TUKES", "TULLI", "EU"
  documentType  String   // "FOOD_GUIDE", "SAFETY_REGULATION", "CUSTOMS_GUIDE"
  title         String
  language      String   // "FI", "SV", "EN"
  pdfUrl        String?
  storagePath   String?
  version       String?
  effectiveDate DateTime?
  chunks        RegulatoryDocumentChunk[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([source, documentType, language])
  @@index([source, documentType])
  @@index([language])
}
```

### RegulatoryDocumentChunk

```prisma
model RegulatoryDocumentChunk {
  id          String              @id @default(cuid())
  documentId  String
  chunkIndex  Int
  sectionPath String              // e.g., "Section 5.3", "Chapter 2.1"
  content     String
  pageNumber  Int?
  embedding   Unsupported("vector")?  // pgvector type
  metadata    Json?               // { "section": "5.3", "topic": "QUID", "language": "FI" }
  document    RegulatoryDocument  @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId, chunkIndex])
  @@index([sectionPath])
}
```

### LegalSourceChunk

```prisma
model LegalSourceChunk {
  id          String                  @id @default(cuid())
  source      String                  // "EUR_LEX"
  regulation  String                  // "EU_2021_1832"
  language    String                  @default("EN")
  sectionPath String                  // e.g., "PART ONE > SECTION I > A > rule 1"
  content     String
  sha256      String                  @unique  // Deduplication hash
  pageStart   Int?
  pageEnd     Int?
  embedding   Unsupported("vector")?  // pgvector type
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  @@index([regulation, language])
  @@index([source])
}
```

**Note**: The `embedding` column uses PostgreSQL's `vector` type (via pgvector extension), which Prisma doesn't natively support. That's why we use `Unsupported("vector")` and raw SQL for embedding operations.

---

## Code Walkthrough

### Example: Complete RAG Search Flow

Let's trace through a complete example: **Searching for labeling requirements for a food product**.

#### Step 1: User Request

```typescript
// User calls label generator
const label = await generateEnhancedLabel({
  name: "Dried Mango",
  description: "Dried mango slices",
  productCategory: "FOOD",
  // ... other fields
});
```

#### Step 2: Query Generation

```typescript
// Location: src/lib/labeling/label-generator-enhanced.ts

const productType = getRegulatoryProductType("FOOD"); // Returns "FOOD"
const searchQuery = "What are the mandatory labeling requirements for FOOD products in Finland? Include language requirements, ingredient lists, nutrition information, etc.";
```

#### Step 3: Embedding Generation

```typescript
// Location: src/lib/rag/regulatory-search.ts, lines 64-72

const openai = createFeatureOpenAIClient("Regulatory Search Embeddings");
const embeddingResponse = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: searchQuery, // "What are the mandatory labeling requirements..."
});

const queryEmbedding = embeddingResponse.data[0].embedding;
// Returns: [0.123, -0.456, 0.789, ...] (1536 dimensions)
```

#### Step 4: Vector Search

```typescript
// Location: src/lib/rag/regulatory-search.ts, lines 78-96

const embeddingVectorStr = `[${queryEmbedding.join(",")}]`;
// Returns: "[0.123,-0.456,0.789,...]"

const sources = ["RUOKAVIRASTO", "EU"]; // For FOOD product type

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
    d.source = ANY(ARRAY['RUOKAVIRASTO', 'EU'])
    AND c.embedding IS NOT NULL
    AND d."documentType" = 'FOOD_GUIDE'
  ORDER BY c.embedding <=> '${embeddingVectorStr}'::vector
  LIMIT 10
`;

const results = await prisma.$queryRawUnsafe(sql);
```

**What happens in PostgreSQL**:
1. PostgreSQL receives the query with the vector string
2. Casts the string to `vector` type: `'[0.123,-0.456,...]'::vector`
3. Computes cosine distance for each chunk: `c.embedding <=> queryVector`
4. Orders by distance (ascending = most similar first)
5. Limits to top 10 results
6. Calculates similarity: `1 - distance`

**Example Result**:
```typescript
[
  {
    id: "chunk-123",
    content: "All food products sold in Finland must have labels in both Finnish and Swedish...",
    sectionPath: "Section 5.3",
    pageNumber: 42,
    title: "Food Labeling Guide",
    source: "RUOKAVIRASTO",
    language: "FI",
    similarity: 0.87  // 87% similar
  },
  {
    id: "chunk-456",
    content: "Mandatory information includes: product name, ingredients list, net quantity...",
    sectionPath: "Section 3.1",
    pageNumber: 15,
    title: "EU Regulation 1169/2011",
    source: "EU",
    language: "EN",
    similarity: 0.82  // 82% similar
  },
  // ... 8 more chunks
]
```

#### Step 5: Context Assembly

```typescript
// Location: src/lib/labeling/label-generator-enhanced.ts, lines 209-212

const allRequirements = regulatoryChunks.map((c) => 
  `[${c.source} ${c.sectionPath}] ${c.content}`
).join("\n\n");

// Result:
// "[RUOKAVIRASTO Section 5.3] All food products sold in Finland must have labels in both Finnish and Swedish...
// 
// [EU Section 3.1] Mandatory information includes: product name, ingredients list, net quantity..."
```

#### Step 6: LLM Generation

```typescript
// Location: src/lib/labeling/label-generator-enhanced.ts, lines 214-240

const systemPrompt = `You are an expert EU/Finnish regulatory compliance specialist. Your job is to generate a 100% compliant, ready-to-print product label.

REGULATORY CONTEXT (YOUR SOURCE OF TRUTH):
${allRequirements}

CRITICAL ACCURACY REQUIREMENTS:
1. You MUST use ONLY the regulatory requirements provided in the context below
2. DO NOT hallucinate marks, symbols, or requirements
3. All text MUST be in Finnish AND Swedish (bilingual requirement for Finland)
4. Cite the exact regulatory source for each requirement
`;

const userPrompt = `Generate a compliant label for:
Product: Dried Mango
Description: Dried mango slices
Category: FOOD
...`;

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
  temperature: 0.1, // Low temperature for accuracy
});
```

#### Step 7: Response

The LLM generates a compliant label using the regulatory context, ensuring:
- All requirements from the retrieved chunks are followed
- No hallucinated requirements
- Proper citations to regulatory sources
- Bilingual (Finnish + Swedish) content

---

## Performance Considerations

### Embedding Generation

- **Cost**: ~$0.02 per 1M tokens (text-embedding-3-small)
- **Speed**: ~100 chunks/minute (with rate limiting)
- **Batch API**: Use batch embedding API for efficiency (up to 2048 inputs per request)

### Vector Search

- **Index**: pgvector automatically creates indexes on `vector` columns
- **Query Time**: < 100ms for top-10 search on ~10K chunks
- **Scaling**: Consider HNSW index for larger datasets (>100K chunks)

### Chunk Size

- **Regulatory docs**: 800 characters (smaller, more focused)
- **Legal sources**: 4500 characters (larger, preserves context)
- **Trade-off**: Smaller chunks = more precise, but may lose context. Larger chunks = more context, but less precise.

---

## Troubleshooting

### "No chunks found" or "Empty results"

1. **Check embeddings**: Ensure chunks have embeddings
   ```sql
   SELECT COUNT(*) FROM "RegulatoryDocumentChunk" WHERE embedding IS NOT NULL;
   ```

2. **Run embedding generation**: `npm run generate:embeddings`

3. **Check query embedding**: Verify the query embedding is generated correctly

### "Vector type not found"

1. **Install pgvector extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Verify extension**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

### "Low similarity scores"

1. **Query quality**: Ensure the query is specific and relevant
2. **Language mismatch**: For regulatory docs, queries should be in Finnish for best results
3. **Chunk size**: Consider adjusting chunk size if context is lost

---

## Summary

The RAG pipeline in HarmonizeAI:

1. **Ingests** regulatory and legal documents (PDF/HTML → text → chunks)
2. **Generates** vector embeddings for all chunks (OpenAI text-embedding-3-small)
3. **Stores** chunks and embeddings in PostgreSQL with pgvector
4. **Searches** using cosine similarity to find relevant chunks
5. **Retrieves** top-N chunks by similarity score
6. **Passes** chunks as context to LLM for generation
7. **Ensures** responses are grounded in regulatory sources

This architecture provides **accurate, source-backed compliance information** while maintaining **fast search performance** and **cost efficiency**.


