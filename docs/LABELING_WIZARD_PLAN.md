# Labeling Wizard Implementation Plan

## Overview
Build a legally-compliant Labeling Wizard that uses RAG to search Finnish regulatory PDFs (Ruokavirasto, Tukes, EU regulations) to generate accurate, compliant product labels with Finnish/Swedish translations.

---

## Phase 1: Legal Foundation & Document Ingestion

### 1.1 Legal Disclaimer Integration
**Priority: CRITICAL** (Protect from liability)

**Location**: `src/components/legal/disclaimer.tsx` + Footer

**Implementation**:
- Add disclaimer modal/component that users must accept before using labeling features
- Store acceptance in database (`UserLegalAcceptance` table)
- Display disclaimer text based on user's country (Finland-specific vs EU-general)
- Link to official sources (Ruokavirasto, Tukes, Tulli)

**Database Schema**:
```prisma
model UserLegalAcceptance {
  id            String   @id @default(cuid())
  userId        String
  feature       String   // "LABELING_WIZARD", "CLASSIFICATION", etc.
  disclaimerVersion String
  acceptedAt    DateTime @default(now())
  ipAddress     String?
  userAgent     String?
  user          User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, feature])
  @@index([userId])
}
```

### 1.2 Document Ingestion Pipeline
**Priority: HIGH**

**Documents to Ingest**:
1. **Food (Ruokavirasto)**:
   - Elintarviketieto-opas (Guide 17068/2) - Finnish PDF
   - Food Information To Be Provided - English PDF
   - Section 2: Mandatory Information - PDF
   - Regulation (EU) No 1169/2011 - Official text

2. **General Product Safety (Tukes)**:
   - General Product Safety Regulation (EU) 2023/988
   - Finnish Product Safety Act 184/2025 (Finlex)
   - Tukes Safety Information and Manuals Guide

3. **Customs (Tulli)**:
   - EU TARIC Database references
   - Finnish Customs Import Guide

**Implementation Steps**:

1. **Create Document Storage** (`prisma/schema.prisma`):
```prisma
model RegulatoryDocument {
  id            String   @id @default(cuid())
  source        String   // "RUOKAVIRASTO", "TUKES", "TULLI", "EU"
  documentType  String   // "FOOD_GUIDE", "SAFETY_REGULATION", "CUSTOMS_GUIDE"
  title         String
  language      String   // "FI", "SV", "EN"
  pdfUrl        String?  // Original PDF URL
  storagePath   String?  // Local storage path
  version       String?
  effectiveDate DateTime?
  chunks        RegulatoryDocumentChunk[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([source, documentType])
  @@index([language])
}

model RegulatoryDocumentChunk {
  id              String              @id @default(cuid())
  documentId      String
  chunkIndex      Int
  sectionPath     String              // e.g., "Section 5.3", "Chapter 2.1"
  content         String
  pageNumber      Int?
  embedding       Unsupported("vector")?
  metadata        Json?               // { "section": "5.3", "topic": "QUID", "language": "FI" }
  document        RegulatoryDocument  @relation(fields: [documentId], references: [id])
  
  @@index([documentId, chunkIndex])
  @@index([sectionPath])
}
```

2. **PDF Processing Script** (`scripts/ingest-regulatory-docs.ts`):
   - Download PDFs from official sources
   - Extract text (use `pdf-parse` or `pdfjs-dist`)
   - Split into semantic chunks (by section, ~500-800 tokens)
   - Generate embeddings (OpenAI `text-embedding-3-small` - supports multilingual)
   - Store in database

3. **Multilingual Embedding Strategy**:
   - Use `text-embedding-3-small` (supports Finnish, Swedish, English)
   - For queries: Translate English → Finnish before vector search
   - Hybrid search: Combine vector similarity + keyword matching

---

## Phase 2: Enhanced RAG System

### 2.1 Multilingual RAG Search
**Priority: HIGH**

