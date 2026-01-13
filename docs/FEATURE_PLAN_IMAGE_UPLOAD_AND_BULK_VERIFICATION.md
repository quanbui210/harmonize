# Feature Implementation Plan: Image Upload & Bulk Verification

## Executive Summary

This document outlines the implementation plan for two major features:
1. **Image Upload for Product Classification** - OCR-based label/ingredients extraction
2. **Bulk Verification** - Excel/PDF batch classification verification

Both features are **highly doable** with existing infrastructure and modern libraries.

---

## Feature 1: Image Upload for Product Classification

### Overview
Allow users to upload images of product labels, ingredient lists, or specification tags during classification. The system extracts text via OCR and analyzes it to populate classification fields automatically.

### Complexity Analysis

**Overall Complexity: MEDIUM** ⚠️

**Breakdown:**
- **OCR Integration**: LOW-MEDIUM (well-established libraries)
- **Image Processing**: LOW (Supabase Storage already in use)
- **AI Analysis**: LOW (existing OpenAI integration)
- **UI/UX**: LOW (simple file upload component)
- **Data Extraction**: MEDIUM (parsing unstructured OCR text)

### Technical Stack

#### Required Dependencies
```json
{
  "tesseract.js": "^5.0.0",           // Client-side OCR (optional)
  "tesseract": "^5.0.0",              // Server-side OCR
  "sharp": "^0.33.0",                 // Image processing
  "jimp": "^0.22.0"                   // Alternative image processing
}
```

#### Alternative: Cloud OCR Services
- **Google Cloud Vision API** (paid, high accuracy)
- **AWS Textract** (paid, excellent for structured documents)
- **Azure Computer Vision** (paid)
- **Tesseract.js** (free, open-source, good for simple text)

**Recommendation**: Start with **Tesseract.js** (free), upgrade to Google Vision API if accuracy is insufficient.

### Implementation Plan

#### Phase 1: Infrastructure Setup (2-3 days)

**1.1 Storage Bucket**
- Create `product-images` bucket in Supabase
- Configure RLS policies (organization-scoped access)
- Set file size limits (10MB per image)
- Allowed types: `image/jpeg`, `image/png`, `image/webp`

**1.2 Database Schema Updates**
```prisma
model ProductImage {
  id              String   @id @default(cuid())
  productId       String
  organizationId String
  storagePath    String
  contentType    String
  sizeBytes      Int
  ocrText        String?  // Extracted text
  ocrConfidence  Float?   // OCR confidence score
  extractedData  Json?    // Structured extracted data
  uploadedAt     DateTime @default(now())
  uploadedById   String
  
  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id])
  uploadedBy     User     @relation(fields: [uploadedById], references: [id])
  
  @@index([productId])
  @@index([organizationId])
}
```

**1.3 Server Action: Image Upload**
```typescript
// src/server/actions/product-images.ts
export async function uploadProductImageAction(formData: FormData) {
  // 1. Validate file (type, size)
  // 2. Upload to Supabase Storage
  // 3. Run OCR extraction
  // 4. Save ProductImage record
  // 5. Return extracted text + structured data
}
```

#### Phase 2: OCR Integration (3-4 days)

**2.1 Server-Side OCR Service**
```typescript
// src/lib/ocr/ocr-service.ts
export class OCRService {
  async extractText(imageBuffer: Buffer): Promise<{
    text: string;
    confidence: number;
    blocks: Array<{ text: string; bbox: BoundingBox }>;
  }>
  
  async extractIngredients(text: string): Promise<{
    materials: Array<{ name: string; percentage?: number }>;
    compositionText: string;
  }>
  
  async extractSpecifications(text: string): Promise<{
    weight?: string;
    dimensions?: string;
    powerSource?: string;
    voltage?: string;
  }>
}
```

**2.2 AI-Powered Text Analysis**
- Use existing OpenAI integration to:
  - Parse OCR text into structured fields
  - Extract materials/composition percentages
  - Identify key specifications (weight, voltage, etc.)
  - Clean and normalize extracted data

**Implementation:**
```typescript
async function analyzeOCRText(ocrText: string): Promise<ExtractedData> {
  const prompt = `Extract product information from this OCR text:
  
${ocrText}

Return JSON with:
- materials: Array<{name: string, percentage?: number}>
- compositionText: string (normalized)
- weight?: string
- dimensions?: string
- powerSource?: string
- voltage?: string
- otherSpecs?: Record<string, string>
`;
  
  // Use OpenAI to parse and structure
}
```

