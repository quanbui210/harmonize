# Classification Flow - End-to-End Documentation

## Overview

This document explains the complete end-to-end flow of how TulliCheck classifies products and determines CN codes. Understanding this flow is essential for modifying prompting strategies and improving classification accuracy.

---

## High-Level Flow Diagram

```
User Input (Product Name, Description, etc.)
    ↓
┌─────────────────────────────────────────┐
│ 1. RAG Search (Vector Similarity)     │
│    - Generate embedding from product    │
│    - Search LegalSourceChunk database   │
│    - Return top 10 relevant chunks      │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 2. Extract CN Codes from Chunks        │
│    - Parse chunks for CN codes          │
│    - Extract 8-digit codes              │
│    - Validate chapter ranges (1-97)     │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 3. AI Product Analysis (OpenAI)        │
│    - Analyze product attributes         │
│    - Suggest chapters/headings          │
│    - Provide CN codes if possible       │
│    - Use legal chunks as context        │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 4. Chapter Validation                  │
│    - Filter extracted codes            │
│    - Match against AI-suggested        │
│      chapters                           │
│    - Reject codes from wrong chapters   │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 5. CN Code Selection (Priority Order)   │
│    Priority 1: AI-provided CN code      │
│    Priority 2: Construct from AI        │
│    Priority 3: Validated RAG codes     │
│    Priority 4: Classification engine     │
│    Priority 5: Fallback (chapter only)  │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 6. Generate Legal Rationale            │
│    - Create defense dossier content     │
│    - Extract duty rates                 │
│    - Build reasoning trail              │
└───────────────┬─────────────────────────┘
                ↓
        Final Classification Result
```

---

## Detailed Step-by-Step Flow

### Step 1: AI Product Analysis

**File**: `src/lib/eu/openai-service.ts` → `analyzeProduct()`

**What happens**:
1. Builds system prompt with GRI rules and classification protocol
2. Uses LLM training knowledge directly (RAG search removed for performance)
3. Sends product attributes to GPT-4o
4. AI analyzes and returns:
   - `suggestedChapters`: Array of chapter suggestions with:
     - `chapter` (number)
     - `heading` (optional number)
     - `subheading` (optional number)
     - `cnCode` (optional 8-digit string)
     - `reason` (GRI-based explanation)
     - `confidence` (0-1)
   - `keyAttributes`: Product characteristics
   - `classificationNotes`: Special considerations

**System Prompt Key Points**:
- Follows GRI 1 → GRI 3 → GRI 6 sequentially
- Validates chapter relevance (e.g., trail mix → Chapter 20, not Chapter 3)
- If legal sources provided, prioritizes codes from those sources
- Must cite specific GRI rules
- For composite goods, applies GRI 3(b) for essential character

**User Prompt Includes**:
- Product name, description, intended use, materials
- Instructions to use training knowledge of Regulation (EU) 2021/1832

**Key Code**:
```typescript
const systemPrompt = `You are an elite EU Customs Auditor...
CLASSIFICATION PROTOCOL (MUST FOLLOW SEQUENTIALLY):
1. GRI 1: Determine classification by the terms of the headings...
2. GRI 3: If goods are prima facie classifiable under two or more headings...
3. GRI 6: Determine subheading classification...`;

const legalContext = legalChunks && legalChunks.length > 0
  ? `\n\n### MANDATORY LEGAL SOURCES (Regulation EU 2021/1832)...
     CRITICAL RULES FOR LEGAL SOURCES:
     1. If a specific CN code is mentioned AND it matches the product type, you MUST use that exact code
     2. VALIDATION REQUIRED: If Legal Sources contain codes from wrong chapters, REJECT those codes...`
  : "\nNote: No specific legal chunks provided...";
```

**Output**: `ProductAnalysisResult` with suggested chapters and CN codes

---

### Step 2: CN Code Selection (Priority-Based)

**File**: `src/server/actions/classification-search.ts` (lines 380-513)

**Priority Order**:

#### Priority 1: AI-Provided CN Code (LLM Knowledge)
- **When**: AI returns a valid 8-digit CN code in `suggestedChapters[0].cnCode`
- **Normalization**: Removes spaces, dots, dashes → ensures 8 digits
- **Validation**: Must be 8 digits, not "00000000"
- **Confidence**: Uses AI's confidence score (typically 0.8+)
- **Rationale**: "AI-provided CN Code {code}: {reason}"

**Key Code**:
```typescript
if (normalizedAiCode && normalizedAiCode.length === 8 && normalizedAiCode !== "00000000") {
  validatedCnCode = normalizedAiCode;
  console.log(`[Classification] Using AI-provided CN code (not found in document): ${validatedCnCode}`);
}
```

#### Priority 2: Construct from AI Components
- **When**: AI provides chapter/heading/subheading but no full CN code
- **Construction**: `chapter (2) + heading (2) + subheading (2) + "00"` = 8 digits
- **Example**: Chapter 20, Heading 8, Subheading 19 → `20081900`
- **Handles**: String formats like `"20 08"` or numbers like `8`
- **Rationale**: "Constructed CN Code {code} from AI analysis: {reason}"

**Key Code**:
```typescript
const chapterStr = topSuggestion.chapter.toString().padStart(2, "0");
const headingStr = headingNum !== null ? headingNum.toString().padStart(2, "0") : "00";
const subheadingStr = subheadingNum !== null ? subheadingNum.toString().padStart(2, "0") : "00";
validatedCnCode = `${chapterStr}${headingStr}${subheadingStr}00`.substring(0, 8);
```