**Location**: `src/lib/rag/regulatory-search.ts`

**Implementation**:

```typescript
interface RegulatorySearchOptions {
  productType: "FOOD" | "ELECTRONICS" | "TOYS" | "COSMETICS" | "GENERAL";
  query: string; // User's question in English
  language?: "FI" | "SV" | "EN";
  documentSources?: string[]; // ["RUOKAVIRASTO", "TUKES"]
  maxResults?: number;
}

async function searchRegulatoryDocuments(
  options: RegulatorySearchOptions
): Promise<RegulatoryChunk[]> {
  // Step 1: Translate query to Finnish if needed
  const translatedQuery = options.language === "FI" 
    ? await translateToFinnish(options.query)
    : options.query;
  
  // Step 2: Generate embedding
  const embedding = await generateEmbedding(translatedQuery);
  
  // Step 3: Vector search with filters
  const vectorResults = await prisma.$queryRaw`
    SELECT 
      c.id,
      c.content,
      c.sectionPath,
      c.pageNumber,
      d.title,
      d.source,
      d.language,
      1 - (c.embedding <=> ${embedding}::vector) as similarity
    FROM "RegulatoryDocumentChunk" c
    JOIN "RegulatoryDocument" d ON c."documentId" = d.id
    WHERE 
      d.source = ANY(${options.documentSources || ["RUOKAVIRASTO", "TUKES", "TULLI"]})
      AND c.embedding IS NOT NULL
      AND (
        -- Filter by product type
        (d."documentType" = 'FOOD_GUIDE' AND ${options.productType} = 'FOOD')
        OR (d."documentType" = 'SAFETY_REGULATION' AND ${options.productType} IN ('ELECTRONICS', 'TOYS'))
        OR d."documentType" = 'CUSTOMS_GUIDE'
      )
    ORDER BY c.embedding <=> ${embedding}::vector
    LIMIT ${options.maxResults || 10}
  `;
  
  // Step 4: Keyword boost (exact matches get higher score)
  const keywordResults = await keywordSearch(translatedQuery, options);
  
  // Step 5: Combine and re-rank
  return combineAndRerank(vectorResults, keywordResults);
}
```

### 2.2 Product Type Detection
**Priority: HIGH**

**Location**: `src/lib/rag/product-type-detector.ts`

**Implementation**:
- Use existing classification CN code to infer product type
- Chapter-based detection:
  - Chapters 1-24 → FOOD
  - Chapters 84-85 → ELECTRONICS
  - Chapter 95 → TOYS
  - Chapter 33 → COSMETICS
- Also use product name/description keywords

---

## Phase 3: Label Generation Engine

### 3.1 Label Compliance Checker
**Priority: CRITICAL**

**Location**: `src/lib/labeling/compliance-checker.ts`

**Compliance Rules** (from Ruokavirasto Guide):

