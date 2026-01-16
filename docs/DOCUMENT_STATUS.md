# Document Processing Status

## Overview

Your application uses **two separate document systems** for different features:

1. **`RegulatoryDocument` + `RegulatoryDocumentChunk`** - For food/safety regulatory documents (Ruokavirasto, Tukes, Tulli, EU)
2. **`LegalSourceChunk`** - For EU customs classification regulation (EUR-Lex Regulation EU 2021/1832)

---

## Feature-by-Feature Status

### ✅ **Labeling Feature** - READY

**Documents Used:**
- `RegulatoryDocument` table
- `RegulatoryDocumentChunk` table (with embeddings)

**Ingestion Script:**
- `scripts/ingest-regulatory-docs.ts`

**What It Does:**
- Processes PDFs from `data/regulatory-docs/` folder
- Extracts text, chunks it, generates embeddings
- Stores in `RegulatoryDocument` and `RegulatoryDocumentChunk` tables
- Sources: RUOKAVIRASTO, TUKES, TULLI, EU documents

**Usage:**
- Used by `src/lib/rag/regulatory-search.ts` → `searchRegulatoryDocuments()`
- Called in:
  - `src/lib/labeling/label-generator-enhanced.ts` (RAG search for labeling requirements)
  - `src/lib/labeling/label-generator.ts` (RAG search for compliance)

**Status:** ✅ **READY** - Documents are processed and ready for labeling

---

### ✅ **Classification Feature** - READY

**Documents Used:**
- `LegalSourceChunk` table (with embeddings)

**Ingestion Script:**
- `scripts/ingest-eurlex-2021-1832.ts`

**What It Does:**
- Processes EUR-Lex Regulation EU 2021/1832 (customs classification)
- Extracts text, chunks it, generates embeddings
- Stores in `LegalSourceChunk` table
- Source: EUR_LEX, Regulation: EU_2021_1832, Language: EN

**Usage:**
- Used by `src/server/actions/classification-search.ts` → `searchLegalChunksForProduct()`
- Vector similarity search using pgvector
- Falls back to keyword search if embeddings not available

**Status:** ✅ **READY** - Documents are processed and ready for classification

---

### ⚠️ **Compliance Chat Feature** - PARTIALLY READY

**Documents Used:**
- `LegalSourceChunk` table (keyword search, NOT vector search yet)

**Ingestion Script:**
- Same as classification: `scripts/ingest-eurlex-2021-1832.ts`

**What It Does:**
- Uses `src/server/actions/compliance-chat.ts` → `searchLegalChunks()`
- Currently uses **keyword matching** (not vector similarity)
- Searches for CN codes, GRI rules, chapter numbers, keywords

**Current Implementation:**
```typescript
// Uses keyword search, not vector search
async function searchLegalChunks(query: string, limit: number = 5) {
  // Keyword matching on content, sectionPath
  // Extracts CN codes, GRI rules, chapter numbers
}
```

**Status:** ⚠️ **PARTIALLY READY**
- ✅ Documents are in database (`LegalSourceChunk`)
- ⚠️ Using keyword search instead of vector similarity (less accurate)
- 💡 **Recommendation:** Upgrade to vector search like classification uses

---

## Summary Table

| Feature | Table Used | Ingestion Script | Search Method | Status |
|---------|-----------|------------------|---------------|--------|
| **Labeling** | `RegulatoryDocumentChunk` | `ingest-regulatory-docs.ts` | Vector similarity | ✅ Ready |
| **Classification** | `LegalSourceChunk` | `ingest-eurlex-2021-1832.ts` | Vector similarity | ✅ Ready |
| **Compliance Chat** | `LegalSourceChunk` | `ingest-eurlex-2021-1832.ts` | Keyword matching | ⚠️ Partially Ready |

---

## Recommendations

### 1. Upgrade Compliance Chat to Vector Search

The compliance chat currently uses keyword search, which is less accurate than vector similarity search. To upgrade:

**Current code** (`src/server/actions/compliance-chat.ts`):
```typescript
async function searchLegalChunks(query: string, limit: number = 5) {
  // Uses keyword matching
  const where: any = {
    source: "EUR_LEX",
    regulation: "EU_2021_1832",
    language: "EN",
  };
  // ... keyword search logic
}
```

**Should be upgraded to** (like classification does):
```typescript
async function searchLegalChunks(query: string, limit: number = 5) {
  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  
  // Vector similarity search using pgvector
  const sql = `
    SELECT id, "sectionPath", content, "pageStart", "pageEnd",
           1 - (embedding <=> '${embeddingVectorStr}'::vector) as similarity
    FROM "LegalSourceChunk"
    WHERE source = 'EUR_LEX'
      AND regulation = 'EU_2021_1832'
      AND language = 'EN'
      AND embedding IS NOT NULL
    ORDER BY embedding <=> '${embeddingVectorStr}'::vector
    LIMIT ${limit}
  `;
}
```

### 2. Verify Document Counts

Run these queries to verify documents are ingested:

```sql
-- Check RegulatoryDocument (for labeling)
SELECT source, "documentType", language, COUNT(*) as chunk_count
FROM "RegulatoryDocument" d
JOIN "RegulatoryDocumentChunk" c ON c."documentId" = d.id
GROUP BY source, "documentType", language;

-- Check LegalSourceChunk (for classification & compliance chat)
SELECT source, regulation, language, COUNT(*) as chunk_count
FROM "LegalSourceChunk"
GROUP BY source, regulation, language;

-- Check embeddings status
SELECT 
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings
FROM "LegalSourceChunk"
WHERE source = 'EUR_LEX' AND regulation = 'EU_2021_1832';
```

### 3. Generate Embeddings for LegalSourceChunk (if missing)

If embeddings are missing, run:
```bash
npx tsx scripts/generate-embeddings.ts
```

This will generate embeddings for all `LegalSourceChunk` records that don't have them yet.

---

## Conclusion

- ✅ **Labeling**: Fully ready with vector search
- ✅ **Classification**: Fully ready with vector search  
- ⚠️ **Compliance Chat**: Documents ready, but should upgrade from keyword to vector search for better accuracy

All documents are processed and stored. The compliance chat just needs to be upgraded to use vector similarity search instead of keyword matching.


