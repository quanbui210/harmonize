import { NextRequest } from "next/server";
import { getRulingAction, listRulingsAction } from "@/server/actions/rulings";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request);
    const rulingId = request.nextUrl.searchParams.get("id");

    if (rulingId) {
      const ruling = await getRulingAction(rulingId);
      return jsonWithCors(request, { ruling });
    }

    const market = request.nextUrl.searchParams.get("market") || undefined;
    const htsCode =
      request.nextUrl.searchParams.get("htsCode") ||
      request.nextUrl.searchParams.get("hsCode") ||
      undefined;
    const search =
      request.nextUrl.searchParams.get("search") ||
      request.nextUrl.searchParams.get("q") ||
      undefined;
    const category = request.nextUrl.searchParams.get("category") || undefined;
    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
    const offset = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);

    const result = await listRulingsAction({
      market,
      htsCode,
      search,
      category,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return jsonWithCors(request, result);
  } catch (error) {
    return handleApiError(error, request);
  }
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
