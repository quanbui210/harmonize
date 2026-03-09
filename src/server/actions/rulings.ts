"use server";

import { prisma } from "@/lib/prisma";

export async function listRulingsAction(input: {
  market?: string;
  htsCode?: string;
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  // For now, BTI rulings store country as string ('FI', 'DE') instead of MarketCode enum
  // So we filter by country if market is provided
  if (input.market) {
    if (input.market === 'all') {
      // No filter needed for 'all', or maybe we want to filter to only valid BTI countries?
      // For now, let 'all' return everything.
    } else {
      where.country = input.market;
    }
  } else {
    // Default to FI if no market specified
    where.country = "FI";
  }

  if (input.category && input.category !== "all") {
    where.category = input.category;
  }

  if (input.htsCode) {
    where.hsCode = {
      startsWith: input.htsCode,
    };
  }

  if (input.search) {
    where.OR = [
      { reference: { contains: input.search, mode: "insensitive" } },
      { description: { contains: input.search, mode: "insensitive" } },
      { justification: { contains: input.search, mode: "insensitive" } },
    ];
  }

  // Query BtiRuling table instead of BindingRuling
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

  return {
    rulings: rulings.map((r: any) => {
      // Prefer AI title, then English description, then truncated description
      const displayDescription = r.descriptionEn || r.description;
      const title = r.titleEn || displayDescription.substring(0, 100) + (displayDescription.length > 100 ? "..." : "");
      
      return {
        id: r.id,
        market: r.country, // Map country to market for UI compatibility
        reference: r.reference,
        title: title,
        body: displayDescription,
        originalBody: r.description, // Keep original for toggle
        isTranslated: !!r.descriptionEn,
        category: r.category,
        htsCode: r.hsCode,
        issuedAt: r.startDate ? new Date(r.startDate).toISOString() : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      };
    }),
    total,
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

