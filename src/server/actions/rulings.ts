"use server";

import { prisma } from "@/lib/prisma";
import { MarketCode } from "@prisma/client";

export async function listRulingsAction(input: {
  market?: MarketCode;
  htsCode?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (input.market) {
    where.market = input.market;
  }

  if (input.htsCode) {
    where.htsCode = {
      startsWith: input.htsCode,
    };
  }

  if (input.search) {
    where.OR = [
      { reference: { contains: input.search, mode: "insensitive" } },
      { title: { contains: input.search, mode: "insensitive" } },
      { body: { contains: input.search, mode: "insensitive" } },
    ];
  }

  const [rulings, total] = await Promise.all([
    prisma.bindingRuling.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      take: input.limit || 50,
      skip: input.offset || 0,
    }),
    prisma.bindingRuling.count({ where }),
  ]);

  return {
    rulings: rulings.map((r) => ({
      id: r.id,
      market: r.market,
      reference: r.reference,
      title: r.title,
      body: r.body,
      htsCode: r.htsCode,
      issuedAt: r.issuedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total,
  };
}

export async function getRulingAction(rulingId: string) {
  const ruling = await prisma.bindingRuling.findUnique({
    where: { id: rulingId },
  });

  if (!ruling) {
    throw new Error("Ruling not found");
  }

  return {
    id: ruling.id,
    market: ruling.market,
    reference: ruling.reference,
    title: ruling.title,
    body: ruling.body,
    htsCode: ruling.htsCode,
    issuedAt: ruling.issuedAt,
    createdAt: ruling.createdAt,
    updatedAt: ruling.updatedAt,
  };
}

/**
 * Ingest binding rulings into the database
 * This is for importing official rulings from customs authorities
 */
export async function ingestRulingsAction(input: {
  rulings: Array<{
    market: MarketCode;
    reference: string;
    title: string;
    body: string;
    htsCode: string;
    issuedAt?: Date;
  }>;
}) {
  const results = [];

  for (const ruling of input.rulings) {
    try {
      const result = await prisma.bindingRuling.upsert({
        where: { reference: ruling.reference },
        update: {
          title: ruling.title,
          body: ruling.body,
          htsCode: ruling.htsCode,
          issuedAt: ruling.issuedAt,
          updatedAt: new Date(),
        },
        create: {
          market: ruling.market,
          reference: ruling.reference,
          title: ruling.title,
          body: ruling.body,
          htsCode: ruling.htsCode,
          issuedAt: ruling.issuedAt,
        },
      });
      results.push({ success: true, reference: ruling.reference, id: result.id });
    } catch (error) {
      results.push({
        success: false,
        reference: ruling.reference,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    total: input.rulings.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

