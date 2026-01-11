# Phase 1: TARIC API Integration - Setup Guide

## ✅ What's Implemented

Phase 1 is now complete! The system will:
1. **Fetch CN code descriptions from TARIC API** when needed
2. **Cache descriptions in database** for faster future access
3. **Automatically use cached descriptions** to avoid API calls

## 🚀 Setup Steps

### Step 1: Update Database Schema

Run Prisma migration to add the new `CnCodeDescription` table:

```bash
npx prisma generate
npx prisma db push
```

This creates a new table to cache CN code descriptions from TARIC API.

### Step 2: Verify TARIC Configuration

Make sure your `.env` file has:

```env
TARIC_PROVIDER=SOAP
TARIC_WSDL_URL=https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl
```

### Step 3: Test It!

1. **Classify a product** - The system will automatically:
   - Check database cache first
   - If not found, fetch from TARIC API
   - Store in database for next time

2. **Check the database** - You should see descriptions being cached:
   ```sql
   SELECT * FROM "CnCodeDescription" ORDER BY "fetchedAt" DESC LIMIT 10;
   ```

## 📊 How It Works

### Flow Diagram

```
User Classifies Product
    ↓
GRI Engine determines CN Code
    ↓
Get Description Request
    ↓
Check Database Cache
    ├─ Found? → Return cached description
    └─ Not Found? → Fetch from TARIC API
                      ↓
                   Store in database
                      ↓
                   Return description
```

### Database Schema

```prisma
model CnCodeDescription {
  id          String     @id @default(cuid())
  cnCode      String     @unique
  market      MarketCode
  description String
  fullText    String?
  notes       String?
  source      String     @default("TARIC")
  fetchedAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  createdAt   DateTime   @default(now())
}
```

## 🛠️ Available Functions

### Get Description (Automatic)

```typescript
import { getCNCodeDescription } from "@/server/actions/cn-descriptions";

const description = await getCNCodeDescription("90191000", MarketCode.EU);
// Returns: "Mechano-therapy appliances; massage apparatus..."
```

### Bulk Fetch (Optional)

Pre-populate common CN codes:

```typescript
import { bulkFetchCNDescriptions } from "@/server/actions/cn-descriptions";

const result = await bulkFetchCNDescriptions(
  ["90191000", "85094000", "85165000"],
  MarketCode.EU
);
// Returns: { success: 3, failed: 0 }
```

### List Cached Descriptions

```typescript
import { listCNDescriptions } from "@/server/actions/cn-descriptions";

const cached = await listCNDescriptions(MarketCode.EU);
// Returns: Array of all cached descriptions
```

## 🎯 Benefits

1. **Faster responses** - Cached descriptions load instantly
2. **Reduced API calls** - Only fetches once per CN code
3. **Automatic caching** - No manual intervention needed
4. **Fallback support** - Works even if TARIC API is down

## 📝 Next Steps

After Phase 1 is working:
- **Phase 2**: Parse EUR-Lex documents for legal notes
- **Phase 3**: Set up automated sync for new CN codes

## ⚠️ Troubleshooting

### "Property 'cnCodeDescription' does not exist"

**Solution**: Run `npx prisma generate` to regenerate Prisma client after schema changes.

### "TARIC API error"

**Solution**: 
- Check your `.env` configuration
- Verify TARIC_WSDL_URL is correct
- The system will fall back to placeholder descriptions if API fails

### Descriptions not caching

**Solution**: 
- Check database connection
- Verify `CnCodeDescription` table exists
- Check console logs for errors

