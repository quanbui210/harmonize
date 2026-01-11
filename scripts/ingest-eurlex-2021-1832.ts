import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

type Chunk = {
  source: string;
  regulation: string;
  language: string;
  sectionPath: string;
  content: string;
  sha256: string;
  pageStart?: number;
  pageEnd?: number;
};

const DEFAULT_PDF_PATH = path.join("public", "docs", "2021-1832.pdf");
const DEFAULT_REGULATION = "EU_2021_1832";
const DEFAULT_LANGUAGE = "EN";
const DEFAULT_OUT_DIR = path.join("data", "legal-sources");
const DEFAULT_HTML_PATH = path.join("data", "legal-sources", "eurlex.html");

function sha256(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeText(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripPdfArtifacts(input: string) {
  return input
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.includes("file:///")) return false;
      if (t.includes("EUR-Lex")) return false;
      if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(t) && /\bAM\b|\bPM\b/.test(t))
        return false;
      if (/\b\d{1,4}\/1230\b/.test(t)) return false;
      return true;
    })
    .join("\n");
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCodePoint(parseInt(String(n), 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&rdquo;/g, "\"")
    .replace(/&ldquo;/g, "\"")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function extractTextFromHtml(html: string) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;

  const withoutScripts = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const withNewlines = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/td>/gi, "\t");

  const stripped = withNewlines.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(stripped);
  return normalizeText(decoded);
}

function chunkTextWithMarkers(fullText: string) {
  const maxLen = 4500;
  const paragraphs = fullText.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);

  const ctx: { part?: string; section?: string; chapter?: string; annex?: string } =
    {};

  const chunks: Array<{ sectionPath: string; content: string }> = [];
  let buffer = "";
  let bufferPath = "DOC";
  let bufferIdx = 0;

  const flush = () => {
    const cleaned = normalizeText(buffer);
    if (!cleaned) return;
    let i = 0;
    for (let start = 0; start < cleaned.length; start += maxLen) {
      const part = normalizeText(cleaned.slice(start, start + maxLen));
      if (!part) continue;
      chunks.push({
        sectionPath: `${bufferPath} > chunk ${++i}`,
        content: part,
      });
    }
    buffer = "";
  };

  const setPath = () => {
    const pieces = ["DOC"];
    if (ctx.part) pieces.push(ctx.part);
    if (ctx.section) pieces.push(ctx.section);
    if (ctx.chapter) pieces.push(ctx.chapter);
    if (ctx.annex) pieces.push(ctx.annex);
    bufferPath = pieces.join(" > ");
  };

  for (const p of paragraphs) {
    const line = p.replace(/\s+/g, " ").trim();

    const partMatch = line.match(/^PART\s+(ONE|TWO|THREE)\b/i);
    const sectionMatch = line.match(/^SECTION\s+([IVX]+)\b/i);
    const chapterMatch = line.match(/^CHAPTER\s+(\d{1,3})\b/i);
    const annexMatch = line.match(/^ANNEX\s+([0-9IVX]+)\b/i);

    const isMarker = !!(partMatch || sectionMatch || chapterMatch || annexMatch);
    if (isMarker) {
      flush();
      if (partMatch) {
        ctx.part = `PART ${partMatch[1].toUpperCase()}`;
        ctx.section = undefined;
        ctx.chapter = undefined;
        ctx.annex = undefined;
      }
      if (sectionMatch) {
        ctx.section = `SECTION ${sectionMatch[1].toUpperCase()}`;
        ctx.chapter = undefined;
        ctx.annex = undefined;
      }
      if (chapterMatch) {
        ctx.chapter = `CHAPTER ${chapterMatch[1]}`;
        ctx.annex = undefined;
      }
      if (annexMatch) {
        ctx.annex = `ANNEX ${annexMatch[1].toUpperCase()}`;
      }
      setPath();
      buffer = `${line}\n\n`;
      bufferIdx = 0;
      continue;
    }

    if (buffer.length + p.length + 2 > maxLen * 3) {
      flush();
      setPath();
      bufferIdx += 1;
      buffer = "";
    }

    if (!bufferPath) setPath();
    buffer += `${p}\n\n`;
  }

  flush();
  return chunks;
}

