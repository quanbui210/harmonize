import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";

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

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Dossier preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

