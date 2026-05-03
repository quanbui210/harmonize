import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api/mobile-auth";
import { authenticateRequest } from "@/lib/api/request-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> }
) {
  try {
    const { membership } = await authenticateRequest(request);

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
    
    // Add print styles for PDF export
    const pdfReadyHTML = htmlContent.replace(
      '</head>',
      `<style>
        @media print {
          body { margin: 0; padding: 20px; }
          @page { margin: 1cm; }
          .no-print { display: none; }
        }
      </style>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
      </head>`
    );

    return new NextResponse(pdfReadyHTML, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `inline; filename="dossier-${dossierId}.html"`,
      },
    });
  } catch (error) {
    console.error("Dossier export error:", error);
    return handleApiError(error);
  }
}

