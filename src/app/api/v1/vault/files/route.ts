import { NextRequest, NextResponse } from "next/server";
import { getVaultFilesAction } from "@/server/actions/vault";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

export async function GET(request: NextRequest) {
  try {
    const { membership } = await requireApiAuth(request);
    const files = await getVaultFilesAction({
      organizationId: membership.organizationId,
    });
    return NextResponse.json({ files });
  } catch (error) {
    return handleApiError(error);
  }
}
