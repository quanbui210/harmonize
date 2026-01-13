# Bulk Verification Optimization Strategy

## Problem Statement

**Challenge**: How to verify thousands of products without:
- ❌ Sending entire file to LLM (expensive, token limits)
- ❌ Processing sequentially (too slow)
- ❌ Hitting API rate limits
- ❌ Exceeding context windows

## Solution: Three-Stage Pipeline

### Stage 1: Local File Parsing (No LLM)
**Parse file locally** - Extract structured data without AI

### Stage 2: Individual Product Verification (LLM per product)
**Process each product individually** - Reuse existing classification engine

### Stage 3: Batch Comparison (Local logic)
**Compare results locally** - No LLM needed for comparison

---

## Architecture Overview

```
┌─────────────────┐
│  Excel/PDF File │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Local Parser   │  ← No LLM (xlsx/pdf-parse)
│  Extract Rows   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rate-Limited   │
│  Parallel Queue │  ← Process 5-10 products concurrently
│  (p-limit)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Per-Product    │  ← Individual LLM call per product
│  Classification │     (reuse existing searchAndClassifyAction)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Local Compare  │  ← No LLM (simple string comparison)
│  & Status Logic │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Results Table  │
└─────────────────┘
```

---

## Implementation Strategy

### Phase 1: File Parsing (Local, No LLM)

```typescript
// src/lib/bulk-verification/file-parser.ts
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';

export interface ProductRow {
  rowNumber: number;
  productId?: string;
  productName: string;
  description?: string;
  userHtsCode?: string;
  userCnCode?: string;
  dutyRate?: number;
  originCountry?: string;
  market?: string;
  // Additional columns preserved
  [key: string]: any;
}

export class FileParser {
  /**
   * Parse Excel file - NO LLM needed
   * Returns array of product rows
   */
  async parseExcel(fileBuffer: Buffer): Promise<ProductRow[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON (xlsx library handles this)
    const rows = XLSX.utils.sheet_to_json(sheet, { 
      header: 1, // First row as headers
      defval: null 
    });
    
    // Auto-detect column mapping
    const headers = rows[0] as string[];
    const columnMap = this.detectColumnMapping(headers);
    
    // Parse rows
    const products: ProductRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (!row || row.length === 0) continue;
      
      products.push({
        rowNumber: i + 1,
        productId: this.getCellValue(row, columnMap.productId),
        productName: this.getCellValue(row, columnMap.productName) || `Row ${i + 1}`,
        description: this.getCellValue(row, columnMap.description),
        userHtsCode: this.getCellValue(row, columnMap.htsCode),
        userCnCode: this.getCellValue(row, columnMap.cnCode),
        dutyRate: this.parseNumber(this.getCellValue(row, columnMap.dutyRate)),
        originCountry: this.getCellValue(row, columnMap.originCountry),
        market: this.getCellValue(row, columnMap.market),
      });
    }
    
    return products;
  }
  
  /**
   * Auto-detect column names (handles variations)
   */
  private detectColumnMapping(headers: string[]): ColumnMap {
    const normalized = headers.map(h => h?.toLowerCase().trim() || '');
    
    return {
      productId: this.findColumn(normalized, ['id', 'product_id', 'sku', 'item_code', 'product code']),
      productName: this.findColumn(normalized, ['name', 'product_name', 'product', 'item_name', 'description']),
      description: this.findColumn(normalized, ['description', 'desc', 'details', 'notes']),
      htsCode: this.findColumn(normalized, ['hs_code', 'hts_code', 'tariff_code', 'code']),
      cnCode: this.findColumn(normalized, ['cn_code', 'combined_nomenclature']),
      dutyRate: this.findColumn(normalized, ['duty', 'duty_rate', 'tariff_rate', 'rate']),
      originCountry: this.findColumn(normalized, ['origin', 'country', 'origin_country', 'country_of_origin']),
      market: this.findColumn(normalized, ['market', 'destination', 'region']),
    };
  }
  
  private findColumn(headers: string[], variations: string[]): number | null {
    for (const variation of variations) {
      const index = headers.findIndex(h => h.includes(variation));
      if (index !== -1) return index;
    }
    return null;
  }
  
  private getCellValue(row: any[], index: number | null): string | undefined {
    if (index === null || !row[index]) return undefined;
    const value = row[index];
    return typeof value === 'string' ? value.trim() : String(value).trim();
  }
  
  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
}
```

