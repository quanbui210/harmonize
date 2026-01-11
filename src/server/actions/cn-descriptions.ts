"use server";

import { prisma } from "@/lib/prisma";
import { taricClient } from "@/lib/eu/taric-client";
import { MarketCode } from "@prisma/client";
import type { CNCode } from "@/lib/eu/types";

/**
 * Get CN code description from database or TARIC API
 * Phase 1: Quick win - Use TARIC API to fetch and cache descriptions
 */
export async function getCNCodeDescription(
  cnCode: CNCode,
  market: MarketCode = MarketCode.EU,
): Promise<string> {
  // First, try to get from database cache
  const cached = await prisma.cnCodeDescription.findUnique({
    where: {
      cnCode,
    },
  });

  if (cached && cached.description) {
    return cached.description;
  }

  // If not in cache, fetch from TARIC API
  try {
    const description = await taricClient.getDescriptionForCode(cnCode);

    if (description) {
      // Store in database for future use
      await prisma.cnCodeDescription.upsert({
        where: { cnCode },
        create: {
          cnCode,
          market,
          description,
          source: "TARIC",
        },
        update: {
          description,
          source: "TARIC",
          fetchedAt: new Date(),
        },
      });

      return description;
    }
  } catch (error) {
    console.error(`Failed to fetch description for CN ${cnCode}:`, error);
  }

  const eurlexDescription = await getCNDescriptionFromEurLexChunks(cnCode);
  if (eurlexDescription) {
    await prisma.cnCodeDescription.upsert({
      where: { cnCode },
      create: {
        cnCode,
        market,
        description: eurlexDescription,
        source: "EUR_LEX",
      },
      update: {
        description: eurlexDescription,
        source: "EUR_LEX",
        fetchedAt: new Date(),
      },
    });
    return eurlexDescription;
  }

  return `CN Code ${cnCode} - Description not available`;
}

function formatCnVariants(cnCode: string) {
  const digits = cnCode.replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
  const spaced = `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
  const dotted = `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  const hs6 = digits.slice(0, 6);
  return { digits, spaced, dotted, hs6 };
}

function extractRowLikeDescription(cnCode: string, content: string) {
  const { digits, spaced } = formatCnVariants(cnCode);
  const patterns = [
    new RegExp(`\\b${digits}\\b\\s+(.{5,200})`, "i"),
    new RegExp(`\\b${spaced.replace(/\s+/g, "\\s+")}\\b\\s+(.{5,200})`, "i"),
    new RegExp(`\\b${digits.slice(0, 4)}\\s+${digits.slice(4, 6)}\\s+${digits.slice(6, 8)}\\b\\s+(.{5,200})`, "i"),
  ];

  for (const re of patterns) {
    const m = content.match(re);
    if (!m) continue;
    const raw = m[1] || "";
    const cleaned = raw
      .replace(/\s+/g, " ")
      .replace(/^\W+/, "")
      .trim();
    if (cleaned.length >= 5) return cleaned;
  }

  return null;
}

async function getCNDescriptionFromEurLexChunks(cnCode: CNCode) {
  const { digits, spaced, dotted, hs6 } = formatCnVariants(cnCode);

  const hits = await prisma.legalSourceChunk.findMany({
    where: {
      source: "EUR_LEX",
      regulation: "EU_2021_1832",
      language: "EN",
      OR: [
        { content: { contains: digits } },
        { content: { contains: spaced } },
        { content: { contains: dotted } },
        { content: { contains: hs6 } },
      ],
    },
    select: { sectionPath: true, content: true },
    take: 8,
  });

  for (const h of hits) {
    const row = extractRowLikeDescription(cnCode, h.content);
    if (row) return row;
  }

  return null;
}

/**
 * Bulk fetch and cache CN code descriptions from TARIC API
 * Useful for pre-populating common codes
 */
export async function bulkFetchCNDescriptions(
  cnCodes: CNCode[],
  market: MarketCode = MarketCode.EU,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const cnCode of cnCodes) {
    try {
      const description = await taricClient.getDescriptionForCode(cnCode);

      if (description) {
        await prisma.cnCodeDescription.upsert({
          where: { cnCode },
          create: {
            cnCode,
            market,
            description,
            source: "TARIC",
          },
          update: {
            description,
            source: "TARIC",
            fetchedAt: new Date(),
          },
        });
        success++;
      } else {
        failed++;
      }

      // Rate limiting: wait 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to fetch description for CN ${cnCode}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get all cached CN code descriptions
 */
export async function listCNDescriptions(market?: MarketCode) {
  return prisma.cnCodeDescription.findMany({
    where: market ? { market } : undefined,
    orderBy: { cnCode: "asc" },
    take: 1000,
  });
}