#### Phase 3: UI Integration (2-3 days)

**3.1 Enhanced Classification Form**
- Add optional "Upload Label/Ingredients Image" section
- Drag-and-drop or file picker
- Image preview with extracted text overlay
- "Use extracted data" button to auto-fill form fields

**Component Structure:**
```tsx
// src/components/classification/image-upload-section.tsx
export function ImageUploadSection({
  onDataExtracted,
}: {
  onDataExtracted: (data: ExtractedData) => void;
}) {
  // File upload
  // OCR processing indicator
  // Extracted text preview
  // "Use this data" button
}
```

**3.2 Workflow**
1. User uploads image
2. Show loading state: "Extracting text from image..."
3. Display extracted text in collapsible preview
4. Show structured data suggestions (materials, specs)
5. User clicks "Use extracted data" → auto-fills form
6. User can still manually edit before submitting

#### Phase 4: Error Handling & Edge Cases (1-2 days)

- **Poor image quality**: Warn user, suggest retaking photo
- **No text found**: Fallback to manual entry
- **Low OCR confidence**: Show warning, allow manual correction
- **Multiple languages**: Detect language, use appropriate OCR model
- **Rotated images**: Auto-rotate using image processing

### Estimated Timeline
- **Total**: 8-12 days
- **MVP**: 5-7 days (basic OCR + form integration)
- **Production-ready**: 10-12 days (error handling + polish)

### Cost Considerations
- **Tesseract.js**: Free (self-hosted)
- **Google Vision API**: ~$1.50 per 1,000 images (first 1,000 free/month)
- **Storage**: Minimal (Supabase free tier: 1GB)

### Success Metrics
- OCR accuracy > 85% for clear images
- User adoption rate > 30% of classifications
- Time saved: 2-3 minutes per classification

---

## Feature 2: Bulk Verification

### Overview
Users upload Excel/PDF files containing their existing product catalog with HS codes. System verifies each code, flags incorrect ones, and suggests corrections.

### Complexity Analysis

**Overall Complexity: MEDIUM-HIGH** ⚠️⚠️

**Breakdown:**
- **File Parsing**: LOW (established libraries)
- **Data Normalization**: MEDIUM (handling various formats)
- **Batch Classification**: MEDIUM (parallel processing)
- **Comparison Logic**: MEDIUM (matching user codes vs suggested)
- **Report Generation**: MEDIUM (Excel export with highlights)
- **UI/UX**: MEDIUM (complex table with filters, actions)

### Technical Stack

#### Required Dependencies
```json
{
  "xlsx": "^0.18.5",                  // Excel parsing
  "exceljs": "^4.4.0",                // Excel generation
  "pdf-parse": "^1.1.1",              // PDF parsing (already installed)
  "p-limit": "^4.0.0",                // Rate limiting for batch operations
  "papaparse": "^5.4.1"               // CSV parsing (optional)
}
```

### Implementation Plan

#### Phase 1: Database Schema (1 day)

**1.1 Bulk Verification Job Model**
```prisma
model BulkVerificationJob {
  id              String   @id @default(cuid())
  organizationId  String
  userId          String
  fileName        String
  fileSize        Int
  storagePath     String
  status          BulkVerificationStatus // PENDING, PROCESSING, COMPLETED, FAILED
  totalProducts   Int
  processedCount  Int
  correctCount     Int
  incorrectCount   Int
  needsReviewCount Int
  createdAt        DateTime @default(now())
  completedAt      DateTime?
  errorMessage     String?
  
  organization    Organization @relation(fields: [organizationId], references: [id])
  user           User @relation(fields: [userId], references: [id])
  results        BulkVerificationResult[]
  
  @@index([organizationId])
  @@index([status])
}

enum BulkVerificationStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model BulkVerificationResult {
  id              String   @id @default(cuid())
  jobId           String
  rowNumber       Int      // Original row in uploaded file
  productId       String?  // If matched to existing product
  productName     String
  userHtsCode     String?  // Code from user's file
  suggestedHtsCode String? // Our suggested code
  confidence      Float?
  status          VerificationStatus // CORRECT, INCORRECT, NEEDS_REVIEW, ERROR
  discrepancyReason String? // Why codes don't match
  market          MarketCode
  createdAt       DateTime @default(now())
  
  job             BulkVerificationJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  classification  Classification?     // If user accepts suggestion
  
  @@index([jobId])
  @@index([status])
}

enum VerificationStatus {
  CORRECT
  INCORRECT
  NEEDS_REVIEW
  ERROR
}
```

