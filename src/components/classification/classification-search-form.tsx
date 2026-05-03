"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Sparkles, FileText, Camera } from "lucide-react";
import { ImageUploadSection } from "./image-upload-section";
import { ProductScanSection } from "./product-scan-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ClassificationResult = Awaited<ReturnType<typeof searchAndClassifyAction>>;

type Props = {
  organizationId: string;
  userId: string;
};

export function ClassificationSearchForm({ organizationId, userId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [refinementAnswer, setRefinementAnswer] = useState<string>("");
  const [showMaterials, setShowMaterials] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  
  // Form state for auto-fill
  const [formData, setFormData] = useState({
    productName: "",
    description: "",
    compositionText: "",
    intendedUse: "",
    originCountry: "",
    destinationCountry: "",
  });

  useEffect(() => {
    const refinementKey = searchParams.get("refinementKey");
    if (refinementKey && typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(refinementKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ClassificationResult;
          setResult(parsed);
          window.sessionStorage.removeItem(refinementKey);
        } catch (error) {
          console.error("Failed to parse refinement payload:", error);
        }
      }
      router.replace("/classify");
    }

    const classificationError = searchParams.get("classificationError");
    if (classificationError) {
      setClassificationError(decodeURIComponent(classificationError));
      router.replace("/classify");
    }
  }, [router, searchParams]);

  const handleSubmit = async (formData: FormData) => {
    const productName = String(formData.get("productName") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const market = String(formData.get("market") || MarketCode.EU) as MarketCode;
    const originCountry = String(formData.get("originCountry") || "").trim();
    const destinationCountry = String(formData.get("destinationCountry") || "").trim();
    const endUse = String(formData.get("endUse") || "").trim();
    const endUseOther = String(formData.get("endUseOther") || "").trim();
    const compositionText = String(formData.get("compositionText") || "").trim();

    if (!originCountry || !destinationCountry) {
      setClassificationError("Please provide both origin and destination countries.");
      return;
    }

    const intendedUse =
      endUse === "OTHER" ? (endUseOther || undefined) : (endUse || undefined);

    const payloadKey = `classify_manual_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        payloadKey,
        JSON.stringify({
          productName,
          description,
          intendedUse,
          originCountry: originCountry || undefined,
          destinationCountry: destinationCountry || undefined,
          compositionText: compositionText || undefined,
          market,
        }),
      );
    }

    router.push(`/classify/loading?flow=manual&payloadKey=${encodeURIComponent(payloadKey)}`);
  };

  const handleRefinementAnswer = async (answer: string) => {
    if (!result) return;
    const payloadKey = `classify_refine_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        payloadKey,
        JSON.stringify({
          classificationId: result.classificationId,
          answer,
          field: result.refinementQuestion?.field || "intendedUse",
        }),
      );
    }
    router.push(`/classify/loading?flow=refinement&payloadKey=${encodeURIComponent(payloadKey)}`);
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
      {classificationError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive">Classification failed</CardTitle>
            <CardDescription className="text-foreground/80">
              {classificationError}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Tip: add clearer composition and intended use, then retry.
            </p>
          </CardContent>
        </Card>
      ) : null}
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
                disabled={false}
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
                  disabled={false}
                />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="market">Destination market</Label>
                <select
                  id="market"
                  name="market"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  defaultValue={MarketCode.EU}
                  disabled={false}
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
                  required
                  disabled={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destinationCountry">Destination country <span className="text-muted-foreground text-xs">(To)</span></Label>
                <Input
                  id="destinationCountry"
                  name="destinationCountry"
                  placeholder="e.g. Finland, Germany"
                  required
                  defaultValue="Finland"
                  disabled={false}
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
                disabled={false}
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
                disabled={false}
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
                  disabled={false}
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
                  disabled={false}
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
                  disabled={false}
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
                    disabled={false}
                  />
                </div>
              )}
            </div>

                <Button type="submit" className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Classify
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* {result && !result.refinementQuestion && (
        <div className="p-4 bg-gray-100 rounded text-xs font-mono">
          <p>Debug: Result received but no refinement question.</p>
          <pre>{JSON.stringify({ needsRefinement: result.needsRefinement }, null, 2)}</pre>
        </div>
      )} */}

      {result?.refinementQuestion && (
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
                    disabled={false}
                  >
                    {option.label || option.value}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No options available</p>
              )}
            </div>

            {result.refinementQuestion.options?.some((o) => o.value === "other") && (
              <div className="space-y-2">
                <Label htmlFor="refinementAnswer">If other, type details</Label>
                <div className="flex gap-2">
                  <Input
                    id="refinementAnswer"
                    value={refinementAnswer}
                    onChange={(e) => setRefinementAnswer(e.target.value)}
                    placeholder="Type details…"
                    disabled={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRefinementAnswer(refinementAnswer)}
                    disabled={refinementAnswer.trim().length === 0}
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

