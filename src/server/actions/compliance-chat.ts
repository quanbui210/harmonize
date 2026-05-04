"use server";

import { prisma } from "@/lib/prisma";
import { openaiService } from "@/lib/eu/openai-service";
import { searchRegulatoryDocuments } from "@/lib/rag/regulatory-search";
import type { RegulatoryProductType } from "@/lib/regulatory/product-type";
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    sectionPath: string;
    excerpt: string;
    pageStart?: number;
    pageEnd?: number;
    source?: string;
  }>;
}

/**
 * Detect product type from query to route to appropriate regulatory documents
 */
function detectProductTypeFromQuery(query: string): RegulatoryProductType {
  const lowerQuery = query.toLowerCase();
  
  // Food-related keywords
  if (lowerQuery.match(/\b(food|ingredient|label|nutrition|allergen|quid|ruokavirasto|bilingual|finnish|swedish)\b/)) {
    return "FOOD";
  }
  
  // Electronics/safety keywords
  if (lowerQuery.match(/\b(electronic|ce marking|safety|tukes|toy|toys)\b/)) {
    if (lowerQuery.includes("toy")) return "TOYS";
    return "ELECTRONICS";
  }
  
  // Customs/procedures
  if (lowerQuery.match(/\b(customs|import|export|procedure|document|tulli)\b/)) {
    return "GENERAL";
  }
  
  return "GENERAL";
}

/**
 * Search LegalSourceChunk for relevant content using vector similarity search
 */
async function searchLegalChunksVector(query: string, limit: number = 5) {
  try {
    // Generate embedding for the query
    const openai = createFeatureOpenAIClient("Compliance Chat Embeddings");
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const embeddingVectorStr = `[${queryEmbedding.join(",")}]`;

    // Use vector similarity search with pgvector
    const sql = `
      SELECT 
        id,
        "sectionPath",
        content,
        "pageStart",
        "pageEnd",
        1 - (embedding <=> '${embeddingVectorStr}'::vector) as similarity
      FROM "LegalSourceChunk"
      WHERE 
        source = 'EUR_LEX'
        AND regulation = 'EU_2021_1832'
        AND language = 'EN'
        AND embedding IS NOT NULL
      ORDER BY embedding <=> '${embeddingVectorStr}'::vector
      LIMIT ${limit}
    `;

    const chunks = await prisma.$queryRawUnsafe<Array<{
      id: string;
      sectionPath: string;
      content: string;
      pageStart: number | null;
      pageEnd: number | null;
      similarity: number;
    }>>(sql);

    return chunks.map((chunk) => ({
      sectionPath: chunk.sectionPath,
      excerpt: chunk.content.slice(0, 500) + (chunk.content.length > 500 ? "..." : ""),
      pageStart: chunk.pageStart || undefined,
      pageEnd: chunk.pageEnd || undefined,
      source: "EUR_LEX",
      similarity: chunk.similarity,
    }));
  } catch (error) {
    console.error("[ComplianceChat] Vector search failed, falling back to keyword search:", error);
    // Fallback to keyword search
    return searchLegalChunksKeyword(query, limit);
  }
}

/**
 * Search LegalSourceChunk for relevant content using keyword matching (fallback)
 */