#### Phase 2: File Parsing Service (3-4 days)

**2.1 Excel Parser**
```typescript
// src/lib/bulk-verification/excel-parser.ts
export class ExcelParser {
  async parseFile(fileBuffer: Buffer): Promise<Array<{
    rowNumber: number;
    productId?: string;
    productName: string;
    description?: string;
    htsCode?: string;
    cnCode?: string;
    dutyRate?: number;
    originCountry?: string;
    market?: string;
    [key: string]: any; // Additional columns
  }>> {
    // Use xlsx or exceljs to parse
    // Handle various column name formats
    // Normalize data types
  }
}
```

**2.2 PDF Parser**
```typescript
// src/lib/bulk-verification/pdf-parser.ts
export class PDFParser {
  async parseFile(fileBuffer: Buffer): Promise<Array<ProductRow>> {
    // Extract text from PDF
    // Use AI to identify table structure
    // Parse into structured rows
    // Handle multi-page PDFs
  }
}
```

**2.3 Column Mapping**
- Auto-detect common column names:
  - Product ID: `product_id`, `id`, `sku`, `item_code`
  - Product Name: `name`, `product_name`, `description`, `item_name`
  - HS Code: `hs_code`, `hts_code`, `cn_code`, `tariff_code`
  - Duty: `duty`, `duty_rate`, `tariff_rate`
- Allow user to manually map columns if auto-detection fails

#### Phase 3: Batch Classification Engine (4-5 days)

**3.1 Queue System**
- Use background job processing (or simple Promise.all with rate limiting)
- Process products in batches of 10-20
- Show progress in real-time

**3.2 Classification Service**
```typescript
// src/lib/bulk-verification/verification-service.ts
export class BulkVerificationService {
  async verifyProduct(
    productData: ProductRow,
    market: MarketCode
  ): Promise<VerificationResult> {
    // 1. Run classification for this product
    // 2. Compare user's code vs suggested code
    // 3. Determine status (CORRECT, INCORRECT, NEEDS_REVIEW)
    // 4. Generate discrepancy reason if codes differ
    // 5. Return result
  }
  
  async verifyBatch(
    products: ProductRow[],
    market: MarketCode,
    onProgress?: (processed: number, total: number) => void
  ): Promise<BulkVerificationResult[]> {
    // Process in parallel with rate limiting
    // Use p-limit to control concurrency
  }
}
```

**3.3 Comparison Logic**
```typescript
function compareCodes(
  userCode: string,
  suggestedCode: string,
  confidence: number
): {
  status: VerificationStatus;
  reason?: string;
} {
  // Exact match
  if (userCode === suggestedCode) {
    return { status: 'CORRECT' };
  }
  
  // HS6 match but subheading differs (common case)
  if (userCode.substring(0, 6) === suggestedCode.substring(0, 6)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'HS6 matches but subheading differs. Verify subheading accuracy.'
    };
  }
  
  // Different chapter/heading
  if (userCode.substring(0, 4) !== suggestedCode.substring(0, 4)) {
    return {
      status: 'INCORRECT',
      reason: `Different heading: user has ${userCode.substring(0, 4)}, suggested ${suggestedCode.substring(0, 4)}`
    };
  }
  
  // Low confidence - needs human review
  if (confidence < 0.7) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'Low classification confidence. Manual review recommended.'
    };
  }
  
  return {
    status: 'INCORRECT',
    reason: 'Codes do not match. Review classification logic.'
  };
}
```

#### Phase 4: UI Implementation (5-6 days)

**4.1 Upload Page**
```tsx
// src/app/(app)/bulk-verification/page.tsx
export default function BulkVerificationPage() {
  // File upload (Excel/PDF)
  // Market selection
  // Column mapping (if needed)
  // Start verification button
}
```

