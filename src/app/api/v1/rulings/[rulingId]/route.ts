import { NextRequest } from "next/server";
import { getRulingAction } from "@/server/actions/rulings";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rulingId: string }> },
) {
  try {
    await requireApiAuth(request);
    const { rulingId } = await params;
    const ruling = await getRulingAction(rulingId);
    return jsonWithCors(request, { ruling });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