**Key Point**: File parsing is **100% local** - no LLM calls, no API costs, instant processing.

---

### Phase 2: Optimized Batch Processing

#### Strategy: Individual Product Classification (Not Batch LLM)

**❌ DON'T DO THIS:**
```typescript
// BAD: Send 100 products to LLM at once
const response = await openai.chat.completions.create({
  messages: [{
    role: "user",
    content: `Verify these 100 products: ${JSON.stringify(allProducts)}`
  }]
});
// Problems:
// - Expensive ($10-20 per 100 products)
// - Token limits (128k context = ~50-100 products max)
// - Slow (one big request)
// - Hard to track progress
```

**✅ DO THIS INSTEAD:**
```typescript
// GOOD: Process each product individually with rate limiting
import pLimit from 'p-limit';

const limit = pLimit(5); // Process 5 products concurrently

const results = await Promise.all(
  products.map(product => 
    limit(() => verifySingleProduct(product, market))
  )
);
```

#### Implementation

```typescript
// src/lib/bulk-verification/verification-service.ts
import pLimit from 'p-limit';
import { searchAndClassifyAction } from '@/server/actions/classification-search';
import { MarketCode } from '@prisma/client';

interface VerificationResult {
  rowNumber: number;
  productName: string;
  userHtsCode?: string;
  suggestedHtsCode?: string;
  confidence?: number;
  status: 'CORRECT' | 'INCORRECT' | 'NEEDS_REVIEW' | 'ERROR';
  discrepancyReason?: string;
  error?: string;
}

export class BulkVerificationService {
  /**
   * Verify a single product
   * Reuses existing classification engine
   */
  private async verifySingleProduct(
    product: ProductRow,
    market: MarketCode,
    userId: string,
    organizationId: string
  ): Promise<VerificationResult> {
    try {
      // Reuse existing classification action
      const classification = await searchAndClassifyAction({
        productName: product.productName,
        description: product.description || product.productName,
        intendedUse: undefined, // Can be enhanced later
        compositionText: undefined,
        originCountry: product.originCountry,
        market,
      });
      
      // Get suggested code from classification
      const suggestedCode = classification.candidates[0]?.htsCode || 
                           classification.candidates[0]?.cnCode;
      const confidence = classification.candidates[0]?.confidence || 0;
      
      // Compare codes locally (no LLM needed)
      const comparison = this.compareCodes(
        product.userHtsCode || product.userCnCode,
        suggestedCode,
        confidence
      );
      
      return {
        rowNumber: product.rowNumber,
        productName: product.productName,
        userHtsCode: product.userHtsCode || product.userCnCode,
        suggestedHtsCode: suggestedCode,
        confidence,
        status: comparison.status,
        discrepancyReason: comparison.reason,
      };
    } catch (error: any) {
      return {
        rowNumber: product.rowNumber,
        productName: product.productName,
        userHtsCode: product.userHtsCode || product.userCnCode,
        status: 'ERROR',
        error: error.message || 'Classification failed',
      };
    }
  }
  
  /**
   * Compare codes - LOCAL LOGIC (no LLM)
   */
  private compareCodes(
    userCode: string | undefined,
    suggestedCode: string | undefined,
    confidence: number
  ): { status: VerificationResult['status']; reason?: string } {
    // No user code provided
    if (!userCode) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'No code provided in file',
      };
    }
    
    // No suggestion (classification failed)
    if (!suggestedCode) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'Could not determine classification',
      };
    }
    
    // Normalize codes (remove spaces, dashes)
    const normalizedUser = userCode.replace(/[\s-]/g, '');
    const normalizedSuggested = suggestedCode.replace(/[\s-]/g, '');
    
    // Exact match
    if (normalizedUser === normalizedSuggested) {
      return { status: 'CORRECT' };
    }
    
    // HS6 match (first 6 digits) - subheading differs
    if (normalizedUser.substring(0, 6) === normalizedSuggested.substring(0, 6)) {
      return {
        status: 'NEEDS_REVIEW',
        reason: `HS6 matches (${normalizedUser.substring(0, 6)}) but subheading differs. User: ${normalizedUser.substring(6)}, Suggested: ${normalizedSuggested.substring(6)}`,
      };
    }
    
    // Heading match (first 4 digits) - different subheadings
    if (normalizedUser.substring(0, 4) === normalizedSuggested.substring(0, 4)) {
      return {
        status: 'INCORRECT',
        reason: `Different subheadings within same heading (${normalizedUser.substring(0, 4)}). Verify subheading accuracy.`,
      };
    }
    
    // Different chapter/heading - likely incorrect
    if (normalizedUser.substring(0, 2) !== normalizedSuggested.substring(0, 2)) {
      return {
        status: 'INCORRECT',
        reason: `Different chapters. User: Chapter ${normalizedUser.substring(0, 2)}, Suggested: Chapter ${normalizedSuggested.substring(0, 2)}`,
      };
    }
    
    // Low confidence - needs review
    if (confidence < 0.7) {
      return {
        status: 'NEEDS_REVIEW',
        reason: `Low classification confidence (${(confidence * 100).toFixed(0)}%). Manual review recommended.`,
      };
    }
    
    // Default: incorrect
    return {
      status: 'INCORRECT',
      reason: 'Codes do not match. Review classification.',
    };
  }
  
  /**
   * Process batch with rate limiting
   */
  async verifyBatch(
    products: ProductRow[],
    market: MarketCode,
    userId: string,
    organizationId: string,
    options: {
      concurrency?: number; // Default: 5
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<VerificationResult[]> {
    const concurrency = options.concurrency || 5;
    const limit = pLimit(concurrency);
    let processed = 0;
    const total = products.length;
    
    // Process in parallel with rate limiting
    const results = await Promise.all(
      products.map((product, index) =>
        limit(async () => {
          const result = await this.verifySingleProduct(
            product,
            market,
            userId,
            organizationId
          );
          
          processed++;
          if (options.onProgress) {
            options.onProgress(processed, total);
          }
          
          return result;
        })
      )
    );
    
    return results;
  }
}
```

