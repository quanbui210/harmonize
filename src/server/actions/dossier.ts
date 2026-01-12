"use server";

import { prisma } from "@/lib/prisma";
import { openaiService } from "@/lib/eu/openai-service";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { marked } from "marked";
import { createAuditLogEntry } from "@/server/actions/audit-log";
import { getCNCodeDescription } from "@/server/actions/cn-descriptions";
import { MarketCode } from "@prisma/client";

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

export async function generateDossierAction(input: {
  classificationId: string;
  organizationId: string;
  userId: string;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);
  if (!membership || membership.organizationId !== input.organizationId) {
    throw new Error("Unauthorized");
  }

  const classification = await prisma.classification.findFirst({
    where: {
      id: input.classificationId,
      organizationId: input.organizationId,
    },
    include: {
      product: {
        include: {
          materials: true,
        },
      },
      sources: true,
      dutySummary: true,
    },
  });

  if (!classification) {
    throw new Error("Classification not found");
  }

  const existingDossier = await prisma.dossier.findUnique({
    where: { classificationId: classification.id },
  });

  if (existingDossier) {
    return {
      dossierId: existingDossier.id,
      dossierUrl: `/api/dossier/${existingDossier.id}/preview`,
    };
  }

  const productAttributes = {
    name: classification.product.name,
    description: classification.product.description,
    intendedUse: classification.product.intendedUse || undefined,
    materials: classification.product.materials.map((m) => ({
      material: m.material,
      percentage: Number(m.percentage),
    })),
  };

  const reasoningTrail = (classification.reasoningTrail as Array<{
    griRule: string;
    level: string;
    selection: string;
    rationale: string;
    score: number;
  }>) || [];

  // Get legal rationale if available (from classification search)
  // For now, we'll generate it if not already available
  const cnCode = classification.htsCode?.substring(0, 8) || "";
  let legalRationale = "";
  let distinctions: Array<{ heading: string; reason: string }> = [];
  let keyFeatures: string[] = [];

  // Try to get legal rationale from classification metadata or generate it
  if (cnCode && cnCode !== "00000000") {
    try {
      const cnCodeDescription = await getCNCodeDescription(cnCode as any, MarketCode.EU);
      
      // Check if sources mention a different CN code (potential classification error)
      const sourceCodes: string[] = [];
      for (const source of classification.sources) {
        // Extract CN codes from source excerpts (format: 6109 10 00 or 61091000)
        const codeMatches = source.excerpt.match(/\b(\d{4}[\s\.]?\d{2}[\s\.]?\d{2})\b/g);
        if (codeMatches) {
          sourceCodes.push(...codeMatches.map(m => m.replace(/[\s\.]/g, "").substring(0, 8)));
        }
      }
      
      // If sources mention a different code, log a warning
      const uniqueSourceCodes = [...new Set(sourceCodes)];
      const differentCodes = uniqueSourceCodes.filter(code => code !== cnCode && code.length === 8);
      if (differentCodes.length > 0) {
        console.warn(`[Dossier] Warning: Classification has CN code ${cnCode}, but sources mention: ${differentCodes.join(", ")}. This may indicate a classification error.`);
      }
      
      // Ask AI to provide accurate duty rate - don't assume or use mock data
      const legalInfo = await openaiService.generateLegalRationale(
        productAttributes,
        {
          cnCode,
          cnCodeDescription,
          reasoningTrail,
          exclusionNotes: (classification.exclusionNotes as string[]) || [],
          sources: classification.sources.map((s) => ({
            sourceType: s.sourceType,
            referenceId: s.referenceId || undefined,
            excerpt: s.excerpt,
          })),
        },
      );
      legalRationale = legalInfo.legalRationale;
      distinctions = legalInfo.distinctions;
      keyFeatures = legalInfo.keyFeatures;
      
      // Use AI-provided duty rate if available, otherwise keep existing
      const aiDutyRate = legalInfo.dutyRate;
      const aiVatRate = legalInfo.vatRate;
      
      // Update duty summary with AI-provided rates if they exist
      if (aiDutyRate !== undefined) {
        if (classification.dutySummary) {
          await prisma.dutySummary.update({
            where: { classificationId: classification.id },
            data: {
              dutyRate: aiDutyRate,
              vatRate: aiVatRate || 20.0,
            },
          });
        } else {
          await prisma.dutySummary.create({
            data: {
              classificationId: classification.id,
              baseValue: 0,
              dutyRate: aiDutyRate,
              vatRate: aiVatRate || 20.0,
              estimatedDuty: 0,
            },
          });
        }
      }
    } catch (error) {
      console.error("Failed to generate legal rationale:", error);
    }
  }

  const dossierText = await openaiService.generateReasoningDossier(
    productAttributes,
    {
      cnCode,
      reasoningTrail,
      sources: classification.sources.map((s) => ({
        sourceType: s.sourceType,
        referenceId: s.referenceId || undefined,
        excerpt: s.excerpt,
      })),
      legalRationale, // Pass legal rationale to dossier generator
      distinctions,
      keyFeatures,
    },
  );

  // TODO: Use a proper PDF library like pdfkit or puppeteer
  // For now, we'll store the HTML content and generate PDF on-demand
  const htmlContent = generateHTML(dossierText, classification as any);
  const htmlBuffer = Buffer.from(htmlContent, "utf-8");
  const sha256 = createHash("sha256").update(htmlBuffer).digest("hex");

  const storagePath = `${input.organizationId}/${input.classificationId}/${Date.now()}.html`;

  const supabase = getSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from("dossiers")
    .upload(storagePath, htmlBuffer, {
      contentType: "text/html",
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Failed to upload dossier: ${uploadError.message}`);
  }

  const dossier = await prisma.dossier.create({
    data: {
      classificationId: classification.id,
      generatedById: input.userId,
      storagePath,
      sha256,
    },
  });

  // Log audit entry
  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: input.userId,
    entityType: "DOSSIER",
    entityId: dossier.id,
    action: "GENERATE",
    payload: {
      classificationId: classification.id,
      productName: classification.product.name,
      htsCode: classification.htsCode,
    },
  });

  return {
    dossierId: dossier.id,
    dossierUrl: `/api/dossier/${dossier.id}/preview`,
  };
}

function generateHTML(
  content: string,
  classification: {
    htsCode: string | null;
    product: { name: string; description: string; intendedUse?: string | null; metadata?: any };
    market?: string;
  },
): string {
  const productMeta = (classification.product.metadata as Record<string, unknown> | null) ?? null;
  const originCountry =
    productMeta && typeof productMeta.originCountry === "string"
      ? productMeta.originCountry
      : undefined;
  const compositionText =
    productMeta && typeof productMeta.compositionText === "string"
      ? productMeta.compositionText
      : undefined;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @media print {
      @page {
        margin: 2cm;
        size: A4;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 60px 50px;
      color: #1a1a1a;
      background: #ffffff;
      font-size: 12pt;
    }
    .header {
      text-align: center;
      margin-bottom: 50px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 24pt;
      font-weight: bold;
      color: #1a1a1a;
      margin: 0 0 10px 0;
      border: none;
      padding: 0;
    }
    .header p {
      font-size: 11pt;
      color: #4b5563;
      margin: 0;
    }
    .meta {
      background: #f8f9fa;
      padding: 25px;
      border: 1px solid #e5e7eb;
      border-left: 4px solid #2563eb;
      margin-bottom: 40px;
    }
    .meta p {
      margin: 8px 0;
      font-size: 11pt;
    }
    .content {
      text-align: justify;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-top: 40px;
      margin-bottom: 20px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 8px;
      page-break-after: avoid;
    }
    h2 {
      font-size: 16pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-top: 35px;
      margin-bottom: 15px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 14pt;
      font-weight: bold;
      color: #4b5563;
      margin-top: 25px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    p {
      margin: 12px 0;
      text-align: justify;
      orphans: 3;
      widows: 3;
    }
    strong {
      font-weight: bold;
      color: #1a1a1a;
    }
    em {
      font-style: italic;
    }
    ul, ol {
      margin: 15px 0;
      padding-left: 35px;
    }
    li {
      margin: 8px 0;
      line-height: 1.8;
    }
    blockquote {
      border-left: 4px solid #2563eb;
      padding-left: 20px;
      margin: 20px 0;
      color: #4b5563;
      font-style: italic;
      background: #f8f9fa;
      padding: 15px 20px;
    }
    code {
      background: #f3f4f6;
      padding: 3px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
    }
    pre {
      background: #f8f9fa;
      padding: 20px;
      border-left: 4px solid #2563eb;
      overflow-x: auto;
      white-space: pre-wrap;
      border: 1px solid #e5e7eb;
      margin: 20px 0;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 25px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 12px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: bold;
      color: #1a1a1a;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 30px 0;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 10pt;
    }
    .footer p {
      margin: 5px 0;
      text-align: center;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>EU Customs Classification Reasoning Dossier</h1>
    <p><strong>HarmonizeAI Defense Document</strong></p>
  </div>

  <div class="meta">
    <p><strong>Product:</strong> ${classification.product.name}</p>
    <p><strong>Market:</strong> ${classification.market ? String(classification.market) : "EU"}</p>
    <p><strong>Origin:</strong> ${originCountry ? originCountry : "Not provided"}</p>
    <p><strong>End use:</strong> ${classification.product.intendedUse ? classification.product.intendedUse : "Not provided"}</p>
    ${compositionText ? `<p><strong>Materials / composition:</strong> ${compositionText}</p>` : ""}
    <p><strong>HS Code (International Base):</strong> ${classification.htsCode ? formatHSCode(classification.htsCode.substring(0, 6)) : "Pending"}</p>
    <p><strong>CN Code (EU):</strong> ${classification.htsCode ? formatCNCode(classification.htsCode.substring(0, 8)) : "Pending"}</p>
    <p><strong>HTS Code (USA):</strong> ${classification.htsCode ? formatHTSCode(classification.htsCode) : "Pending"}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}</p>
  </div>

  <div class="content">
    ${marked.parse(content)}
  </div>

  <div class="footer">
    <p>This document was generated by HarmonizeAI for audit protection purposes.</p>
    <p>Document SHA-256: [Generated upon finalization]</p>
  </div>
</body>
</html>
  `;

  return html;
}

function formatHSCode(hsCode: string): string {
  if (!hsCode || hsCode.length !== 6) return hsCode;
  return `${hsCode.substring(0, 2)}.${hsCode.substring(2, 4)}.${hsCode.substring(4, 6)}`;
}

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

function formatHTSCode(htsCode: string): string {
  if (!htsCode || htsCode.length !== 10) return htsCode;
  return `${htsCode.substring(0, 4)}.${htsCode.substring(4, 6)}.${htsCode.substring(6, 8)}.${htsCode.substring(8, 10)}`;
}

