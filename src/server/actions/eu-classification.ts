"use server";

import { euClassificationEngine } from "@/lib/eu/classification-engine";
import { openaiService } from "@/lib/eu/openai-service";
import type { EUProductAttributes } from "@/lib/eu/types";
import { prisma } from "@/lib/prisma";
import { MarketCode, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";
import { join } from "path";

function normalizeCodeDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function isValidCnCode(value?: string | null) {
  const normalized = normalizeCodeDigits(value);
  return normalized.length === 8 && normalized !== "00000000";
}

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

  const normalizedCnCode = normalizeCodeDigits(classificationResult.cnCode).slice(0, 8);
  const hasValidCnCode = isValidCnCode(normalizedCnCode);
  const cnCode = hasValidCnCode ? normalizedCnCode : null;
  const hsCode = cnCode ? cnCode.substring(0, 6) : null;
  const htsCode = cnCode ? cnCode.padEnd(10, "0") : null;
  const requiresReview = !hasValidCnCode || classificationResult.confidence < 0.8;
  const summary = cnCode
    ? `CN Code: ${cnCode}. ${classificationResult.sources[0]?.excerpt || ""}`
    : "Classification pending manual review. No valid CN code was produced from the current evidence.";

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
          summary,
          reasoningTrail: classificationResult.reasoningTrail as unknown as Prisma.InputJsonValue,
          exclusionNotes: classificationResult.exclusionNotes as string[],
          requiresReview,
          status: requiresReview ? "NEEDS_REVIEW" : "DRAFT",
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
          summary,
          reasoningTrail: classificationResult.reasoningTrail as unknown as Prisma.InputJsonValue,
          exclusionNotes: classificationResult.exclusionNotes as string[],
          requiresReview,
          status: requiresReview ? "NEEDS_REVIEW" : "DRAFT",
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
      metadata: source.metadata ? (source.metadata as Prisma.InputJsonValue) : undefined,
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

  if (cnCode && classificationResult.dutySummary) {
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
  } else {
    await prisma.dutySummary.deleteMany({
      where: { classificationId: classification.id },
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

