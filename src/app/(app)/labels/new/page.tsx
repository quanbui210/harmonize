"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { generateLabelAction, exportLabelPDFAction, exportLabelSVGAction, saveLabelAction } from "@/server/actions/labels";
import { analyzeLabelAction } from "@/server/actions/label-analysis";
import { getClassificationsForLabelAction, getClassificationAction } from "@/server/actions/classifications";
import {
  calculateComplianceScore,
  type ComplianceResult,
} from "@/lib/labeling/compliance-checker";
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
import { Loader2, ShieldCheck, ShieldAlert, Download, FileText, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface FormState {
  productName: string;
  description: string;
  originCountry: string;
  destinationCountry: string;
  cnCode: string;
  originalLabelText: string;
  productCategory: string;
  labelSize: LabelSize;
  bestBeforeDate: string;
  netQuantity: string;
  netQuantityUnit: "g" | "kg";
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
  labelSize: LABEL_SIZES[2], // Standard 100×150mm
  bestBeforeDate: "",
  netQuantity: "",
  netQuantityUnit: "g" as const,
  importerAddress: {
    companyName: "",
    street: "",
    postalCode: "",
    city: "",
    country: "Finland",
  },
  nutrition: {},
};

export default function NewLabelPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [isPending, startTransition] = useTransition();
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[]>([]);
  const [generatedLabel, setGeneratedLabel] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [labelAnalysis, setLabelAnalysis] = useState<LabelAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [missingFieldsData, setMissingFieldsData] = useState<Record<string, string | number>>({});
  const [showMissingFieldsForm, setShowMissingFieldsForm] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [showNutritionForm, setShowNutritionForm] = useState(false);
  const [selectedClassificationId, setSelectedClassificationId] = useState<string>("");
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
    setForm((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        [key]: value ? Number(value) : undefined,
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
      
      startTransition(async () => {
        try {
          // Analyze label if we have label text
          if (form.originalLabelText) {
            await handleAnalyzeLabel();
          }
          
          // Generate label - this will set the generatedLabel state
          await handleGenerateLabel();
          
          // Only move to Step 2 after label is generated
          setCurrentStep(2);
        } catch (err: any) {
          setError(err?.message || "Failed to generate label");
        }
      });
    }
  };

  const handleGenerateLabel = async () => {
    setError(null);
    
    try {
      // Merge missing fields data into nutrition/form data
      const mergedNutrition = { ...form.nutrition };
      if (missingFieldsData["nutrition_energy"]) {
        mergedNutrition.energy = Number(missingFieldsData["nutrition_energy"]);
      }
      if (missingFieldsData["nutrition_fat"]) {
        mergedNutrition.fat = Number(missingFieldsData["nutrition_fat"]);
      }
      if (missingFieldsData["nutrition_carbs"]) {
        mergedNutrition.carbs = Number(missingFieldsData["nutrition_carbs"]);
      }
      if (missingFieldsData["nutrition_protein"]) {
        mergedNutrition.protein = Number(missingFieldsData["nutrition_protein"]);
      }
      if (missingFieldsData["nutrition_salt"]) {
        mergedNutrition.salt = Number(missingFieldsData["nutrition_salt"]);
      }

      const result = await generateLabelAction({
        productName: form.productName,
        description: form.description,
        originCountry: form.originCountry,
        destinationCountry: form.destinationCountry,
        cnCode: form.cnCode || undefined,
        originalLabelText: form.originalLabelText || undefined,
        productCategory: form.productCategory,
        labelSize: form.labelSize,
        nutrition: mergedNutrition,
        importerAddress: 
          form.importerAddress.companyName && form.importerAddress.street && form.importerAddress.city
            ? `${form.importerAddress.companyName}, ${form.importerAddress.street}, ${form.importerAddress.postalCode}, ${form.importerAddress.city}, ${form.importerAddress.country}`
            : (missingFieldsData["importer_address"] as string | undefined),
        bestBeforeDate: form.bestBeforeDate || undefined,
        netQuantity: form.netQuantity ? `${form.netQuantity}${form.netQuantityUnit}` : undefined,
      });

      setGeneratedLabel(result.label);
      setComplianceResults(result.complianceResults);
      setComplianceScore(result.complianceScore);
      setShowMissingFieldsForm(false);
    } catch (err: any) {
      setError(err?.message || "Failed to generate label");
      throw err; // Re-throw so handleNextStep can catch it
    }
  };

  const handleSaveLabel = async () => {
    if (!generatedLabel || !form.productName) {
      setError("Please generate a label first");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const labelId = await saveLabelAction({
        labelData: generatedLabel,
        complianceScore: complianceScore || 0,
        complianceResults,
        productName: form.productName,
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

  const reset = () => {
    setForm(initialForm);
    setComplianceResults([]);
    setComplianceScore(null);
    setGeneratedLabel(null);
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
    const extractTextFromJSON = (jsonString: string): { text: string; bestBeforeDate?: string; netQuantity?: string } | null => {
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
    if (!form.bestBeforeDate?.trim()) missing.push("Best Before Date");
    if (!form.netQuantity?.trim()) missing.push("Net Quantity");
    if (!form.importerAddress.companyName?.trim()) missing.push("Importer Company Name");
    if (!form.importerAddress.street?.trim()) missing.push("Importer Street Address");
    if (!form.importerAddress.postalCode?.trim()) missing.push("Importer Postcode");
    if (!form.importerAddress.city?.trim()) missing.push("Importer Post Office");
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
            Step-by-step process to generate compliant FI/SV labels
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
                <label className="text-sm font-medium">
                  Destination country <span className="text-red-500">*</span>
                </label>
                <Input
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
                  <label className="text-sm font-medium">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.importerAddress.companyName}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, companyName: e.target.value })}
                    placeholder="e.g. Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Street address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.importerAddress.street}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, street: e.target.value })}
                    placeholder="e.g. Opastinsilta 1"
                  />
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Postcode <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.importerAddress.postalCode}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, postalCode: e.target.value })}
                    placeholder="e.g. 00520"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Post office <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.importerAddress.city}
                    onChange={(e) => handleChange("importerAddress", { ...form.importerAddress, city: e.target.value })}
                    placeholder="e.g. Helsinki"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Country <span className="text-red-500">*</span>
                </label>
                <Input
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
                
                if (isPending || isAnalyzing) {
                  return (
                    <div className="rounded-md border border-blue-500/50 bg-blue-50 dark:bg-blue-900/10 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-800 dark:text-blue-200">
                          {isAnalyzing ? "Analyzing label..." : "Generating label..."}
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
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Label Preview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Step 2: Compliance Analysis & Label Result</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportPDF}>
                      <Download className="mr-2 h-4 w-4" />
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportSVG}>
                      <FileText className="mr-2 h-4 w-4" />
                      Export SVG
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 flex justify-center">
                  <LabelPreview labelData={generatedLabel} productCategory={form.productCategory} />
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

          {/* Navigation & Save Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Step 1
                  </Button>
                </div>
                <Button 
                  onClick={handleSaveLabel} 
                  disabled={isPending || isSaving}
                  size="lg"
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

