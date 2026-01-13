"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProductImagesForClassificationAction } from "@/server/actions/labels";
import { extractLabelTextAction } from "@/server/actions/labels";
import { Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ProductImage {
  id: string;
  url: string | null;
  ocrText: string | null;
  createdAt: Date;
}

interface ProductImageSelectorProps {
  classificationId: string | null;
  onImageSelected: (text: string) => void;
  disabled?: boolean;
}

export function ProductImageSelector({ 
  classificationId, 
  onImageSelected,
  disabled 
}: ProductImageSelectorProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classificationId) {
      setImages([]);
      setSelectedImageId("");
      return;
    }

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

  const handleSelectImage = async (imageId: string) => {
    if (disabled || isProcessing || !imageId || imageId === "none") {
      setSelectedImageId("");
      return;
    }

    const image = images.find((img) => img.id === imageId);
    if (!image) return;

    setSelectedImageId(imageId);
    setIsProcessing(true);
    setError(null);

    try {
      // If OCR text already exists, use it
      if (image.ocrText) {
        onImageSelected(image.ocrText);
        setIsProcessing(false);
        return;
      }

      // Otherwise, extract text from the image URL
      const response = await fetch(image.url!);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const dataUrl = reader.result as string;
          // Remove data URL prefix (e.g., "data:image/png;base64,")
          const base64Data = dataUrl.split(',')[1];
          if (!base64Data) {
            throw new Error("Failed to extract base64 data from image");
          }
          const text = await extractLabelTextAction(base64Data);
          onImageSelected(text);
        } catch (err: any) {
          console.error("Failed to extract text:", err);
          setError(err.message || "Failed to extract text from image");
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read image file");
        setIsProcessing(false);
      };

      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error("Failed to process image:", err);
      setError(err.message || "Failed to process image");
      setIsProcessing(false);
    }
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