---

## Cost & Performance Analysis

### Scenario: 1000 Products

#### ❌ Bad Approach: Batch LLM
```
- Send 1000 products in one request
- Cost: ~$50-100 (huge context window)
- Time: 2-5 minutes (one big request)
- Risk: Token limit exceeded
- Progress: No visibility
```

#### ✅ Good Approach: Individual + Rate Limiting
```
- Process 5 products concurrently
- Cost: ~$10-20 (same as individual classifications)
- Time: ~10-15 minutes (200 batches × 5 seconds)
- Risk: Low (handles failures gracefully)
- Progress: Real-time updates
```

### Cost Breakdown (1000 products)

| Component | Cost | Notes |
|-----------|------|-------|
| **File Parsing** | $0 | Local processing |
| **Classification (5 concurrent)** | $10-20 | ~$0.01-0.02 per product |
| **Comparison Logic** | $0 | Local string comparison |
| **Total** | **$10-20** | vs $50-100 for batch approach |

### Time Breakdown (1000 products)

| Stage | Time | Notes |
|-------|------|-------|
| **File Parsing** | < 1 second | Instant (local) |
| **Classification** | 10-15 minutes | 5 concurrent × 200 batches |
| **Comparison** | < 1 second | Instant (local) |
| **Total** | **10-15 minutes** | vs 2-5 minutes (but unreliable) |

---

## Advanced Optimizations

### 1. Smart Batching by Category

Group similar products together to potentially reuse legal chunks:

```typescript
// Group products by category (first 2 digits of user's code)
const grouped = products.reduce((acc, product) => {
  const category = product.userHtsCode?.substring(0, 2) || 'unknown';
  if (!acc[category]) acc[category] = [];
  acc[category].push(product);
  return acc;
}, {} as Record<string, ProductRow[]>);

// Process each category sequentially (but products within category in parallel)
// This allows legal chunks to be cached per category
```

### 2. Caching Strategy