async function searchLegalChunksKeyword(query: string, limit: number = 5) {
  const searchTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  // Extract CN code if present (e.g., "8806 00 00", "88060000", "8806.00.00")
  const cnCodeMatch = query.match(/\b(\d{4}[\s\.]?\d{2}[\s\.]?\d{2})\b/);
  const cnCodeDigits = cnCodeMatch
    ? cnCodeMatch[1].replace(/[\s\.]/g, "")
    : null;
  
  // Extract chapter and heading from CN code for broader search
  const chapterFromCN = cnCodeDigits ? cnCodeDigits.slice(0, 2) : null;
  const headingFromCN = cnCodeDigits ? cnCodeDigits.slice(0, 4) : null;

  // Extract GRI rule if present (e.g., "GRI 1", "GRI_1", "rule 1")
  const griMatch = query.match(/\b(?:gri|rule)\s*[_\s]?(\d+)\b/i);
  const griNumber = griMatch ? griMatch[1] : null;

  // Extract chapter number if present (e.g., "Chapter 88", "chapter 88", "ch 88")
  const chapterMatch = query.match(/\b(?:chapter|ch\.?)\s*(\d{1,3})\b/i);
  const chapterNumber = chapterMatch ? chapterMatch[1] : null;

  const where: any = {
    source: "EUR_LEX",
    regulation: "EU_2021_1832",
    language: "EN",
  };

  // Build OR conditions for keyword search
  const orConditions: any[] = [];

  // If CN code found, search for various formats and also by chapter/heading
  if (cnCodeDigits) {
    // Exact CN code formats
    orConditions.push(
      { content: { contains: cnCodeDigits, mode: "insensitive" } },
      {
        content: {
          contains: `${cnCodeDigits.slice(0, 4)} ${cnCodeDigits.slice(4, 6)} ${cnCodeDigits.slice(6, 8)}`,
          mode: "insensitive",
        },
      },
      {
        content: {
          contains: `${cnCodeDigits.slice(0, 4)}.${cnCodeDigits.slice(4, 6)}.${cnCodeDigits.slice(6, 8)}`,
          mode: "insensitive",
        },
      },
    );
    
    // Also search by chapter and heading
    if (chapterFromCN) {
      orConditions.push({
        sectionPath: { contains: `CHAPTER ${parseInt(chapterFromCN)}`, mode: "insensitive" },
      });
      orConditions.push({
        content: { contains: `Chapter ${parseInt(chapterFromCN)}`, mode: "insensitive" },
      });
    }
    
    // Search for heading pattern (e.g., "8806" as heading, or "88.06")
    if (headingFromCN) {
      const headingNum = parseInt(headingFromCN.slice(2, 4));
      const chapterNum = parseInt(headingFromCN.slice(0, 2));
      // Search for heading in various formats
      orConditions.push({
        content: { contains: `heading ${headingNum}`, mode: "insensitive" },
      });
      orConditions.push({
        content: { contains: `Heading ${headingNum}`, mode: "insensitive" },
      });
      // Search for heading as part of CN code (e.g., "8806" or "88.06")
      orConditions.push({
        content: { contains: headingFromCN, mode: "insensitive" },
      });
      orConditions.push({
        content: { contains: `${chapterNum}.${headingNum}`, mode: "insensitive" },
      });
      orConditions.push({
        content: { contains: `${chapterNum} ${headingNum}`, mode: "insensitive" },
      });
    }
  }

  // If GRI rule found, search in sectionPath
  if (griNumber) {
    orConditions.push({
      sectionPath: { contains: `GRI ${griNumber}`, mode: "insensitive" },
    });
    orConditions.push({
      content: { contains: `GRI ${griNumber}`, mode: "insensitive" },
    });
  }

  // If chapter found, search in sectionPath and content
  if (chapterNumber) {
    orConditions.push({
      sectionPath: { contains: `CHAPTER ${chapterNumber}`, mode: "insensitive" },
    });
    orConditions.push({
      content: { contains: `Chapter ${chapterNumber}`, mode: "insensitive" },
    });
  }

  // Add keyword search for all search terms
  for (const term of searchTerms) {
    orConditions.push({
      content: { contains: term, mode: "insensitive" },
    });
  }

  if (orConditions.length > 0) {
    where.OR = orConditions;
  }

  // Simple ordering: prioritize chunks with exact matches in sectionPath
  const chunks = await prisma.legalSourceChunk.findMany({
    where,
    take: limit,
    select: {
      id: true,
      sectionPath: true,
      content: true,
      pageStart: true,
      pageEnd: true,
    },
  });

  // Sort chunks by relevance (exact matches first)
  chunks.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // Boost score for exact CN code matches in content
    if (cnCodeDigits) {
      if (a.content.includes(cnCodeDigits)) scoreA += 10;
      if (b.content.includes(cnCodeDigits)) scoreB += 10;
    }

    // Boost score for GRI matches in sectionPath
    if (griNumber) {
      if (a.sectionPath.toLowerCase().includes(`gri ${griNumber}`)) scoreA += 5;
      if (b.sectionPath.toLowerCase().includes(`gri ${griNumber}`)) scoreB += 5;
    }

    // Boost score for chapter matches in sectionPath
    if (chapterNumber) {
      if (a.sectionPath.toLowerCase().includes(`chapter ${chapterNumber}`)) scoreA += 5;
      if (b.sectionPath.toLowerCase().includes(`chapter ${chapterNumber}`)) scoreB += 5;
    }

    return scoreB - scoreA;
  });

  return chunks.map((chunk) => ({
    sectionPath: chunk.sectionPath,
    excerpt: chunk.content.slice(0, 500) + (chunk.content.length > 500 ? "..." : ""),
    pageStart: chunk.pageStart || undefined,
    pageEnd: chunk.pageEnd || undefined,
    source: "EUR_LEX",
    similarity: 0.5, // Default for keyword search
  }));
}

