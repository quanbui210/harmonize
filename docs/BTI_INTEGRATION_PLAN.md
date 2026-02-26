# TulliVision: BTI Database & AI Integration Master Plan

## 1. Executive Summary
This document outlines the strategy to integrate the **EU Binding Tariff Information (BTI)** database (1.2M+ rulings) into TulliCheck. This feature transforms the app from a simple "classification tool" into a **legal defense engine**.

By leveraging **Supabase (PostgreSQL)** and **pgvector**, we can provide users with "Defense Cards"—legally binding precedents that justify their HS code choices, significantly reducing audit risk.

---

## 2. Business Value & Strategy
**Why do this?**
1.  **Audit Immunity**: A BTI ruling is the gold standard of evidence. Showing a user that "Finland Customs approved this exact product last year" is 100x more valuable than a generic AI guess.
2.  **Trust**: It grounds AI hallucinations in hard legal reality.
3.  **Competitive Moat**: Competitors might use GPT-4; we use GPT-4 + 1.2M legal precedents.

**The "Defense Card" Concept**:
Instead of just saying "Code 6109.10.00", we present a card:
> *"Confidence: 98%. Precedent: FI-BTI-2023-1234. Finland Customs classified 'Cotton T-Shirt with Logo' under this code on Jan 15, 2023."*

---

## 3. Technical Architecture

### 3.1 Data Pipeline (The 1.2M Row Challenge)
Processing 1.2M rows requires a robust pipeline to avoid timeouts and manage costs.

*   **Source**: EU Open Data Portal (XML/CSV exports of the EBTI database).
*   **Ingestion Strategy**:
    1.  **ETL Script**: A Python or Node.js script to parse the massive XML/CSV files.
    2.  **Batch Processing**: Process in chunks of 1,000 records.
    3.  **Filtering**: Discard expired rulings (older than 3-5 years) to reduce volume if needed.
    4.  **Vectorization**:
        *   **Model**: OpenAI `text-embedding-3-small` (Cost-effective & high performance).
        *   **Cost Estimate**:
            *   1.2M rows * ~100 tokens/row = 120M tokens.
            *   Price: ~$0.02 per 1M tokens.
            *   Total Cost: ~$2.40 - $5.00 (Extremely cheap!).
    5.  **Storage**: Supabase `BtiRuling` table with `vector(1536)` column.

### 3.2 Database Schema
(Already implemented in Phase 1)
*   **Table**: `BtiRuling`
*   **Key Fields**: `reference` (Unique ID), `hsCode` (Indexed), `description` (Text), `descriptionVector` (Vector), `country` (Indexed).
*   **Indexes**: HNSW index on `descriptionVector` for fast semantic search.

### 3.3 The "Smart Query" Search Logic
When a user searches for "Running shoes with LED lights", we run a **Hybrid Search**:

1.  **Step 1: Broad Pruning (SQL)**
    *   If we have a tentative HS code (e.g., from AI prediction), filter by the first 4 digits (e.g., `6404`).
    *   *Query*: `WHERE hsCode LIKE '6404%'`

2.  **Step 2: Semantic Ranking (Vector)**
    *   Calculate Cosine Similarity between user input and BTI descriptions.
    *   *Query*: `ORDER BY descriptionVector <=> queryVector`

3.  **Step 3: Strategic Re-Ranking (The "Finnish Logic")**
    *   **Priority 1**: Finnish Rulings (`country = 'FI'`).
    *   **Priority 2**: Recent Rulings (Last 2 years).
    *   **Priority 3**: Trusted Authorities (`DE`, `NL`).

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Completed)
- [x] Design Database Schema (`BtiRuling` table).
- [x] Configure Prisma & Supabase (Enable `vector` extension).
- [x] Create basic Server Actions for search (`searchBtiAction`).

### Phase 2: Data Ingestion (Next Steps)
- [ ] **Task 2.1**: Build the `ingest-bti.ts` script.
    -   Must handle huge XML/CSV files (stream processing).
    -   Must handle API rate limits for OpenAI embeddings.
- [ ] **Task 2.2**: Run the initial ingestion.
    -   Start with a sample (e.g., 10k records) to validate.
    -   Full ingestion of 1.2M records.

### Phase 3: UI Integration
- [ ] **Task 3.1**: "Precedent Search" Component.
    -   A search bar specifically for looking up rulings.
- [ ] **Task 3.2**: Integration into Classification Flow.
    -   When viewing a classification result, show "Similar Rulings" automatically.
- [ ] **Task 3.3**: "Defense Card" UI.
    -   Display the ruling details, confidence score, and link to official EU PDF.

### Phase 4: Refinement
- [ ] **Task 4.1**: Fine-tune search weights (balance between semantic match vs. exact code match).
- [ ] **Task 4.2**: Add "Expired" warning for old rulings.

---

## 5. Feasibility & Risks

| Risk | Mitigation |
| :--- | :--- |
| **Data Volume** | 1.2M rows is large but manageable for Postgres. We will use HNSW indexes for speed. |
| **Ingestion Cost** | OpenAI `text-embedding-3-small` is very cheap. Total cost < $10. |
| **Search Latency** | Hybrid search (filtering by HS code first) ensures sub-second responses. |
| **Data Freshness** | We need a scheduled cron job (monthly) to fetch updates from EU portal. |

## 6. Conclusion
This is absolutely doable and highly strategic. The technical stack (Supabase + pgvector) is perfect for this. The cost is negligible compared to the value of "Audit Immunity."

**Recommendation**: Proceed immediately with **Phase 2 (Data Ingestion)**.
