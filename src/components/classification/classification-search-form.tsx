"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { searchAndClassifyAction } from "@/server/actions/classification-search";
import { MarketCode } from "@prisma/client";
import { Loader2, Sparkles, FileText, Camera } from "lucide-react";
import { ImageUploadSection } from "./image-upload-section";
import { ProductScanSection } from "./product-scan-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ClassificationResult = {
  productId: string;
  classificationId: string;
  candidates: Array<{
    htsCode: string;
    cnCode: string;
    confidence: number;
    description: string;
    dutyRate: number;
    vatRate: number;
    precedent?: string;
    reasoning: string;
    legalRationale?: string;
    distinctions?: Array<{
      heading: string;
      reason: string;
    }>;
    keyFeatures?: string[];
    griRule?: string;
    notes?: string;
    importGuidance?: {
      importStatus: "ALLOWED" | "RESTRICTED" | "PROHIBITED";
      importStatusMessage: string;
      riskLevel: "LOW" | "MEDIUM" | "HIGH";
      requiredDocuments: string[];
      foodSafetyRisks?: Array<{
        risk: string;
        level: "LOW" | "MEDIUM" | "HIGH";
        reason: string;
      }>;
      recommendedTests?: string[];
      labellingRequirements?: string[];
      borderControlLikelihood: "LOW" | "MEDIUM" | "HIGH";
      borderControlReason?: string;
      nextActions: string[];
    };
  }>;
  refinementQuestion: {
    question: string;
    explanation: string;
    options: Array<{ value: string; label: string }>;
    field: string;
  } | null;
  needsRefinement: boolean;
};

type Props = {
  organizationId: string;
  userId: string;
};

