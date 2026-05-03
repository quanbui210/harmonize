import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { labelId } = await params;

    const label = await prisma.label.findFirst({
      where: {
        id: labelId,
        organizationId: membership.organizationId,
      },
      include: {
        classification: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!label) {
      return jsonWithCors(request, { error: "Label not found" }, { status: 404 });
    }

    return jsonWithCors(request, { label });
  } catch (error) {
    return handleApiError(error, request);
  }
}

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}
