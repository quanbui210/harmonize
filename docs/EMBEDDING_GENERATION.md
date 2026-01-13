# Embedding Generation Guide

## Problem

The RAG (Retrieval-Augmented Generation) system uses vector similarity search to find relevant legal document chunks. However, the chunks were ingested without embeddings, so the vector search returns 0 results.

## Solution

Generate embeddings for all `LegalSourceChunk` records using OpenAI's embedding API.

## Quick Fix

Run the embedding generation script:

```bash
npm run generate:embeddings
```

This will:
1. Find all chunks without embeddings
2. Generate embeddings in batches of 100
3. Update the database with embeddings
4. Show progress as it processes

## What It Does

1. **Finds chunks without embeddings**: Queries for `LegalSourceChunk` records where `embedding IS NULL`
2. **Generates embeddings**: Uses OpenAI `text-embedding-3-small` model (1536 dimensions)
3. **Updates database**: Stores embeddings as PostgreSQL `vector` type
4. **Rate limiting**: Waits 1 second between batches to avoid API limits

## Cost Estimate

- **Model**: `text-embedding-3-small`
- **Cost**: ~$0.02 per 1M tokens
- **For 540 chunks**: ~$0.10-0.50 (depends on chunk size)

## Time Estimate

- **540 chunks**: ~5-10 minutes (with rate limiting)
- **Processing**: ~100 chunks per minute

## After Running

Once embeddings are generated, the RAG search will work properly:
- Vector similarity search will find relevant chunks
- Better classification accuracy
- More accurate CN code extraction

## Troubleshooting

### "No embedding for chunk"
- Some chunks might be too large or empty
- Check the chunk content in the database
- These chunks will be skipped

### "Rate limit exceeded"
- The script has built-in rate limiting (1 second delay)
- If you still hit limits, increase the delay in the script
- Or reduce `BATCH_SIZE` from 100 to 50

### "Vector type not found"
- Make sure pgvector extension is installed in PostgreSQL
- Run: `CREATE EXTENSION IF NOT EXISTS vector;` in your database

## Verification

After running, verify embeddings were created:

```sql
SELECT 
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embeddings
FROM "LegalSourceChunk"
WHERE source = 'EUR_LEX' 
  AND regulation = 'EU_2021_1832';
```

Should show all chunks have embeddings.

## Re-running

The script is idempotent - it only processes chunks without embeddings. Safe to run multiple times.