export function ClassificationSearchForm({ organizationId, userId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [refinementAnswer, setRefinementAnswer] = useState<string>("");
  const [showMaterials, setShowMaterials] = useState(false);
  
  // Form state for auto-fill
  const [formData, setFormData] = useState({
    productName: "",
    description: "",
    compositionText: "",
    intendedUse: "",
    originCountry: "",
  });

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const productName = String(formData.get("productName") || "").trim();
        const description = String(formData.get("description") || "").trim();

        const market = String(formData.get("market") || MarketCode.EU) as MarketCode;
        const originCountry = String(formData.get("originCountry") || "").trim();

        const endUse = String(formData.get("endUse") || "").trim();
        const endUseOther = String(formData.get("endUseOther") || "").trim();
        const compositionText = String(formData.get("compositionText") || "").trim();

        const intendedUse =
          endUse === "OTHER" ? (endUseOther || undefined) : (endUse || undefined);

        const res = await searchAndClassifyAction({
          productName,
          description,
          intendedUse,
          originCountry: originCountry || undefined,
          compositionText: compositionText || undefined,
          market,
        });

        setResult(res);
        
        // Debug: Log result to check if refinement question exists
        console.log("[UI] Classification result:", {
          hasRefinementQuestion: !!res.refinementQuestion,
          refinementQuestion: res.refinementQuestion,
          needsRefinement: res.needsRefinement,
        });

        if (!res.needsRefinement) {
          router.push(`/classify/${res.classificationId}`);
        }
      } catch (error) {
        console.error("Classification error:", error);
        alert(error instanceof Error ? error.message : "Failed to classify product. Please try again.");
      }
    });
  };

  const handleRefinementAnswer = async (answer: string) => {
    if (!result) return;

    startTransition(async () => {
      try {
        const { answerRefinementQuestionAction } = await import(
          "@/server/actions/classification-search"
        );
        
        const updated = await answerRefinementQuestionAction({
          classificationId: result.classificationId,
          answer,
          field: result.refinementQuestion?.field || "intendedUse",
        });

        router.push(`/classify/${updated.classificationId}`);
      } catch (error) {
        console.error("Refinement error:", error);
        alert("Failed to process refinement. Please try again.");
      }
    });
  };

  const handleDataExtracted = (data: {
    productName?: string;
    description?: string;
    materials?: Array<{ name: string; percentage?: number }>;
    compositionText?: string;
    specifications?: Record<string, string>;
    intendedUse?: string;
    originCountry?: string;
  }) => {
    // Auto-fill form fields
    if (data.productName) {
      setFormData((prev) => ({ ...prev, productName: data.productName || "" }));
      const nameInput = document.getElementById("productName") as HTMLInputElement;
      if (nameInput) nameInput.value = data.productName;
    }
    
    if (data.description) {
      setFormData((prev) => ({ ...prev, description: data.description || "" }));
      const descInput = document.getElementById("description") as HTMLTextAreaElement;
      if (descInput) descInput.value = data.description;
    }
    
    if (data.compositionText) {
      setFormData((prev) => ({ ...prev, compositionText: data.compositionText || "" }));
      setShowMaterials(true);
      const compInput = document.getElementById("compositionText") as HTMLTextAreaElement;
      if (compInput) compInput.value = data.compositionText;
    }
    
    if (data.intendedUse) {
      setFormData((prev) => ({ ...prev, intendedUse: data.intendedUse || "" }));
      const endUseSelect = document.getElementById("endUse") as HTMLSelectElement;
      if (endUseSelect) {
        // Try to match to existing options, otherwise use "OTHER"
        const options = Array.from(endUseSelect.options);
        const match = options.find(opt => 
          opt.value.toLowerCase().includes(data.intendedUse?.toLowerCase() || "") ||
          data.intendedUse?.toLowerCase().includes(opt.value.toLowerCase() || "")
        );
        if (match) {
          endUseSelect.value = match.value;
        } else {
          endUseSelect.value = "OTHER";
          const otherInput = document.getElementById("endUseOther") as HTMLInputElement;
          if (otherInput) otherInput.value = data.intendedUse;
        }
      }
    }
    
    if (data.originCountry) {
      setFormData((prev) => ({ ...prev, originCountry: data.originCountry || "" }));
      const originInput = document.getElementById("originCountry") as HTMLInputElement;
      if (originInput) originInput.value = data.originCountry;
    }
  };

  const [mode, setMode] = useState<"manual" | "scan">("scan");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Classification</CardTitle>
          <CardDescription>
            Choose your classification method: scan product images or enter details manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "scan")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="scan" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Product Scan
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Manual Classification
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="space-y-4">
              <ProductScanSection
                organizationId={organizationId}
                userId={userId}
                market={MarketCode.EU}
                disabled={isPending}
              />
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <ImageUploadSection
                  onDataExtracted={handleDataExtracted}
                  disabled={isPending}
                />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="market">Destination market</Label>
                <select
                  id="market"
                  name="market"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  defaultValue={MarketCode.EU}
                  disabled={isPending}
                >
                  <option value={MarketCode.EU}>EU (CN / TARIC)</option>
                  <option value={MarketCode.US} disabled>
                    US (HTS) — coming soon
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="originCountry">Origin country <span className="text-muted-foreground text-xs">(From)</span></Label>
                <Input
                  id="originCountry"
                  name="originCountry"
                  placeholder="e.g. China, Vietnam"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destinationCountry">Destination country <span className="text-muted-foreground text-xs">(To)</span></Label>
                <Input
                  id="destinationCountry"
                  name="destinationCountry"
                  placeholder="e.g. Finland, Germany"
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">For VAT calculation</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                name="productName"
                placeholder="e.g. Electric neck massager with lithium battery"
                required
                disabled={isPending}
                defaultValue={formData.productName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Detailed product description..."
                rows={4}
                required
                disabled={isPending}
                defaultValue={formData.description}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endUse">End use</Label>
                <select
                  id="endUse"
                  name="endUse"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  defaultValue="COMMERCIAL_GENERAL"
                  disabled={isPending}
                >
                  <option value="COMMERCIAL_GENERAL">Commercial / General</option>
                  <option value="INDUSTRIAL">Industrial</option>
                  <option value="MEDICAL">Medical</option>
                  <option value="AVIATION">Civil aviation</option>
                  <option value="FOOD_CONTACT">Food-contact / kitchen use</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endUseOther">End use (if Other)</Label>
                <Input
                  id="endUseOther"
                  name="endUseOther"
                  placeholder="e.g. laboratory calibration equipment"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Materials / composition (optional)</p>
                  <p className="text-xs text-muted-foreground">
                    Only needed for categories where materials change the code (e.g., textiles). We’ll prompt if required.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMaterials((v) => !v)}
                  disabled={isPending}
                >
                  {showMaterials ? "Hide" : "Add"}
                </Button>
              </div>

              {showMaterials && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="compositionText">Composition / materials</Label>
                  <Textarea
                    id="compositionText"
                    name="compositionText"
                    placeholder='e.g. 70% cotton, 30% polyester; or "stainless steel housing, lithium battery, PCB"'
                    rows={3}
                    disabled={isPending}
                  />
                </div>
              )}
            </div>

                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Classifying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Classify
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {result?.refinementQuestion && result.refinementQuestion.question && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-blue-600">ACTION REQUIRED</span>
              <Badge variant="outline" className="bg-white">
                Reasoning Engine
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium text-blue-900">
                {result.refinementQuestion.question}
              </p>
              <p className="mt-2 text-sm text-blue-700">
                {result.refinementQuestion.explanation}
              </p>
            </div>

            <div className="space-y-2">
              {result.refinementQuestion.options && result.refinementQuestion.options.length > 0 ? (
                result.refinementQuestion.options.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    className="w-full justify-start bg-white"
                    onClick={() => handleRefinementAnswer(option.value)}
                    disabled={isPending}
                  >
                    {option.label || option.value}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No options available</p>
              )}
            </div>

            {result.refinementQuestion.options.some((o) => o.value === "other") && (
              <div className="space-y-2">
                <Label htmlFor="refinementAnswer">If other, type details</Label>
                <div className="flex gap-2">
                  <Input
                    id="refinementAnswer"
                    value={refinementAnswer}
                    onChange={(e) => setRefinementAnswer(e.target.value)}
                    placeholder="Type details…"
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRefinementAnswer(refinementAnswer)}
                    disabled={isPending || refinementAnswer.trim().length === 0}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}

