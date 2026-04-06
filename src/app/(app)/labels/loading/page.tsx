"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { analyzeLabelAction } from "@/server/actions/label-analysis";
import { generateLabelAction } from "@/server/actions/labels";

function parseNumericNutritionValue(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  const normalized = value.replace(",", ".");
  const kcalMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (kcalMatch) {
    const parsed = Number(kcalMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }

  const kjMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kj/i);
  if (kjMatch) {
    const parsed = Number(kjMatch[1]);
    if (Number.isFinite(parsed)) return Number((parsed / 4.184).toFixed(1));
  }

  const numberMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) return undefined;
  const parsed = Number(numberMatch[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function LabelLoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasStartedRef = useRef(false);

  const payloadKey = searchParams.get("payloadKey");
  const classificationId = searchParams.get("classificationId");

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      if (!payloadKey || typeof window === "undefined") {
        router.replace("/labels/new?labelGenerationError=Missing%20label%20payload");
        return;
      }

      const payloadRaw = window.sessionStorage.getItem(payloadKey);
      window.sessionStorage.removeItem(payloadKey);

      if (!payloadRaw) {
        router.replace("/labels/new?labelGenerationError=Label%20payload%20expired.%20Please%20retry.");
        return;
      }

      try {
        const payload = JSON.parse(payloadRaw) as {
          form: any;
          missingFieldsData: Record<string, string | number>;
          classificationId?: string | null;
        };
        const { form, missingFieldsData } = payload;
        const effectiveClassificationId = payload.classificationId || classificationId || null;

        const mergedNutrition = { ...(form.nutrition || {}) };
        if (missingFieldsData?.nutrition_energy !== undefined) {
          mergedNutrition.energy = parseNumericNutritionValue(missingFieldsData.nutrition_energy);
        }
        if (missingFieldsData?.nutrition_fat !== undefined) {
          mergedNutrition.fat = parseNumericNutritionValue(missingFieldsData.nutrition_fat);
        }
        if (missingFieldsData?.nutrition_carbs !== undefined) {
          mergedNutrition.carbs = parseNumericNutritionValue(missingFieldsData.nutrition_carbs);
        }
        if (missingFieldsData?.nutrition_protein !== undefined) {
          mergedNutrition.protein = parseNumericNutritionValue(missingFieldsData.nutrition_protein);
        }
        if (missingFieldsData?.nutrition_salt !== undefined) {
          mergedNutrition.salt = parseNumericNutritionValue(missingFieldsData.nutrition_salt);
        }

        const labelAnalysis = form.originalLabelText
          ? await analyzeLabelAction({
              originalLabelText: form.originalLabelText,
              productCategory: form.productCategory,
              cnCode: form.cnCode || undefined,
              destinationCountry: form.destinationCountry || undefined,
            })
          : null;

        const result = await generateLabelAction({
          productName: form.productName,
          description: form.description,
          originCountry: form.originCountry,
          destinationCountry: form.destinationCountry,
          cnCode: form.cnCode || undefined,
          originalLabelText: form.originalLabelText || undefined,
          productCategory: form.productCategory,
          endUse: form.endUse,
          labelSize: form.labelSize,
          nutrition: mergedNutrition,
          importerAddress:
            form.importerAddress?.companyName && form.importerAddress?.street && form.importerAddress?.city
              ? `${form.importerAddress.companyName}, ${form.importerAddress.street}, ${form.importerAddress.postalCode}, ${form.importerAddress.city}, ${form.importerAddress.country}`
              : (missingFieldsData?.importer_address as string | undefined),
          bestBeforeDate: form.bestBeforeDate || undefined,
          netQuantity: form.netQuantity ? `${form.netQuantity}${form.netQuantityUnit}` : undefined,
          quidIngredientName: form.quidIngredientName?.trim() || undefined,
          quidPercentage: form.quidPercentage ? Number(form.quidPercentage) : undefined,
        });

        const resultKey = `label_result_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem(
          resultKey,
          JSON.stringify({
            ...result,
            labelAnalysis,
          }),
        );

        const nextParams = new URLSearchParams({
          labelGenerationResultKey: resultKey,
        });
        if (effectiveClassificationId) {
          nextParams.set("classificationId", effectiveClassificationId);
        }
        router.replace(`/labels/new?${nextParams.toString()}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to generate label. Please try again.";
        const errorParams = new URLSearchParams({
          labelGenerationError: message,
        });
        if (classificationId) {
          errorParams.set("classificationId", classificationId);
        }
        router.replace(`/labels/new?${errorParams.toString()}`);
      }
    };

    void run();
  }, [classificationId, payloadKey, router]);

  return (
    <LoadingScreen
      variant="fullscreen"
      message="Generating Label"
      subMessage="This can take up to 30-90 seconds depending on product complexity."
      steps={[
        "Analyzing product details",
        "Validating EU market requirements",
        "Generating multilingual label content",
        "Running compliance checks",
      ]}
    />
  );
}
