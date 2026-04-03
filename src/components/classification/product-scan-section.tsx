"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { uploadProductImageAction } from "@/server/actions/product-images";
import { MarketCode } from "@prisma/client";
import { Loader2, Upload, X, CheckCircle2, Sparkles, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  extractedData?: {
    productName?: string;
    description?: string;
    materials?: Array<{ name: string; percentage?: number }>;
    compositionText?: string;
    specifications?: Record<string, string>;
    intendedUse?: string;
    originCountry?: string;
  };
  isProcessing?: boolean;
}

interface ProductScanSectionProps {
  organizationId: string;
  userId: string;
  market: MarketCode;
  disabled?: boolean;
}

export function ProductScanSection({
  organizationId,
  userId,
  market,
  disabled,
}: ProductScanSectionProps) {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 3 images total
    const remainingSlots = 3 - images.length;
    const filesToAdd = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      alert(`You can upload up to 3 images. Only the first ${remainingSlots} will be added.`);
    }

    const newImages: UploadedImage[] = [];

    for (const file of filesToAdd) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert(`${file.name} is not an image file. Skipping.`);
        continue;
      }

      // Create preview
      const reader = new FileReader();
      const preview = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newImages.push({
        id: `temp-${Date.now()}-${Math.random()}`,
        file,
        preview,
        isProcessing: true,
      });
    }

    setImages([...images, ...newImages]);

    // Process each image
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      try {
        const formData = new FormData();
        formData.append("image", image.file);

        const result = await uploadProductImageAction(formData);

        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? {
                  ...img,
                  extractedData: result.extractedData,
                  isProcessing: false,
                }
              : img
          )
        );
      } catch (error: any) {
        console.error("Upload error:", error);
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? {
                  ...img,
                  isProcessing: false,
                }
              : img
          )
        );
        alert(`Failed to process ${image.file.name}: ${error.message}`);
      }
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
    setClassificationError(null);
  };

  const handleQuickClassify = async () => {
    if (images.length === 0) {
      alert("Please upload at least one product image");
      return;
    }

    // Combine extracted data from all images
    const allExtractedData = images
      .map((img) => img.extractedData)
      .filter(Boolean) as Array<NonNullable<UploadedImage["extractedData"]>>;

    if (allExtractedData.length === 0) {
      alert("No data extracted from images. Please try again or use manual classification.");
      return;
    }

    // Merge data from all images (prioritize first image, fill gaps from others)
    const mergedData = allExtractedData.reduce(
      (acc, data) => ({
        productName: acc.productName || data.productName || "",
        description: acc.description || data.description || "",
        compositionText: acc.compositionText || data.compositionText || "",
        intendedUse: acc.intendedUse || data.intendedUse,
        originCountry: acc.originCountry || data.originCountry,
        materials: acc.materials || data.materials,
      }),
      {
        productName: "",
        description: "",
        compositionText: "",
        intendedUse: undefined,
        originCountry: undefined,
        materials: undefined,
      }
    );

    if (!mergedData.productName && !mergedData.description) {
      alert("Could not identify product from images. Please add a description or use manual classification.");
      return;
    }

    setClassificationError(null);
    try {
      const payloadKey = `classify_scan_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          payloadKey,
          JSON.stringify({
            productName: mergedData.productName || "Product from image",
            description:
              mergedData.description ||
              mergedData.productName ||
              "Product identified from image",
            intendedUse: mergedData.intendedUse,
            compositionText: mergedData.compositionText || undefined,
            originCountry: originCountry || mergedData.originCountry || undefined,
            destinationCountry: destinationCountry || undefined,
            materials: mergedData.materials?.map((m) => ({
              material: m.name,
              percentage: m.percentage || 0,
            })),
            market: selectedMarket,
          }),
        );
      }

      router.push(`/classify/loading?flow=scan&payloadKey=${encodeURIComponent(payloadKey)}`);
    } catch (error: any) {
      console.error("Failed to start classify flow:", error);
      setClassificationError("Failed to start classification. Please try again.");
    }
  };

  const hasExtractedData = images.some((img) => img.extractedData);

  const [selectedMarket, setSelectedMarket] = useState<MarketCode>(market);
  const [originCountry, setOriginCountry] = useState<string>("");
  const [destinationCountry, setDestinationCountry] = useState<string>("");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="scan-market" className="text-sm font-medium">
            Destination market
          </label>
          <select
            id="scan-market"
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value as MarketCode)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            disabled={disabled}
          >
            <option value={MarketCode.EU}>EU (CN / TARIC)</option>
            <option value={MarketCode.US} disabled>
              US (HTS) — coming soon
            </option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="scan-origin" className="text-sm font-medium">
            Origin country <span className="text-muted-foreground">(From)</span>
          </label>
          <input
            id="scan-origin"
            type="text"
            value={originCountry}
            onChange={(e) => setOriginCountry(e.target.value)}
            placeholder="e.g. China, Vietnam"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="scan-destination" className="text-sm font-medium">
            Destination country <span className="text-muted-foreground">(To)</span>
          </label>
          <input
            id="scan-destination"
            type="text"
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
            placeholder="e.g. Finland, Germany"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium">Product Scan</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload up to 3 product images. AI will identify and classify the product automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || images.length >= 3}
          >
            <Upload className="mr-2 h-4 w-4" />
            {images.length >= 3 ? "Max 3 images" : "Add Image"}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || images.length >= 3}
        />

        {images.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <div className="relative aspect-square rounded-lg border-2 border-gray-200 bg-gray-50 overflow-hidden">
                    <Image
                      src={image.preview}
                      alt="Product"
                      className="w-full h-full object-contain p-2"
                      fill
                      unoptimized
                    />
                    {image.isProcessing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
                      onClick={() => handleRemoveImage(image.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {image.extractedData?.productName && (
                    <p className="mt-1 text-xs text-center text-muted-foreground truncate">
                      {image.extractedData.productName}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {hasExtractedData && (
              <div className="rounded-lg border bg-green-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-green-900">
                      Product identified from {images.filter((img) => img.extractedData).length} image(s)
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  {images
                    .filter((img) => img.extractedData?.productName)
                    .map((img, idx) => (
                      <div key={idx} className="text-muted-foreground">
                        <span className="font-medium">Image {idx + 1}:</span>{" "}
                        {img.extractedData?.productName}
                        {img.extractedData?.description && (
                          <span className="text-xs"> - {img.extractedData.description.substring(0, 50)}...</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleQuickClassify}
              disabled={disabled || !hasExtractedData}
              className="w-full"
              size="lg"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Quick Classify from Images
            </Button>

            {classificationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{classificationError}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

