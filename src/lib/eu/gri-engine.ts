import type {
  EUProductAttributes,
  GRIReasoningStep,
  CNCode,
} from "./types";
import { prisma } from "@/lib/prisma";

export class GRIEngine {
  async classify(
    product: EUProductAttributes,
  ): Promise<{
    cnCode: CNCode;
    reasoningTrail: GRIReasoningStep[];
    confidence: number;
  }> {
    const reasoningTrail: GRIReasoningStep[] = [];

    const chapterResult = await this.applyGRI1(product);
    reasoningTrail.push(chapterResult);

    if (chapterResult.score < 0.7) {
      return {
        cnCode: `${chapterResult.selection.padEnd(8, "0")}`,
        reasoningTrail,
        confidence: chapterResult.score,
      };
    }

    const headingResult = await this.applyGRI2(
      product,
      chapterResult.selection,
    );
    reasoningTrail.push(headingResult);

    if (headingResult.score < 0.7) {
      return {
        cnCode: `${chapterResult.selection}${headingResult.selection
          .substring(2)
          .padEnd(6, "0")}`,
        reasoningTrail,
        confidence: headingResult.score * 0.9,
      };
    }

    const subheadingResult = await this.applyGRI3(
      product,
      `${chapterResult.selection}${headingResult.selection.substring(2)}`,
    );
    reasoningTrail.push(subheadingResult);

    const finalCode = `${chapterResult.selection}${headingResult.selection
      .substring(2)
      .padEnd(6, "0")}`.substring(0, 8);

    return {
      cnCode: finalCode,
      reasoningTrail,
      confidence: Math.min(
        chapterResult.score * headingResult.score * subheadingResult.score,
        0.95,
      ),
    };
  }

  private async applyGRI1(
    product: EUProductAttributes,
  ): Promise<GRIReasoningStep> {
    const searchText = `${product.name} ${product.description} ${product.intendedUse || ""}`.toLowerCase();

    const chapters = await this.searchChaptersByKeywords(searchText);

    if (chapters.length === 0) {
      return {
        griRule: "GRI_1",
        level: "CHAPTER",
        selection: "00",
        rationale: "No matching chapter found. Requires manual review.",
        score: 0.3,
      };
    }

    const bestMatch = chapters[0];
    return {
      griRule: "GRI_1",
      level: "CHAPTER",
      selection: bestMatch.chapter.toString().padStart(2, "0"),
      rationale: `Product matches Chapter ${bestMatch.chapter} based on: ${bestMatch.reason}`,
      score: bestMatch.confidence,
      excludedOptions: chapters.slice(1, 3).map((c) => c.chapter.toString()),
    };
  }

  private async applyGRI2(
    product: EUProductAttributes,
    chapter: string,
  ): Promise<GRIReasoningStep> {
    const chapterNum = parseInt(chapter, 10);
    const notes = await prisma.legalNote.findMany({
      where: {
        chapter: chapterNum,
        heading: null,
      },
      take: 10,
    });

    const headings = await this.searchHeadingsInChapter(
      chapterNum,
      product,
      notes,
    );

    if (headings.length === 0) {
      return {
        griRule: "GRI_2",
        level: "HEADING",
        selection: chapter,
        rationale: "No specific heading found. Using chapter-level classification.",
        score: 0.5,
      };
    }

    const bestMatch = headings[0];
    return {
      griRule: "GRI_2",
      level: "HEADING",
      selection: `${chapter}${bestMatch.heading.toString().padStart(2, "0")}`,
      rationale: `Product matches Heading ${bestMatch.heading} within Chapter ${chapterNum}: ${bestMatch.reason}`,
      score: bestMatch.confidence,
      excludedOptions: headings.slice(1, 3).map((h) => h.heading.toString()),
    };
  }

  private async applyGRI3(
    product: EUProductAttributes,
    heading: string,
  ): Promise<GRIReasoningStep> {
    const headingNum = parseInt(heading.substring(2, 4), 10);
    const chapterNum = parseInt(heading.substring(0, 2), 10);

    const notes = await prisma.legalNote.findMany({
      where: {
        chapter: chapterNum,
        heading: headingNum,
      },
      take: 20,
    });

    const subheadings = await this.searchSubheadings(
      chapterNum,
      headingNum,
      product,
      notes,
    );

    if (subheadings.length === 0) {
      return {
        griRule: "GRI_3",
        level: "SUBHEADING",
        selection: heading,
        rationale: "No specific subheading found. Using heading-level classification.",
        score: 0.6,
      };
    }

    const bestMatch = subheadings[0];
    return {
      griRule: "GRI_3",
      level: "SUBHEADING",
      selection: `${heading}${bestMatch.subheading.toString().padStart(2, "0")}`,
      rationale: `Product matches Subheading ${bestMatch.subheading} within Heading ${headingNum}: ${bestMatch.reason}`,
      score: bestMatch.confidence,
      excludedOptions: subheadings.slice(1, 3).map((s) => s.subheading.toString()),
    };
  }

