import { NextRequest } from "next/server";
import { getVaultFilesAction } from "@/server/actions/vault";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const files = await getVaultFilesAction({
      organizationId: membership.organizationId,
    });
    return jsonWithCors(request, { files });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
