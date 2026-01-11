# How to Populate the Ruling Database

## Overview

The Ruling Database stores official binding tariff information (BTI) rulings from customs authorities. These are **official legal documents**, not user-generated content.

## Data Sources

### EU Market
- **Source:** EU Binding Tariff Information (BTI) Database
- **URL:** https://ec.europa.eu/taxation_customs/dds2/ebti/ebti_consultation.jsp
- **Format:** Web interface, database export, or API (if available)
- **Reference Format:** `BTI-[Country]/[Number]/[Year]` (e.g., `BTI-DE/123456/2021`)

### US Market
- **Source:** US Customs and Border Protection (CBP) Rulings
- **URL:** https://rulings.cbp.gov/
- **Format:** Web interface, database export
- **Reference Format:** `NY N[Number]` or `HQ H[Number]` (e.g., `NY N123456`)

### Other Markets
- **UK:** HMRC Binding Tariff Information
- **Canada:** CBSA Advance Rulings
- **Australia:** ABF Tariff Classification Advices

## Methods to Populate Data

### Method 1: Manual Ingestion (Quick Start)

Use the provided script with example data:

```bash
npm run tsx scripts/ingest-rulings.ts
```

This will add 3 example rulings to your database for testing.

### Method 2: Programmatic Ingestion

Use the `ingestRulingsAction` in your code:

```typescript
import { ingestRulingsAction } from "@/server/actions/rulings";
import { MarketCode } from "@prisma/client";

await ingestRulingsAction({
  rulings: [
    {
      market: MarketCode.EU,
      reference: "BTI-DE/123456/2021",
      title: "Product description",
      body: "Full ruling text (supports markdown)",
      htsCode: "9019100000", // 10-digit HTS code
      issuedAt: new Date("2021-01-15"), // Optional
    },
    // ... more rulings
  ],
});
```

### Method 3: Import from JSON/CSV

Create a script to parse your data file:

```typescript
import fs from "fs";
import { ingestRulingsAction } from "@/server/actions/rulings";

const rulingsData = JSON.parse(fs.readFileSync("rulings.json", "utf-8"));

await ingestRulingsAction({
  rulings: rulingsData.map((r: any) => ({
    market: r.market as MarketCode,
    reference: r.reference,
    title: r.title,
    body: r.body,
    htsCode: r.htsCode,
    issuedAt: r.issuedAt ? new Date(r.issuedAt) : undefined,
  })),
});
```

### Method 4: Web Scraping (Advanced)

For automated data collection, create a scraper:

```typescript
// Example: Scrape EU BTI database
async function scrapeEURulings() {
  // 1. Access BTI database
  // 2. Search/filter rulings
  // 3. Extract data:
  //    - Reference number
  //    - Product description
  //    - CN code assigned
  //    - Full text
  //    - Issue date
  // 4. Format and ingest
}
```

**Note:** Check robots.txt and terms of service before scraping. Consider using official APIs if available.

## Data Structure

Each ruling requires:

```typescript
{
  market: "EU" | "US" | "UK" | "VN" | "CA" | "AU" | "OTHER",
  reference: string,        // Unique identifier (e.g., "BTI-DE/123/2021")
  title: string,           // Short description
  body: string,            // Full ruling text (markdown supported)
  htsCode: string,         // 10-digit HTS/CN code (e.g., "9019100000")
  issuedAt?: Date          // When ruling was published (optional)
}
```

## Example Data Formats

### EU BTI Ruling
```json
{
  "market": "EU",
  "reference": "BTI-DE/123456/2021",
  "title": "Electric neck massager with heating function",
  "body": "**Binding Tariff Information Decision**\n\n**Product Description:**\n...",
  "htsCode": "9019100000",
  "issuedAt": "2021-01-15"
}
```

### US CBP Ruling
```json
{
  "market": "US",
  "reference": "NY N123456",
  "title": "Smartphone with protective accessories",
  "body": "**Customs Ruling**\n\n**Product Description:**\n...",
  "htsCode": "8517120000",
  "issuedAt": "2023-01-01"
}
```

## Best Practices

1. **Data Quality:**
   - Ensure `reference` is unique (used as unique key)
   - Use 10-digit HTS codes (pad with zeros if needed)
   - Include full ruling text in `body` field
   - Use markdown for formatting (headings, lists, bold text)

2. **Validation:**
   - Verify HTS codes are valid
   - Check reference format matches market conventions
   - Ensure dates are valid

3. **Updates:**
   - The `ingestRulingsAction` uses `upsert` - it will update existing rulings if reference matches
   - Rulings are typically valid for 3-6 years
   - Consider periodic updates to refresh expired rulings

4. **Bulk Import:**
   - Process in batches (50-100 at a time) to avoid timeouts
   - Add error handling for individual failures
   - Log successful and failed imports

## Testing

After ingesting data:

1. Visit `/rulings` to see the list
2. Search by reference, title, or HTS code
3. Filter by market
4. View individual ruling details

## Next Steps

1. **Start with example data:** Run `scripts/ingest-rulings.ts`
2. **Add real data:** Collect rulings from official sources
3. **Automate (optional):** Set up periodic sync from official databases
4. **Enhance search:** Add vector embeddings for semantic search (future)

## Resources

- **EU BTI Database:** https://ec.europa.eu/taxation_customs/dds2/ebti/
- **US CBP Rulings:** https://rulings.cbp.gov/
- **TARIC Support API:** May provide some rulings data
- **Third-party services:** Some aggregators provide structured ruling data