  private async searchChaptersByKeywords(
    searchText: string,
  ): Promise<
    Array<{ chapter: number; reason: string; confidence: number }>
  > {
    const keywords = searchText.split(/\s+/).filter((w) => w.length > 3);

    const notes = await prisma.legalNote.findMany({
      where: {
        heading: null,
      },
      take: 100,
    });

    const matches: Map<
      number,
      { count: number; reasons: string[]; totalScore: number }
    > = new Map();

    for (const note of notes) {
      const content = note.content.toLowerCase();
      let matchCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      if (matchCount > 0) {
        const existing = matches.get(note.chapter) || {
          count: 0,
          reasons: [],
          totalScore: 0,
        };
        existing.count += matchCount;
        existing.reasons.push(
          `Matched keywords: ${matchedKeywords.join(", ")} in Chapter ${note.chapter} notes`,
        );
        existing.totalScore += matchCount / keywords.length;
        matches.set(note.chapter, existing);
      }
    }

    return Array.from(matches.entries())
      .map(([chapter, data]) => ({
        chapter,
        reason: data.reasons[0] || "General match",
        confidence: Math.min(data.totalScore / data.count, 0.95),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private async searchHeadingsInChapter(
    chapter: number,
    product: EUProductAttributes,
    notes: Array<{ heading: number | null; content: string }>,
  ): Promise<
    Array<{ heading: number; reason: string; confidence: number }>
  > {
    const searchText = `${product.name} ${product.description}`.toLowerCase();
    const keywords = searchText.split(/\s+/).filter((w) => w.length > 3);

    const headingNotes = notes.filter((n) => n.heading !== null);
    const matches: Map<
      number,
      { count: number; reasons: string[]; totalScore: number }
    > = new Map();

    for (const note of headingNotes) {
      if (!note.heading) continue;

      const content = note.content.toLowerCase();
      let matchCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      if (matchCount > 0) {
        const existing = matches.get(note.heading) || {
          count: 0,
          reasons: [],
          totalScore: 0,
        };
        existing.count += matchCount;
        existing.reasons.push(
          `Matched keywords: ${matchedKeywords.join(", ")} in Heading ${note.heading} notes`,
        );
        existing.totalScore += matchCount / keywords.length;
        matches.set(note.heading, existing);
      }
    }

    return Array.from(matches.entries())
      .map(([heading, data]) => ({
        heading,
        reason: data.reasons[0] || "General match",
        confidence: Math.min(data.totalScore / data.count, 0.9),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private async searchSubheadings(
    chapter: number,
    heading: number,
    product: EUProductAttributes,
    notes: Array<{ heading: number | null; content: string }>,
  ): Promise<
    Array<{ subheading: number; reason: string; confidence: number }>
  > {
    // Search for actual CN code descriptions in the database
    const chapterStr = chapter.toString().padStart(2, "0");
    const headingStr = heading.toString().padStart(2, "0");
    const baseCode = `${chapterStr}${headingStr}`;
    
    // Search for CN codes that start with this chapter+heading combination
    const cnCodes = await prisma.cnCodeDescription.findMany({
      where: {
        cnCode: { startsWith: baseCode },
        market: "EU",
      },
      take: 20,
    });

    const searchText = `${product.name} ${product.description}`.toLowerCase();
    const keywords = searchText.split(/\s+/).filter((w) => w.length > 3);
    
    const matches: Map<
      number,
      { count: number; reasons: string[]; totalScore: number; description: string }
    > = new Map();

    for (const cnCode of cnCodes) {
      // Extract subheading from CN code (positions 4-5, 0-indexed: chars 4-6)
      const subheadingStr = cnCode.cnCode.substring(4, 6);
      const subheading = parseInt(subheadingStr, 10);
      
      if (isNaN(subheading)) continue;

      const description = cnCode.description.toLowerCase();
      let matchCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        if (description.includes(keyword)) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      if (matchCount > 0) {
        const existing = matches.get(subheading) || {
          count: 0,
          reasons: [],
          totalScore: 0,
          description: cnCode.description,
        };
        existing.count += matchCount;
        existing.reasons.push(
          `Matched keywords: ${matchedKeywords.join(", ")} in CN ${cnCode.cnCode}`,
        );
        existing.totalScore += matchCount / keywords.length;
        matches.set(subheading, existing);
      }
    }

    if (matches.size === 0) {
      return [];
    }

    return Array.from(matches.entries())
      .map(([subheading, data]) => ({
        subheading,
        reason: data.reasons[0] || `CN code ${baseCode}${subheading.toString().padStart(2, "0")}00: ${data.description}`,
        confidence: Math.min(data.totalScore / data.count, 0.85),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }
}

export const griEngine = new GRIEngine();

