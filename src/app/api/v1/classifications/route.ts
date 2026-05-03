import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { classifyProductForEUAction } from "@/server/actions/eu-classification";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const classifyRequestSchema = z.object({
  productId: z.string().cuid(),
});

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

    const classifications = await prisma.classification.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      include: {
        product: true,
        dutySummary: true,
        riskFlags: true,
        dossier: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
    });

    return NextResponse.json({ classifications });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const body = await request.json();
    const { productId } = classifyRequestSchema.parse(body);

    const result = await classifyProductForEUAction(
      productId,
      membership.organizationId,
    );

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
