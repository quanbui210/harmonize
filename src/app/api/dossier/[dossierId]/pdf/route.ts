import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { generatePDFFromHTML } from "@/lib/pdf/generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const membership = await getPrimaryMembership(user.id);
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dossierId } = await params;
    const dossier = await prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        classification: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!dossier || dossier.classification.organizationId !== membership.organizationId) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from("dossiers")
      .download(dossier.storagePath);

    if (error || !data) {
      return NextResponse.json({ error: "Failed to fetch dossier" }, { status: 500 });
    }

    const htmlContent = await data.text();
    
    // Add print styles for PDF generation
    const pdfReadyHTML = htmlContent.replace(
      '</head>',
      `<style>
        @media print {
          body { margin: 0; padding: 20px; }
          @page { margin: 1cm; size: A4; }
          .no-print { display: none; }
        }
      </style>
      </head>`
    );

    // Generate PDF
    const pdfBuffer = await generatePDFFromHTML(pdfReadyHTML, {
      format: "A4",
      margin: {
        top: "1cm",
        right: "1cm",
        bottom: "1cm",
        left: "1cm",
      },
      printBackground: true,
    });

    // Generate filename - sanitize to avoid encoding issues
    const productName = dossier.classification.product.name
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "") // Remove non-ASCII and special chars
      .slice(0, 50); // Limit length
    const filename = `dossier_${productName}_${dossierId.slice(0, 8)}.pdf`;
    const filenameEncoded = encodeURIComponent(filename);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filenameEncoded}`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Dossier PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
