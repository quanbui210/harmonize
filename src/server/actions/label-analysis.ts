"use server";

import { analyzeLabel, getRequiredFieldsTemplate } from "@/lib/labeling/label-analyzer";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

export interface AnalyzeLabelInput {
  originalLabelText: string;
  productCategory: string;
  cnCode?: string;
  destinationCountry?: string;
}

export async function analyzeLabelAction(
  input: AnalyzeLabelInput
): Promise<ReturnType<typeof analyzeLabel>> {
  await requireAuthenticatedUser();
  return await analyzeLabel(
    input.originalLabelText,
    input.productCategory,
    input.cnCode,
    input.destinationCountry,
  );
}

export async function getRequiredFieldsTemplateAction(
  productCategory: string
): Promise<ReturnType<typeof getRequiredFieldsTemplate>> {
  await requireAuthenticatedUser();
  return getRequiredFieldsTemplate(productCategory);
}