function sliceBetween(text: string, startNeedle: RegExp, endNeedle: RegExp) {
  const start = text.search(startNeedle);
  if (start === -1) return null;
  const rest = text.slice(start);
  const endInRest = rest.search(endNeedle);
  if (endInRest === -1) return rest;
  return rest.slice(0, endInRest);
}

function parseTocPageNumber(tocText: string, needle: RegExp) {
  const match = tocText.match(needle);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function chunkPartOneStructured(partOneText: string) {
  const maxLen = 4500;
  const text = normalizeText(stripPdfArtifacts(partOneText));

  const chunks: Array<{ sectionPath: string; content: string }> = [];

  const pushChunk = (sectionPath: string, content: string) => {
    const cleaned = normalizeText(content);
    if (!cleaned) return;
    if (cleaned.length <= maxLen) {
      chunks.push({ sectionPath, content: cleaned });
      return;
    }
    let i = 0;
    for (let start = 0; start < cleaned.length; start += maxLen) {
      const part = cleaned.slice(start, start + maxLen);
      chunks.push({
        sectionPath: `${sectionPath} > chunk ${++i}`,
        content: normalizeText(part),
      });
    }
  };

  const sectionIIdx = text.search(/\nSECTION\s+I\b/i);
  const sectionIIIdx = text.search(/\nSECTION\s+II\b/i);

  const sectionI =
    sectionIIdx !== -1
      ? text.slice(sectionIIdx, sectionIIIdx !== -1 ? sectionIIIdx : text.length)
      : "";
  const sectionII = sectionIIIdx !== -1 ? text.slice(sectionIIIdx) : "";

  if (sectionI) {
    const aIdx = sectionI.search(/\nA\.\s/i);
    const bIdx = sectionI.search(/\nB\.\s/i);
    const cIdx = sectionI.search(/\nC\.\s/i);

    const aBlock =
      aIdx !== -1 ? sectionI.slice(aIdx, bIdx !== -1 ? bIdx : sectionI.length) : "";
    const bBlock =
      bIdx !== -1 ? sectionI.slice(bIdx, cIdx !== -1 ? cIdx : sectionI.length) : "";
    const cBlock = cIdx !== -1 ? sectionI.slice(cIdx) : "";

    if (aBlock) {
      // Split A by numbered GRI rules: "1.", "2.", ..., "6."
      const parts = aBlock.split(/\n(?=\d+\.)/g);
      const header = parts.shift() || "";
      pushChunk("PART ONE > SECTION I > A > header", header);
      for (const p of parts) {
        const m = p.match(/^\s*(\d+)\./);
        const ruleNo = m ? m[1] : "x";
        pushChunk(`PART ONE > SECTION I > A > rule ${ruleNo}`, p);
      }
    }

    if (bBlock) pushChunk("PART ONE > SECTION I > B", bBlock);
    if (cBlock) pushChunk("PART ONE > SECTION I > C", cBlock);
  }

  if (sectionII) {
    const sectionIIClean =
      sliceBetween(sectionII, /^SECTION\s+II\b/im, /^PART\s+TWO\b/im) ?? sectionII;

    const parts = sectionIIClean.split(/\n(?=[A-F]\.\s)/g);
    const header = parts.shift() || "";
    pushChunk("PART ONE > SECTION II > header", header);
    for (const p of parts) {
      const m = p.match(/^\s*([A-F])\./);
      const letter = m ? m[1] : "X";
      pushChunk(`PART ONE > SECTION II > ${letter}`, p);
    }
  }

  if (chunks.length === 0) {
    return [{ sectionPath: "PART ONE", content: text }];
  }

  return chunks;
}

function chunkFullDocumentByPage(pages: Array<{ num: number; text: string }>) {
  const maxLen = 4500;

  const chunks: Array<{
    sectionPath: string;
    content: string;
    pageStart: number;
    pageEnd: number;
  }> = [];

  for (const p of pages) {
    const cleaned = normalizeText(stripPdfArtifacts(p.text || ""));
    if (!cleaned) continue;

    if (cleaned.length <= maxLen) {
      chunks.push({
        sectionPath: `DOC > page ${String(p.num).padStart(4, "0")}`,
        content: cleaned,
        pageStart: p.num,
        pageEnd: p.num,
      });
      continue;
    }

    let i = 0;
    for (let start = 0; start < cleaned.length; start += maxLen) {
      const part = normalizeText(cleaned.slice(start, start + maxLen));
      if (!part) continue;
      chunks.push({
        sectionPath: `DOC > page ${String(p.num).padStart(4, "0")} > chunk ${++i}`,
        content: part,
        pageStart: p.num,
        pageEnd: p.num,
      });
    }
  }

  return chunks;
}

async function insertChunks(
  chunks: Chunk[],
  options: { mode: "upsert" | "createMany"; batchSize?: number } = {
    mode: "upsert",
  },
) {
  const prisma = new PrismaClient();
  try {
    if (options.mode === "upsert") {
      for (const c of chunks) {
        await prisma.legalSourceChunk.upsert({
          where: { sha256: c.sha256 },
          create: c,
          update: {
            content: c.content,
            sectionPath: c.sectionPath,
            pageStart: c.pageStart,
            pageEnd: c.pageEnd,
          },
        });
      }
      return;
    }

    const batchSize = options.batchSize ?? 250;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await prisma.legalSourceChunk.createMany({
        data: batch as any,
        skipDuplicates: true,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const pdfPathArg = process.argv.find((a) => a.startsWith("--pdf="));
  const htmlPathArg = process.argv.find((a) => a.startsWith("--html="));
  const outDirArg = process.argv.find((a) => a.startsWith("--outDir="));
  const regulationArg = process.argv.find((a) => a.startsWith("--reg="));
  const insertDb = argv.some((a) => a === "--db" || a.startsWith("--db="));
  const fullMode = argv.some((a) => a === "--full");

  const pdfPath = pdfPathArg ? pdfPathArg.slice("--pdf=".length) : DEFAULT_PDF_PATH;
  const htmlPath = htmlPathArg ? htmlPathArg.slice("--html=".length) : DEFAULT_HTML_PATH;
  const outDir = outDirArg ? outDirArg.slice("--outDir=".length) : DEFAULT_OUT_DIR;
  const regulation = regulationArg ? regulationArg.slice("--reg=".length) : DEFAULT_REGULATION;

  const useHtml = argv.some((a) => a === "--html" || a.startsWith("--html="));

  let docHash = "";
  let pagesTotal: number | string = "unknown";
  let chunks: Chunk[] = [];
  let modeLabel = "";

  if (useHtml) {
    const html = await fs.readFile(htmlPath, "utf-8");
    docHash = sha256(Buffer.from(html, "utf-8"));
    const fullText = extractTextFromHtml(html);
    const chunkInputs = chunkTextWithMarkers(fullText);

    chunks = chunkInputs.map((c) => ({
      source: "EUR_LEX",
      regulation,
      language: DEFAULT_LANGUAGE,
      sectionPath: c.sectionPath,
      content: c.content,
      sha256: sha256(`${regulation}:${DEFAULT_LANGUAGE}:${c.sectionPath}:${c.content}`),
    }));

    modeLabel = "html";
  } else {
    const buffer = await fs.readFile(pdfPath);
    docHash = sha256(buffer);

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    await parser.destroy();

    const nonEmptyPages = (textResult.pages as Array<{ text?: string }>).reduce(
      (acc, p) => acc + (p?.text && p.text.trim().length > 0 ? 1 : 0),
      0,
    );

    const rawText = normalizeText(textResult.text || "");
    pagesTotal = textResult.total ?? "unknown";

    if (nonEmptyPages === 0) {
      throw new Error(
        [
          "This PDF has no extractable text layer (likely scanned images).",
          "To ingest full text you must either:",
          "- Use a text-based EUR-Lex PDF/HTML source (recommended), or",
          "- Run OCR (not implemented in this script yet).",
          `PDF: ${pdfPath}`,
          `Pages: ${pagesTotal}`,
        ].join("\n"),
      );
    }

    if (fullMode) {
      const pageInputs = chunkFullDocumentByPage(textResult.pages as any);
      chunks = pageInputs.map((c) => ({
        source: "EUR_LEX",
        regulation,
        language: DEFAULT_LANGUAGE,
        sectionPath: c.sectionPath,
        content: c.content,
        sha256: sha256(`${regulation}:${DEFAULT_LANGUAGE}:${c.sectionPath}:${c.content}`),
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
      }));
      modeLabel = "pdf-full";
    } else {
    const tocSnippet =
      sliceBetween(rawText, /^COMBINED\s+NOMENCLATURE\b/im, /^PART\s+THREE\b/im) ??
      rawText.slice(0, 200_000);

    const partOneStartPage =
      parseTocPageNumber(
        tocSnippet,
        /GENERAL\s+RULES\s+FOR\s+THE\s+INTERPRETATION[\s\S]{0,120}?(\d{1,4})\b/i,
      ) ?? 1;

    const partTwoStartPage =
      parseTocPageNumber(
        tocSnippet,
        /PART\s+TWO[\s—-]+SCHEDULE\s+OF\s+CUSTOMS\s+DUTIES[\s\S]{0,200}?(\d{1,4})\s*$/im,
      ) ?? null;

    const safePartTwoStart =
      partTwoStartPage && partTwoStartPage > partOneStartPage
        ? partTwoStartPage
        : null;

    const partOnePages = (textResult.pages as any)
      .filter((p: any) => {
        if (typeof p?.num !== "number") return false;
        if (p.num < partOneStartPage) return false;
        if (safePartTwoStart && p.num >= safePartTwoStart) return false;
        return true;
      })
      .map((p: any) => p.text)
      .join("\n\n");

    if (!partOnePages || partOnePages.trim().length === 0) {
      throw new Error(
        `Failed to extract PART ONE pages. startPage=${partOneStartPage} partTwoStart=${safePartTwoStart ?? "unknown"}`,
      );
    }

    const chunkInputs = chunkPartOneStructured(partOnePages);
    chunks = chunkInputs.map((c) => ({
      source: "EUR_LEX",
      regulation,
      language: DEFAULT_LANGUAGE,
      sectionPath: c.sectionPath,
      content: c.content,
      sha256: sha256(`${regulation}:${DEFAULT_LANGUAGE}:${c.sectionPath}:${c.content}`),
      pageStart: partOneStartPage,
      pageEnd: safePartTwoStart ? safePartTwoStart - 1 : undefined,
    }));
  }
    modeLabel = modeLabel || "pdf-part-one";
  }

  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `eurlex-${regulation.toLowerCase()}.${DEFAULT_LANGUAGE.toLowerCase()}${fullMode ? ".full" : ""}.jsonl`,
  );

  const jsonl = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
  await fs.writeFile(outPath, jsonl, "utf-8");

  if (insertDb) {
    await insertChunks(chunks, {
      mode: fullMode || useHtml ? "createMany" : "upsert",
      batchSize: 250,
    });
  }

  process.stdout.write(
    [
      `Ingestion complete`,
      useHtml ? `HTML: ${htmlPath}` : `PDF: ${pdfPath}`,
      `Doc SHA-256: ${docHash}`,
      `Pages: ${pagesTotal}`,
      `Chunks: ${chunks.length}`,
      `Output: ${outPath}`,
      `Mode: ${modeLabel}`,
      insertDb
        ? `DB: inserted ${chunks.length} chunks (${fullMode ? "createMany" : "upsert"})`
        : `DB: skipped (pass --db to insert)`,
    ].join("\n") + "\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


