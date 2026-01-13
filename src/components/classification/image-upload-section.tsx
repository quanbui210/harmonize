"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadProductImageAction } from "@/server/actions/product-images";
import { Loader2, Upload, Image as ImageIcon, X, CheckCircle2 } from "lucide-react";

interface ExtractedData {
  productName?: string;
  description?: string;
  materials?: Array<{ name: string; percentage?: number }>;
  compositionText?: string;
  specifications?: Record<string, string>;
  intendedUse?: string;
  originCountry?: string;
}

interface ImageUploadSectionProps {
  onDataExtracted: (data: ExtractedData) => void;
  disabled?: boolean;
}

export function ImageUploadSection({
  onDataExtracted,
  disabled,
}: ImageUploadSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload and extract
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const result = await uploadProductImageAction(formData);

      setExtractedData(result.extractedData);
      setOcrText(result.ocrText);
      setShowPreview(true);
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(error.message || "Failed to process image. Please try again.");
      setPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseData = () => {
    if (extractedData) {
      onDataExtracted(extractedData);
      // Close preview after using data
      setShowPreview(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setExtractedData(null);
    setOcrText("");
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-medium">Scan Label / Ingredients (Optional)</p>
            <p className="text-xs text-muted-foreground">
              Upload an image of the product label, ingredient list, or spec sheet to auto-fill the form
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </>
            )}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {preview && (
          <div className="mt-3 space-y-3">
            <div className="relative">
              <img
                src={preview}
                alt="Uploaded product label"
                className="w-full max-h-48 object-contain rounded border bg-gray-50"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {extractedData && showPreview && (
              <div className="space-y-3 rounded-lg border bg-blue-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-blue-900">
                      Data extracted successfully
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleUseData}
                  >
                    Use This Data
                  </Button>
                </div>

                <div className="space-y-2 text-sm">
                  {extractedData.productName && (
                    <div>
                      <span className="font-medium">Product Name: </span>
                      <span className="text-muted-foreground">
                        {extractedData.productName}
                      </span>
                    </div>
                  )}
                  {extractedData.description && (
                    <div>
                      <span className="font-medium">Description: </span>
                      <span className="text-muted-foreground">
                        {extractedData.description}
                      </span>
                    </div>
                  )}
                  {extractedData.compositionText && (
                    <div>
                      <span className="font-medium">Composition: </span>
                      <span className="text-muted-foreground">
                        {extractedData.compositionText}
                      </span>
                    </div>
                  )}
                  {extractedData.intendedUse && (
                    <div>
                      <span className="font-medium">Intended Use: </span>
                      <span className="text-muted-foreground">
                        {extractedData.intendedUse}
                      </span>
                    </div>
                  )}
                  {extractedData.originCountry && (
                    <div>
                      <span className="font-medium">Origin: </span>
                      <span className="text-muted-foreground">
                        {extractedData.originCountry}
                      </span>
                    </div>
                  )}
                </div>

                {ocrText && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      View extracted text
                    </summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded border max-h-32 overflow-auto">
                      {ocrText}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

