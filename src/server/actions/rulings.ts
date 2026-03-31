"use server";

import { prisma } from "@/lib/prisma";

export async function listRulingsAction(input: {
  market?: string;
  htsCode?: string;
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
  includeCrossMarketFallback?: boolean;
}) {
  const selectedMarket = input.market || "FI";
  const includeCrossMarketFallback = input.includeCrossMarketFallback !== false;
  const hasSearchConstraints = Boolean(input.htsCode || input.search);

  const buildWhere = (market: string, includeCategory: boolean, htsCodeOverride?: string) => {
    const where: any = {};

    if (market !== "all") {
      where.country = market;
    }

    if (includeCategory && input.category && input.category !== "all") {
      where.category = input.category;
    }

    const codePrefix = htsCodeOverride ?? input.htsCode;
    if (codePrefix) {
      where.hsCode = {
        startsWith: codePrefix,
      };
    }

    if (input.search) {
      where.OR = [
        { reference: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } },
        { justification: { contains: input.search, mode: "insensitive" } },
      ];
    }

    return where;
  };

  const queryRulings = async (where: any) => {
    const [rulings, total] = await Promise.all([
      prisma.btiRuling.findMany({
        where,
        orderBy: { startDate: "desc" },
        take: input.limit || 50,
        skip: input.offset || 0,
        select: {
          id: true,
          reference: true,
          country: true,
          hsCode: true,
          description: true,
          // @ts-ignore: New fields
          descriptionEn: true,
          // @ts-ignore: New fields
          titleEn: true,
          // @ts-ignore: New fields
          category: true,
          startDate: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      prisma.btiRuling.count({ where }),
    ]);

    return { rulings, total };
  };

  const primaryWhere = buildWhere(selectedMarket, true);
  let { rulings, total } = await queryRulings(primaryWhere);

  let effectiveMarket = selectedMarket;
  let usedCrossMarketFallback = false;
  let fallbackReason: "NO_RESULTS_IN_SELECTED_MARKET" | null = null;

  if (
    includeCrossMarketFallback &&
    selectedMarket !== "all" &&
    hasSearchConstraints &&
    total === 0
  ) {
    const fallbackHtsPrefix = input.htsCode ? input.htsCode.slice(0, 4) : undefined;
    const fallbackWhere = buildWhere("all", false, fallbackHtsPrefix);
    const fallbackResult = await queryRulings(fallbackWhere);
    if (fallbackResult.total > 0) {
      rulings = fallbackResult.rulings;
      total = fallbackResult.total;
      effectiveMarket = "all";
      usedCrossMarketFallback = true;
      fallbackReason = "NO_RESULTS_IN_SELECTED_MARKET";
    }
  }

  return {
    rulings: rulings.map((r: any) => {
      const displayDescription = r.descriptionEn || r.description;
      const title = r.titleEn || displayDescription.substring(0, 100) + (displayDescription.length > 100 ? "..." : "");
      
      return {
        id: r.id,
        market: r.country,
        reference: r.reference,
        title: title,
        body: displayDescription,
        originalBody: r.description,
        isTranslated: !!r.descriptionEn,
        category: r.category,
        htsCode: r.hsCode,
        issuedAt: r.startDate ? new Date(r.startDate).toISOString() : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      };
    }),
    total,
    requestedMarket: selectedMarket,
    effectiveMarket,
    usedCrossMarketFallback,
    fallbackReason,
  };
}

export async function getRulingAction(rulingId: string) {
  // Try to find in BtiRuling first
  const btiRuling = await prisma.btiRuling.findUnique({
    where: { id: rulingId },
  });

  if (btiRuling) {
    // Cast to any to access new fields safely
    const r = btiRuling as any;
    const displayDescription = r.descriptionEn || r.description;
    const title = r.titleEn || displayDescription.substring(0, 100) + (displayDescription.length > 100 ? "..." : "");
    
    return {
      id: r.id,
      market: r.country,
      reference: r.reference,
      title: title,
      body: displayDescription,
      originalBody: r.description,
      isTranslated: !!r.descriptionEn,
      category: r.category,
      keywords: r.keywords,
      justification: r.justificationEn || r.justification,
      originalJustification: r.justification,
      htsCode: r.hsCode,
      issuedAt: r.startDate ? new Date(r.startDate).toISOString() : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  // Fallback to BindingRuling (legacy table)
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
    issuedAt: ruling.issuedAt ? new Date(ruling.issuedAt).toISOString() : null,
    createdAt: ruling.createdAt ? new Date(ruling.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: ruling.updatedAt ? new Date(ruling.updatedAt).toISOString() : new Date().toISOString(),
  };
}

/**
 * Ingest binding rulings into the database
 * This is for importing official rulings from customs authorities
 */
export async function ingestRulingsAction(input: {
  rulings: Array<{
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
          market: "EU",
          issuedAt: ruling.issuedAt,
          updatedAt: new Date(),
        },
        create: {
          reference: ruling.reference,
          title: ruling.title,
          body: ruling.body,
          htsCode: ruling.htsCode,
          market: "EU",
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

export async function getRulingCategoriesAction(market: string = "FI") {
  const categories = await prisma.btiRuling.findMany({
    where: {
      country: market,
      category: { not: null },
    },
    select: {
      category: true,
    },
    distinct: ["category"],
  });

  return categories
    .map((c) => c.category)
    .filter((c): c is string => !!c)
    .sort();
}

