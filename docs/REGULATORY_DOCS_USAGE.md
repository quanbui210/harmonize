# Regulatory Documents Usage Analysis

## Current Status

### ✅ **Currently Used: Labeling Only**

**Regulatory Documents** (`RegulatoryDocument` + `RegulatoryDocumentChunk`):
- **Sources**: RUOKAVIRASTO, TUKES, TULLI, EU
- **Document Types**: FOOD_GUIDE, SAFETY_REGULATION, CUSTOMS_GUIDE
- **Currently Used In**: 
  - ✅ Labeling feature only (`src/lib/labeling/label-generator-enhanced.ts`)
  - ❌ **NOT used in Compliance Chat**
  - ❌ **NOT used in Classification**

**Legal Source Chunks** (`LegalSourceChunk`):
- **Source**: EUR_LEX
- **Regulation**: EU_2021_1832 (Customs Classification)
- **Currently Used In**:
  - ✅ Classification feature
  - ⚠️ Compliance Chat (keyword search only, should upgrade to vector)

---

## The Gap: Compliance Chat Should Use Regulatory Documents

### Current Compliance Chat Capabilities

**What it CAN answer** (from `LegalSourceChunk`):
- CN code lookups
- GRI rules (General Rules of Interpretation)
- Chapter/heading notes
- Customs classification guidance
- End-use provisions

**What it CANNOT answer** (but should, using `RegulatoryDocument`):
- ❌ Food labeling requirements (QUID, allergens, nutrition tables)
- ❌ Product safety requirements (CE marking, age warnings)
- ❌ Customs procedures and documentation
- ❌ Import/export permits and licenses
- ❌ Finnish/Swedish bilingual labeling rules
- ❌ Ruokavirasto specific requirements
- ❌ Tukes safety regulations

---

## Recommendation: Integrate Regulatory Documents into Compliance Chat

### Why This Makes Sense

1. **Broader Coverage**: Users ask compliance questions beyond just customs classification
2. **Already Processed**: Documents are already in the database with embeddings
3. **Better Answers**: Can answer food labeling, safety, and customs procedure questions
4. **Unified Experience**: One chat interface for all compliance questions

### Implementation Approach

**Option 1: Unified Search (Recommended)**
- Search both `LegalSourceChunk` AND `RegulatoryDocumentChunk` in parallel
- Combine results and rank by relevance
- Let LLM use all sources to answer

**Option 2: Smart Routing**
- Detect question type (classification vs. labeling vs. safety)
- Route to appropriate document source
- Fallback to both if unclear

**Option 3: Hybrid Search**
- Always search `LegalSourceChunk` (for classification questions)
- Also search `RegulatoryDocumentChunk` if question mentions:
  - Food/labeling/ingredients → RUOKAVIRASTO
  - Safety/CE marking/toys → TUKES
  - Customs/procedures → TULLI
  - EU regulations → EU documents

---

## Example Questions That Would Benefit

### Current (LegalSourceChunk only):
- ✅ "What is CN code 2008 19 13?"
- ✅ "How does GRI 3 work?"
- ✅ "What are the notes for Chapter 20?"

### With Regulatory Documents Added:
- ✅ "What are the QUID requirements for food labels?"
- ✅ "Do I need CE marking for this product?"
- ✅ "What documents do I need for customs clearance?"
- ✅ "What are the allergen labeling requirements in Finland?"
- ✅ "What safety warnings are required for toys?"
- ✅ "What is the bilingual labeling requirement for food products?"

---

## Implementation Plan

### Step 1: Update Compliance Chat Search Function

**Current** (`src/server/actions/compliance-chat.ts`):
```typescript
async function searchLegalChunks(query: string, limit: number = 5) {
  // Only searches LegalSourceChunk (EU 2021/1832)
  const where: any = {
    source: "EUR_LEX",
    regulation: "EU_2021_1832",
    language: "EN",
  };
  // ... keyword search
}
```

**Proposed**:
```typescript
async function searchComplianceDocuments(query: string, limit: number = 10) {
  // 1. Search LegalSourceChunk (customs classification)
  const legalChunks = await searchLegalChunksVector(query, limit / 2);
  
  // 2. Search RegulatoryDocumentChunk (food/safety/customs)
  const regulatoryChunks = await searchRegulatoryDocuments({
    productType: detectProductType(query), // or "GENERAL"
    query: query,
    maxResults: limit / 2,
  });
  
  // 3. Combine and rank by relevance
  return [...legalChunks, ...regulatoryChunks]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
```

### Step 2: Upgrade to Vector Search

**Current**: Keyword matching only
**Proposed**: Vector similarity search (like classification uses)

### Step 3: Update System Prompt

Include context about regulatory sources:
```typescript
const systemPrompt = `
You are a compliance expert with access to:
1. EU Customs Classification Regulation (EU 2021/1832) - for CN codes, GRI rules
2. Ruokavirasto Food Labeling Guides - for food labeling requirements
3. Tukes Safety Regulations - for product safety requirements
4. Tulli Customs Guides - for import/export procedures

Use the appropriate sources based on the question type.
`;
```

---

## Files to Modify

1. **`src/server/actions/compliance-chat.ts`**
   - Add `searchRegulatoryDocuments()` call
   - Upgrade `searchLegalChunks()` to vector search
   - Combine results from both sources

2. **`src/lib/rag/regulatory-search.ts`**
   - Already exists and ready to use
   - Just needs to be called from compliance chat

3. **System prompts**
   - Update to mention all available sources
   - Guide LLM to use appropriate sources

---

## Benefits

1. ✅ **Comprehensive Answers**: Can answer labeling, safety, and customs questions
2. ✅ **Better User Experience**: One chat for all compliance questions
3. ✅ **Leverages Existing Data**: Uses documents already processed
4. ✅ **More Accurate**: Vector search instead of keyword matching
5. ✅ **Source Attribution**: Users can see which regulation/guide was used

---

## Next Steps

1. ✅ Documents are already processed and ready
2. ⏳ Integrate `searchRegulatoryDocuments()` into compliance chat
3. ⏳ Upgrade compliance chat to vector search
4. ⏳ Test with various question types
5. ⏳ Update UI to show source types (EUR_LEX vs RUOKAVIRASTO vs TUKES)

