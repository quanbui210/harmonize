import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function resolveLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseCursor(value: string | null) {
  if (!value) return null;
  const [generatedAtText, id] = value.split("|");
  if (!generatedAtText || !id) {
    throw new Error("Invalid cursor");
  }
  const generatedAt = new Date(generatedAtText);
  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error("Invalid cursor");
  }
  return { generatedAt, id };
}

function makeCursor(value: { generatedAt: Date; id: string }) {
  return `${value.generatedAt.toISOString()}|${value.id}`;
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const limit = resolveLimit(request.nextUrl.searchParams.get("limit"));
    const cursor = parseCursor(request.nextUrl.searchParams.get("cursor"));

    const labels = await prisma.label.findMany({
      where: {
        organizationId: membership.organizationId,
        isDraft: false,
        ...(cursor
          ? {
              OR: [
                { generatedAt: { lt: cursor.generatedAt } },
                {
                  generatedAt: cursor.generatedAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const hasMore = labels.length > limit;
    const pageItems = hasMore ? labels.slice(0, limit) : labels;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem ? makeCursor(lastItem) : null;

    return jsonWithCors(request, {
      items: pageItems,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}
