# Development Database Setup - Populate Documents

**Quick guide to populate your development database with regulatory documents and legal sources.**

---

## ⚠️ Why Tables Are Empty

The `RegulatoryDocumentChunk` and `LegalSourceChunk` tables are empty because **the ingestion scripts haven't been run yet**. These scripts need to be executed to:

1. Extract text from PDFs
2. Chunk documents
3. Generate embeddings
4. Store in database

---

## 🚀 Quick Start - Populate Development Database

### Step 1: Verify Your Development Database Connection

Make sure your `.env` file has your **development** database URL:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/harmonize_dev"
# OR your development Supabase URL
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
```

### Step 2: Make Sure You Have OpenAI API Key

```bash
OPENAI_API_KEY="sk-..."
```

### Step 3: Run Regulatory Documents Ingestion

This populates `RegulatoryDocument` and `RegulatoryDocumentChunk` tables:

```bash
npm run ingest:regulatory-docs
```

**What it does:**
- Reads PDFs from `data/regolatory-docs/` (or `data/regulatory-docs/`)
- Extracts text, chunks it, generates embeddings
- Stores in database

**Expected output:**
```
[Ingest] Starting regulatory document ingestion...
[Ingest] Found 7 PDF file(s)
[Ingest] Processing: en-pakkausmerkintojen_valvontaohje-17055_1.pdf
[Ingest] Created 234 chunks
[Ingest] Processing batch 1/24
...
[Ingest] Done!
```

**Time:** ~30-60 minutes for all PDFs

### Step 4: Run Legal Sources Ingestion

This populates `LegalSourceChunk` table (for classification features):

**Option A: From HTML (Fastest - Recommended)**
```bash
npm run ingest:eurlex:2021:html:db
```

**Option B: From PDF (Full document)**
```bash
npm run ingest:eurlex:2021:full:db
```

**Option C: From JSONL (If you already have the file)**
```bash
# First ingest chunks
npm run ingest:eurlex:2021:db

# Then generate embeddings
npm run generate:embeddings
```

**Time:** 
- HTML: ~10-20 minutes
- PDF: ~30-60 minutes
- JSONL: ~5-10 minutes

### Step 5: Verify Data Was Ingested

**Option A: Use the check script**
```bash
npm run check:embeddings
```

**Option B: Check in Supabase Studio**
- Go to Table Editor
- Check `RegulatoryDocumentChunk` - should have rows
- Check `LegalSourceChunk` - should have rows

**Option C: Run SQL queries**
```sql
-- Check regulatory documents
SELECT COUNT(*) FROM "RegulatoryDocumentChunk";

-- Check legal sources
SELECT COUNT(*) FROM "LegalSourceChunk";

-- Check embeddings
SELECT 
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NULL) as without_embeddings
FROM "LegalSourceChunk";
```

---

## 📋 Complete Command List

```bash
# 1. Ingest regulatory documents (for labeling)
npm run ingest:regulatory-docs

# 2. Ingest legal sources (for classification)
npm run ingest:eurlex:2021:html:db

# 3. Generate missing embeddings (if needed)
npm run generate:embeddings

# 4. Check status
npm run check:embeddings
```

---

## 🔍 Troubleshooting

### "DATABASE_URL is not set"

Make sure your `.env` file has `DATABASE_URL` set to your **development** database.

### "OPENAI_API_KEY is not set"

You need an OpenAI API key to generate embeddings. Add it to `.env`:
```bash
OPENAI_API_KEY="sk-..."
```

### "No PDF files found"

Make sure PDFs are in:
- `data/regolatory-docs/` (handles typo)
- OR `data/regulatory-docs/`

### "Tables are still empty after running scripts"

1. Check which database you're connected to:
   ```bash
   # Check your .env file
   echo $DATABASE_URL
   ```

2. Make sure you're using the **development** database URL, not production

3. Check for errors in the script output

4. Verify the scripts completed successfully (look for "Done!" message)

### "Embeddings are NULL"

If chunks were created but embeddings are NULL:
```bash
npm run generate:embeddings
```

This will generate embeddings for all chunks that don't have them.

---

## ⚡ Quick Verification

After running the scripts, you should see:

1. **RegulatoryDocumentChunk**: ~1,000-5,000+ chunks (depends on PDFs)
2. **LegalSourceChunk**: ~5,000-10,000+ chunks (EUR-Lex regulation)

If both tables have data, you're good to go! 🎉

---

## 📝 Notes

- **Development vs Production**: Make sure you're using the correct `DATABASE_URL`
- **Cost**: Generating embeddings uses OpenAI API (~$0.02 per 1M tokens)
- **Time**: First-time ingestion can take 1-2 hours total
- **Re-running**: Scripts are safe to re-run (they update existing records)

---

## 🎯 What Gets Populated

### RegulatoryDocumentChunk
- **Source**: Food labeling guides, safety regulations
- **Used by**: Labeling wizard, compliance features
- **Script**: `ingest-regulatory-docs.ts`

### LegalSourceChunk  
- **Source**: EUR-Lex Regulation EU 2021/1832 (Combined Nomenclature)
- **Used by**: Classification features, compliance chat
- **Script**: `ingest-eurlex-2021-1832.ts`

---

## ✅ Success Checklist

- [ ] `RegulatoryDocumentChunk` table has rows
- [ ] `LegalSourceChunk` table has rows  
- [ ] Embeddings are generated (not NULL)
- [ ] `npm run check:embeddings` shows data
- [ ] Classification features work
- [ ] Labeling features work

