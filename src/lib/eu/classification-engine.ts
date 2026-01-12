import type {
  EUProductAttributes,
  EUClassificationResult,
  CNCode,
  GRIReasoningStep,
} from "./types";
import { griEngine } from "./gri-engine";
import { taricClient } from "./taric-client";
import { prisma } from "@/lib/prisma";
import { MarketCode } from "@prisma/client";

export class EUClassificationEngine {
  async classifyProduct(
    product: EUProductAttributes,
  ): Promise<EUClassificationResult> {
    const griResult = await griEngine.classify(product);
    const cnCode = griResult.cnCode;

    const [taricMeasure, rulings, legalNotes] = await Promise.all([
      taricClient.getDutyRate(cnCode),
      this.findRelevantRulings(cnCode, product),
      this.findRelevantLegalNotes(cnCode),
    ]);

    const sources = this.buildSources(rulings, legalNotes, taricMeasure);
    const riskFlags = this.identifyRiskFlags(taricMeasure, rulings);
    const exclusionNotes = this.buildExclusionNotes(griResult.reasoningTrail);

    const dutySummary = taricMeasure
      ? {
          baseDutyRate: taricMeasure.dutyRate,
          vatRate: taricMeasure.vatRate || 20.0,
          additionalMeasures: taricMeasure.additionalDuty
            ? [
                {
                  type: "ADDITIONAL_DUTY",
                  rate: taricMeasure.additionalDuty,
                },
              ]
            : undefined,
        }
      : {
          baseDutyRate: 0,
          vatRate: 20.0,
        };

    return {
      cnCode,
      confidence: griResult.confidence,
      reasoningTrail: griResult.reasoningTrail,
      sources,
      dutySummary,
      riskFlags,
      exclusionNotes,
    };
  }

  private async findRelevantRulings(
    cnCode: CNCode,
    product: EUProductAttributes,
  ) {
    const searchTerms = `${product.name} ${product.description}`.toLowerCase();

    return prisma.bindingRuling.findMany({
      where: {
        market: MarketCode.EU,
        OR: [
          { htsCode: { startsWith: cnCode.substring(0, 4) } },
          {
            title: { contains: searchTerms.split(" ")[0], mode: "insensitive" },
          },
          {
            body: { contains: searchTerms.split(" ")[0], mode: "insensitive" },
          },
        ],
      },
      take: 5,
      orderBy: { issuedAt: "desc" },
    });
  }

  private async findRelevantLegalNotes(cnCode: CNCode) {
    const chapter = parseInt(cnCode.substring(0, 2), 10);
    const heading = parseInt(cnCode.substring(2, 4), 10);

    return prisma.legalNote.findMany({
      where: {
        OR: [
          { chapter, heading: null },
          { chapter, heading },
        ],
      },
      take: 10,
    });
  }

  private buildSources(
    rulings: Array<{ reference: string; title: string; body: string }>,
    legalNotes: Array<{ noteKey: string | null; content: string }>,
    taricMeasure: { cnCode: string; dutyRate: number; vatRate?: number } | null,
  ) {
    const sources: EUClassificationResult["sources"] = [];

    if (taricMeasure) {
      sources.push({
        sourceType: "TARIC",
        referenceId: taricMeasure.cnCode,
        excerpt: `Duty rate: ${taricMeasure.dutyRate}%, VAT: ${taricMeasure.vatRate || 20}%`,
        metadata: {
          dutyRate: taricMeasure.dutyRate,
          vatRate: taricMeasure.vatRate,
        },
      });
    }

    for (const ruling of rulings) {
      sources.push({
        sourceType: "BINDING_RULING",
        referenceId: ruling.reference,
        excerpt: ruling.title,
        metadata: {
          fullText: ruling.body.substring(0, 500),
        },
      });
    }

    for (const note of legalNotes.slice(0, 3)) {
      sources.push({
        sourceType: "LEGAL_NOTE",
        referenceId: note.noteKey || undefined,
        excerpt: note.content.substring(0, 200),
      });
    }

    return sources;
  }

  private identifyRiskFlags(
    taricMeasure: {
      quota?: { quantity: number; unit: string };
      additionalDuty?: number;
    } | null,
    rulings: Array<{ reference: string; title: string }>,
  ): EUClassificationResult["riskFlags"] {
    const flags: EUClassificationResult["riskFlags"] = [];

    if (taricMeasure?.quota) {
      flags.push({
        type: "QUOTA",
        label: "Quota Restriction",
        details: `Quota limit: ${taricMeasure.quota.quantity} ${taricMeasure.quota.unit}`,
      });
    }

    if (taricMeasure?.additionalDuty && taricMeasure.additionalDuty > 0) {
      flags.push({
        type: "ANTI_DUMPING",
        label: "Additional Duty Applied",
        details: `Additional duty rate: ${taricMeasure.additionalDuty}%`,
      });
    }

    if (rulings.length > 0) {
      flags.push({
        type: "OTHER",
        label: "Binding Rulings Found",
        details: `${rulings.length} relevant binding ruling(s) found. Review recommended.`,
      });
    }

    return flags;
  }

  private buildExclusionNotes(
    reasoningTrail: GRIReasoningStep[],
  ): string[] {
    const notes: string[] = [];

    for (const step of reasoningTrail) {
      if (step.excludedOptions && step.excludedOptions.length > 0) {
        notes.push(
          `Excluded ${step.excludedOptions.join(", ")} based on ${step.level} analysis`,
        );
      }
    }

    return notes;
  }
}

export const euClassificationEngine = new EUClassificationEngine();