```typescript
interface ComplianceRule {
  id: string;
  name: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  check: (label: LabelData) => ComplianceResult;
  source: string; // "RUOKAVIRASTO Section 5.3"
}

const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: "quid-required",
    name: "QUID Percentage Required",
    severity: "CRITICAL",
    check: (label) => {
      // If product name contains ingredient (e.g., "Dried Mango"),
      // ingredients must show percentage
      const productName = label.productName.toLowerCase();
      const hasIngredientInName = FOOD_INGREDIENTS.some(ing => 
        productName.includes(ing.toLowerCase())
      );
      
      if (hasIngredientInName) {
        const hasQUID = label.ingredients.some(ing => ing.percentage !== undefined);
        return {
          passed: hasQUID,
          message: hasQUID 
            ? "QUID percentage found"
            : "Missing QUID: Product name contains ingredient, must show percentage in ingredients list",
          source: "Ruokavirasto Guide 17068/2, Section 5.3"
        };
      }
      return { passed: true };
    }
  },
  {
    id: "high-salt-warning",
    name: "High Salt Warning (Finland)",
    severity: "CRITICAL",
    check: (label) => {
      if (label.saltPercentage > 1.2) {
        const hasWarning = label.warnings?.some(w => 
          w.includes("Voimakassuolainen") || w.includes("Kraftigt saltad")
        );
        return {
          passed: hasWarning,
          message: hasWarning
            ? "High salt warning present"
            : `Salt content is ${label.saltPercentage}%. Must include "Voimakassuolainen / Kraftigt saltad" warning`,
          source: "Ruokavirasto Guide 17068/2, Section 9.2"
        };
      }
      return { passed: true };
    }
  },
  {
    id: "finnish-swedish-languages",
    name: "Finnish and Swedish Required",
    severity: "CRITICAL",
    check: (label) => {
      const hasFinnish = label.translations?.some(t => t.language === "FI");
      const hasSwedish = label.translations?.some(t => t.language === "SV");
      return {
        passed: hasFinnish && hasSwedish,
        message: hasFinnish && hasSwedish
          ? "Both Finnish and Swedish translations present"
          : `Missing ${!hasFinnish ? "Finnish" : ""} ${!hasSwedish ? "Swedish" : ""} translation. Required by Finnish Product Safety Act 184/2025`,
        source: "Finnish Product Safety Act 184/2025, Section 3"
      };
    }
  },
  {
    id: "font-size",
    name: "Minimum Font Size (1.2mm x-height)",
    severity: "WARNING",
    check: (label) => {
      // Calculate based on label dimensions
      const xHeight = calculateXHeight(label.fontSize, label.labelDimensions);
      return {
        passed: xHeight >= 1.2,
        message: xHeight >= 1.2
          ? `Font size compliant (x-height: ${xHeight.toFixed(2)}mm)`
          : `Font too small (x-height: ${xHeight.toFixed(2)}mm). Minimum required: 1.2mm`,
        source: "Ruokavirasto Guide 17068/2, Section 2.1"
      };
    }
  },
  {
    id: "allergen-highlighting",
    name: "Allergen Visual Distinction",
    severity: "WARNING",
    check: (label) => {
      const allergens = label.ingredients.filter(ing => ing.isAllergen);
      const allHighlighted = allergens.every(ing => ing.isHighlighted);
      return {
        passed: allHighlighted,
        message: allHighlighted
          ? "All allergens properly highlighted"
          : "Allergens must be visually distinct (bold, italic, or CAPS)",
        source: "Ruokavirasto Guide 17068/2, Section 2.3"
      };
    }
  },
  {
    id: "eu-importer-address",
    name: "EU Importer Address Required",
    severity: "CRITICAL",
    check: (label) => {
      const hasEUAddress = label.importerAddress && 
        EU_COUNTRIES.some(country => 
          label.importerAddress.includes(country)
        );
      return {
        passed: hasEUAddress,
        message: hasEUAddress
          ? "EU importer address found"
          : "Must include EU-based importer address. Original Asian address is not sufficient",
        source: "Ruokavirasto Guide 17068/2, Section 1.1"
      };
    }
  },
  {
    id: "functional-classes",
    name: "E-Code Functional Classes",
    severity: "INFO",
    check: (label) => {
      const eCodes = label.ingredients.filter(ing => ing.code?.startsWith("E"));
      const allHaveFunction = eCodes.every(ing => ing.functionalClass);
      return {
        passed: allHaveFunction,
        message: allHaveFunction
          ? "All E-codes have functional classes"
          : "E-codes must include functional class (e.g., 'Flavor enhancer: E621' or 'Makuvahvenne: E621')",
        source: "Regulation (EU) No 1169/2011"
      };
    }
  }
];
```

### 3.2 Label Data Structure
**Location**: `src/lib/labeling/types.ts`

