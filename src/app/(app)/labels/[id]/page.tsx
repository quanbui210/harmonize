import { notFound } from "next/navigation";
import { getLabelAction } from "@/server/actions/labels";
import { LabelPreview } from "@/components/labeling/label-preview";
import { ComplianceAuditReport } from "@/components/labeling/compliance-audit-report";
import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { LabelExportButtons } from "@/components/labeling/label-export-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface LabelDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LabelDetailPage({ params }: LabelDetailPageProps) {
  const { id } = await params;
  
  let label;
  try {
    label = await getLabelAction(id);
  } catch (error) {
    notFound();
  }

  if (!label) {
    notFound();
  }

  const labelData = label.labelData as any as EnhancedLabelData & {
    productName?: string | { original: string; translations?: { fi?: string; sv?: string } };
    productCategory?: string;
    complianceResults?: any[];
  };
  const complianceResults = labelData?.complianceResults || [];
  const productCategory = labelData?.productCategory || "food";

  // Helper function to extract product name string from object or string
  const getProductName = (productName: string | { original: string; translations?: { fi?: string; sv?: string } } | undefined): string => {
    if (!productName) return "Product Label";
    if (typeof productName === "string") return productName;
    return productName.original || productName.translations?.fi || productName.translations?.sv || "Product Label";
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/labels">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Labels
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              {getProductName(labelData?.productName)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Generated on {new Date(label.generatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Label Preview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <LabelPreview labelData={labelData} productCategory={productCategory} />
          </CardContent>
        </Card>

        {/* Compliance Report */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Audit</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceAuditReport
              productName={typeof labelData.productName === "string" ? labelData.productName : labelData.productName?.original || "Product"}
              originCountry={labelData.originCountry || ""}
              complianceResults={complianceResults}
            />
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Export Label</CardTitle>
        </CardHeader>
        <CardContent>
          <LabelExportButtons
            labelData={labelData}
            productCategory={productCategory}
            productName={getProductName(labelData?.productName)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

