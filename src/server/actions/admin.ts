
"use server";

import { requireSystemAdmin } from "@/lib/auth/admin";
import { ingestBtiCsv } from "@/lib/bti/ingestion";
import { enrichPendingRulings } from "@/lib/bti/enrichment";
import { prisma } from "@/lib/prisma";
import { createFeatureOpenAIClient } from "@/lib/langfuse/openai-wrapper";

export async function uploadBtiCsvAction(formData: FormData) {
  await requireSystemAdmin();

  const file = formData.get("csvFile") as File;
  if (!file) {
    throw new Error("No file uploaded");
  }

  const text = await file.text();
  const processedCount = await ingestBtiCsv(text);

  return processedCount;
}

export async function triggerEnrichmentAction() {
  await requireSystemAdmin();
  
  // Process a batch of 10
  const processedCount = await enrichPendingRulings(10);
  
  return processedCount;
}

export async function getSystemStatsAction() {
  await requireSystemAdmin();

  const [totalUsers, totalRulings, unenrichedRulings] = await Promise.all([
    prisma.user.count(),
    prisma.btiRuling.count(),
    prisma.btiRuling.count({
      where: { 
        // @ts-ignore
        titleEn: null 
      }
    })
  ]);

  return {
    totalUsers,
    totalRulings,
    unenrichedRulings,
    enrichmentProgress: totalRulings > 0 
      ? Math.round(((totalRulings - unenrichedRulings) / totalRulings) * 100) 
      : 0
  };
}

export async function getUsersAction() {
  await requireSystemAdmin();

  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
        _count: {
            select: {
                createdOrganizations: true
            }
        }
    }
  });
}

// New action for manual creation
export async function createBtiRulingAction(data: {
  reference: string;
  country: string;
  hsCode: string;
  description: string;
  justification: string;
  startDate: Date;
  endDate?: Date;
  language: string;
}) {
  await requireSystemAdmin();

  // 1. Generate embedding immediately
  const openai = createFeatureOpenAIClient("BTI Manual Ingestion");
  let embeddingVector: number[] = [];
  
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: data.description,
    });
    embeddingVector = response.data[0].embedding;
  } catch (error) {
    console.error("Failed to generate embedding for manual ruling", error);
    // We can proceed without embedding or fail - let's fail to ensure quality
    throw new Error("Failed to generate AI embedding. Please try again.");
  }

  // 2. Insert into DB
  // Using executeRaw because Prisma doesn't support vector type natively yet in create()
  await prisma.$executeRaw`
    INSERT INTO "BtiRuling" (
      id,
      reference,
      country,
      "hsCode",
      description,
      justification,
      "startDate",
      "endDate",
      language,
      "descriptionVector",
      "createdAt",
      "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      ${data.reference},
      ${data.country},
      ${data.hsCode},
      ${data.description},
      ${data.justification},
      ${data.startDate},
      ${data.endDate},
      ${data.language},
      ${JSON.stringify(embeddingVector)}::vector,
      NOW(),
      NOW()
    )
  `;

  // 3. Trigger enrichment immediately for this specific ruling?
  // Or just let the batch process pick it up. Let's let batch pick it up for simplicity.
  // But we could call enrichPendingRulings(1) here if we wanted instant feedback.

  return { success: true };
}
