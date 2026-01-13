"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { exportLabelPDFAction, exportLabelSVGAction } from "@/server/actions/labels";
import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";

interface LabelExportButtonsProps {
  labelData: EnhancedLabelData;
  productCategory: string;
  productName: string;
}

export function LabelExportButtons({ labelData, productCategory, productName }: LabelExportButtonsProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingSVG, setIsExportingSVG] = useState(false);

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const pdfBytes = await exportLabelPDFAction(labelData, productCategory);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${productName.replace(/\s+/g, "_")}_label.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportSVG = async () => {
    setIsExportingSVG(true);
    try {
      const svgString = await exportLabelSVGAction(labelData, productCategory);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${productName.replace(/\s+/g, "_")}_label.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export SVG:", error);
    } finally {
      setIsExportingSVG(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        disabled={isExportingPDF || isExportingSVG}
      >
        {isExportingPDF ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportSVG}
        disabled={isExportingPDF || isExportingSVG}
      >
        {isExportingSVG ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <FileText className="mr-2 h-4 w-4" />
            SVG
          </>
        )}
      </Button>
    </div>
  );
}

