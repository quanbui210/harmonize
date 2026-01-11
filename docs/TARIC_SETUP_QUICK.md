# TARIC API Setup - Quick Start (2025)

## ✅ Official EU TARIC API - No API Key Required!

**Great news!** The EU has released public TARIC APIs that require **NO registration and NO API key**.

## Quick Setup (5 minutes)

### Step 1: Update Environment Variables

In your `.env` file:

```env
TARIC_PROVIDER=SOAP
TARIC_WSDL_URL=https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl
```

**That's it!** No API key needed.

### Step 2: Test It

The TARIC client is already configured to use this endpoint. Just run your app:

```bash
npm run dev
```

Then classify a product - it will automatically fetch:
- ✅ Duty rates
- ✅ VAT rates  
- ✅ CN code descriptions
- ✅ Quotas and measures

## What You Get

### 1. Duty Rates & Measures
- Base duty rate
- VAT rate
- Quotas (if applicable)
- Additional duties (anti-dumping, etc.)

### 2. CN Code Descriptions
- Official EU descriptions for each CN code
- Updated automatically
- No manual downloads needed

## API Methods Available

The WSDL provides two main methods:

### `getMeasuresPerGoodsCode`
**Input:**
- `goodsCode`: CN code (e.g., "85167970")
- `date`: Date in YYYY-MM-DD format

**Output:**
- Duty rate
- VAT rate
- Quotas
- Additional measures

### `getDescriptionsPerGoodsCode`
**Input:**
- `goodsCode`: CN code (e.g., "85167970")
- `date`: Date in YYYY-MM-DD format

**Output:**
- Official CN code description text

## Usage Limits

- **Rate Limit:** 100 requests per second
- **No Authentication:** Public access
- **No API Key:** Not required

## Testing the API

You can test directly with SOAP client:

```bash
# Install soap client globally (optional)
npm install -g soap-cli

# Or use Postman/Insomnia with SOAP support
```

Or test in your code:

```typescript
import { taricClient } from "@/lib/eu/taric-client";

// Get duty rate
const measure = await taricClient.getDutyRate("85167970");
console.log(measure); // { dutyRate: 0, vatRate: 20, ... }

// Get description
const description = await taricClient.getDescriptionForCode("85167970");
console.log(description); // "Electric instantaneous water heaters..."
```

## Troubleshooting

### Issue: "Connection timeout"
**Solution:** The EU server might be slow. Add retry logic or use mock mode for development.

### Issue: "Method not found"
**Solution:** The WSDL structure might have changed. Check the WSDL file directly:
- Visit: https://ec.europa.eu/taxation_customs/dds2/taric/services/goods?wsdl
- Look for available methods

### Issue: "Rate limit exceeded"
**Solution:** You're making more than 100 requests/second. Add rate limiting or caching.

## Alternative: Download Files (If API Doesn't Work)

If you prefer to download files instead:

1. **CN Tariff Data:**
   - Visit: https://ec.europa.eu/taxation_customs/dds2/taric/
   - Download XML/CSV files
   - Parse and ingest into database

2. **Explanatory Notes:**
   - Visit: https://eur-lex.europa.eu
   - Search for "Combined Nomenclature"
   - Download PDF or structured data

But **using the API is recommended** - it's automatic, always up-to-date, and requires no manual work.

## Next Steps

1. ✅ Set `TARIC_PROVIDER=SOAP` in `.env`
2. ✅ Test classification - it should now get real descriptions
3. ✅ Verify duty rates are correct
4. ✅ Check that descriptions appear in classification results

Your TARIC integration is now ready with official EU data!

