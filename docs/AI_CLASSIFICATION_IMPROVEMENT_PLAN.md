# AI Classification Improvement Plan

## Executive Summary

This document outlines a comprehensive strategy to improve AI classification accuracy by moving away from model hallucinations and towards strict, verifiable, source-based classification.

## Current State Analysis

### What We're Doing Well ✅
1. **Legal Chunks Integration**: We search and inject legal source chunks
2. **GRI Engine**: We have a separate GRI engine that applies rules sequentially
3. **Duty Rate Handling**: We're asking AI to provide rates (but need verification)
4. **Basic Validation**: We normalize responses and handle errors

### Critical Gaps ❌
1. **Temperature Too High**: Using 0.3 instead of 0.1 for legal work
2. **Weak GRI Enforcement**: System prompt doesn't enforce sequential GRI application
3. **No Essential Character Field**: Missing GRI 3(b) determination
4. **No Verification Loop**: No mechanism to validate AI output against sources
5. **Weak Source Hierarchy**: Legal chunks not prioritized strongly enough
6. **Duty Rate Hallucination Risk**: AI can still guess rates
7. **Limited RAG**: Not searching Chapter Notes specifically
8. **No Competitive Distinction**: Not forcing AI to explain why alternatives are wrong

## Improvement Strategy

### Phase 1: Prompt Engineering (HIGH PRIORITY)

#### 1.1 Lower Temperature
- **Current**: 0.3
- **Target**: 0.1
- **Impact**: Reduces hallucination, increases consistency
- **Files**: `src/lib/eu/openai-service.ts`

#### 1.2 Enforce GRI Sequence
- **Current**: Generic GRI mention
- **Target**: Explicit sequential application (GRI 1 → GRI 3 → GRI 6)
- **Impact**: Prevents "code jumping" errors
- **Implementation**:
  ```
  CLASSIFICATION PROTOCOL:
  1. GRI 1: Determine classification by the terms of the headings and Section/Chapter Notes.
  2. GRI 3: If goods are prima facie classifiable under two or more headings, apply (a) Specific Description, (b) Essential Character, or (c) Kinship.
  3. GRI 6: Determine subheading classification according to the terms of those subheadings.
  ```

#### 1.3 Add Essential Character Field
- **New Field**: `essentialCharacter` in `ProductAnalysisResult`
- **Purpose**: Force AI to determine why multi-material products belong in one chapter vs another
- **Example**: "Product is 60% plastic, 40% metal, but essential character is determined by the plastic housing (GRI 3b)"

#### 1.4 Strict Source Hierarchy
- **Current**: "Prioritize legal sources"
- **Target**: "FORBID using codes that contradict legal sources"
- **Implementation**:
  ```
  CRITICAL CONSTRAINTS:
  - Priority: Legal Sources > Chapter Notes > General Knowledge
  - If a CN code is found in Legal Sources, you MUST use it
  - If Legal Sources contradict your suggestion, you MUST use the Legal Source code
  - NEVER guess a duty rate. If not in Legal Sources, state "Must verify via TARIC"
  ```

### Phase 2: Enhanced RAG (Retrieval-Augmented Generation)

#### 2.1 Expand Legal Chunk Search
- **Current**: Search by product keywords only
- **Target**: Multi-stage search:
  1. Product keywords
  2. Chapter Notes for suggested chapters
  3. Section Notes for suggested headings
  4. Explanatory Notes (HSEN) for subheadings

#### 2.2 Chapter Notes Injection
- **New Function**: `getChapterNotes(chapter: number)`
- **Purpose**: Always inject Chapter Notes when AI suggests a chapter
- **Source**: Extract from Regulation (EU) 2021/1832

#### 2.3 Section Notes Injection
- **New Function**: `getSectionNotes(section: number)`
- **Purpose**: Inject Section Notes for multi-chapter sections
- **Example**: Section XI (Textiles) covers Chapters 50-63

### Phase 3: Verification Loop

#### 3.1 Pre-Classification Verification
- **Step 1**: AI suggests CN code
- **Step 2**: Search legal chunks for that specific CN code
- **Step 3**: If found, verify AI suggestion matches
- **Step 4**: If mismatch, use legal source code and flag discrepancy

#### 3.2 Post-Classification Validation
- **Step 1**: Extract all CN codes mentioned in legal rationale
- **Step 2**: Verify they match the assigned code
- **Step 3**: Flag if AI mentions different codes in rationale

#### 3.3 Duty Rate Verification
- **Never**: Let AI provide rate without verification
- **Always**: Label as "Estimated" if from AI
- **Preferred**: Fetch from TARIC API and pass to AI for confirmation
- **Fallback**: Link to EU TARIC Consultation page

### Phase 4: Output Structure Enhancement

#### 4.1 GRI Reasoning Trail
- **Current**: Generic "reason" field
- **Target**: Structured trail:
  ```json
  {
    "griReasoningTrail": [
      {
        "step": 1,
        "griRule": "GRI_1",
        "level": "CHAPTER",
        "selection": "42",
        "rationale": "Product is a handbag, classified under Chapter 42 per GRI 1",
        "legalBasis": "Chapter 42, Note 3(a)"
      },
      {
        "step": 2,
        "griRule": "GRI_1",
        "level": "HEADING",
        "selection": "4202",
        "rationale": "Handbags fall under heading 4202 per GRI 1",
        "legalBasis": "Heading 4202"
      },
      {
        "step": 3,
        "griRule": "GRI_6",
        "level": "SUBHEADING",
        "selection": "420221",
        "rationale": "Leather handbags fall under subheading 4202 21 per GRI 6",
        "legalBasis": "Subheading 4202 21 00"
      }
    ]
  }
  ```

