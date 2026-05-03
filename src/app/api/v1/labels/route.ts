import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

    const labels = await prisma.label.findMany({
      where: {
        organizationId: membership.organizationId,
        isDraft: false,
      },
      orderBy: {
        generatedAt: "desc",
      },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
    });

    return jsonWithCors(request, { labels });
  } catch (error) {
    return handleApiError(error, request);
  }
}
