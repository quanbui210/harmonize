import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";
import { handleCorsPreflight, jsonWithCors } from "@/lib/api/cors";
import { serializeClassification } from "@/lib/api/mobile-serializers";
import { answerRefinementQuestionForOrganization } from "@/server/actions/classification-search";

const refinementAnswerSchema = z.object({
  answer: z.string().min(1),
  field: z.string().min(1),
});

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classificationId: string }> },
) {
  try {
    const { membership } = await requireApiAuth(request);
    const { classificationId } = await params;
    const body = await request.json();
    const payload = refinementAnswerSchema.parse(body);

    const result = await answerRefinementQuestionForOrganization({
      classificationId,
      answer: payload.answer,
      field: payload.field,
      organizationId: membership.organizationId,
    });

    const classification = await prisma.classification.findFirst({
      where: {
        id: result.classificationId,
        organizationId: membership.organizationId,
      },
      include: {
        product: true,
        dutySummary: true,
        riskFlags: true,
        dossier: true,
      },
    });

    if (!classification) {
      throw new Error("Updated classification could not be loaded.");
    }

    return jsonWithCors(request, {
      result: {
        classificationId: result.classificationId,
        confidence: result.confidence,
        classification: serializeClassification(classification),
      },
    });
  } catch (error) {
    return handleApiError(error, request);
  }
}
