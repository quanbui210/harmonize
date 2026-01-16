# Production Deployment Guide

Complete guide for deploying HarmonizeAI to production.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Environment Variables](#step-1-environment-variables)
3. [Step 2: Database Setup (Supabase)](#step-2-database-setup-supabase)
4. [Step 3: Process Regulatory Documents](#step-3-process-regulatory-documents)
5. [Step 4: OpenAI API Configuration](#step-4-openai-api-configuration)
5. [Step 5: Google OAuth Setup](#step-5-google-oauth-setup)
6. [Step 6: TARIC API (Optional)](#step-6-taric-api-optional)
7. [Step 7: Build & Deploy](#step-7-build--deploy)
8. [Step 8: Post-Deployment Verification](#step-8-post-deployment-verification)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 20+ installed
- npm or yarn package manager
- Supabase account (for database and auth)
- OpenAI API account (for AI features)
- Google Cloud Console account (for OAuth)
- Production hosting platform (Vercel, Railway, etc.)

---

## Step 1: Environment Variables

Create a `.env` file in your project root with all required variables:

```bash
# Database (Supabase)
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Application URL (production)
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# OpenAI (Required for AI features)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o"

# TARIC API (EU Customs Data)
# Option 1: Official SOAP (free, no API key)
TARIC_PROVIDER="SOAP"
TARIC_WSDL_URL="https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl"

# Option 2: Third-party REST (paid, requires API key)
# TARIC_PROVIDER="REST"
# TARIC_API_KEY="your-taric-api-key"
# TARIC_REST_API_URL="https://api.taricsupport.com/v1"

# Option 3: Mock mode (development only)
# TARIC_PROVIDER="MOCK"

# VIES (VAT Validation - public, no key needed)
VIES_WSDL_URL="http://ec.europa.eu/taxation_customs/vies/services/checkVatService?wsdl"

# EORI (Optional - requires registration)
# EORI_API_KEY=""
# EORI_BASE_URL="https://ec.europa.eu/taxation_customs/dds2/eos"
```

**⚠️ Important:** Never commit `.env` files to version control. Add `.env` to `.gitignore`.

---

## Step 2: Database Setup (Supabase)

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for database to be provisioned (~2 minutes)

### 2.2 Get Database Connection Strings

1. Go to **Settings** → **Database**
2. Under **Connection string**, select **Connection pooling** mode
3. Copy the connection string (use port `6543` for session mode)
4. Replace `[YOUR-PASSWORD]` with your database password
5. Use this for both `DATABASE_URL` and `DIRECT_URL` in `.env`

### 2.3 Get Supabase Auth Keys

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### 2.4 Run Database Migrations

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prepare

# Push schema to database
npm run db:push

# Or create a migration
npm run db:migrate
```

### 2.5 Enable pgvector Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.6 Create Storage Buckets

1. Go to **Storage** → **Buckets**
2. Create the following buckets:

   **`product-images`** (private):
   - Name: `product-images`
   - Public: `No`
   - File size limit: `10 MB`
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/jpg`

   **`vault-files`** (private):
   - Name: `vault-files`
   - Public: `No`
   - File size limit: `50 MB`
   - Allowed MIME types: `application/pdf`, `image/*`, `text/*`

   **`label-images`** (private):
   - Name: `label-images`
   - Public: `No`
   - File size limit: `10 MB`
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/jpg`

### 2.7 Set Up Row Level Security (RLS)

The app uses Supabase Auth, so RLS policies should be configured. Check your Prisma schema for table-level access patterns.

---

## Step 3: Process Regulatory Documents

**⚠️ Critical:** This step must be completed before production use. The app requires processed regulatory documents for labeling and compliance features.

### 3.1 Prepare PDF Documents

1. Place regulatory PDFs in `data/regulatory-docs/` folder:
   - Ruokavirasto documents (food labeling)
   - Tukes documents (safety regulations)
   - Tulli documents (customs procedures)
   - EU regulations (food information, safety)

2. **Required documents:**
   - Food labeling guides (FI/SV/EN)
   - Safety regulations
   - Customs procedures
   - EU Regulation 1169/2011 (Food Information to Consumers)

### 3.2 Run Document Ingestion Script

```bash
# Make sure OPENAI_API_KEY is set in .env
npm run ingest:regulatory-docs
```

**What this does:**
- Extracts text from PDFs
- Chunks documents into semantic sections
- Generates embeddings using OpenAI `text-embedding-3-small`
- Stores in `RegulatoryDocument` and `RegulatoryDocumentChunk` tables

**Expected output:**
```
[Ingest] Starting regulatory document ingestion...
[Ingest] Found 8 PDF file(s)
[Ingest] Processing: en-pakkausmerkintojen_valvontaohje-17055_1.pdf
[Ingest] Created 234 chunks
[Ingest] Processing batch 1/24
...
[Ingest] Completed: en-pakkausmerkintojen_valvontaohje-17055_1.pdf
[Ingest] Done!
```

### 3.3 Process Legal Sources (Optional but Recommended)

For compliance chat and classification features:

```bash
# Ingest EUR-Lex Regulation EU 2021/1832
npm run ingest:eurlex:2021:full:db
```

**Note:** This may take 30-60 minutes depending on document size.

### 3.4 Verify Document Processing

```bash
# Check embeddings in database
npm run check:embeddings
```

Or query directly:
```sql
SELECT COUNT(*) FROM "RegulatoryDocument";
SELECT COUNT(*) FROM "RegulatoryDocumentChunk";
SELECT COUNT(*) FROM "LegalSourceChunk";
```

---

## Step 4: OpenAI API Configuration

### 4.1 Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to **API Keys** → **Create new secret key**
4. Copy the key (starts with `sk-`)
5. Add to `.env`: `OPENAI_API_KEY="sk-..."`

### 4.2 Set Up Billing

1. Go to **Billing** → **Payment methods**
2. Add a payment method
3. Set usage limits if needed

### 4.3 Verify API Access

```bash
# Test OpenAI connection (run in Node.js)
node -e "const OpenAI = require('openai'); const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); client.models.list().then(console.log).catch(console.error);"
```

**Models used:**
- `gpt-4o` - Classification, dossier generation, label generation
- `gpt-4o` (Vision) - Image extraction from product photos
- `text-embedding-3-small` - Document embeddings

---

## Step 5: Google OAuth Setup

### 5.1 Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google+ API** (if not already enabled)

### 5.2 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure:

   **Authorized JavaScript origins:**
   ```
   https://your-domain.com
   http://localhost:3000  (for local testing)
   ```

   **Authorized redirect URIs:**
   ```
   https://PROJECT_REF.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback  (for local testing)
   ```

5. Click **Create**
6. Copy **Client ID** and **Client Secret**

### 5.3 Configure Supabase OAuth

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** provider
3. Enable it
4. Paste:
   - **Client ID** (from Google Cloud Console)
   - **Client Secret** (from Google Cloud Console)
5. Click **Save**

### 5.4 Test OAuth Flow

1. Visit your app's login page
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify you're redirected back to the app

**⚠️ Important:** Make sure `NEXT_PUBLIC_APP_URL` is set to your production domain. If not set, the app will try to detect it from request headers, but it's better to set it explicitly.

---

## Step 6: TARIC API (Optional)

### Option A: Official EU TARIC SOAP (Free)

**No API key needed!** Just use:
```env
TARIC_PROVIDER="SOAP"
TARIC_WSDL_URL="https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl"
```

**Note:** SOAP can be complex. For production, consider Option B.

### Option B: Third-Party REST API (Paid, Easier)

1. Sign up at [taricsupport.com/api](https://www.taricsupport.com/api)
2. Request free trial or paid plan
3. Get API key
4. Configure:
```env
TARIC_PROVIDER="REST"
TARIC_API_KEY="your-api-key"
TARIC_REST_API_URL="https://api.taricsupport.com/v1"
```

### Option C: Mock Mode (Development Only)

```env
TARIC_PROVIDER="MOCK"
```

**⚠️ Don't use MOCK in production!** It returns fake data.

---

## Step 7: Build & Deploy

### 7.1 Build Locally (Test First)

```bash
# Install dependencies
npm install

# Run type check
npm run type-check

# Run linting
npm run lint

# Build for production
npm run build

# Test production build locally
npm start
```

### 7.2 Deploy to Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Add Environment Variables:**
   - Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
   - Add all variables from `.env`
   - Set for **Production**, **Preview**, and **Development** as needed

4. **Configure Build Settings:**
   - Framework Preset: **Next.js**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

5. **Redeploy:**
   ```bash
   vercel --prod
   ```

### 7.3 Deploy to Railway

1. **Connect Repository:**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub repo

2. **Add Environment Variables:**
   - Go to **Variables** tab
   - Add all variables from `.env`

3. **Configure Build:**
   - Build Command: `npm run build`
   - Start Command: `npm start`

4. **Deploy:**
   - Railway auto-deploys on git push
   - Or trigger manual deploy

### 7.4 Deploy to Other Platforms

**Docker (if needed):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Step 8: Post-Deployment Verification

### 8.1 Health Checks

1. **Homepage loads:** `https://your-domain.com`
2. **Login works:** Test Google OAuth flow
3. **Dashboard accessible:** After login, verify dashboard loads

### 8.2 Feature Testing

1. **Classification:**
   - Create a product
   - Run classification
   - Verify CN/HS codes are returned

2. **Labeling:**
   - Create a label for a food product
   - Verify compliance checks run
   - Export label as PDF

3. **Compliance Chat:**
   - Ask a compliance question
   - Verify regulatory documents are referenced

4. **Image Upload:**
   - Upload a product image
   - Verify OpenAI Vision extraction works

### 8.3 Database Verification

```sql
-- Check document counts
SELECT 
  (SELECT COUNT(*) FROM "RegulatoryDocument") as regulatory_docs,
  (SELECT COUNT(*) FROM "RegulatoryDocumentChunk") as regulatory_chunks,
  (SELECT COUNT(*) FROM "LegalSourceChunk") as legal_chunks;

-- Should return > 0 for regulatory_docs and regulatory_chunks
```

### 8.4 Monitor Logs

- **Vercel:** Dashboard → **Deployments** → Click deployment → **Functions** tab
- **Railway:** **Deployments** → Click deployment → **Logs** tab
- **Supabase:** Dashboard → **Logs** → **Postgres Logs**

---

## Troubleshooting

### Issue: "PKCE code verifier not found"

**Solution:**
- Ensure `NEXT_PUBLIC_APP_URL` matches your production domain
- Verify OAuth redirect URIs in Google Cloud Console match Supabase callback URL
- Clear browser cookies and try again

### Issue: "Database connection failed"

**Solution:**
- Verify `DATABASE_URL` uses connection pooler (port 6543)
- Check Supabase project is active
- Verify password is correct (no special characters need URL encoding)

### Issue: "MaxClientsInSessionMode: max clients reached"

**Solution:**
This error occurs when the connection pool is exhausted. This is common in serverless environments.

**Fixes:**
1. **Ensure Prisma client is properly reused** - The code uses a singleton pattern, but verify your deployment rebuilt after the latest changes
2. **Check your Supabase plan** - Free tier has limited connections (15). Consider upgrading if you have high traffic
3. **Add connection pool parameters** to `DATABASE_URL`:
   ```
   ?connection_limit=1&pool_timeout=10
   ```
   (The code now adds this automatically, but you can add it manually too)
4. **Reduce concurrent requests** - If you're making many parallel database calls, batch them or reduce concurrency
5. **Upgrade Supabase plan** - Pro plan has 200 connections, which is better for production

**Quick fix:** Redeploy your application to ensure the latest Prisma client singleton pattern is active.

### Issue: "OpenAI API error"

**Solution:**
- Verify `OPENAI_API_KEY` is set correctly
- Check billing is enabled on OpenAI account
- Verify API key has not expired
- Check usage limits in OpenAI dashboard

### Issue: "No regulatory documents found"

**Solution:**
- Run `npm run ingest:regulatory-docs` again
- Verify PDFs are in `data/regulatory-docs/` folder
- Check database for `RegulatoryDocument` records
- Verify embeddings were generated (check `RegulatoryDocumentChunk.embedding` is not null)

### Issue: "Storage bucket not found"

**Solution:**
- Create buckets in Supabase Dashboard → **Storage**
- Verify bucket names match: `product-images`, `vault-files`, `label-images`
- Check RLS policies allow authenticated users to upload

### Issue: Build fails

**Solution:**
- Run `npm run type-check` locally to find TypeScript errors
- Run `npm run lint` to find linting errors
- Verify all environment variables are set in deployment platform
- Check Node.js version matches (should be 20+)

---

## Production Checklist

Before going live, verify:

- [ ] All environment variables are set in production
- [ ] Database migrations are applied
- [ ] Regulatory documents are processed (`npm run ingest:regulatory-docs`)
- [ ] Legal sources are processed (optional: `npm run ingest:eurlex:2021:full:db`)
- [ ] Storage buckets are created in Supabase
- [ ] Google OAuth is configured and tested
- [ ] OpenAI API key is valid and billing is enabled
- [ ] TARIC API is configured (or using MOCK for testing)
- [ ] Production build succeeds (`npm run build`)
- [ ] All features are tested in production
- [ ] Error monitoring is set up (Sentry, etc.)
- [ ] Domain is configured and SSL certificate is valid
- [ ] Analytics are configured (if needed)

---

## Additional Resources

- **API Access Guide:** [docs/API_ACCESS_GUIDE.md](./API_ACCESS_GUIDE.md)
- **Supabase Setup:** [docs/SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- **Document Status:** [docs/DOCUMENT_STATUS.md](./DOCUMENT_STATUS.md)
- **Regulatory Docs Usage:** [docs/REGULATORY_DOCS_USAGE.md](./REGULATORY_DOCS_USAGE.md)

---

## Support

If you encounter issues:
1. Check logs in your deployment platform
2. Verify all environment variables are set correctly
3. Test features one by one to isolate the issue
4. Check database for missing data (documents, embeddings)
5. Review error messages in browser console and server logs

---

**Last Updated:** 2025-01-27