/**
 * Search both LegalSourceChunk and RegulatoryDocumentChunk
 * Combines results from customs classification and regulatory documents
 */
async function searchComplianceDocuments(query: string, limit: number = 10) {
  // Search legal sources (customs classification) - 50% of results
  const legalChunks = await searchLegalChunksVector(query, Math.ceil(limit / 2));
  
  // Detect product type to route to appropriate regulatory documents
  const productType = detectProductTypeFromQuery(query);
  
  // Search regulatory documents (labeling, safety, customs) - 50% of results
  let regulatoryChunks: Array<{
    sectionPath: string;
    excerpt: string;
    pageStart?: number;
    pageEnd?: number;
    source: string;
    similarity: number;
  }> = [];
  
  try {
    const regulatoryResults = await searchRegulatoryDocuments({
      productType,
      query,
      maxResults: Math.ceil(limit / 2),
    });
    
    regulatoryChunks = regulatoryResults.map((chunk) => ({
      sectionPath: `${chunk.source} - ${chunk.sectionPath}`,
      excerpt: chunk.content.slice(0, 500) + (chunk.content.length > 500 ? "..." : ""),
      pageStart: chunk.pageNumber || undefined,
      pageEnd: chunk.pageNumber || undefined,
      source: chunk.source,
      similarity: chunk.similarity,
    }));
  } catch (error) {
    console.error("[ComplianceChat] Regulatory document search failed:", error);
    // Continue with just legal chunks if regulatory search fails
  }
  
  // Combine and sort by similarity (relevance)
  const allChunks = [...legalChunks, ...regulatoryChunks]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return allChunks;
}

/**
 * Generate AI answer from legal chunks using OpenAI
 */