```typescript
interface LabelData {
  productName: {
    original: string;
    translations: {
      fi: string;
      sv: string;
    };
  };
  ingredients: Array<{
    name: string;
    percentage?: number; // QUID
    code?: string; // E-code
    functionalClass?: string; // "Flavor enhancer"
    isAllergen: boolean;
    isHighlighted: boolean;
    translations: {
      fi: string;
      sv: string;
    };
  }>;
  nutritionInfo: {
    energy: number; // kcal
    fat: number;
    carbs: number;
    protein: number;
    salt: number; // percentage
  };
  warnings: string[]; // ["Voimakassuolainen / Kraftigt saltad"]
  importerAddress: string;
  bestBeforeDate: string;
  labelDimensions: {
    width: number; // mm
    height: number; // mm
  };
  fontSize: number; // pt
  complianceScore: number; // 0-100
  complianceResults: ComplianceResult[];
}
```

### 3.3 AI Label Generator
**Location**: `src/lib/labeling/label-generator.ts`

**Implementation**:

```typescript
async function generateCompliantLabel(
  product: ProductData,
  regulatoryChunks: RegulatoryChunk[]
): Promise<LabelData> {
  const systemPrompt = `You are a food labeling expert specializing in EU and Finnish regulations. 
You must generate a compliant label based on:
1. Product information provided
2. Regulatory requirements from Ruokavirasto Guide 17068/2
3. Regulation (EU) No 1169/2011

CRITICAL RULES:
- Labels MUST be in Finnish AND Swedish
- QUID percentages required if ingredient in product name
- High salt warning (>1.2%) must include "Voimakassuolainen / Kraftigt saltad"
- Allergens must be visually distinct
- EU importer address required
- E-codes must include functional class
- Font x-height must be ≥1.2mm

Use the provided regulatory chunks as your source of truth.`;

  const userPrompt = `Generate a compliant label for:
Product: ${product.name}
Description: ${product.description}
Ingredients (original): ${product.originalIngredients}
Nutrition: ${JSON.stringify(product.nutrition)}
Origin: ${product.originCountry}

Regulatory Requirements:
${regulatoryChunks.map(chunk => 
  `[${chunk.source} ${chunk.sectionPath}] ${chunk.content}`
).join("\n\n")}

Return JSON with complete label data including Finnish and Swedish translations.`;

  // Call OpenAI with structured output
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
  });

  const labelData = JSON.parse(response.choices[0].message.content);
  
  // Run compliance checks
  const complianceResults = runComplianceChecks(labelData);
  labelData.complianceScore = calculateComplianceScore(complianceResults);
  labelData.complianceResults = complianceResults;
  
  return labelData;
}
```

---

## Phase 4: UI/UX Implementation

### 4.1 Labeling Wizard Flow
**Location**: `src/app/(app)/labeling/wizard/page.tsx`

**User Flow**:

1. **Step 1: Product Input**
   - Upload product image (OCR extraction)
   - Or manual entry form
   - Product type detection (Food/Electronics/Toys)

2. **Step 2: Compliance Audit** (NEW)
   - Show compliance scorecard
   - List all checks (✅/⚠️/❌)
   - Link to regulatory sources
   - Allow user to fix issues

3. **Step 3: Label Preview**
   - Three-column view:
     - Left: Original label
     - Middle: Compliance issues
     - Right: Generated compliant label
   - Real-time preview with Finnish/Swedish
   - Font size calculator

4. **Step 4: Export**
   - Download print-ready PDF/SVG
   - Option: "Expert Review" (upsell)

### 4.2 Compliance Scorecard Component
**Location**: `src/components/labeling/compliance-scorecard.tsx`

