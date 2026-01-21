"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { exportLabelPDFAction, exportLabelSVGAction } from "@/server/actions/labels";
import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";

interface LabelExportButtonsProps {
  labelData: EnhancedLabelData;
  productCategory: string;
  productName: string;
  labelId?: string; // Optional: if provided, use export route instead of generating PDF
}

export function LabelExportButtons({ labelData, productCategory, productName, labelId }: LabelExportButtonsProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isExportingSVG, setIsExportingSVG] = useState(false);

  const handlePrint = () => {
    // If labelId exists, open print route in new window
    if (labelId) {
      window.open(`/api/label/${labelId}/export`, "_blank");
      return;
    }

    // Fallback for unsaved labels: use browser print on preview
    setIsPrinting(true);
    window.print();
    setIsPrinting(false);
  };

  const handleDownloadPDF = async () => {
    setIsDownloadingPDF(true);
    try {
      // If labelId exists, download from PDF route
      if (labelId) {
        const response = await fetch(`/api/label/${labelId}/pdf`);
        if (!response.ok) {
          throw new Error("Failed to generate PDF");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${productName.replace(/\s+/g, "_")}_label.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // Fallback for unsaved labels: use existing PDF generation
      const pdfBytes = await exportLabelPDFAction(labelData, productCategory);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${productName.replace(/\s+/g, "_")}_label.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download PDF:", error);
    } finally {
      setIsDownloadingPDF(false);
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
        onClick={handlePrint}
        disabled={isPrinting || isDownloadingPDF || isExportingSVG}
      >
        {isPrinting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Opening...
          </>
        ) : (
          <>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadPDF}
        disabled={isPrinting || isDownloadingPDF || isExportingSVG}
      >
        {isDownloadingPDF ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportSVG}
        disabled={isPrinting || isDownloadingPDF || isExportingSVG}
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

