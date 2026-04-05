"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  exportLabelPDFAction,
  exportLabelSVGAction,
  saveLabelAction,
  translateIngredientsAction,
  translateLabelTextsAction,
} from "@/server/actions/labels";
import { analyzeLabelAction } from "@/server/actions/label-analysis";
import { getClassificationsForLabelAction, getClassificationAction } from "@/server/actions/classifications";
import {
  calculateComplianceScore,
  runComplianceChecks,
  type LabelData,
  type ComplianceResult,
} from "@/lib/labeling/compliance-checker";
import { getRegulatoryProductType } from "@/lib/regulatory/product-type";
import { LABEL_SIZES, type LabelSize } from "@/lib/labeling/label-renderer";
import type { MissingField, LabelAnalysis } from "@/lib/labeling/label-analyzer";
import { LabelImageUpload } from "@/components/labeling/label-image-upload";
import { ProductImageSelector } from "@/components/labeling/product-image-selector";
import { LabelPreview } from "@/components/labeling/label-preview";
import { ComplianceAuditReport } from "@/components/labeling/compliance-audit-report";
import { LabelWizardSteps } from "@/components/labeling/label-wizard-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, Download, FileText, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Save, Info, Pencil, Check, X, WandSparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


interface FormState {
  productName: string;
  description: string;
  originCountry: string;
  destinationCountry: string;
  cnCode: string;
  originalLabelText: string;
  productCategory: string;
  endUse: "B2C" | "B2B" | "internal";
  labelSize: LabelSize;
  bestBeforeDate: string;
  netQuantity: string;
  netQuantityUnit: "g" | "kg";
  quidIngredientName: string;
  quidPercentage: string;
  importerAddress: {
    companyName: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  nutrition: {
    energy?: number;
    fat?: number;
    carbs?: number;
    protein?: number;
    salt?: number;
  };
}

const initialForm: FormState = {
  productName: "",
  description: "",
  originCountry: "",
  destinationCountry: "Finland",
  cnCode: "",
  originalLabelText: "",
  productCategory: "food",
  endUse: "B2C",
  labelSize: LABEL_SIZES[2], // Standard 100×150mm
  bestBeforeDate: "",
  netQuantity: "",
  netQuantityUnit: "g" as const,
  quidIngredientName: "",
  quidPercentage: "",
  importerAddress: {
    companyName: "",
    street: "",
    postalCode: "",
    city: "",
    country: "Finland",
  },
  nutrition: {},
};

function parseNumericNutritionValue(value: string | number | undefined, key: keyof FormState["nutrition"]): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const normalized = value.replace(",", ".");
  if (key === "energy") {
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
  }

