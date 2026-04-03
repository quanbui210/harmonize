"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Printer } from "lucide-react";
import type { Classification, Product, ClassificationSource, DutySummary, Dossier } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  classification: Classification & {
    product: Product & {
      materials: Array<{ material: string; percentage: number }>;
    };
    sources: ClassificationSource[];
    dutySummary: DutySummary | null;
    dossier: Dossier | null;
  };
};

// Helper to safely extract product name string - handles all possible structures
function getProductNameString(productName: any): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";
  
  // Handle standard structure: {original: string, translations: {fi: string, sv: string}}
  if (productName.translations && typeof productName.translations === "object") {
    const trans = productName.translations;
    if (typeof trans.fi === "string") return trans.fi;
    if (typeof trans.sv === "string") return trans.sv;
    if (typeof productName.original === "string") return productName.original;
  }
  
  // Handle edge case: direct {fi: string, sv: string} structure
  if (typeof productName.fi === "string") return productName.fi;
  if (typeof productName.sv === "string") return productName.sv;
  
  // Final fallback
  if (typeof productName.original === "string") return productName.original;
  
  return "Product";
}

export function DossierGenerator({ classification }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dossierUrl] = useState<string | null>(
    classification.dossier ? `/api/dossier/${classification.dossier.id}/preview` : null,
  );
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const dossierError = searchParams.get("dossierError");
    if (!dossierError) return;
    alert(decodeURIComponent(dossierError));
    router.replace(`/classify/${classification.id}/dossier`);
  }, [classification.id, router, searchParams]);

  const handleGenerate = () => {
    router.push(`/classify/dossier/loading?classificationId=${encodeURIComponent(classification.id)}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Product Name</p>
            <p className="text-lg font-semibold">{getProductNameString(classification.product.name)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Description</p>
            <p className="text-sm">{classification.product.description}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">HTS Code</p>
            <p className="font-mono text-lg">
              {classification.htsCode && classification.htsCode !== "0000000000" 
                ? classification.htsCode 
                : "Pending classification"}
            </p>
          </div>
          {classification.dutySummary && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Duty Rate</p>
              <p className="text-sm">
                {Number(classification.dutySummary.dutyRate) === 0
                  ? "Free"
                  : `${Number(classification.dutySummary.dutyRate)}%`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defense Dossier</CardTitle>
          <CardDescription>
            Generate a comprehensive reasoning document for audit protection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dossierUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border bg-green-50 p-4">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Dossier Generated</p>
                  <p className="text-sm text-green-700">
                    Your defense dossier is ready for preview and export
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowPreview(!showPreview)}
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {showPreview ? "Hide Preview" : "Preview HTML"}
                </Button>
                <Button
                  onClick={() => {
                    const exportUrl = dossierUrl.replace("/preview", "/export");
                    window.open(exportUrl, "_blank");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  onClick={() => {
                    const pdfUrl = dossierUrl.replace("/preview", "/pdf");
                    window.open(pdfUrl, "_blank");
                  }}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
              {showPreview && (
                <div className="mt-4 rounded-lg border">
                  <iframe
                    src={dossierUrl}
                    className="h-[600px] w-full rounded-lg"
                    title="Dossier Preview"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                  <strong>What&apos;s included:</strong>
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-blue-700">
                  <li>GRI analysis with step-by-step reasoning</li>
                  <li>Legal precedent citations</li>
                  <li>Source attribution (TARIC, binding rulings, legal notes)</li>
                  <li>Professional formatting for customs authorities</li>
                </ul>
              </div>
              <Button
                onClick={handleGenerate}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Defense Dossier
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                This will create a comprehensive PDF document ready for customs audit
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {classification.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources & References</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {classification.sources.map((source, index) => (
                <div key={index} className="flex items-start gap-2 rounded border p-3">
                  <Badge variant="outline">{source.sourceType}</Badge>
                  <div className="flex-1">
                    {source.referenceId && (
                      <p className="font-mono text-sm">{source.referenceId}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{source.excerpt}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

