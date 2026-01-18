# Embedding Storage & Vector Similarity Search

Complete overview of where embeddings are stored and how vector similarity search is implemented.

---

## 📦 Where Embeddings Are Stored

All embeddings are stored in **PostgreSQL/Supabase** using the **pgvector** extension. The database schema includes the following tables with embedding columns:

### 1. **LegalSourceChunk** (Classification & QA Chat)
- **Table**: `LegalSourceChunk`
- **Column**: `embedding` (type: `vector`)
- **Content**: EUR-Lex Regulation EU 2021/1832 (Combined Nomenclature)
- **Model**: `text-embedding-3-small` (1536 dimensions)
- **Usage**: 
  - ✅ **Classifications** - Finding relevant CN code rules
  - ✅ **QA Chat** - Answering compliance questions

### 2. **RegulatoryDocumentChunk** (Label Generation)
- **Table**: `RegulatoryDocumentChunk`
- **Column**: `embedding` (type: `vector`)
- **Content**: Ruokavirasto, Tukes, Tulli, EU regulatory documents
- **Model**: `text-embedding-3-small` (1536 dimensions)
- **Usage**:
  - ✅ **Label Generation** - Finding labeling requirements
  - ✅ **QA Chat** - Answering regulatory questions

### 3. **LegalNote** (Not Currently Used)
- **Table**: `LegalNote`
- **Column**: `embedding` (type: `vector`)
- **Status**: Schema exists but not actively used in search

### 4. **BindingRuling** (Not Currently Used)
- **Table**: `BindingRuling`
- **Column**: `embedding` (type: `vector`)
- **Status**: Schema exists but not actively used in search

---

## 🔍 Vector Similarity Search Implementation

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

**Key Points:**
- Uses **cosine distance** (`<=>`) for semantic similarity
- Converts distance to similarity: `1 - distance`
- Orders by distance (ascending = most similar first)
- Filters out NULL embeddings

---

## ✅ Features Using Vector Search

### 1. **Classifications** (`src/server/actions/classification-search.ts`)

**Function**: `searchLegalChunksForProduct()`

**What it does:**
- Searches `LegalSourceChunk` table for relevant CN code rules
- Uses product name, description, and materials to find matching regulations
- Returns chunks with similarity scores

**Implementation:**
```typescript
// Generate embedding for product query
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: `${productName}. ${description}...`
});

// Vector similarity search
const sql = `
  SELECT 
    id, "sectionPath", content,
    1 - (embedding <=> '${embeddingVectorStr}'::vector) as similarity
  FROM "LegalSourceChunk"
  WHERE source = 'EUR_LEX'
    AND regulation = 'EU_2021_1832'
    AND embedding IS NOT NULL
  ORDER BY embedding <=> '${embeddingVectorStr}'::vector
  LIMIT 10
`;
```

**Fallback**: Keyword search if embeddings are missing

**Used by**: EU Classification Engine

---

### 2. **QA Chat / Compliance Chat** (`src/server/actions/compliance-chat.ts`)

**Functions**: 
- `searchLegalChunksVector()` - Searches legal sources
- `searchRegulatoryDocuments()` - Searches regulatory documents (via `regulatory-search.ts`)
- `searchComplianceDocuments()` - Combines both

**What it does:**
- Searches both `LegalSourceChunk` and `RegulatoryDocumentChunk`
- Combines results from customs classification and regulatory documents
- Sorts by similarity score

**Implementation:**
```typescript
// Search legal sources (50% of results)
const legalChunks = await searchLegalChunksVector(query, limit / 2);

// Search regulatory documents (50% of results)
const regulatoryChunks = await searchRegulatoryDocuments({
  productType,
  query,
  maxResults: limit / 2,
});

// Combine and sort by similarity
const allChunks = [...legalChunks, ...regulatoryChunks]
  .sort((a, b) => b.similarity - a.similarity);
```

**Fallback**: Keyword search if vector search fails

**Used by**: Compliance Chat feature

---

### 3. **Label Generation** (`src/lib/rag/regulatory-search.ts`)

**Function**: `searchRegulatoryDocuments()`

**What it does:**
- Searches `RegulatoryDocumentChunk` for labeling requirements
- Filters by product type (FOOD, ELECTRONICS, TOYS, etc.)
- Filters by document source (RUOKAVIRASTO, TUKES, TULLI, EU)
- Translates queries to Finnish for better results

**Implementation:**
```typescript
// Generate embedding
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: translatedQuery
});

// Vector search with filters
const sql = `
  SELECT 
    c.id, c.content, c."sectionPath",
    d.title, d.source, d.language,
    1 - (c.embedding <=> '${embeddingVectorStr}'::vector) as similarity
  FROM "RegulatoryDocumentChunk" c
  JOIN "RegulatoryDocument" d ON c."documentId" = d.id
  WHERE 
    d.source = ANY(ARRAY['RUOKAVIRASTO', 'TUKES', ...])
    AND c.embedding IS NOT NULL
    AND (product type filters...)
  ORDER BY c.embedding <=> '${embeddingVectorStr}'::vector
  LIMIT 10