  const numberMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) {
    return undefined;
  }

  const parsed = Number(numberMatch[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function NewLabelPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[]>([]);
  const [generatedLabel, setGeneratedLabel] = useState<any>(null);
  const [editedLabel, setEditedLabel] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelAnalysis, setLabelAnalysis] = useState<LabelAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslatingIngredients, setIsTranslatingIngredients] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [missingFieldsData, setMissingFieldsData] = useState<Record<string, string | number>>({});
  const [showMissingFieldsForm, setShowMissingFieldsForm] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [showNutritionForm, setShowNutritionForm] = useState(false);
  const [selectedClassificationId, setSelectedClassificationId] = useState<string>("");
  const [isNavigatingToGenerate, setIsNavigatingToGenerate] = useState(false);
  const [classifications, setClassifications] = useState<Array<{
    id: string;
    productName: string;
    cnCode: string;
    description: string;
    originCountry: string;
    htsCode: string;
    createdAt: Date;
  }>>([]);
  const [isLoadingClassifications, setIsLoadingClassifications] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const isPending = isNavigatingToGenerate;

  const resolveProductTypeForChecks = () => {
    const normalized = (form.productCategory || "").toLowerCase();
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
    if (normalized.includes("cosmetic")) {
      return "COSMETICS" as const;
    }
    if (normalized.includes("toy")) {
      return "TOYS" as const;
    }
    if (
      normalized.includes("electronic") ||
      normalized.includes("appliance") ||
      normalized.includes("battery") ||
      normalized.includes("machinery") ||
      normalized.includes("device")
    ) {
      return "ELECTRONICS" as const;
    }
    return form.cnCode ? getRegulatoryProductType(form.cnCode) : "GENERAL";
  };

  const cloneLabel = (label: any) => JSON.parse(JSON.stringify(label));

  const applyComplianceFromLabel = (label: any) => {
    const labelDataForChecks: LabelData = {
      productName: label.productName,
      ingredients: Array.isArray(label.ingredients) ? label.ingredients : [],
      nutritionInfo: label.nutritionInfo || {
        energy: 0,
        fat: 0,
        carbs: 0,
        protein: 0,
        salt: 0,
      },
      warnings: Array.isArray(label.warnings) ? label.warnings : [],
      importerAddress: label.importerAddress || "",
      bestBeforeDate: label.bestBeforeDate || "",
      labelDimensions: label.labelDimensions || { width: 100, height: 150 },
      fontSize: label.fontSize || 10,
    };

    const results = runComplianceChecks(labelDataForChecks, resolveProductTypeForChecks(), {
      destinationCountry: form.destinationCountry,
      requiredLocales: label.market?.requiredLocales,
      endUse: form.endUse,
    });

    const score = calculateComplianceScore(results);
    setComplianceResults(results);
    setComplianceScore(score);
    return { results, score };
  };

  const getRequiredLocales = (label: any): string[] => {
    const required = Array.isArray(label?.market?.requiredLocales) ? label.market.requiredLocales : [];
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
      destinationCountry: label.destinationCountry || form.destinationCountry,
    });

    const translationBySource = new Map(
      translated.map((item) => [String(item.source || "").trim().toLowerCase(), item.translations || {}]),
    );

    const next = cloneLabel(label);
    for (const { ingredient, index } of candidates) {
      const source = String(ingredient?.name || "").trim();
      const sourceKey = source.toLowerCase();
      const localeValues = translationBySource.get(sourceKey) || {};
      const targetIngredient = next.ingredients?.[index];
      if (!targetIngredient) continue;
      targetIngredient.translations = { ...(targetIngredient.translations || {}) };
      for (const locale of locales) {
        const translatedText = String(localeValues[locale] || "").trim();
        if (translatedText) {
          targetIngredient.translations[locale] = translatedText;
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
      destinationCountry: label.destinationCountry || form.destinationCountry,
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

    const next = cloneLabel(label);
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
    let next = cloneLabel(label);

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
      next.ingredients = next.ingredients.map((ingredient: any) => {
        if (ingredient?.isAllergen) {
          return { ...ingredient, isHighlighted: true };
        }
        return ingredient;
      });

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
    const destinationCountry = String(next.destinationCountry || form.destinationCountry || "").trim();
    if (!hasEuCountryInAddress && destinationCountry) {
      const address = String(next.importerAddress || "").trim();
      next.importerAddress = address ? `${address}, ${destinationCountry}` : destinationCountry;
    }

    const destination = String(next.destinationCountry || form.destinationCountry || "").toLowerCase();
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

  // Load classifications and handle query param on mount
  useEffect(() => {
    const loadClassifications = async () => {
      setIsLoadingClassifications(true);
      try {
        const data = await getClassificationsForLabelAction();
        setClassifications(data);
        
        // Check if classificationId is in query params
        const classificationIdParam = searchParams.get("classificationId");
        if (classificationIdParam) {
          setSelectedClassificationId(classificationIdParam);
          // Load and pre-fill classification data
          try {
            const classification = await getClassificationAction(classificationIdParam);
            setForm((prev) => ({
              ...prev,
              productName: classification.product.name,
              description: classification.product.description || "",
              cnCode: classification.htsCode?.substring(0, 8) || "",
              originCountry: (classification.product.metadata as any)?.originCountry || "",
            }));
          } catch (err) {
            console.error("Failed to load classification:", err);
          }
        }
      } catch (err) {
        console.error("Failed to load classifications:", err);
      } finally {
        setIsLoadingClassifications(false);
      }
    };
    
    loadClassifications();
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const labelGenerationError = searchParams.get("labelGenerationError");
    if (labelGenerationError) {
      setIsNavigatingToGenerate(false);
      setError(decodeURIComponent(labelGenerationError));
      router.replace("/labels/new");
      return;
    }

    const generationResultKey = searchParams.get("labelGenerationResultKey");
    if (!generationResultKey) return;

    const rawResult = window.sessionStorage.getItem(generationResultKey);
    window.sessionStorage.removeItem(generationResultKey);
    setIsNavigatingToGenerate(false);

    if (!rawResult) {
      setError("Label generation result expired. Please generate again.");
      router.replace("/labels/new");
      return;
    }

    try {
      const parsed = JSON.parse(rawResult) as {
        label: any;
        complianceScore: number;
        complianceResults: ComplianceResult[];
        labelAnalysis?: LabelAnalysis | null;
      };

      setGeneratedLabel(parsed.label);
      setEditedLabel(parsed.label ? cloneLabel(parsed.label) : null);
      setComplianceScore(parsed.complianceScore);
      setComplianceResults(parsed.complianceResults || []);
      setLabelAnalysis(parsed.labelAnalysis || null);
      setIsEditMode(false);
      setCurrentStep(2);
      setError(null);
    } catch {
      setError("Failed to read generated label result. Please try again.");
    } finally {
      router.replace("/labels/new");
    }
  }, [router, searchParams]);

  const handleClassificationChange = async (classificationId: string) => {
    setSelectedClassificationId(classificationId);
    if (!classificationId || classificationId === "none") {
      // Reset form if no classification selected
      setSelectedClassificationId("");
      setForm((prev) => ({
        ...prev,
        productName: "",
        description: "",
        cnCode: "",
        originCountry: "",
      }));
      return;
    }
    
    try {
      const classification = await getClassificationAction(classificationId);
      setForm((prev) => ({
        ...prev,
        productName: classification.product.name,
        description: classification.product.description || "",
        cnCode: classification.htsCode?.substring(0, 8) || "",
        originCountry: (classification.product.metadata as any)?.originCountry || "",
      }));
    } catch (err) {
      console.error("Failed to load classification:", err);
      setError("Failed to load classification data");
    }
  };

  const handleChange = (key: keyof FormState, value: any) => {
    // Special handling for originalLabelText - detect and parse JSON if pasted
    if (key === "originalLabelText" && typeof value === "string") {
      // Helper function to extract plain text from JSON
      const extractTextFromJSON = (jsonString: string): { text: string; bestBeforeDate?: string; netQuantity?: string } | null => {
        let trimmed = jsonString.trim();
        
        // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
        trimmed = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        
        // Check if it looks like JSON (starts with { and contains "text" key)
        if (!trimmed.startsWith("{") || (!trimmed.includes('"text"') && !trimmed.includes('"text"'))) {
          return null;
        }
        
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object" && parsed.text && typeof parsed.text === "string") {
            return {
              text: parsed.text,
              bestBeforeDate: parsed.bestBeforeDate,
              netQuantity: parsed.netQuantity,
            };
          }
        } catch (e) {
          // Not valid JSON, return null
          return null;
        }
        
        return null;
      };
      
      // Try to extract text from JSON
      const extracted = extractTextFromJSON(value);
      
      if (extracted) {
        // It's JSON from OCR - extract structured data and show only plain text
        let netQuantityValue = "";
        let netQuantityUnit: "g" | "kg" = "g";
        if (extracted.netQuantity && typeof extracted.netQuantity === "string") {
          const match = extracted.netQuantity.match(/^(\d+)/) || extracted.netQuantity.match(/(\d+)/);
          netQuantityValue = match ? match[1] : extracted.netQuantity.replace(/[^0-9]/g, "");
          // Detect unit (kg or g)
          const lowerQuantity = extracted.netQuantity.toLowerCase();
          if (lowerQuantity.includes("kg") || lowerQuantity.includes("kilogram")) {
            netQuantityUnit = "kg";
          }
        }
        
        // Update form with extracted data - ONLY plain text in textarea
        setForm((prev) => ({
          ...prev,
          originalLabelText: extracted.text, // Only plain text in textarea, never JSON
          bestBeforeDate: extracted.bestBeforeDate && typeof extracted.bestBeforeDate === "string" && extracted.bestBeforeDate.trim() !== "" 
            ? extracted.bestBeforeDate 
            : prev.bestBeforeDate,
          netQuantity: netQuantityValue || prev.netQuantity,
          netQuantityUnit: netQuantityValue ? netQuantityUnit : prev.netQuantityUnit,
        }));
        return; // Don't set the JSON string as the value
      }
      
      // Not JSON or parsing failed - treat as plain text and set normally
    }
    
    // Normal update for all other cases
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNutritionChange = (key: keyof FormState["nutrition"], value: string) => {
    const parsedValue = parseNumericNutritionValue(value, key);
    setForm((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        [key]: parsedValue,
      },
    }));
  };

  const canGenerateLabel = () => {
    if (!labelAnalysis) return false;
    // Check if importer address is provided (from Step 1 form)
    const hasImporterAddress = 
      form.importerAddress.companyName.trim() !== "" &&
      form.importerAddress.street.trim() !== "" &&
      form.importerAddress.postalCode.trim() !== "" &&
      form.importerAddress.city.trim() !== "" &&
      form.importerAddress.country.trim() !== "";
    
    // Check other critical/required missing fields (excluding importer_address)
    const criticalMissing = labelAnalysis.missingFields.filter(
      (f) => (f.category === "CRITICAL" || f.category === "REQUIRED") && f.fieldId !== "importer_address"
    );
    
    // If there are no critical missing fields (excluding importer), we can proceed
    if (criticalMissing.length === 0) {
      return hasImporterAddress;
    }
    
    const allOtherFieldsFilled = criticalMissing.every((f) => {
      const value = missingFieldsData[f.fieldId];
      // Check if value exists and is not empty
      if (value === undefined || value === null || value === "") {
        return false;
      }
      // For numbers, check it's a valid number (not NaN) and greater than 0
      if (typeof value === "number") {
        return !isNaN(value) && value > 0;
      }
      // For strings, check it's not empty after trimming
      if (typeof value === "string") {
        return value.trim() !== "";
      }
      return true;
    });
    
    return hasImporterAddress && allOtherFieldsFilled;
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      // Validate required fields
      if (!form.productName || !form.destinationCountry) {
        setError("Please fill in all required fields (product name, destination country)");
        return;
      }
      if (!form.bestBeforeDate || !form.netQuantity) {
        setError("Please provide best before date and net quantity");
        return;
      }
      if (!form.importerAddress.companyName || !form.importerAddress.street || 
          !form.importerAddress.postalCode || !form.importerAddress.city || !form.importerAddress.country) {
        setError("Please complete the EU importer address");
        return;
      }
      
      setError(null);
      
      await handleGenerateLabel();
    }
  };

  const handleGenerateLabel = async () => {
    setError(null);

    try {
      const payloadKey = `label_generation_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          payloadKey,
          JSON.stringify({
            form,
            missingFieldsData,
          }),
        );
      }

      setIsNavigatingToGenerate(true);
      router.push(`/labels/loading?payloadKey=${encodeURIComponent(payloadKey)}`);
    } catch (err: any) {
      setError(err?.message || "Failed to generate label");
    }
  };

  const handleSaveLabel = async () => {
    if (!generatedLabel && !editedLabel) {
      setError("Please generate a label first");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      let labelToSave = generatedLabel ? cloneLabel(generatedLabel) : cloneLabel(editedLabel);
      if (isEditMode && editedLabel) {
        labelToSave = cloneLabel(editedLabel);
      }
      if (typeof labelToSave.warnings === "string") {
        labelToSave.warnings = labelToSave.warnings
          .split("\n")
          .map((item: string) => item.trim())
          .filter(Boolean);
      }
      labelToSave = await enrichLabelTranslations(labelToSave);
      setGeneratedLabel(labelToSave);
      if (isEditMode) {
        setEditedLabel(cloneLabel(labelToSave));
        setIsEditMode(false);
      }
      const { results: recalculatedResults, score: recalculatedScore } = applyComplianceFromLabel(labelToSave);

      const resolvedProductName =
        form.productName ||
        (typeof labelToSave.productName === "string"
          ? labelToSave.productName
          : labelToSave.productName?.original) ||
        "Product";

      const labelId = await saveLabelAction({
        labelData: labelToSave,
        complianceScore: recalculatedScore,
        complianceResults: recalculatedResults,
        productName: resolvedProductName,
        productCategory: form.productCategory,
        originCountry: form.originCountry,
        destinationCountry: form.destinationCountry,
        cnCode: form.cnCode,
        classificationId: selectedClassificationId && selectedClassificationId !== "none" ? selectedClassificationId : undefined,
      });

      // Redirect to view page or show success
      router.push(`/labels/${labelId}`);
    } catch (err: any) {
      setError(err?.message || "Failed to save label");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoTranslateEditedIngredients = async () => {
    if (!editedLabel) return;
    setError(null);
    setIsTranslatingIngredients(true);
    try {
      const next = await enrichLabelTranslations(cloneLabel(editedLabel));
      setEditedLabel(next);
    } catch (err: any) {
      setError(err?.message || "Failed to translate ingredients");
    } finally {
      setIsTranslatingIngredients(false);
    }
  };

  const handleAutoFixEditedLabel = async () => {
    if (!editedLabel) return;
    setError(null);
    setIsAutoFixing(true);
    try {
      const next = await autoFixComplianceIssues(cloneLabel(editedLabel));
      setEditedLabel(next);
      const { results } = applyComplianceFromLabel(next);
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

  const handleExportPDF = async () => {
    if (!generatedLabel) return;
    try {
      const pdfBytes = await exportLabelPDFAction(generatedLabel, form.productCategory);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.productName.replace(/\s+/g, "_")}_label.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to export PDF");
    }
  };

  const handleExportSVG = async () => {
    if (!generatedLabel) return;
    try {
      const svg = await exportLabelSVGAction(generatedLabel, form.productCategory);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.productName.replace(/\s+/g, "_")}_label.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to export SVG");
    }
  };

  const startEditLabel = () => {
    if (!generatedLabel) return;
    setEditedLabel(cloneLabel(generatedLabel));
    setIsEditMode(true);
    setError(null);
  };

  const cancelEditLabel = () => {
    setEditedLabel(generatedLabel ? cloneLabel(generatedLabel) : null);
    setIsEditMode(false);
  };

  const updateEditedLabel = (updater: (prev: any) => any) => {
    setEditedLabel((prev: any) => {
      if (!prev) return prev;
      return updater(prev);
    });
  };

  const handleEditedIngredientChange = (index: number, key: "name" | "percentage" | "isAllergen" | "isHighlighted", value: string | number | boolean) => {
    updateEditedLabel((prev) => {
      const ingredients = Array.isArray(prev.ingredients) ? [...prev.ingredients] : [];
      const ingredient = { ...(ingredients[index] || {}) };
      if (key === "percentage") {
        const parsed = typeof value === "number" ? value : Number(value);
        ingredient.percentage = Number.isFinite(parsed) ? parsed : undefined;
      } else if (key === "isAllergen" || key === "isHighlighted") {
        ingredient[key] = Boolean(value);
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

  const addEditedIngredient = () => {
    updateEditedLabel((prev) => ({
      ...prev,
      ingredients: [
        {
          name: "",
          percentage: undefined,
          isAllergen: false,
          isHighlighted: false,
          translations: {},
        },
        ...(Array.isArray(prev.ingredients) ? prev.ingredients : []),
      ],
    }));
  };

  const removeEditedIngredient = (index: number) => {
    updateEditedLabel((prev) => ({
      ...prev,
      ingredients: (Array.isArray(prev.ingredients) ? prev.ingredients : []).filter((_: any, idx: number) => idx !== index),
    }));
  };

  const applyLabelEdits = async () => {
    if (!editedLabel) return;
    setError(null);
    setIsTranslatingIngredients(true);
    try {
      let nextLabel = cloneLabel(editedLabel);
      if (typeof nextLabel.warnings === "string") {
        nextLabel.warnings = nextLabel.warnings
          .split("\n")
          .map((item: string) => item.trim())
          .filter(Boolean);
      }
      nextLabel = await enrichLabelTranslations(nextLabel);
      setGeneratedLabel(nextLabel);
      setEditedLabel(cloneLabel(nextLabel));
      applyComplianceFromLabel(nextLabel);
      setIsEditMode(false);
    } catch (err: any) {
      setError(err?.message || "Failed to apply label edits");
    } finally {
      setIsTranslatingIngredients(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setComplianceResults([]);
    setComplianceScore(null);
    setGeneratedLabel(null);
    setEditedLabel(null);
    setIsEditMode(false);
    setError(null);
    setLabelAnalysis(null);
    setMissingFieldsData({});
    setShowMissingFieldsForm(false);
    setCurrentStep(1);
    setShowNutritionForm(false);
    // Reset file input if using ref
  };

  const handleLabelTextExtracted = (text: string) => {
    // OCR returns JSON string - parse it and extract only the text
    // This function is called when OCR extracts text from an image
    if (!text || typeof text !== "string") {
      return; // Invalid input
    }
    
    // Helper function to extract plain text from JSON
    const extractTextFromJSON = (jsonString: string): { 
      text: string; 
      bestBeforeDate?: string; 
      netQuantity?: string;
      nutrition?: {
        energyKJ?: number | null;
        energyKcal?: number | null;
        fat?: number | null;
        carbs?: number | null;
        protein?: number | null;
        salt?: number | null;
      }
    } | null => {
      let trimmed = jsonString.trim();
      
      // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
      trimmed = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(trimmed);
        
        if (parsed && typeof parsed === "object" && parsed.text && typeof parsed.text === "string") {
          return {
            text: parsed.text,
            bestBeforeDate: parsed.bestBeforeDate,
            netQuantity: parsed.netQuantity,
            nutrition: parsed.nutrition,
          };
        }
      } catch (e) {
        // Not valid JSON, return null
        return null;
      }
      
      return null;
    };
    
    // Try to extract text from JSON
    const extracted = extractTextFromJSON(text);
    
    if (extracted) {
      // Successfully parsed JSON - extract only the plain text
      let netQuantityValue = "";
      let netQuantityUnit: "g" | "kg" = "g";
      if (extracted.netQuantity && typeof extracted.netQuantity === "string") {
        // Match numbers at the start or extract all digits
        const match = extracted.netQuantity.match(/^(\d+)/) || extracted.netQuantity.match(/(\d+)/);
        netQuantityValue = match ? match[1] : extracted.netQuantity.replace(/[^0-9]/g, "");
        // Detect unit (kg or g)
        const lowerQuantity = extracted.netQuantity.toLowerCase();
        if (lowerQuantity.includes("kg") || lowerQuantity.includes("kilogram")) {
          netQuantityUnit = "kg";
        }
      }
      
      // Update form with extracted data - ONLY plain text goes to textarea
      setForm((prev) => ({ 
        ...prev, 
        originalLabelText: extracted.text, // CRITICAL: Only the plain text, NOT the JSON
        bestBeforeDate: extracted.bestBeforeDate && typeof extracted.bestBeforeDate === "string" && extracted.bestBeforeDate.trim() !== "" 
          ? extracted.bestBeforeDate 
          : prev.bestBeforeDate,
        netQuantity: netQuantityValue || prev.netQuantity,
        netQuantityUnit: netQuantityValue ? netQuantityUnit : prev.netQuantityUnit,
        nutrition: extracted.nutrition ? {
          energy: extracted.nutrition.energyKcal ?? extracted.nutrition.energyKJ ? Math.round((extracted.nutrition.energyKJ || 0) / 4.184) : prev.nutrition.energy,
          fat: extracted.nutrition.fat ?? prev.nutrition.fat,
          carbs: extracted.nutrition.carbs ?? prev.nutrition.carbs,
          protein: extracted.nutrition.protein ?? prev.nutrition.protein,
          salt: extracted.nutrition.salt ?? prev.nutrition.salt,
        } : prev.nutrition,
      }));
      return; // Exit early - don't set the JSON string
    }
    
    // Fallback: If not JSON or doesn't have text property, treat as plain text
    // This should only happen if OCR returns plain text (backward compatibility)
    setForm((prev) => ({ ...prev, originalLabelText: text }));
  };
  
  // Effect to parse JSON if it's already in the textarea (fix for existing JSON)
  useEffect(() => {
    if (form.originalLabelText) {
      let trimmed = form.originalLabelText.trim();
      
      // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
      trimmed = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      
      // Check if it looks like JSON with text field
      if (trimmed.startsWith("{") && (trimmed.includes('"text"') || trimmed.includes("text"))) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object" && parsed.text && typeof parsed.text === "string") {
          // It's JSON - extract the text and replace with plain text only
          let netQuantityValue = "";
          let netQuantityUnit: "g" | "kg" = "g";
          if (parsed.netQuantity && typeof parsed.netQuantity === "string") {
            const match = parsed.netQuantity.match(/^(\d+)/) || parsed.netQuantity.match(/(\d+)/);
            netQuantityValue = match ? match[1] : parsed.netQuantity.replace(/[^0-9]/g, "");
            // Detect unit (kg or g)
            const lowerQuantity = parsed.netQuantity.toLowerCase();
            if (lowerQuantity.includes("kg") || lowerQuantity.includes("kilogram")) {
              netQuantityUnit = "kg";
            }
          }
          
          setForm((prev) => ({
            ...prev,
            originalLabelText: parsed.text, // Replace JSON with plain text only
            bestBeforeDate: parsed.bestBeforeDate && typeof parsed.bestBeforeDate === "string" && parsed.bestBeforeDate.trim() !== "" 
              ? parsed.bestBeforeDate 
              : prev.bestBeforeDate,
            netQuantity: netQuantityValue || prev.netQuantity,
            netQuantityUnit: netQuantityValue ? netQuantityUnit : prev.netQuantityUnit,
            nutrition: parsed.nutrition ? {
              energy: parsed.nutrition.energyKcal ?? parsed.nutrition.energyKJ ? Math.round((parsed.nutrition.energyKJ || 0) / 4.184) : prev.nutrition.energy,
              fat: parsed.nutrition.fat ?? prev.nutrition.fat,
              carbs: parsed.nutrition.carbs ?? prev.nutrition.carbs,
              protein: parsed.nutrition.protein ?? prev.nutrition.protein,
              salt: parsed.nutrition.salt ?? prev.nutrition.salt,
            } : prev.nutrition,
          }));
          }
        } catch (e) {
          // Not valid JSON, ignore - keep as is
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - intentionally not including form.originalLabelText to avoid re-parsing on every change

  const handleAnalyzeLabel = async (labelText?: string) => {
    const textToAnalyze = labelText || form.originalLabelText;
    if (!textToAnalyze || !form.productName) {
      setError("Please provide product name and label text first");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const analysis = await analyzeLabelAction({
        originalLabelText: textToAnalyze,
        productCategory: form.productCategory,
        cnCode: form.cnCode || undefined,
        destinationCountry: form.destinationCountry || undefined,
      });

      setLabelAnalysis(analysis);
      
      // Pre-fill nutrition fields if detected in form
      if (form.nutrition) {
        const nutritionData: Record<string, string | number> = {};
        if (form.nutrition.energy) nutritionData["nutrition_energy"] = form.nutrition.energy;
        if (form.nutrition.fat) nutritionData["nutrition_fat"] = form.nutrition.fat;
        if (form.nutrition.carbs) nutritionData["nutrition_carbs"] = form.nutrition.carbs;
        if (form.nutrition.protein) nutritionData["nutrition_protein"] = form.nutrition.protein;
        if (form.nutrition.salt) nutritionData["nutrition_salt"] = form.nutrition.salt;
        setMissingFieldsData(nutritionData);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to analyze label");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMissingFieldChange = (fieldId: string, value: string | number) => {
    setMissingFieldsData((prev) => ({ ...prev, [fieldId]: value }));

    // Auto-update form nutrition if it's a nutrition field
    if (fieldId.startsWith("nutrition_")) {
      const key = fieldId.replace("nutrition_", "") as keyof FormState["nutrition"];
      if (key === "energy" || key === "fat" || key === "carbs" || key === "protein" || key === "salt") {
        handleNutritionChange(key, String(value));
      }
    }
  };

  const getMissingRequiredFields = (): string[] => {
    const missing: string[] = [];
    
    if (!form.productName?.trim()) missing.push("Product name");
    // Origin country is optional - removed from required fields
    if (!form.destinationCountry?.trim()) missing.push("Destination country");
    if (!form.endUse?.trim()) missing.push("End use");
    if (!form.bestBeforeDate?.trim()) missing.push("Best Before Date");
    if (!form.netQuantity?.trim()) missing.push("Net Quantity");
    if (!form.importerAddress.companyName?.trim()) missing.push("Importer Company Name");
    if (!form.importerAddress.street?.trim()) missing.push("Importer Street Address");
    if (!form.importerAddress.postalCode?.trim()) missing.push("Importer Postcode");
    if (!form.importerAddress.city?.trim()) missing.push("Importer City");
    if (!form.importerAddress.country?.trim()) missing.push("Importer Country");
    
    return missing;
  };

  const isGenerateButtonDisabled = (): boolean => {
    return isPending || 
           isAnalyzing || 
           getMissingRequiredFields().length > 0;
  };

  // Render component
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-semibold">Create Product Label</h1>
          <p className="text-sm text-muted-foreground">
            Step-by-step process to generate compliant EU market labels
          </p>
        </div>
        <Button variant="outline" onClick={reset} disabled={isPending}>
          Reset
        </Button>
      </div>

      <LabelWizardSteps currentStep={currentStep} />

      {/* Step 1: Upload & Product Info */}
      {currentStep === 1 && (
        <Card>
            <CardHeader>
              <CardTitle>Step 1: Upload & Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            {/* Classification Selector */}
            <div className="space-y-2">
              <Label htmlFor="classification">Product / Classification (Optional)</Label>
              <Select
                value={selectedClassificationId || undefined}
                onValueChange={handleClassificationChange}
                disabled={isLoadingClassifications}
              >
                <SelectTrigger id="classification">
                  <SelectValue placeholder={isLoadingClassifications ? "Loading..." : "Select a classification to pre-fill form"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Create standalone label)</SelectItem>
                  {classifications.map((classification) => (
                    <SelectItem key={classification.id} value={classification.id}>
                      {classification.productName} {classification.cnCode ? `(CN: ${classification.cnCode})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a classification to automatically fill product name, description, CN code, and origin country.
              </p>
            </div>

            {/* {selectedClassificationId && selectedClassificationId !== "none" && (
              <ProductImageSelector
                classificationId={selectedClassificationId}
                onImageSelected={handleLabelTextExtracted}
                disabled={isPending || isAnalyzing}
              />
            )} */}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Upload Label Image</Label>
              <p className="text-xs text-muted-foreground">
                {selectedClassificationId && selectedClassificationId !== "none"
                  ? "Or upload a new label image. The clearer the text and data visible in the image, the better the extraction results will be."
                  : "Upload a photo of your existing product label. We'll extract the text automatically. The clearer the text and data visible in the image, the better the extraction results will be."}
              </p>
              <LabelImageUpload
                onTextExtracted={handleLabelTextExtracted}
                disabled={isPending || isAnalyzing}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Product name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.productName}
                  onChange={(e) => handleChange("productName", e.target.value)}
                  placeholder="e.g. Dried mango slices"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Product category</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.productCategory}
                  onChange={(e) => handleChange("productCategory", e.target.value)}
                >
                  <option value="food">Food / beverages / dried goods</option>
                  <option value="meat">Meat / fish / dairy</option>
                  <option value="supplements">Supplements / nutrition</option>
                  <option value="cosmetics">Cosmetics / personal care</option>
                  <option value="toys">Toys / juvenile products</option>
                  <option value="electronics">Electronics / appliances / batteries</option>
                  <option value="textiles">Textiles / apparel / footwear</option>
                  <option value="furniture">Furniture / home goods</option>
                  <option value="chemicals">Chemicals / detergents / cleaning</option>
                  <option value="medical">Medical devices</option>
                  <option value="pharma">Pharma / OTC</option>
                  <option value="pet">Pet food / pet products</option>
                  <option value="packaging">Food-contact / packaging</option>
                  <option value="automotive">Automotive parts / machinery / tools</option>
                  <option value="ppe">PPE / safety gear</option>
                  <option value="sports">Sports / outdoor / recreation</option>
                  <option value="jewelry">Jewelry / watches</option>
                  <option value="stationery">Stationery / school supplies</option>
                  <option value="alcohol">Alcohol / tobacco / vape</option>
                  <option value="other">Other / general</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">End use <span className="text-red-500">*</span></label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="End use requirements info"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      B2C requires full consumer-ready label content (EU 1169/2011). B2B can rely on trade documents for some details.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" variant="link" className="h-auto p-0 text-xs">
                      When should I choose each?
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Choose The Correct End Use</DialogTitle>
                      <DialogDescription>
                        This affects the compliance checks and what information the generated output prioritizes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <p><strong>B2C (Retail consumer):</strong> Full consumer label checks, including market language and food-specific QUID rules.</p>
                      <p><strong>B2B (Business only):</strong> Focuses on trade/commercial context. Consumer pack checks are relaxed and should be supported by accompanying documents.</p>
                      <p><strong>Internal:</strong> Draft/internal workflow only. Consumer market checks are skipped and output is for internal review.</p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Select
                value={form.endUse}
                onValueChange={(value) => handleChange("endUse", value as FormState["endUse"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select end use" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2C">B2C - Final consumer retail</SelectItem>
                  <SelectItem value="B2B">B2B - Food service / ingredient processing</SelectItem>
                  <SelectItem value="internal">Internal - Not for market placement</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.endUse === "B2C" && "Runs full consumer compliance checks for destination market labeling."}
                {form.endUse === "B2B" && "Prioritizes trade/commercial output and relaxes some consumer-pack checks."}
                {form.endUse === "internal" && "For internal drafts only; market-facing legal checks are skipped."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">CN code (optional)</label>
                <Input
                  value={form.cnCode}
                  onChange={(e) => handleChange("cnCode", e.target.value)}
                  placeholder="08045000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Label size</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={LABEL_SIZES.findIndex((s) => s.name === form.labelSize.name)}
                  onChange={(e) => {
                    const size = LABEL_SIZES[parseInt(e.target.value)];
                    handleChange("labelSize", size);
                  }}
                >
                  {LABEL_SIZES.map((size, idx) => (
                    <option key={idx} value={idx}>
                      {size.name} ({size.width}×{size.height}mm)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="e.g. Sweetened dried mango slices packaged for retail..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="destination-country">
                  Destination country <span className="text-red-500">*</span>
                </label>
                <Input
                  id="destination-country"
                  name="country-name"
                  autoComplete="country-name"
                  value={form.destinationCountry}
                  onChange={(e) => handleChange("destinationCountry", e.target.value)}
                  placeholder="e.g. Finland"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Best Before Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={form.bestBeforeDate}
                  onChange={(e) => handleChange("bestBeforeDate", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Extracted from label image if available
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Net Quantity <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={form.netQuantity}
                    onChange={(e) => handleChange("netQuantity", e.target.value)}
                    placeholder="e.g. 200"
                    min="0"
                    step="1"
                    className="flex-1"
                  />
                  <Select
                    value={form.netQuantityUnit}
                    onValueChange={(value) => handleChange("netQuantityUnit", value as "g" | "kg")}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Extracted from label image if available
                </p>
              </div>
            </div>

            {(form.productCategory === "food" ||
              form.productCategory === "meat" ||
              form.productCategory === "supplements" ||
              form.productCategory === "pet") && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                <div>
                  <label className="text-sm font-medium">QUID helper (recommended for precise food labels)</label>
                  <p className="text-xs text-muted-foreground">
                    If an ingredient is highlighted in the product name, add it here with its percentage.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="quid-ingredient-name">Main ingredient name</label>
                    <Input
                      id="quid-ingredient-name"
                      value={form.quidIngredientName}
                      onChange={(e) => handleChange("quidIngredientName", e.target.value)}
                      placeholder="e.g. Mango"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="quid-percentage">Main ingredient percentage (%)</label>
                    <Input
                      id="quid-percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.quidPercentage}
                      onChange={(e) => handleChange("quidPercentage", e.target.value)}
                      placeholder="e.g. 95"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  EU Importer Address <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  The address of the EU-based importer is mandatory for products sold in the EU.
                </p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="importer-company-name">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="importer-company-name"
                    name="company"
                    autoComplete="organization"
                    value={form.importerAddress.companyName}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, companyName: e.target.value })}
                    placeholder="e.g. Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="importer-street-address">
                    Street address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="importer-street-address"
                    name="street-address"
                    autoComplete="address-line1"
                    value={form.importerAddress.street}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, street: e.target.value })}
                    placeholder="e.g. Opastinsilta 1"
                  />
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="importer-postal-code">
                    Postcode <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="importer-postal-code"
                    name="postal-code"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={form.importerAddress.postalCode}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, postalCode: e.target.value })}
                    placeholder="e.g. 00520"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="importer-city">
                    City <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="importer-city"
                    name="address-level2"
                    autoComplete="address-level2"
                    value={form.importerAddress.city}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, city: e.target.value })}
                    placeholder="e.g. Helsinki"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="importer-country">
                  Country <span className="text-red-500">*</span>
                </label>
                <Input
                  id="importer-country"
                  name="country-name"
                  autoComplete="country-name"
                  value={form.importerAddress.country}
                  onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, country: e.target.value })}
                  placeholder="e.g. Finland"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Existing label text (optional)</label>
              <Textarea
                rows={4}
                value={form.originalLabelText}
                onChange={(e) => handleChange("originalLabelText", e.target.value)}
                placeholder="Paste text from the original (e.g., Vietnamese) label. Or add more necessary info here for better results."
              />
              <p className="text-xs text-muted-foreground">
                You can paste manually or upload an image above to auto-fill via OCR. You can also add more necessary information here for better label generation results.
              </p>
            </div>

            {/* Nutrition button - only for food-related categories */}
            {(form.productCategory === "food" || 
              form.productCategory === "meat" || 
              form.productCategory === "supplements" || 
              form.productCategory === "pet") && (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNutritionForm(!showNutritionForm)}
                  className="w-full"
                >
                  {showNutritionForm ? "Hide" : "Input"} nutrition info if missing from label
                </Button>
                {showNutritionForm && (
                  <div className="grid gap-3 md:grid-cols-3 p-4 border rounded-md bg-gray-50">
                    <Input
                      type="number"
                      step="1"
                      placeholder="Energy (kcal/100g)"
                      value={form.nutrition.energy ?? ""}
                      onChange={(e) => handleNutritionChange("energy", e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Fat (g/100g)"
                      value={form.nutrition.fat ?? ""}
                      onChange={(e) => handleNutritionChange("fat", e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Carbs (g/100g)"
                      value={form.nutrition.carbs ?? ""}
                      onChange={(e) => handleNutritionChange("carbs", e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Protein (g/100g)"
                      value={form.nutrition.protein ?? ""}
                      onChange={(e) => handleNutritionChange("protein", e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Salt (% or g/100g)"
                      value={form.nutrition.salt ?? ""}
                      onChange={(e) => handleNutritionChange("salt", e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Category-specific fields */}
            {form.productCategory === "electronics" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">CE marking (optional)</label>
                  <Input
                    placeholder="CE marking number or certificate"
                    value={form.cnCode} // Reusing field for now, can add separate state if needed
                    onChange={(e) => handleChange("cnCode", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voltage / Power (optional)</label>
                  <Input
                    placeholder="e.g., 220V, 50Hz, 100W"
                    value={form.description} // Reusing field for now
                    onChange={(e) => handleChange("description", e.target.value)}
                  />
                </div>
              </div>
            )}

            {form.productCategory === "toys" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Age warning (optional)</label>
                <Input
                  placeholder="e.g., Not suitable for children under 36 months"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
            )}

            {form.productCategory === "textiles" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Fiber composition (optional)</label>
                <Textarea
                  rows={2}
                  placeholder="e.g., 60% Cotton, 40% Polyester"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
            )}

            {form.productCategory === "cosmetics" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Ingredients list (optional)</label>
                <Textarea
                  rows={3}
                  placeholder="List of cosmetic ingredients (INCI names)"
                  value={form.originalLabelText}
                  onChange={(e) => handleChange("originalLabelText", e.target.value)}
                />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="pt-6 border-t mt-6 space-y-3">
              {(() => {
                const missingFields = getMissingRequiredFields();
                const isDisabled = isGenerateButtonDisabled();
                
                if (isDisabled && missingFields.length > 0 && !isPending && !isAnalyzing) {
                  return (
                    <div className="rounded-md border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/10 p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                            Please fill in the following required fields:
                          </p>
                          <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-300 space-y-0.5">
                            {missingFields.map((field, idx) => (
                              <li key={idx}>{field}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                if (isPending) {
                  return (
                    <div className="rounded-md border border-blue-500/50 bg-blue-50 dark:bg-blue-900/10 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-800 dark:text-blue-200">
                          Redirecting to generation screen...
                        </span>
                      </div>
                    </div>
                  );
                }
                
                return null;
              })()}
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleNextStep} 
                  disabled={isGenerateButtonDisabled()}
                  size="lg"
                >
                  Generate Label
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Compliance & Result */}
      {currentStep === 2 && generatedLabel && (
        <div className="space-y-6 pb-24">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {isEditMode && editedLabel && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Label Before Save</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Update fields below, then apply edits to refresh compliance and preview.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Product Name</Label>
                    <Input
                      value={editedLabel.productName?.original || ""}
                      onChange={(e) =>
                        updateEditedLabel((prev) => ({
                          ...prev,
                          productName: {
                            ...(prev.productName || {}),
                            original: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Best Before Date</Label>
                    <Input
                      value={editedLabel.bestBeforeDate || ""}
                      onChange={(e) =>
                        updateEditedLabel((prev) => ({
                          ...prev,
                          bestBeforeDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Net Quantity</Label>
                    <Input
                      value={editedLabel.netQuantity || ""}
                      onChange={(e) =>
                        updateEditedLabel((prev) => ({
                          ...prev,
                          netQuantity: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Importer / Company Address</Label>
                    <Textarea
                      rows={2}
                      value={editedLabel.importerAddress || ""}
                      onChange={(e) =>
                        updateEditedLabel((prev) => ({
                          ...prev,
                          importerAddress: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Warnings (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={Array.isArray(editedLabel.warnings) ? editedLabel.warnings.join("\n") : ""}
                    onChange={(e) =>
                      updateEditedLabel((prev) => ({
                        ...prev,
                        warnings: e.target.value
                          .split("\n")
                          .map((item: string) => item.trim())
                          .filter(Boolean),
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
                        value={editedLabel.nutritionInfo?.energy ?? ""}
                        onChange={(e) =>
                          updateEditedLabel((prev) => ({
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
                        value={editedLabel.nutritionInfo?.fat ?? ""}
                        onChange={(e) =>
                          updateEditedLabel((prev) => ({
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
                        value={editedLabel.nutritionInfo?.carbs ?? ""}
                        onChange={(e) =>
                          updateEditedLabel((prev) => ({
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
                        value={editedLabel.nutritionInfo?.protein ?? ""}
                        onChange={(e) =>
                          updateEditedLabel((prev) => ({
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
                        value={editedLabel.nutritionInfo?.salt ?? ""}
                        onChange={(e) =>
                          updateEditedLabel((prev) => ({
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoFixEditedLabel}
                        disabled={isAutoFixing || isSaving || isTranslatingIngredients}
                      >
                        {isAutoFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                        Auto-fix Compliance
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoTranslateEditedIngredients}
                        disabled={isTranslatingIngredients || isAutoFixing || isSaving}
                      >
                        {isTranslatingIngredients ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Auto-translate
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={addEditedIngredient}>
                        Add Ingredient
                      </Button>
                    </div>
                  </div>

                  {(Array.isArray(editedLabel.ingredients) ? editedLabel.ingredients : []).map((ingredient: any, idx: number) => (
                    <div key={idx} className="grid gap-2 rounded-md border p-3 md:grid-cols-6">
                      <Input
                        className="md:col-span-3"
                        placeholder="Ingredient name"
                        value={ingredient?.name || ""}
                        onChange={(e) => handleEditedIngredientChange(idx, "name", e.target.value)}
                      />
                      <Input
                        className="md:col-span-1"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="%"
                        value={ingredient?.percentage ?? ""}
                        onChange={(e) => handleEditedIngredientChange(idx, "percentage", e.target.value)}
                      />
                      <div className="md:col-span-1 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(ingredient?.isAllergen)}
                          onChange={(e) => handleEditedIngredientChange(idx, "isAllergen", e.target.checked)}
                        />
                        Allergen
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="md:col-span-1"
                        onClick={() => removeEditedIngredient(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Label Preview */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">Step 2: Compliance Analysis & Label Result</CardTitle>
                    <p className="text-sm text-muted-foreground">Review your generated label and compliance analysis.</p>
                  </div>
                  <div className="flex items-center flex-wrap gap-3">
                    {!isEditMode ? (
                      <Button variant="outline" size="sm" onClick={startEditLabel}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Label
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={cancelEditLabel}>
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={applyLabelEdits} disabled={isTranslatingIngredients || isAutoFixing || isSaving}>
                          {isTranslatingIngredients ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Apply Edits
                        </Button>
                      </>
                    )}
                    <Button 
                      onClick={handleSaveLabel} 
                      disabled={isPending || isSaving || isTranslatingIngredients || isAutoFixing}
                      className="bg-primary hover:bg-primary/90 px-6"
                      size="sm"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Finish & Save
                        </>
                      )}
                    </Button>
                    <div className="w-px h-8 bg-border mx-1" />
                    <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isEditMode}>
                      <Download className="mr-2 h-4 w-4" />
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportSVG} disabled={isEditMode}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export SVG
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 flex justify-center">
                  <LabelPreview labelData={isEditMode && editedLabel ? editedLabel : generatedLabel} productCategory={form.productCategory} />
                </div>
              </CardContent>
            </Card>

            {/* Compliance Audit Report */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Compliance Audit</CardTitle>
              </CardHeader>
              <CardContent>
                {complianceResults.length > 0 && (
                  <ComplianceAuditReport
                    productName={
                      form.productName || 
                      generatedLabel.productName || 
                      "Product"
                    }
                    originCountry={form.originCountry || "Unknown"}
                    complianceResults={complianceResults}
                  />
                )}
                {complianceScore !== null && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Compliance Score: {complianceScore}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Navigation & Save Actions - Sticky Bottom Bar */}
          <Card className="sticky bottom-6 z-50 shadow-lg border-t-2 border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(1)} disabled={isPending || isSaving}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Step 1
                  </Button>
                </div>
                <Button 
                  onClick={handleSaveLabel} 
                  disabled={isPending || isSaving || isTranslatingIngredients || isAutoFixing}
                  size="lg"
                  className="px-8 shadow-md"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Finish & Save
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show message if no label generated yet in step 2 */}
      {currentStep === 2 && !generatedLabel && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No label generated yet. Please go back to previous steps.</p>
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Back to Step 1
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

