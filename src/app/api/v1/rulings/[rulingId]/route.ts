import { NextRequest, NextResponse } from "next/server";
import { getRulingAction } from "@/server/actions/rulings";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rulingId: string }> },
) {
  try {
    await requireApiAuth(request);
    const { rulingId } = await params;
    const ruling = await getRulingAction(rulingId);
    return NextResponse.json({ ruling });
  } catch (error) {
    return handleApiError(error);
  }
}