async function generateAnswer(
  query: string,
  chunks: Array<{ sectionPath: string; excerpt: string; source?: string }>,
  options?: { userId?: string; organizationId?: string },
): Promise<string> {
  const context = chunks
    .map(
      (chunk, idx) =>
        `[Source ${idx + 1}: ${chunk.sectionPath}]\n${chunk.excerpt}`,
    )
    .join("\n\n---\n\n");

  const hasSources = chunks.length > 0;
  
  // Group sources by type for better context
  const legalSources = chunks.filter(c => c.source === "EUR_LEX");
  const regulatorySources = chunks.filter(c => c.source !== "EUR_LEX");
  
  const systemPrompt = `You are an expert EU compliance assistant with access to multiple regulatory sources. Provide SPECIFIC, ACTIONABLE answers. Users want direct answers, not educational explanations.

AVAILABLE SOURCES:
${hasSources 
  ? `- EU Customs Classification: COMMISSION IMPLEMENTING REGULATION (EU) 2021/1832 (for CN codes, GRI rules, classification guidance)
${regulatorySources.length > 0 ? `- Regulatory Documents: ${[...new Set(regulatorySources.map(s => s.source))].join(", ")} (for food labeling, product safety, customs procedures)` : ""}
- Use the appropriate source(s) based on the question type`
  : `- No specific sources found, but you have knowledge of EU regulations`}

CRITICAL RULES:
${hasSources 
  ? `- ALWAYS prioritize the provided source chunks
- For classification questions: Use EUR_LEX Regulation (EU) 2021/1832
- For labeling questions: Use Ruokavirasto/EU food labeling documents
- For safety questions: Use Tukes/EU safety regulations
- For customs procedures: Use Tulli/EU customs guides
- Cite specific sources when using them (e.g., "According to [Source] - [Section]...")
- Extract and provide ACTUAL codes, requirements, or procedures from sources when available`
  : `- The user's question is not directly covered in the provided sources, but you can use your knowledge`}

MULTI-PART QUESTIONS:
- If the user asks multiple questions (e.g., "what is the CN code AND what permissions do I need?"), answer ALL parts
- Address each question clearly with separate sections or bullet points
- Don't skip any part of the question

ANSWER STYLE:
- For classification questions: Provide the SPECIFIC CN CODE (e.g., "8806 00 00") and brief reasoning. Don't just explain the process.
- For labeling questions: Provide SPECIFIC requirements (e.g., "QUID percentage required for ingredients in product name", "Bilingual labeling required: Finnish and Swedish")
- For safety questions: Provide SPECIFIC requirements (e.g., "CE marking required", "Age warning: 0-3 years")
- For import/export questions: Give SPECIFIC steps, requirements, and procedures. Be actionable.
- For permit/license questions: State clearly if permits are needed, what type, and from which authority. If not needed, state that explicitly.
- For GRI questions: Explain briefly, then show HOW to apply it with examples.
- For CN code lookups: Provide the code AND description immediately.

FORMAT:
- Start with the answer (CN code, procedure, etc.)
- Use clear sections for multi-part questions (e.g., "**Classification:**" and "**Import Requirements:**")
- Then provide brief reasoning/sources
- Be concise - maximum 3-4 paragraphs unless complex
- Use bullet points for lists
- NEVER end with "consult TARIC" or "check with customs" - provide the answer directly

If you must use general knowledge (not in sources), clearly state this but still provide a specific, actionable answer.`;

  const userPrompt = `User Question: ${query}

IMPORTANT: If the user asked multiple questions (e.g., classification AND permissions, OR classification AND import requirements, OR labeling AND safety requirements), you MUST answer ALL parts. Do not skip any question.
Also, user may ask questions that may need your own knowledge that does not contain in the sources. You can answer these questions using your own knowledge.
${hasSources 
  ? `Relevant Sources:
${context}

Please provide a clear, accurate answer addressing ALL parts of the question. Use the appropriate source(s) based on the question type:
- Classification/CN codes/GRI rules → Use EUR_LEX Regulation (EU) 2021/1832 sources
- Food labeling/ingredients/allergens → Use Ruokavirasto/EU food labeling sources
- Product safety/CE marking → Use Tukes/EU safety sources
- Customs procedures/documents → Use Tulli/EU customs sources

If the question covers multiple areas, use sources from all relevant categories. If sources don't cover everything, you may use your knowledge of EU regulations to provide helpful guidance.`
  : `No specific sources were found for this question. Please provide helpful guidance using your knowledge of EU regulations (customs classification, food labeling, product safety, customs procedures, permits/licenses, or tax matters) as appropriate. Address ALL parts of the user's question.`}`;

  try {
    const openai = createFeatureOpenAIClient("Compliance Chat", {
      userId: options?.userId,
      organizationId: options?.organizationId,
    });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    return response.choices[0]?.message?.content || "I couldn't generate an answer. Please try rephrasing your question.";
  } catch (error) {
    console.error("OpenAI chat error:", error);
    throw new Error("Failed to generate answer");
  }
}

/**
 * Main chat action - search legal chunks and generate answer
 */
export async function askComplianceQuestionAction(input: {
  query: string;
  sessionId?: string;
  organizationId: string;
  userId: string;
  classificationIds?: string[];
  labelIds?: string[];
}): Promise<{
  answer: string;
  sources: Array<{
    sectionPath: string;
    excerpt: string;
    pageStart?: number;
    pageEnd?: number;
    source?: string;
  }>;
  sessionId: string;
  messageId: string;
}> {
  const { query, sessionId, organizationId, userId, classificationIds, labelIds } = input;

  if (!query || query.trim().length === 0) {
    throw new Error("Query cannot be empty");
  }

  // Get or create chat session
  let session: any;
  if (sessionId) {
    session = await (prisma as any).chatSession.findFirst({
      where: {
        id: sessionId,
        organizationId,
        userId,
      },
    });
    if (!session) {
      throw new Error("Chat session not found");
    }
  } else {
    session = await (prisma as any).chatSession.create({
      data: {
        organizationId,
        userId,
        title: query.slice(0, 50), // Use first 50 chars as title
      },
    });
  }

  // Save user message
  const userMessage = await (prisma as any).chatMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: query,
    },
  });

  // Search for relevant chunks from both legal sources and regulatory documents
  const chunks = await searchComplianceDocuments(query, 10);

  // Fetch contextual user data if requested
  const attachedContextChunks: Array<{ sectionPath: string; excerpt: string; source?: string }> = [];

  if (classificationIds?.length) {
    const classifications = await (prisma as any).classification.findMany({
      where: { id: { in: classificationIds }, organizationId },
      include: { product: true },
    });

    for (const cls of classifications) {
      const details = [
        `Product: ${cls.product?.name || "Unknown"}`,
        `HS/HTS/CN Code: ${cls.cnCode || cls.htsCode || cls.hsCode || "Unknown"}`,
        `Confidence: ${cls.confidence ? `${cls.confidence}%` : "Unknown"}`,
        `Summary: ${cls.summary || "None"}`,
      ].join("\n");
      
      attachedContextChunks.push({
        sectionPath: `Attached Context: Classification for ${cls.product?.name || "Product"}`,
        excerpt: details,
        source: "USER_CONTEXT",
      });
    }
  }

  if (labelIds?.length) {
    const labels = await (prisma as any).label.findMany({
      where: { id: { in: labelIds }, organizationId },
      include: { product: true },
    });

    for (const lbl of labels) {
      const details = [
        `Product: ${lbl.product?.name || "Unknown"}`,
        `Compliance Score: ${lbl.complianceScore}%`,
        `Data: ${JSON.stringify(lbl.labelData || {})}`
      ].join("\n");

      attachedContextChunks.push({
        sectionPath: `Attached Context: Label for ${lbl.product?.name || "Product"}`,
        excerpt: details,
        source: "USER_CONTEXT",
      });
    }
  }

  const combinedChunks = [...attachedContextChunks, ...chunks];

  // Always generate answer - LLM can use its knowledge if sources don't contain the answer
  const answer = await generateAnswer(query, combinedChunks, { userId, organizationId });

  // Save assistant message
  const assistantMessage = await (prisma as any).chatMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: answer,
      sources: combinedChunks as any,
    },
  });

  // Update session timestamp
  await (prisma as any).chatSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return {
    answer,
    sources: combinedChunks,
    sessionId: session.id,
    messageId: assistantMessage.id,
  };
}

/**
 * Get chat session with messages
 */
export async function getChatSessionAction(input: {
  sessionId: string;
  organizationId: string;
  userId: string;
}) {
  const session = await (prisma as any).chatSession.findFirst({
    where: {
      id: input.sessionId,
      organizationId: input.organizationId,
      userId: input.userId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) {
    throw new Error("Chat session not found");
  }

  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: (session.messages as any[]).map((msg: any) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      sources: msg.sources as Array<{
        sectionPath: string;
        excerpt: string;
        pageStart?: number;
        pageEnd?: number;
      }> | undefined,
      createdAt: msg.createdAt,
    })),
  };
}

/**
 * List user's chat sessions
 */
export async function listChatSessionsAction(input: {
  organizationId: string;
  userId: string;
  limit?: number;
}) {
  const sessions = await (prisma as any).chatSession.findMany({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
    },
    orderBy: { updatedAt: "desc" },
    take: input.limit || 20,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1, // Get last message for preview
      },
    },
  });

  return (sessions as any[]).map((session: any) => ({
    id: session.id,
    title: session.title || "New Chat",
    lastMessage: session.messages[0]?.content || null,
    updatedAt: session.updatedAt,
    createdAt: session.createdAt,
  }));
}

/**
 * Delete a chat session
 */
export async function deleteChatSessionAction(input: {
  sessionId: string;
  organizationId: string;
  userId: string;
}): Promise<{ success: boolean }> {
  const { sessionId, organizationId, userId } = input;

  // Verify session belongs to user and organization
  const session = await (prisma as any).chatSession.findFirst({
    where: {
      id: sessionId,
      organizationId,
      userId,
    },
  });

  if (!session) {
    throw new Error("Chat session not found or access denied");
  }

  // Delete the session (messages will be cascade deleted)
  await (prisma as any).chatSession.delete({
    where: { id: sessionId },
  });

  return { success: true };
}

/**
 * Get example questions users can ask
 */
export async function getExampleQuestions(): Promise<Array<{
  question: string;
  category: string;
}>> {
  return [
    {
      question: "What is CN code 8806 00 00?",
      category: "CN Code",
    },
    {
      question: "How does GRI 1 work?",
      category: "GRI Rules",
    },
    {
      question: "What is GRI 3 about sets?",
      category: "GRI Rules",
    },
    {
      question: "What are the notes for Chapter 88?",
      category: "Chapter Notes",
    },
    {
      question: "What is the difference between heading 8806 and 9503?",
      category: "Classification",
    },
    {
      question: "What are end-use arrangements?",
      category: "Special Provisions",
    },
    {
      question: "How are incomplete products classified?",
      category: "Classification",
    },
    {
      question: "What is the packing rule?",
      category: "General Rules",
    },
    {
      question: "What products qualify for civil aircraft end-use?",
      category: "End-Use",
    },
    {
      question: "What exclusions apply to heading 9503?",
      category: "Heading Notes",
    },
  ];
}

