# Production Document Ingestion Guide

Complete guide for chunking and embedding documents in your production database.

---

## Prerequisites

1. ✅ Database schema is set up (you've run `prisma/init-production.sql`)
2. ✅ Environment variables are configured in `.env.production`:
   - `DATABASE_URL` - Your production Supabase connection string
   - `OPENAI_API_KEY` - Your OpenAI API key (required for embeddings)

---

## Step 1: Set Up Environment Variables

Make sure your `.env.production` file has:

```bash
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
OPENAI_API_KEY="sk-..."
```

**For Windows (PowerShell):**
```powershell
# Load production environment variables
$env:DATABASE_URL="your-production-database-url"
$env:OPENAI_API_KEY="sk-your-key"
```

**For Windows (CMD):**
```cmd
set DATABASE_URL=your-production-database-url
set OPENAI_API_KEY=sk-your-key
```

**For Linux/Mac:**
```bash
export DATABASE_URL="your-production-database-url"
export OPENAI_API_KEY="sk-your-key"
```

---

## Step 2: Process Regulatory Documents

Regulatory documents are PDFs in `data/regolatory-docs/` (or `data/regulatory-docs/`).

### 2.1 Verify PDFs Are Present

Your folder should contain PDFs like:
- `en-pakkausmerkintojen_valvontaohje-17055_1.pdf`
- `food-information-to-be-provided.pdf`
- `opas_elintarvikkeista_annettavat_tiedot_fi.pdf`
- `Regulation - 1169_2011 - EN - Food Information to Consumers Regulation - EUR-Lex.pdf`
- `Regulation - 2023_988 - EN - EUR-Lex.pdf`
- etc.

### 2.2 Run Regulatory Document Ingestion

```bash
# Make sure you're in the project root
cd "C:\Users\quanb\Documents\work\harmonize-ai"

# Set production environment variables (Windows PowerShell)
$env:DATABASE_URL="your-production-database-url"
$env:OPENAI_API_KEY="sk-your-key"

# Run the ingestion script
npm run ingest:regulatory-docs
```

**What this does:**
- ✅ Reads all PDFs from `data/regolatory-docs/` (handles typo automatically)
- ✅ Extracts text from each PDF
- ✅ Chunks documents into semantic sections (~800 chars per chunk)
- ✅ Generates embeddings using OpenAI `text-embedding-3-small`
- ✅ Stores in `RegulatoryDocument` and `RegulatoryDocumentChunk` tables

**Expected output:**
```
[Ingest] Starting regulatory document ingestion...
[Ingest] Found 7 PDF file(s)
[Ingest] Processing: en-pakkausmerkintojen_valvontaohje-17055_1.pdf
[Ingest] Created 234 chunks
[Ingest] Processing batch 1/24
[Ingest] Processing batch 2/24
...
[Ingest] Completed: en-pakkausmerkintojen_valvontaohje-17055_1.pdf
[Ingest] Done!
```

**Time estimate:** ~5-15 minutes per PDF (depends on size and OpenAI API rate limits)

---

## Step 3: Process Legal Sources (EUR-Lex)

Legal sources are in `data/legal-sources/` folder.

### 3.1 Option A: Ingest from HTML (Recommended - Faster)

If you have `eurlex.html` file:

```bash
# Set production environment variables
$env:DATABASE_URL="your-production-database-url"
$env:OPENAI_API_KEY="sk-your-key"

# Ingest from HTML and write to database
npm run ingest:eurlex:2021:html:db
```

### 3.2 Option B: Ingest from PDF (Full Document)

```bash
# Set production environment variables
$env:DATABASE_URL="your-production-database-url"
$env:OPENAI_API_KEY="sk-your-key"

# Ingest full PDF and write to database
npm run ingest:eurlex:2021:full:db
```

### 3.3 Option C: Ingest from JSONL (If Already Processed)

If you already have `eurlex-eu_2021_1832.en.jsonl` or `eurlex-eu_2021_1832.en.full.jsonl`:

```bash
# First, ingest to database (without embeddings)
npm run ingest:eurlex:2021:db

# Then generate embeddings separately
npm run generate:embeddings
```

**What this does:**
- ✅ Processes EUR-Lex Regulation EU 2021/1832 (Combined Nomenclature)
- ✅ Creates chunks in `LegalSourceChunk` table
- ✅ Generates embeddings for semantic search

**Time estimate:** 
- HTML: ~10-20 minutes
- PDF (full): ~30-60 minutes
- JSONL: ~5-10 minutes

---

## Step 4: Generate Missing Embeddings (If Needed)

If you ingested chunks without embeddings (e.g., from JSONL), generate them:

```bash
# Set production environment variables
$env:DATABASE_URL="your-production-database-url"
$env:OPENAI_API_KEY="sk-your-key"

# Generate embeddings for chunks that don't have them
npm run generate:embeddings
```

**What this does:**
- ✅ Finds all `LegalSourceChunk` records without embeddings
- ✅ Generates embeddings in batches of 100
- ✅ Updates records with vector embeddings

---

## Step 5: Verify Document Processing

### 5.1 Check Document Counts

Run in Supabase SQL Editor:

```sql
-- Check regulatory documents
SELECT 
  source,
  documentType,
  language,
  title,
  COUNT(chunks.id) as chunk_count
FROM "RegulatoryDocument" doc
LEFT JOIN "RegulatoryDocumentChunk" chunks ON chunks."documentId" = doc.id
GROUP BY doc.id, source, documentType, language, title
ORDER BY source, documentType;

-- Check legal source chunks
SELECT 
  source,
  regulation,
  language,
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embeddings
FROM "LegalSourceChunk"
GROUP BY source, regulation, language;
```

### 5.2 Use Check Script

```bash
# Set production environment variables
$env:DATABASE_URL="your-production-database-url"

# Run check script
npm run check:embeddings
```

**Expected output:**
```
Checking embeddings...
RegulatoryDocumentChunk: 1,234 chunks, 1,234 with embeddings (100%)
LegalSourceChunk: 5,678 chunks, 5,678 with embeddings (100%)
```

---

## Troubleshooting

### Issue: "DATABASE_URL is not set"

**Solution:** Make sure you've set the environment variable before running the script:

```powershell
$env:DATABASE_URL="your-production-database-url"
$env:OPENAI_API_KEY="sk-your-key"
npm run ingest:regulatory-docs
```

### Issue: "OPENAI_API_KEY is not set"

**Solution:** Set the OpenAI API key:

```powershell
$env:OPENAI_API_KEY="sk-your-key"
```

### Issue: "Folder not found: data/regulatory-docs"

**Solution:** The script handles both spellings:
- `data/regulatory-docs/` (correct spelling)
- `data/regolatory-docs/` (typo - also works)

Make sure your PDFs are in one of these folders.

### Issue: "Failed to parse PDF" or "Extracted text too short"

**Possible causes:**
- PDF is image-based (scanned) without text layer
- PDF is corrupted
- PDF is password-protected

**Solution:** 
- Try a different PDF source
- Use OCR tools to extract text first
- Check if PDF opens correctly in a PDF viewer

### Issue: OpenAI API Rate Limits

**Symptoms:** Script stops with rate limit errors

**Solution:**
- Wait a few minutes and retry
- The script processes in batches, so partial progress is saved
- You can re-run the script - it will skip already processed documents

### Issue: Embeddings Not Generated

**Solution:** Run the generate embeddings script separately:

```bash
npm run generate:embeddings
```

---

## Cost Estimates

### OpenAI API Costs (Embeddings)

- **Model:** `text-embedding-3-small`
- **Cost:** ~$0.02 per 1M tokens
- **Average chunk size:** ~200 tokens
- **Estimated costs:**
  - Regulatory docs (7 PDFs): ~$0.10 - $0.50
  - Legal sources (EUR-Lex): ~$0.50 - $2.00
  - **Total:** ~$0.60 - $2.50

### Time Estimates

- **Regulatory docs:** 30-60 minutes total
- **Legal sources:** 10-60 minutes (depends on method)
- **Total:** ~1-2 hours

---

## Next Steps

After document ingestion is complete:

1. ✅ Verify all documents are ingested (use SQL queries above)
2. ✅ Test semantic search in your application
3. ✅ Monitor OpenAI API usage and costs
4. ✅ Set up regular document updates (if needed)

---

## Quick Reference Commands

```bash
# Set production environment (PowerShell)
$env:DATABASE_URL="your-production-database-url"
$env:OPENAI_API_KEY="sk-your-key"

# Ingest regulatory documents
npm run ingest:regulatory-docs

# Ingest legal sources (HTML)
npm run ingest:eurlex:2021:html:db

# Ingest legal sources (PDF full)
npm run ingest:eurlex:2021:full:db

# Generate missing embeddings
npm run generate:embeddings

# Check embeddings status
npm run check:embeddings
```

---

## Notes

- **Document metadata is auto-detected** from filenames (source, type, language)
- **Chunks are deduplicated** using SHA-256 hashes
- **Embeddings are generated in batches** to respect API rate limits
- **Progress is saved incrementally** - you can re-run scripts safely
- **Scripts handle both folder spellings** (`regulatory-docs` and `regolatory-docs`)

