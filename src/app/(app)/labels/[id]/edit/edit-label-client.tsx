"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LabelPreview } from "@/components/labeling/label-preview";
import { ComplianceAuditReport } from "@/components/labeling/compliance-audit-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Save, WandSparkles } from "lucide-react";
import {
  calculateComplianceScore,
  runComplianceChecks,
  type LabelData,
  type ComplianceResult,
} from "@/lib/labeling/compliance-checker";
import { getRegulatoryProductType } from "@/lib/regulatory/product-type";
import { translateIngredientsAction, translateLabelTextsAction, updateLabelAction } from "@/server/actions/labels";

interface EditLabelClientProps {
  labelId: string;
  initialLabelData: any;
  initialComplianceScore: number;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function EditLabelClient({
  labelId,
  initialLabelData,
  initialComplianceScore,
}: EditLabelClientProps) {
  const router = useRouter();
  const [labelData, setLabelData] = useState<any>(clone(initialLabelData));
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[]>(
    Array.isArray(initialLabelData?.complianceResults) ? initialLabelData.complianceResults : [],
  );
  const [complianceScore, setComplianceScore] = useState<number>(initialComplianceScore);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productCategory = labelData?.productCategory || "food";
  const productName =
    typeof labelData?.productName === "string"
      ? labelData.productName
      : labelData?.productName?.original || "Product Label";

  const resolveProductTypeForChecks = useMemo(() => {
    const normalized = String(productCategory).toLowerCase();
    if (
      normalized.includes("food") ||
      normalized.includes("beverage") ||
      normalized.includes("drink") ||
      normalized.includes("meat") ||
      normalized.includes("dried") ||
      normalized.includes("snack")
    ) {
      return "FOOD" as const;
    }
    if (normalized.includes("cosmetic")) return "COSMETICS" as const;
    if (normalized.includes("toy")) return "TOYS" as const;
    if (
      normalized.includes("electronic") ||
      normalized.includes("appliance") ||
      normalized.includes("battery") ||
      normalized.includes("machinery") ||
      normalized.includes("device")
    ) {
      return "ELECTRONICS" as const;
    }
    return labelData?.cnCode ? getRegulatoryProductType(labelData.cnCode) : "GENERAL";
  }, [productCategory, labelData?.cnCode]);

  const setField = (updater: (prev: any) => any) => {
    setLabelData((prev: any) => updater(prev));
  };

  const setIngredient = (index: number, key: "name" | "percentage" | "isAllergen", value: string | number | boolean) => {
    setField((prev) => {
      const ingredients = Array.isArray(prev.ingredients) ? [...prev.ingredients] : [];
      const ingredient = { ...(ingredients[index] || {}) };
      if (key === "percentage") {
        const parsed = typeof value === "number" ? value : Number(value);
        ingredient.percentage = Number.isFinite(parsed) ? parsed : undefined;
      } else if (key === "isAllergen") {
        ingredient.isAllergen = Boolean(value);
      } else {
        ingredient.name = String(value);
        const locale = prev?.market?.renderLocales?.[0] || prev?.market?.requiredLocales?.[0] || "en";
        ingredient.translations = {
          ...(ingredient.translations || {}),
          [locale]: String(value),
        };
      }
      ingredients[index] = ingredient;
      return { ...prev, ingredients };
    });
  };

  const runChecks = (nextLabel: any) => {
    const checksData: LabelData = {
      productName: nextLabel.productName,
      ingredients: Array.isArray(nextLabel.ingredients) ? nextLabel.ingredients : [],
      nutritionInfo: nextLabel.nutritionInfo || { energy: 0, fat: 0, carbs: 0, protein: 0, salt: 0 },
      warnings: Array.isArray(nextLabel.warnings) ? nextLabel.warnings : [],
      importerAddress: nextLabel.importerAddress || "",
      bestBeforeDate: nextLabel.bestBeforeDate || "",
      labelDimensions: nextLabel.labelDimensions || { width: 100, height: 150 },
      fontSize: nextLabel.fontSize || 10,
    };

    const results = runComplianceChecks(checksData, resolveProductTypeForChecks, {
      destinationCountry: nextLabel.destinationCountry,
      requiredLocales: nextLabel.market?.requiredLocales,
      endUse: nextLabel.endUse || "B2C",
    });

    setComplianceResults(results);
    setComplianceScore(calculateComplianceScore(results));
    return { results, score: calculateComplianceScore(results) };
  };

  const getRequiredLocales = (label: any): string[] => {
    const required = Array.isArray(label?.market?.requiredLocales)
      ? label.market.requiredLocales
      : [];
    const normalized = required
      .map((locale: string) => String(locale || "").toLowerCase().trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : ["en"];
  };

  const enrichIngredientTranslations = async (label: any) => {
    const locales = getRequiredLocales(label).filter((locale) => locale !== "en");
    if (locales.length === 0) return label;

    const ingredients = Array.isArray(label.ingredients) ? label.ingredients : [];
    const candidates = ingredients
      .map((ingredient: any, index: number) => ({ ingredient, index }))
      .filter(({ ingredient }: { ingredient: any; index: number }) => String(ingredient?.name || "").trim().length > 0)
      .filter(({ ingredient }: { ingredient: any; index: number }) =>
        locales.some((locale) => {
          const existing = String(ingredient?.translations?.[locale] || "").trim();
          const source = String(ingredient?.name || "").trim();
          return !existing || existing.toLowerCase() === source.toLowerCase();
        }),
      );

    if (candidates.length === 0) return label;

    const translated = await translateIngredientsAction({
      ingredients: candidates.map(({ ingredient }: { ingredient: any; index: number }) => String(ingredient.name)),
      targetLocales: locales,
      destinationCountry: label.destinationCountry,
    });

    const next = clone(label);
    for (let i = 0; i < candidates.length; i += 1) {
      const targetIndex = candidates[i].index;
      const translations = translated[i]?.translations || {};
      const ingredient = next.ingredients?.[targetIndex];
      if (!ingredient) continue;
      ingredient.translations = {
        ...(ingredient.translations || {}),
      };
      for (const locale of locales) {
        const translatedText = String(translations[locale] || "").trim();
        if (translatedText) {
          ingredient.translations[locale] = translatedText;
        }
      }
    }
    return next;
  };

  const enrichLabelTextTranslations = async (label: any) => {
    const locales = getRequiredLocales(label).filter((locale) => locale !== "en");
    if (locales.length === 0) return label;

    const textSources = new Set<string>();
    if (typeof label.storageInstructions === "string" && label.storageInstructions.trim().length > 0) {
      textSources.add(label.storageInstructions.trim());
    }
    for (const warning of Array.isArray(label.warnings) ? label.warnings : []) {
      const text = String(warning || "").trim();
      if (text) textSources.add(text);
    }
    if (textSources.size === 0) return label;

    const translated = await translateLabelTextsAction({
      texts: Array.from(textSources),
      targetLocales: locales,
      destinationCountry: label.destinationCountry,
    });

    const translationBySource = new Map(
      translated.map((item) => [String(item.source || "").trim().toLowerCase(), item.translations || {}]),
    );
    const formatLocalized = (source: string) => {
      const sourceText = String(source || "").trim();
      const localeValues = translationBySource.get(sourceText.toLowerCase()) || {};
      const localizedParts = locales
        .map((locale) => String(localeValues[locale] || "").trim())
        .filter(Boolean);
      const uniqueLocalized = Array.from(new Set(localizedParts));
      return uniqueLocalized.length > 0 ? uniqueLocalized.join(" / ") : sourceText;
    };

    const next = clone(label);
    if (typeof next.storageInstructions === "string" && next.storageInstructions.trim().length > 0) {
      next.storageInstructions = formatLocalized(next.storageInstructions);
    }
    if (Array.isArray(next.warnings)) {
      next.warnings = next.warnings.map((warning: string) => formatLocalized(warning));
    }
    return next;
  };

  const enrichLabelTranslations = async (label: any) => {
    const withIngredients = await enrichIngredientTranslations(label);
    return enrichLabelTextTranslations(withIngredients);
  };

  const autoFixComplianceIssues = async (label: any) => {
    let next = clone(label);
    next = await enrichLabelTranslations(next);

    const requiredLocales = getRequiredLocales(next);
    if (typeof next.productName === "object" && next.productName) {
      next.productName.translations = { ...(next.productName.translations || {}) };
      for (const locale of requiredLocales) {
        if (!String(next.productName.translations[locale] || "").trim()) {
          next.productName.translations[locale] = next.productName.original || "Product";
        }
      }
    }

    if (Array.isArray(next.ingredients)) {
      next.ingredients = next.ingredients.map((ingredient: any) =>
        ingredient?.isAllergen ? { ...ingredient, isHighlighted: true } : ingredient,
      );

      const normalize = (value: string) =>
        String(value || "")
          .toLowerCase()
          .replace(/[%.,/#!$^&*;:{}=\-_`~()'"[\]\\|?<>+]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const productNameText = [
        String(next?.productName?.original || ""),
        ...Object.values(next?.productName?.translations || {}),
      ]
        .map((value) => String(value || ""))
        .join(" ");
      const normalizedProductName = ` ${normalize(productNameText)} `;
      const quidTargets = next.ingredients.filter((ingredient: any) => {
        const candidates = [ingredient?.name, ...Object.values(ingredient?.translations || {})]
          .map((value) => normalize(String(value || "")))
          .filter((value) => value.length >= 3);
        return candidates.some((candidate) => normalizedProductName.includes(` ${candidate} `));
      });
      const missingPercentages = quidTargets.filter((ingredient: any) => !Number.isFinite(Number(ingredient?.percentage)));
      if (missingPercentages.length > 0) {
        const currentTotal = next.ingredients.reduce((sum: number, ingredient: any) => {
          const value = Number(ingredient?.percentage);
          return Number.isFinite(value) ? sum + value : sum;
        }, 0);
        const remaining = Math.max(100 - currentTotal, 0);
        const fallbackValue = remaining > 0
          ? Number((remaining / missingPercentages.length).toFixed(1))
          : 1;
        next.ingredients = next.ingredients.map((ingredient: any) => {
          if (!missingPercentages.includes(ingredient)) return ingredient;
          return { ...ingredient, percentage: fallbackValue };
        });
      }

      next.ingredients = next.ingredients.map((ingredient: any) => {
        const code = String(ingredient?.code || "").toUpperCase().trim();
        if (code.startsWith("E") && !String(ingredient?.functionalClass || "").trim()) {
          return { ...ingredient, functionalClass: "Additive" };
        }
        return ingredient;
      });
    }

    if (typeof next.fontSize !== "number" || next.fontSize < 7) {
      next.fontSize = 7;
    }

    const lowerAddress = String(next.importerAddress || "").toLowerCase();
    const euCountryKeywords = [
      "finland", "sweden", "denmark", "germany", "france", "italy", "spain",
      "netherlands", "belgium", "austria", "poland", "portugal", "greece",
      "ireland", "czech", "romania", "hungary", "bulgaria", "croatia",
      "slovakia", "slovenia", "estonia", "latvia", "lithuania", "luxembourg",
      "malta", "cyprus",
    ];
    const hasEuCountryInAddress = euCountryKeywords.some((country) => lowerAddress.includes(country));
    const destinationCountry = String(next.destinationCountry || "").trim();
    if (!hasEuCountryInAddress && destinationCountry) {
      const address = String(next.importerAddress || "").trim();
      next.importerAddress = address ? `${address}, ${destinationCountry}` : destinationCountry;
    }

    const destination = String(next.destinationCountry || "").toLowerCase();
    const saltValue = Number(next?.nutritionInfo?.salt || 0);
    if (destination.includes("finland") && saltValue > 1.2) {
      const fiWarning = "Voimakassuolainen";
      const svWarning = "Kraftigt saltad";
      const existingWarnings = Array.isArray(next.warnings) ? next.warnings.map((w: string) => String(w || "").trim()) : [];
      const hasHighSalt = existingWarnings.some((warning: string) => {
        const lower = warning.toLowerCase();
        return lower.includes(fiWarning.toLowerCase()) || lower.includes(svWarning.toLowerCase());
      });
      if (!hasHighSalt) {
        next.warnings = [...existingWarnings, `${fiWarning} / ${svWarning}`];
      }
    }

    return next;
  };

  const handleAutoTranslateIngredients = async () => {
    setError(null);
    setIsTranslating(true);
    try {
      const next = await enrichLabelTranslations(clone(labelData));
      setLabelData(next);
    } catch (err: any) {
      setError(err?.message || "Failed to translate ingredients");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      let nextLabel = clone(labelData);
      nextLabel.warnings = Array.isArray(nextLabel.warnings)
        ? nextLabel.warnings.filter((w: string) => String(w).trim() !== "")
        : [];
      nextLabel = await enrichLabelTranslations(nextLabel);
      setLabelData(nextLabel);

      const { results, score } = runChecks(nextLabel);

      await updateLabelAction({
        labelId,
        labelData: nextLabel,
        complianceScore: score,
        complianceResults: results,
        productName:
          typeof nextLabel.productName === "string"
            ? nextLabel.productName
            : nextLabel.productName?.original || "Product",
        productCategory: nextLabel.productCategory,
        originCountry: nextLabel.originCountry,
        destinationCountry: nextLabel.destinationCountry,
        cnCode: nextLabel.cnCode,
      });

      router.push(`/labels/${labelId}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to update label");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoFix = async () => {
    setError(null);
    setIsAutoFixing(true);
    try {
      const next = await autoFixComplianceIssues(clone(labelData));
      setLabelData(next);
      const { results } = runChecks(next);
      const stillFailing = results.filter((result) => !result.passed && result.severity !== "INFO").length;
      if (stillFailing > 0) {
        setError(`Auto-fix applied common fixes, but ${stillFailing} issue(s) still need manual review.`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to auto-fix compliance issues");
    } finally {
      setIsAutoFixing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/labels/${labelId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Label
          </Link>
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isTranslating || isAutoFixing}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Edit Saved Label</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input
                value={typeof labelData.productName === "string" ? labelData.productName : labelData.productName?.original || ""}
                onChange={(e) =>
                  setField((prev) => ({
                    ...prev,
                    productName:
                      typeof prev.productName === "string"
                        ? e.target.value
                        : { ...(prev.productName || {}), original: e.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Best Before Date</Label>
              <Input value={labelData.bestBeforeDate || ""} onChange={(e) => setField((prev) => ({ ...prev, bestBeforeDate: e.target.value }))} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Net Quantity</Label>
              <Input value={labelData.netQuantity || ""} onChange={(e) => setField((prev) => ({ ...prev, netQuantity: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Importer / Company Address</Label>
              <Textarea rows={2} value={labelData.importerAddress || ""} onChange={(e) => setField((prev) => ({ ...prev, importerAddress: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Warnings (one per line)</Label>
            <Textarea
              rows={3}
              value={Array.isArray(labelData.warnings) ? labelData.warnings.join("\n") : ""}
              onChange={(e) =>
                setField((prev) => ({
                  ...prev,
                  warnings: e.target.value.split("\n").map((line) => line.trim()),
                }))
              }
            />
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <Label>Nutrition (per 100g / 100ml)</Label>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Energy (kcal)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={labelData.nutritionInfo?.energy ?? ""}
                  onChange={(e) =>
                    setField((prev) => ({
                      ...prev,
                      nutritionInfo: {
                        ...(prev.nutritionInfo || {}),
                        energy: Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fat (g)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={labelData.nutritionInfo?.fat ?? ""}
                  onChange={(e) =>
                    setField((prev) => ({
                      ...prev,
                      nutritionInfo: {
                        ...(prev.nutritionInfo || {}),
                        fat: Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carbs (g)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={labelData.nutritionInfo?.carbs ?? ""}
                  onChange={(e) =>
                    setField((prev) => ({
                      ...prev,
                      nutritionInfo: {
                        ...(prev.nutritionInfo || {}),
                        carbs: Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Protein (g)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={labelData.nutritionInfo?.protein ?? ""}
                  onChange={(e) =>
                    setField((prev) => ({
                      ...prev,
                      nutritionInfo: {
                        ...(prev.nutritionInfo || {}),
                        protein: Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Salt (g)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={labelData.nutritionInfo?.salt ?? ""}
                  onChange={(e) =>
                    setField((prev) => ({
                      ...prev,
                      nutritionInfo: {
                        ...(prev.nutritionInfo || {}),
                        salt: Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <Label>Ingredients</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAutoFix} disabled={isAutoFixing || isSaving || isTranslating}>
                  {isAutoFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                  Auto-fix Compliance
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleAutoTranslateIngredients} disabled={isTranslating || isAutoFixing || isSaving}>
                  {isTranslating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Auto-translate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setField((prev) => ({
                      ...prev,
                      ingredients: [
                        { name: "", percentage: undefined, isAllergen: false, isHighlighted: false, translations: {} },
                        ...(Array.isArray(prev.ingredients) ? prev.ingredients : []),
                      ],
                    }))
                  }
                >
                  Add Ingredient
                </Button>
              </div>
            </div>

            {(Array.isArray(labelData.ingredients) ? labelData.ingredients : []).map((ingredient: any, index: number) => (
              <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-6">
                <Input
                  className="md:col-span-3"
                  placeholder="Ingredient name"
                  value={ingredient?.name || ""}
                  onChange={(e) => setIngredient(index, "name", e.target.value)}
                />
                <Input
                  className="md:col-span-1"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={ingredient?.percentage ?? ""}
                  onChange={(e) => setIngredient(index, "percentage", e.target.value)}
                />
                <label className="md:col-span-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(ingredient?.isAllergen)}
                    onChange={(e) => setIngredient(index, "isAllergen", e.target.checked)}
                  />
                  Allergen
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="md:col-span-1"
                  onClick={() =>
                    setField((prev) => ({
                      ...prev,
                      ingredients: (Array.isArray(prev.ingredients) ? prev.ingredients : []).filter((_: any, idx: number) => idx !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Updated Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <LabelPreview labelData={labelData} productCategory={productCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compliance Audit</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceAuditReport
              productName={labelData?.productName || "Product"}
              originCountry={labelData?.originCountry || ""}
              complianceResults={complianceResults}
            />
            <div className="mt-4 text-sm font-medium">Compliance Score: {complianceScore}%</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