**4.2 Results Page**
```tsx
// src/app/(app)/bulk-verification/[jobId]/page.tsx
export default function BulkVerificationResultsPage({ jobId }) {
  // Progress indicator (if processing)
  // Results table with:
  //   - Product name
  //   - User's code (highlighted if incorrect)
  //   - Suggested code
  //   - Status badge (Correct/Incorrect/Needs Review)
  //   - Discrepancy reason
  //   - Actions (Accept suggestion, View details, Ignore)
  // Filters (status, market)
  // Export to Excel button
  // Bulk actions (Accept all correct, Review all incorrect)
}
```

**4.3 Table Features**
- Sortable columns
- Filter by status (Correct/Incorrect/Needs Review)
- Search by product name
- Color coding:
  - Green: Correct
  - Red: Incorrect
  - Yellow: Needs Review
- Row actions:
  - "Accept suggestion" → Create classification
  - "View details" → Open classification page
  - "Re-classify" → Run classification again

**4.4 Export Functionality**
```typescript
// src/lib/bulk-verification/excel-exporter.ts
export async function exportResultsToExcel(
  results: BulkVerificationResult[]
): Promise<Buffer> {
  // Generate Excel with:
  // - Original data
  // - Suggested codes
  // - Status column
  // - Discrepancy reasons
  // - Color coding (conditional formatting)
}
```

#### Phase 5: Error Handling & Edge Cases (2-3 days)

- **Invalid file format**: Clear error message
- **Missing required columns**: Guide user to add columns
- **Large files (>1000 rows)**: Process in background, show progress
- **API rate limits**: Implement retry logic with exponential backoff
- **Partial failures**: Continue processing, report errors at end
- **Unparseable rows**: Skip with warning, include in error report

### Estimated Timeline
- **Total**: 15-20 days
- **MVP**: 10-12 days (basic Excel parsing + verification)
- **Production-ready**: 18-20 days (PDF support + polish)

### Cost Considerations
- **File Storage**: Minimal (Supabase free tier)
- **API Costs**: 
  - Classification API calls: ~$0.01-0.02 per product (OpenAI)
  - 1000 products = $10-20
- **Processing Time**: 
  - 100 products: ~5-10 minutes
  - 1000 products: ~1-2 hours (with rate limiting)

### Success Metrics
- Processing accuracy > 95%
- User satisfaction with suggestions > 80%
- Time saved vs manual verification: 10x faster
- Adoption rate: > 50% of enterprise users

---

## Integration Points

### Shared Infrastructure
1. **Supabase Storage**: Both features use existing storage buckets
2. **OpenAI Integration**: Both use existing AI services
3. **Classification Engine**: Bulk verification reuses existing classification logic
4. **Database**: Extend existing Prisma schema

### Common Components
- File upload component (reusable)
- Progress indicators
- Error handling patterns
- Audit logging

---

## Risk Assessment

### Feature 1 (Image Upload)
- **Low Risk**: Well-established OCR libraries, simple integration
- **Mitigation**: Start with free Tesseract, upgrade to paid service if needed

### Feature 2 (Bulk Verification)
- **Medium Risk**: Complex file parsing, batch processing challenges
- **Mitigation**: 
  - Start with Excel only (simpler than PDF)
  - Implement rate limiting to avoid API overload
  - Process in background jobs for large files

---

## Recommended Implementation Order

1. **Feature 1 First** (Image Upload)
   - Simpler implementation
   - Immediate user value
   - Lower risk
   - Can be done in parallel with Feature 2 planning

2. **Feature 2 Second** (Bulk Verification)
   - More complex, benefits from Feature 1 learnings
   - Higher value for enterprise users
   - Requires more testing

---

## Next Steps

1. **Approve plan** and prioritize features
2. **Set up development environment** (install dependencies)
3. **Create feature branches** for each feature
4. **Start with Phase 1** of Feature 1 (Image Upload)
5. **Iterate based on user feedback**

---

## Questions to Resolve

1. **OCR Service**: Free Tesseract.js or paid Google Vision API?
2. **Batch Processing**: Background jobs (BullMQ/Redis) or simple Promise.all?
3. **File Size Limits**: Max products per bulk verification?
4. **Pricing Model**: Should bulk verification be a premium feature?
5. **PDF Support**: Essential for MVP or can wait?

---

## Conclusion

Both features are **highly doable** with existing infrastructure. Image Upload is simpler and can be delivered faster. Bulk Verification is more complex but provides significant value for enterprise users. Recommended approach: implement Image Upload first, then Bulk Verification.

**Total Estimated Timeline**: 23-32 days for both features (can be parallelized to ~20 days with 2 developers)