`;
```

**Fallback**: Returns empty array if search fails

**Used by**: 
- Label Generator (`label-generator.ts`)
- Enhanced Label Generator (`label-generator-enhanced.ts`)
- Label Analyzer (`label-analyzer.ts`)

---

## 🔄 Search Flow

### Classification Flow:
```
User Input (Product Info)
    ↓
Generate Embedding (OpenAI)
    ↓
Vector Search (LegalSourceChunk)
    ↓
Return Top 10 Chunks (by similarity)
    ↓
Pass to LLM for Classification
```

### QA Chat Flow:
```
User Question
    ↓
Generate Embedding (OpenAI)
    ↓
Parallel Searches:
  ├─→ Vector Search (LegalSourceChunk) - 50%
  └─→ Vector Search (RegulatoryDocumentChunk) - 50%
    ↓
Combine & Sort by Similarity
    ↓
Pass to LLM for Answer Generation
```

### Label Generation Flow:
```
Product Info + Product Type
    ↓
Detect Product Type
    ↓
Generate Embedding (OpenAI)
    ↓
Vector Search (RegulatoryDocumentChunk)
  + Filter by Product Type
  + Filter by Document Source
    ↓
Return Top 10 Chunks (by similarity)
    ↓
Pass to LLM for Label Generation
```

---

## 📊 Embedding Generation

### When Embeddings Are Created:

1. **During Document Ingestion:**
   - `scripts/ingest-regulatory-docs.ts` - Generates embeddings for regulatory PDFs
   - `scripts/ingest-eurlex-2021-1832.ts` - Generates embeddings for EUR-Lex regulation
   - `scripts/generate-embeddings.ts` - Generates missing embeddings

2. **Model Used:**
   - **Model**: `text-embedding-3-small`
   - **Dimensions**: 1536
   - **Cost**: ~$0.02 per 1M tokens

3. **Storage Format:**
   - Stored as PostgreSQL `vector` type (pgvector extension)
   - Format: `[0.123, -0.456, 0.789, ...]` (1536 floats)

---

## 🛡️ Fallback Mechanisms

All vector search implementations have **graceful fallbacks**:

### 1. **If Embeddings Are Missing:**
- Falls back to keyword search
- Uses basic text matching
- Returns results with default similarity (0.5)

### 2. **If Vector Search Fails:**
- Catches errors gracefully
- Logs error for debugging
- Returns empty results or fallback results

### 3. **If pgvector Extension Missing:**
- Vector operations will fail
- Falls back to keyword search automatically

---

## 📈 Performance Considerations

### Indexes:
- **No vector indexes** are currently defined
- Consider adding **HNSW indexes** for better performance at scale:
  ```sql
  CREATE INDEX ON "LegalSourceChunk" 
  USING hnsw (embedding vector_cosine_ops);
  
  CREATE INDEX ON "RegulatoryDocumentChunk" 
  USING hnsw (embedding vector_cosine_ops);
  ```

### Query Performance:
- Vector search is **fast** for small-medium datasets (< 100K chunks)
- May need indexes for larger datasets (> 100K chunks)
- Current queries use `LIMIT 10-20` which helps performance

---

## ✅ Summary

| Feature | Table | Vector Search? | Fallback |
|---------|-------|----------------|----------|
| **Classifications** | `LegalSourceChunk` | ✅ Yes | Keyword search |
| **QA Chat** | `LegalSourceChunk` + `RegulatoryDocumentChunk` | ✅ Yes | Keyword search |
| **Label Generation** | `RegulatoryDocumentChunk` | ✅ Yes | Empty results |

**All three features use vector similarity search with pgvector!** 🎉

---

## 🔧 Maintenance

### Check Embedding Status:
```bash
npm run check:embeddings
```

### Generate Missing Embeddings:
```bash
npm run generate:embeddings
```

### SQL Queries to Check:
```sql
-- Check LegalSourceChunk embeddings
SELECT 
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings
FROM "LegalSourceChunk"
WHERE source = 'EUR_LEX' AND regulation = 'EU_2021_1832';

-- Check RegulatoryDocumentChunk embeddings
SELECT 
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings
FROM "RegulatoryDocumentChunk";
```

---

## 🚀 Future Improvements

1. **Add HNSW Indexes** for better performance at scale
2. **Hybrid Search** - Combine vector + keyword search for better results
3. **Reranking** - Use cross-encoder models to rerank top results
4. **Caching** - Cache common query embeddings
5. **Use LegalNote & BindingRuling** embeddings if needed

