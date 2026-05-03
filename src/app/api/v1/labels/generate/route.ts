import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateLabelAction, saveLabelAction } from "@/server/actions/labels";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const generateLabelApiSchema = z.object({
  productName: z.string().min(1),
  description: z.string().optional(),
  originCountry: z.string().optional(),
  destinationCountry: z.string().optional(),
  cnCode: z.string().optional(),
  originalLabelText: z.string().optional(),
  nutrition: z
    .object({
      energy: z.number().optional(),
      fat: z.number().optional(),
      carbs: z.number().optional(),
      protein: z.number().optional(),
      salt: z.number().optional(),
    })
    .optional(),
  productCategory: z.string().optional(),
  endUse: z.enum(["B2C", "B2B", "internal"]).default("B2C"),
  labelSize: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  importerAddress: z.string().optional(),
  bestBeforeDate: z.string().optional(),
  netQuantity: z.string().optional(),
  quidIngredientName: z.string().optional(),
  quidPercentage: z.number().optional(),
  classificationId: z.string().cuid().optional(),
  save: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request);
    const body = await request.json();
    const payload = generateLabelApiSchema.parse(body);

    const generated = await generateLabelAction(payload);
    let labelId: string | null = null;

    if (payload.save) {
      labelId = await saveLabelAction({
        labelData: generated.label,
        complianceScore: generated.complianceScore,
        complianceResults: generated.complianceResults,
        productName: payload.productName,
        productCategory: payload.productCategory,
        originCountry: payload.originCountry,
        destinationCountry: payload.destinationCountry,
        cnCode: payload.cnCode,
        classificationId: payload.classificationId,
      });
    }

    return NextResponse.json(
      {
        ...generated,
        labelId,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