```typescript
// Cache classification results for identical products
const cache = new Map<string, ClassificationResult>();

async function verifyWithCache(product: ProductRow) {
  const cacheKey = `${product.productName}-${product.description}`;
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  const result = await verifySingleProduct(product, ...);
  cache.set(cacheKey, result);
  return result;
}
```

### 3. Progressive Processing

```typescript
// Save results incrementally (don't wait for all to complete)
async function verifyWithProgress(
  products: ProductRow[],
  jobId: string
) {
  const batchSize = 50;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const results = await verifyBatch(batch, ...);
    
    // Save to database immediately
    await prisma.bulkVerificationResult.createMany({
      data: results.map(r => ({
        jobId,
        ...r,
      })),
    });
    
    // Update job progress
    await prisma.bulkVerificationJob.update({
      where: { id: jobId },
      data: {
        processedCount: Math.min(i + batchSize, products.length),
      },
    });
  }
}
```

### 4. Background Job Processing

For very large files (>1000 products), use background jobs:

```typescript
// src/server/actions/bulk-verification.ts
export async function startBulkVerificationJob(input: {
  fileBuffer: Buffer;
  fileName: string;
  market: MarketCode;
  organizationId: string;
  userId: string;
}) {
  // 1. Parse file (instant)
  const parser = new FileParser();
  const products = await parser.parseExcel(input.fileBuffer);
  
  // 2. Create job record
  const job = await prisma.bulkVerificationJob.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      fileName: input.fileName,
      fileSize: input.fileBuffer.length,
      status: 'PENDING',
      totalProducts: products.length,
      processedCount: 0,
    },
  });
  
  // 3. Start background processing (don't await)
  processBulkVerificationInBackground(job.id, products, input.market);
  
  return { jobId: job.id };
}

async function processBulkVerificationInBackground(
  jobId: string,
  products: ProductRow[],
  market: MarketCode
) {
  // Update status
  await prisma.bulkVerificationJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  });
  
  try {
    const service = new BulkVerificationService();
    const results = await service.verifyBatch(
      products,
      market,
      userId,
      organizationId,
      {
        concurrency: 5,
        onProgress: async (processed, total) => {
          // Update progress in database
          await prisma.bulkVerificationJob.update({
            where: { id: jobId },
            data: { processedCount: processed },
          });
        },
      }
    );
    
    // Save all results
    await prisma.bulkVerificationResult.createMany({
      data: results.map(r => ({
        jobId,
        ...r,
      })),
    });
    
    // Mark as completed
    await prisma.bulkVerificationJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        correctCount: results.filter(r => r.status === 'CORRECT').length,
        incorrectCount: results.filter(r => r.status === 'INCORRECT').length,
        needsReviewCount: results.filter(r => r.status === 'NEEDS_REVIEW').length,
      },
    });
  } catch (error: any) {
    await prisma.bulkVerificationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });
  }
}
```

---

## Recommended Configuration

### For Small Files (< 100 products)
- **Concurrency**: 10 products
- **Processing**: Synchronous (user waits)
- **Time**: ~1-2 minutes

### For Medium Files (100-500 products)
- **Concurrency**: 5 products
- **Processing**: Background job
- **Time**: ~5-10 minutes

### For Large Files (500+ products)
- **Concurrency**: 5 products
- **Processing**: Background job with progress updates
- **Time**: ~15-30 minutes
- **UI**: Show progress bar, allow user to navigate away

---

## Summary

### ✅ DO:
1. **Parse file locally** (no LLM)
2. **Process products individually** (reuse existing classification)
3. **Use rate limiting** (p-limit, 5 concurrent)
4. **Compare codes locally** (no LLM)
5. **Save progress incrementally** (background jobs)

### ❌ DON'T:
1. Send entire file to LLM
2. Process all products in one LLM call
3. Process sequentially (too slow)
4. Wait for all results before saving

### Key Benefits:
- **Cost**: 5x cheaper than batch approach
- **Reliability**: Handles failures gracefully
- **Progress**: Real-time updates
- **Scalability**: Works for 10 or 10,000 products

---

## Next Steps

1. Install `p-limit`: `npm install p-limit`
2. Install `xlsx`: `npm install xlsx @types/xlsx`
3. Implement file parser (local, no LLM)
4. Implement verification service (individual products)
5. Add background job processing for large files