```typescript
interface ComplianceScorecardProps {
  score: number; // 0-100
  results: ComplianceResult[];
  onFixIssue: (ruleId: string) => void;
}

export function ComplianceScorecard({ score, results, onFixIssue }: Props) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-red-600";
      case "WARNING": return "text-amber-600";
      case "INFO": return "text-blue-600";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Compliance Score</CardTitle>
          <div className={`text-3xl font-bold ${
            score >= 100 ? "text-green-600" :
            score >= 80 ? "text-amber-600" :
            "text-red-600"
          }`}>
            {score}%
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              {result.passed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${getSeverityColor(result.severity)}`} />
              )}
              <div className="flex-1">
                <p className="font-medium">{result.ruleName}</p>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Source: {result.source}
                </p>
                {!result.passed && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => onFixIssue(result.ruleId)}
                  >
                    Fix Issue
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4.3 Label Preview Component
**Location**: `src/components/labeling/label-preview.tsx`

- Visual label preview
- Toggle between Finnish/Swedish
- Font size calculator
- Print-ready export

---

## Phase 5: Database Schema Updates

### 5.1 New Tables
**Location**: `prisma/schema.prisma`

```prisma
model Label {
  id                String   @id @default(cuid())
  organizationId    String
  productId         String?
  classificationId String?
  labelData         Json     // LabelData structure
  complianceScore   Decimal  @db.Decimal(5, 2)
  version           Int      @default(1)
  isDraft           Boolean  @default(true)
  generatedAt       DateTime @default(now())
  organization      Organization @relation(fields: [organizationId], references: [id])
  product           Product?    @relation(fields: [productId], references: [id])
  classification    Classification? @relation(fields: [classificationId], references: [id])
  
  @@index([organizationId])
  @@index([productId])
}

model RegulatoryDocument {
  // ... (see Phase 1.2)
}

model RegulatoryDocumentChunk {
  // ... (see Phase 1.2)
}
```

---

## Phase 6: Integration with Classification

### 6.1 Automatic Label Generation Trigger
**Location**: `src/server/actions/classification-search.ts`

When classification is complete:
1. Detect product type from CN code
2. If FOOD → Trigger label generation workflow
3. Pre-fill label data from classification result
4. Show "Generate Label" button on classification detail page

---

## Implementation Priority

### Week 1-2: Foundation
- [ ] Legal disclaimer component
- [ ] Document ingestion pipeline
- [ ] Database schema updates
- [ ] Basic RAG search for regulatory docs

### Week 3-4: Core Features
- [ ] Compliance checker implementation
- [ ] Label generator with AI
- [ ] Multilingual translation (FI/SV)
- [ ] Compliance scorecard UI

### Week 5-6: Polish & Integration
- [ ] Label preview component
- [ ] PDF export
- [ ] Integration with classification flow
- [ ] Testing with real products

---

## Technical Considerations

### 1. Multilingual Embeddings
- Use `text-embedding-3-small` (supports 50+ languages including Finnish)
- Query translation: English → Finnish before search
- Chunk translation: Finnish → English for user display

### 2. Hybrid Search Strategy
- Vector similarity (semantic meaning)
- Keyword matching (exact terms)
- Section-based filtering (e.g., "Section 5.3" for QUID)

### 3. Validation Layer
- Non-AI validation scripts (TypeScript)
- Rule-based checks (salt > 1.2%, font size, etc.)
- AI as generator, validation as safety net

### 4. Source Attribution
- Every recommendation links to source document
- Show section path (e.g., "Ruokavirasto Guide 17068/2, Section 5.3")
- Deep links to PDF pages when possible

---

## Success Metrics

1. **Compliance Accuracy**: 100% of generated labels pass Ruokavirasto inspection
2. **User Trust**: Compliance scorecard shows clear, actionable issues
3. **Legal Protection**: Disclaimer accepted, all recommendations cite sources
4. **Multilingual Quality**: Finnish/Swedish translations are accurate and natural

---

## Next Steps

1. Start with document ingestion (Phase 1.2)
2. Build basic RAG search (Phase 2.1)
3. Implement compliance checker (Phase 3.1)
4. Create UI components (Phase 4)

Would you like me to start implementing any specific phase?

