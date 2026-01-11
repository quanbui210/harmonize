"use server";

import { euClassificationEngine } from "@/lib/eu/classification-engine";
import { openaiService } from "@/lib/eu/openai-service";
import type { EUProductAttributes } from "@/lib/eu/types";
import { prisma } from "@/lib/prisma";
import { MarketCode } from "@prisma/client";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function classifyProductForEUAction(
  productId: string,
  organizationId: string,
) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId,
    },
    include: {
      materials: true,
      referenceFiles: true,
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const productAttributes: EUProductAttributes = {
    name: product.name,
    description: product.description,
    intendedUse: product.intendedUse || undefined,
    materials: product.materials.map((m) => ({
      material: m.material,
      percentage: Number(m.percentage),
    })),
    composition: (product.metadata as { composition?: Record<string, unknown> })?.composition,
    technicalSpecs: (product.metadata as { technicalSpecs?: Record<string, unknown> })?.technicalSpecs,
  };

  const aiAnalysis = await openaiService.analyzeProduct(productAttributes);
  const classificationResult = await euClassificationEngine.classifyProduct(
    productAttributes,
  );

  const cnCode = classificationResult.cnCode;
  const hsCode = cnCode.substring(0, 6); // Extract HS code (first 6 digits)
  const htsCode = cnCode.padEnd(10, "0");

  const existing = await prisma.classification.findFirst({
    where: {
      productId,
      organizationId,
      market: MarketCode.EU,
    },
  });

  const classification = existing
    ? await prisma.classification.update({
        where: { id: existing.id },
        data: {
          hsCode,
          htsCode,
          confidence: classificationResult.confidence,
          summary: `CN Code: ${cnCode}. ${classificationResult.sources[0]?.excerpt || ""}`,
          reasoningTrail: classificationResult.reasoningTrail as unknown,
          exclusionNotes: classificationResult.exclusionNotes as unknown,
          requiresReview: classificationResult.confidence < 0.8,
          status: classificationResult.confidence < 0.8 ? "NEEDS_REVIEW" : "DRAFT",
        },
      })
    : await prisma.classification.create({
        data: {
          organizationId,
          productId,
          market: MarketCode.EU,
          hsCode,
          htsCode,
          confidence: classificationResult.confidence,
          summary: `CN Code: ${cnCode}. ${classificationResult.sources[0]?.excerpt || ""}`,
          reasoningTrail: classificationResult.reasoningTrail as unknown,
          exclusionNotes: classificationResult.exclusionNotes as unknown,
          requiresReview: classificationResult.confidence < 0.8,
          status: classificationResult.confidence < 0.8 ? "NEEDS_REVIEW" : "DRAFT",
        },
      });

  await prisma.classificationSource.deleteMany({
    where: { classificationId: classification.id },
  });

  await prisma.classificationSource.createMany({
    data: classificationResult.sources.map((source) => ({
      classificationId: classification.id,
      sourceType: source.sourceType,
      referenceId: source.referenceId,
      excerpt: source.excerpt,
      metadata: source.metadata as unknown,
    })),
  });

  await prisma.riskFlag.deleteMany({
    where: { classificationId: classification.id },
  });

  await prisma.riskFlag.createMany({
    data: classificationResult.riskFlags.map((flag) => ({
      classificationId: classification.id,
      riskType: flag.type === "QUOTA" ? "PERMIT" : flag.type === "ANTI_DUMPING" ? "AD" : "OTHER",
      label: flag.label,
      details: flag.details,
    })),
  });

  if (classificationResult.dutySummary) {
    await prisma.dutySummary.upsert({
      where: { classificationId: classification.id },
      create: {
        classificationId: classification.id,
        baseValue: 0,
        dutyRate: classificationResult.dutySummary.baseDutyRate,
        vatRate: classificationResult.dutySummary.vatRate,
        estimatedDuty: 0,
      },
      update: {
        dutyRate: classificationResult.dutySummary.baseDutyRate,
        vatRate: classificationResult.dutySummary.vatRate,
      },
    });
  }

  return {
    classification,
    cnCode,
    confidence: classificationResult.confidence,
    sources: classificationResult.sources,
    riskFlags: classificationResult.riskFlags,
  };
}

export async function generateReasoningDossierAction(
  classificationId: string,
  organizationId: string,
) {
  const classification = await prisma.classification.findFirst({
    where: {
      id: classificationId,
      organizationId,
    },
    include: {
      product: {
        include: {
          materials: true,
        },
      },
      sources: true,
    },
  });

  if (!classification) {
    throw new Error("Classification not found");
  }

  if (classification.market !== MarketCode.EU) {
    throw new Error("Dossier generation only available for EU classifications");
  }

  const productAttributes: EUProductAttributes = {
    name: classification.product.name,
    description: classification.product.description,
    intendedUse: classification.product.intendedUse || undefined,
    materials: classification.product.materials.map((m) => ({
      material: m.material,
      percentage: Number(m.percentage),
    })),
  };

  const dossierContent = await openaiService.generateReasoningDossier(
    productAttributes,
    {
      cnCode: classification.htsCode || "",
      reasoningTrail: (classification.reasoningTrail as Array<{
        griRule: string;
        level: string;
        selection: string;
        rationale: string;
        score: number;
      }>) || [],
      sources: classification.sources.map((s) => ({
        sourceType: s.sourceType,
        referenceId: s.referenceId || undefined,
        excerpt: s.excerpt,
      })),
    },
  );

  const contentHash = createHash("sha256")
    .update(dossierContent)
    .digest("hex");

  const fileName = `dossier-${classificationId}-${Date.now()}.pdf`;
  const storagePath = join(process.cwd(), "storage", "dossiers", fileName);

  await writeFile(storagePath, dossierContent, "utf-8");

  const dossier = await prisma.dossier.upsert({
    where: { classificationId: classification.id },
    create: {
      classificationId: classification.id,
      storagePath,
      sha256: contentHash,
    },
    update: {
      storagePath,
      sha256: contentHash,
      generatedAt: new Date(),
    },
  });

  return dossier;
}

