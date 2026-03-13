import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeDigits(input: string) {
  return input.replace(/\D/g, "");
}

function tokenizeQuery(input: string) {
  const stopwords = new Set([
    "the",
    "and",
    "or",
    "for",
    "with",
    "from",
    "into",
    "of",
    "to",
    "in",
    "on",
    "a",
    "an",
    "other",
    "goods",
    "product",
    "products",
    "food",
    "drink",
  ]);

  return input
    .toLowerCase()
    .split(/[\s,;:/()]+/g)
    .map((t) => t.replace(/[^a-z0-9-]/g, ""))
    .filter((t) => t.length >= 3 && !stopwords.has(t));
}

function formatRuling(r: any) {
  const displayDescription = r.descriptionEn || r.description;
  const title =
    r.titleEn ||
    displayDescription.substring(0, 100) + (displayDescription.length > 100 ? "..." : "");

  return {
    id: r.id,
    market: r.country,
    reference: r.reference,
    title,
    body: displayDescription,
    originalBody: r.description,
    isTranslated: !!r.descriptionEn,
    category: r.category,
    htsCode: r.hsCode,
    issuedAt: r.startDate ? new Date(r.startDate).toISOString() : null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    justification: r.justificationEn || r.justification,
    originalJustification: r.justification,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = (url.searchParams.get("market") || "FI").toUpperCase();
  const htsCode = url.searchParams.get("htsCode") || url.searchParams.get("hsCode") || null;
  const category = url.searchParams.get("category") || null;
  const search = url.searchParams.get("search") || url.searchParams.get("q") || null;
  const includeRelated = url.searchParams.get("includeRelated") === "1";
  const suggest = url.searchParams.get("suggest") === "1";
  const limit = clampInt(url.searchParams.get("limit"), 12, 1, 24);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 10_000);

  const where: any = {};

  if (market && market !== "ALL") {
    where.country = market;
  }

  if (category && category !== "all" && category !== "ALL") {
    where.category = category;
  }

  if (htsCode) {
    const normalized = normalizeDigits(htsCode);
    if (normalized.length > 0) {
      where.hsCode = { startsWith: normalized };
    }
  }

  if (suggest) {
    const rows = (await prisma.btiRuling.findMany({
      where,
      orderBy: { startDate: "desc" },
      take: Math.min(80, limit * 12),
      select: {
        titleEn: true,
        descriptionEn: true,
        description: true,
        keywords: true,
        hsCode: true,
      } as any,
    })) as unknown as Array<{
      titleEn: string | null;
      descriptionEn: string | null;
      description: string;
      keywords: string[];
      hsCode: string;
    }>;

    const seen = new Set<string>();
    const suggestions: Array<{ label: string; query: string }> = [];

    for (const r of rows) {
      if (suggestions.length >= limit) break;

      const titleSource = (r.titleEn || r.descriptionEn || r.description || "").trim();
      const titleTokens = titleSource.split(/\s+/g).filter(Boolean);
      const shortTitle = titleTokens.slice(0, 6).join(" ");
      const label = shortTitle.replace(/[.,;:]+$/g, "");

      const keywordCandidates = Array.isArray(r.keywords) ? r.keywords : [];
      const keywordPhrase = keywordCandidates
        .map((k: string) => k.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");

      const hsPrefix = typeof r.hsCode === "string" ? r.hsCode.replace(/\D/g, "").slice(0, 4) : "";
      const query = keywordPhrase || (hsPrefix ? hsPrefix : label);
      const key = query.toLowerCase();

      if (query.length < 3) continue;
      if (seen.has(key)) continue;

      seen.add(key);
      suggestions.push({ label, query });
    }

    return NextResponse.json(
      {
        suggestions,
        limit,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  }

  const q = search?.trim() ?? "";
  const hasSearch = q.length > 0;
  const qDigits = hasSearch ? normalizeDigits(q) : "";
  const terms = hasSearch ? tokenizeQuery(q) : [];

  if (hasSearch) {
    const or: any[] = [
      { reference: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { justification: { contains: q, mode: "insensitive" } },
      { descriptionEn: { contains: q, mode: "insensitive" } },
      { titleEn: { contains: q, mode: "insensitive" } },
      { justificationEn: { contains: q, mode: "insensitive" } },
    ];

    if (qDigits.length >= 2) {
      or.push({ hsCode: { startsWith: qDigits } });
    }

    if (terms.length > 0) {
      or.push({ keywords: { hasSome: terms } });
      for (const term of terms.slice(0, 6)) {
        or.push({ titleEn: { contains: term, mode: "insensitive" } });
        or.push({ descriptionEn: { contains: term, mode: "insensitive" } });
        or.push({ description: { contains: term, mode: "insensitive" } });
      }
    }

    where.OR = or;
  }

  const [rulings, total] = await Promise.all([
    prisma.btiRuling.findMany({
      where,
      orderBy: { startDate: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        reference: true,
        country: true,
        hsCode: true,
        description: true,
        descriptionEn: true,
        titleEn: true,
        category: true,
        startDate: true,
        createdAt: true,
        updatedAt: true,
        justification: true,
        justificationEn: true,
        keywords: true,
      } as any,
    }),
    prisma.btiRuling.count({ where }),
  ]);

  let merged = rulings;
  let primaryCount = rulings.length;

  if (includeRelated && hasSearch && offset === 0 && rulings.length < limit) {
    const baseIds = new Set<string>(rulings.map((r) => r.id));
    const seed = rulings[0] as any | undefined;
    const seedPrefix =
      seed?.hsCode && typeof seed.hsCode === "string" ? normalizeDigits(seed.hsCode).slice(0, 4) : "";
    const seedCategory = typeof seed?.category === "string" ? seed.category : null;
    const seedKeywords = Array.isArray(seed?.keywords) ? seed.keywords : [];
    const relatedTerms = Array.from(new Set([...terms, ...seedKeywords].slice(0, 12)));

    const relatedOr: any[] = [];
    if (seedPrefix.length >= 2) relatedOr.push({ hsCode: { startsWith: seedPrefix } });
    if (seedCategory) relatedOr.push({ category: seedCategory });
    if (relatedTerms.length > 0) relatedOr.push({ keywords: { hasSome: relatedTerms } });

    if (relatedOr.length > 0) {
      const related = await prisma.btiRuling.findMany({
        where: {
          ...where,
          id: { notIn: Array.from(baseIds) },
          OR: relatedOr,
        },
        orderBy: { startDate: "desc" },
        take: limit - rulings.length,
        select: {
          id: true,
          reference: true,
          country: true,
          hsCode: true,
          description: true,
          descriptionEn: true,
          titleEn: true,
          category: true,
          startDate: true,
          createdAt: true,
          updatedAt: true,
          justification: true,
          justificationEn: true,
          keywords: true,
        } as any,
      });

      merged = [...rulings, ...related];
    }
  }

  return NextResponse.json(
    {
      rulings: merged.map(formatRuling),
      total,
      limit,
      offset,
      primaryCount,
    },
    {
      headers: {
        "Cache-Control": hasSearch ? "no-store" : "public, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}
