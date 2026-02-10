# Plan: Enable AI Refinement Questions for All Products

## Analysis
You are partially correct, but the restriction is not in `openai-service.ts`.

1.  **`src/lib/eu/openai-service.ts` (AI Service)**:
    *   **Status**: This file is **GENERIC**. It does **NOT** contain any hardcoded logic restricting refinement questions to textiles/clothing. It asks the AI for a `clarifyingQuestion` for *any* ambiguous classification.
    *   **Correction**: The AI might not be asking questions for other products because the current prompt focuses on "ambiguity" rather than "missing information".

2.  **`src/server/actions/classification-search.ts` (Search Action)**:
    *   **Status**: This file **DOES** contain a hardcoded check (`shouldAskForComposition`) that *forces* a composition question **only for textiles**.
    *   **Effect**: This creates the perception that only textiles get asked questions about materials, while other products (e.g., a plastic toy missing material info) might be skipped if the AI doesn't proactively ask.

## Proposed Changes

To achieve your goal of "Refinement questions for all products when needed", we will:

1.  **Update `src/lib/eu/openai-service.ts`**:
    *   Modify the `systemPrompt` and `userPrompt` in `analyzeProduct` to explicitly instruct the AI to generate a `clarifyingQuestion` not just for ambiguity, but also **when critical information is missing** (e.g., materials, voltage, dimensions) for *any* product category.

2.  **Update `src/server/actions/classification-search.ts`**:
    *   Relax the hardcoded `shouldAskForComposition` check. Instead of restricting it to textiles, we can rely on the improved AI prompt to detect missing materials for *any* product.
    *   (Optional) We can keep `shouldAskForComposition` as a fallback for textiles but ensure the AI's `clarifyingQuestion` takes precedence for other categories.

This ensures that if you classify a "Toy" without specifying materials, the AI will now ask "What is this made of?" just like it does for a "Shirt".

## Verification
*   We will verify that `openai-service.ts` remains free of category-specific hardcoding.
*   We will ensure the prompt explicitly encourages "missing data" questions for all products.