"use client";

import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProductImagesForClassificationAction, validateImageSuitabilityAction } from "@/server/actions/labels";
import { extractLabelTextAction } from "@/server/actions/labels";
import { Loader2, Image as ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProductImage {
  id: string;
  url: string | null;
  ocrText: string | null;
  extractedData?: unknown;
  createdAt: Date;
}

interface ProductImageSelectorProps {
  classificationId: string | null;
  onImageSelected: (text: string) => void;
  autoSelectLatest?: boolean;
  disabled?: boolean;
}

export function ProductImageSelector({ 
  classificationId, 
  onImageSelected,
  autoSelectLatest = false,
  disabled 
}: ProductImageSelectorProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const autoAppliedClassificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!classificationId) {
      setImages([]);
      setSelectedImageId("");
      setStatusMessage(null);
      autoAppliedClassificationIdRef.current = null;
      return;
    }

    // Reset auto-apply state when user changes classification.
    autoAppliedClassificationIdRef.current = null;

    const loadImages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const productImages = await getProductImagesForClassificationAction(classificationId);
        setImages(productImages);
      } catch (err: any) {
        console.error("Failed to load product images:", err);
        setError(err.message || "Failed to load product images");
      } finally {
        setIsLoading(false);
      }
    };

    loadImages();
  }, [classificationId]);

  const applyImageExtraction = async (imageIdOverride?: string) => {
    const imageId = imageIdOverride || selectedImageId;
    if (!imageId) {
      setError("Please select an existing image first.");
      return;
    }

    const image = images.find((img) => img.id === imageId);
    if (!image) {
      setError("Selected image not found. Please choose another image.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStatusMessage("Analyzing selected image and extracting structured label data...");

    try {
      const suitability = await validateImageSuitabilityAction({
        ocrText: image.ocrText,
        extractedData: image.extractedData,
      });

      if (!suitability.isValid) {
        setError(`This image may not be suitable for label extraction: ${suitability.reason}`);
        setStatusMessage(null);
        return;
      }

      // Always re-run extraction from the image to get label-focused structured output.
      if (image.url) {
        const response = await fetch(image.url);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read selected image"));
          reader.readAsDataURL(blob);
        });

        const base64Data = dataUrl.split(",")[1];
        if (!base64Data) {
          throw new Error("Failed to extract base64 payload from selected image");
        }

        const text = await extractLabelTextAction(base64Data);
        onImageSelected(text);
        setStatusMessage("Existing image extracted and applied. Please review populated fields below.");
        return;
      }

      if (image.ocrText) {
        onImageSelected(image.ocrText);
        setStatusMessage("Used existing OCR text. Please review populated fields below.");
        return;
      }

      throw new Error("No image URL or OCR text available for extraction");
    } catch (err: any) {
      console.error("Failed to process image:", err);
      setError(err?.message || "Failed to process image");
      setStatusMessage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!autoSelectLatest || !classificationId) return;
    if (disabled || isProcessing || isLoading) return;
    if (images.length === 0) return;
    if (autoAppliedClassificationIdRef.current === classificationId) return;

    const latestImage = images[0];
    if (!latestImage?.id) return;

    setSelectedImageId(latestImage.id);
    autoAppliedClassificationIdRef.current = classificationId;
    void applyImageExtraction(latestImage.id);
  }, [autoSelectLatest, classificationId, disabled, images, isLoading, isProcessing]);

  const handleSelectImage = async (imageId: string) => {
    if (disabled || isProcessing || !imageId || imageId === "none") {
      setSelectedImageId("");
      setStatusMessage(null);
      return;
    }

    setSelectedImageId(imageId);
    setError(null);
    setStatusMessage("Image selected. Click 'Use Existing Image' to extract and apply data.");
  };

  if (!classificationId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (images.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label>Select Existing Product Image (Optional)</Label>
      <p className="text-xs text-muted-foreground">
        If you uploaded product images during classification that contain label information, you can select one here. 
        The clearer the text and data visible in the image, the better the extraction results will be.
      </p>
      
      <Select
        value={selectedImageId || "none"}
        onValueChange={handleSelectImage}
        disabled={disabled || isProcessing}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a product image...">
            {selectedImageId && isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing image...</span>
              </div>
            ) : selectedImageId ? (
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                <span>Image selected</span>
              </div>
            ) : (
              "Select a product image..."
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-w-md">
          <SelectItem value="none">
            <span>None (Upload new image)</span>
          </SelectItem>
          {images.map((image) => (
            <SelectItem key={image.id} value={image.id} className="py-2">
              <div className="flex items-center gap-3 w-full">
                {image.url ? (
                  <img
                    src={image.url}
                    alt="Product image"
                    className="h-12 w-12 object-cover rounded border flex-shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-100 flex items-center justify-center rounded border flex-shrink-0">
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">Product Image</div>
                  {image.ocrText && (
                    <div className="text-xs text-muted-foreground">OCR text available</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(image.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void applyImageExtraction()}
          disabled={disabled || isProcessing || !selectedImageId}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : (
            "Use Existing Image"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          This re-analyzes the selected image and populates label fields.
        </p>
      </div>

      {statusMessage && (
        <Card className="bg-green-50 border-green-200 mt-2">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-900">{statusMessage}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-red-50 border-red-200 mt-2">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-900">{error}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