#### Priority 3: Classification Engine (GRI Engine)
- **When**: All above fail, uses `euClassificationEngine.classifyProduct()`
- **What it does**: Applies GRI rules programmatically
- **Output**: CN code from GRI reasoning

#### Priority 4: Fallback (Chapter Only)
- **When**: Everything fails
- **Creates**: Basic code from chapter (e.g., `20000000` for Chapter 20)
- **Warning**: Logs "CRITICAL: No valid CN code found"

---

### Step 3: Generate Legal Rationale

**File**: `src/lib/eu/openai-service.ts` → `generateLegalRationale()`

**What happens**:
1. Gets CN code description from database or TARIC
2. Sends to GPT-4o with:
   - Product attributes
   - CN code and description
   - Reasoning trail
   - Legal sources
3. AI generates:
   - `legalRationale`: Full explanation using GRI rules
   - `distinctions`: Why this heading over alternatives
   - `keyFeatures`: Product characteristics
   - `griRule`: Which GRI rule(s) applied
   - `dutyRate`: MFN duty rate (with chapter-based fallbacks)
   - `vatRate`: VAT rate

**Duty Rate Extraction**:
- Tries to extract from legal rationale text using regex
- Falls back to chapter-based defaults:
  - Chapter 20: 9.6% (preparations of vegetables/fruit/nuts)
  - Chapters 50-63: 10.0% (textiles)
  - Chapters 84-85: 0.0% (electronics)
  - Other agricultural: 8.0%

**Key Code**:
```typescript
const dutyRatePatterns = [
  /duty\s+rate\s+(?:is|of|:)\s*(\d+\.?\d*)\s*%/i,
  /(\d+\.?\d*)\s*%\s*(?:ad\s+valorem\s+)?duty/i,
  // ... more patterns
];

// Chapter-based fallback
if (dutyRate === undefined) {
  const chapter = parseInt(cnCodeStr.substring(0, 2), 10);
  if (chapter === 20) {
    dutyRate = 9.6; // 7.5-12% MFN range midpoint
  }
  // ... other chapters
}
```

---

## Current Prompting Strategy Analysis

### Strengths ✅

1. **Direct LLM Approach**: Uses LLM training knowledge directly (faster, more reliable)
2. **Priority System**: LLM knowledge > Constructed > Engine > Fallback
3. **GRI Compliance**: Systematically follows GRI 1 → 3 → 6
4. **Duty Rate Integration**: AI provides duty rates during initial classification
5. **Import Guidance**: Comprehensive import guidance for users

### Potential Issues ⚠️

1. **AI Code Format**: AI sometimes returns codes with spaces (`"20 08 19 13"`) requiring normalization
2. **Duty Rate Accuracy**: Relies on AI knowledge or chapter defaults, not real-time TARIC
3. **Composite Goods**: GRI 3(b) essential character determination could be improved

### Areas for Improvement 🔧

1. **AI Prompt Refinement**:
   - More explicit instructions for CN code format
   - Better handling of composite goods
   - Clearer validation instructions

2. **Code Normalization**:
   - Already handles spaces/dots, but could be more robust
   - Validate against known CN code patterns

3. **Duty Rate Integration**:
   - Connect to real TARIC API when available
   - Cache duty rates by CN code

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/server/actions/classification-search.ts` | Main classification orchestration |
| `src/lib/eu/openai-service.ts` | AI product analysis and legal rationale |
| `src/lib/eu/classification-engine.ts` | GRI-based classification engine |
| `src/lib/eu/taric-client.ts` | Duty rate lookup (TARIC API) |
| `src/lib/vision/image-extraction-service.ts` | Product identification from images |

---

### Step 4: Generate Import Guidance

**File**: `src/lib/eu/openai-service.ts` → `generateImportGuidance()`

**What happens**:
1. Analyzes product type, CN code, and origin country
2. Generates comprehensive import guidance including:
   - Import status (ALLOWED/RESTRICTED/PROHIBITED)
   - Risk level and required documents
   - Food safety risks (for food products)
   - Recommended lab tests
   - Labelling requirements
   - Border control likelihood
   - Next actions checklist
3. Runs in parallel with legal rationale generation

**Output**: Complete import guidance for the user

---

## Example Flow: Trail Mix Classification

1. **Input**: "Trail mix with dried mango, nuts, and seeds"
2. **AI Analysis**: Suggests Chapter 20 (preparations of vegetables/fruit/nuts), provides code `20081913` with duty rate 9.6%
3. **Selection**: Uses AI-provided `20081913` (Priority 1)
4. **Rationale**: Generates legal rationale explaining GRI 1 classification under Chapter 20
5. **Import Guidance**: Generates import status, required documents, food safety risks, lab tests, etc.
6. **Result**: CN code `20081913` with confidence 0.85, duty rate 9.6%, plus complete import guidance

---

## Modifying the Prompting Strategy

### Where to Modify

1. **AI System Prompt**: `src/lib/eu/openai-service.ts` → `analyzeProduct()` → `systemPrompt`
2. **AI User Prompt**: `src/lib/eu/openai-service.ts` → `analyzeProduct()` → `userPrompt`
3. **Legal Rationale Prompt**: `src/lib/eu/openai-service.ts` → `generateLegalRationale()`
4. **Import Guidance Prompt**: `src/lib/eu/openai-service.ts` → `generateImportGuidance()`

### Common Modifications

- **Improve CN Code Format**: Add explicit instructions: "Return CN codes as 8-digit strings without spaces: '20081913' not '20 08 19 13'"
- **Better Composite Goods**: Add examples of GRI 3(b) determinations
- **Chapter Hints**: Add more specific category hints to RAG query
- **Validation Instructions**: Strengthen validation rules in system prompt

---

*Last Updated: 2025-01-15*