#### 4.2 Competitive Distinction
- **New Field**: `rejectedAlternatives`
- **Purpose**: Force AI to explain why it rejected other possible codes
- **Example**:
  ```json
  {
    "rejectedAlternatives": [
      {
        "code": "4202 12 00",
        "reason": "This subheading is for handbags with outer surface of plastic, not leather (GRI 3a - specific description takes precedence)"
      }
    ]
  }
  ```

#### 4.3 Legal Basis Citation
- **New Field**: `legalBasis` in each suggestion
- **Format**: "Chapter 42, Note 3(a)" or "Heading 4202" or "Regulation (EU) 2021/1832, Annex I, Chapter 42"

### Phase 5: Required Documents

#### 5.1 Essential Documents (MUST HAVE)
1. **Regulation (EU) 2021/1832** ✅ (Already have)
   - Combined Nomenclature
   - Chapter Notes
   - Section Notes
   - Heading descriptions

2. **HSEN (Harmonized System Explanatory Notes)**
   - Purpose: Detailed explanations for each heading/subheading
   - Source: WCO (World Customs Organization)
   - Format: PDF or structured data
   - Priority: HIGH

3. **EU Explanatory Notes**
   - Purpose: EU-specific clarifications
   - Source: EU Commission
   - Format: PDF or structured data
   - Priority: HIGH

4. **TARIC Database**
   - Purpose: Actual duty rates, measures, quotas
   - Source: EU TARIC API or database dump
   - Format: API or structured data
   - Priority: CRITICAL (for duty rates)

#### 5.2 Helpful Documents (SHOULD HAVE)
1. **Binding Tariff Information (BTI) Database**
   - Purpose: Precedents from EU customs authorities
   - Source: EU BTI database
   - Format: API or structured data
   - Priority: MEDIUM

2. **Classification Decisions**
   - Purpose: Historical classification decisions
   - Source: EU customs authorities
   - Format: PDF or structured data
   - Priority: MEDIUM

3. **Case Law Database**
   - Purpose: Court decisions on classification disputes
   - Source: EU Court of Justice
   - Format: PDF or structured data
   - Priority: LOW (but valuable for edge cases)

#### 5.3 Document Processing Strategy
1. **Extract Structured Data**
   - Parse PDFs into structured format
   - Extract Chapter Notes, Section Notes, Heading descriptions
   - Index by CN code, chapter, heading

2. **Vector Embeddings**
   - Create embeddings for all legal text
   - Enable semantic search
   - Current: Basic keyword search (needs upgrade)

3. **Hierarchical Indexing**
   - Index by: CN code → Heading → Chapter → Section
   - Enable fast lookup for verification

## Implementation Roadmap

### Week 1: Critical Fixes
- [ ] Lower temperature to 0.1
- [ ] Enforce GRI sequence in prompts
- [ ] Add Essential Character field
- [ ] Strengthen source hierarchy enforcement

### Week 2: RAG Enhancement
- [ ] Implement Chapter Notes search
- [ ] Implement Section Notes search
- [ ] Expand legal chunk search strategy
- [ ] Test with sample products

### Week 3: Verification Loop
- [ ] Implement pre-classification verification
- [ ] Implement post-classification validation
- [ ] Add duty rate verification
- [ ] Add discrepancy flagging

### Week 4: Output Enhancement
- [ ] Add GRI reasoning trail structure
- [ ] Add competitive distinction field
- [ ] Add legal basis citations
- [ ] Update UI to display new fields

### Week 5+: Document Integration
- [ ] Acquire HSEN documents
- [ ] Acquire EU Explanatory Notes
- [ ] Set up TARIC API integration
- [ ] Process and index documents
- [ ] Create vector embeddings

## Success Metrics

1. **Accuracy**: >95% correct CN codes (validated against legal sources)
2. **Duty Rate Accuracy**: 100% (all rates from TARIC or marked "Estimated")
3. **GRI Compliance**: 100% (all classifications cite specific GRI rules)
4. **Source Citation**: 100% (all codes have legal basis)
5. **Hallucination Rate**: <1% (codes not found in legal sources)

## Risk Mitigation

1. **AI Hallucination**: Always verify against legal sources
2. **Outdated Rates**: Never trust AI for rates, always use TARIC
3. **Code Errors**: Implement verification loop
4. **Missing Context**: Expand RAG to include all relevant notes
5. **User Trust**: Label AI estimates clearly, provide source links

## Conclusion

This plan transforms our classification system from "AI-assisted" to "AI-verified" by:
1. Making legal sources the absolute source of truth
2. Forcing AI to follow strict GRI protocols
3. Verifying all AI output against sources
4. Providing audit-defensible reasoning trails

The key principle: **Never trust AI alone. Always verify against authoritative sources.**
