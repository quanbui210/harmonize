"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { extractLabelTextAction } from "@/server/actions/labels";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";

interface UploadedLabelImage {
  id: string;
  file: File;
  preview: string;
  extractedText?: string;
  isProcessing?: boolean;
}

interface LabelImageUploadProps {
  onTextExtracted: (text: string) => void;
  disabled?: boolean;
}

export function LabelImageUpload({ onTextExtracted, disabled }: LabelImageUploadProps) {
  const [images, setImages] = useState<UploadedLabelImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fileToBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 1 image for labels (can extend later if needed)
    const filesToAdd = files.slice(0, 1);

    if (files.length > 1) {
      alert("You can upload 1 label image at a time.");
    }

    const newImages: UploadedLabelImage[] = [];

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

    // Process each image to extract text
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      try {
        const base64 = await fileToBase64(image.file);
        const text = await extractLabelTextAction(base64);

        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? {
                  ...img,
                  extractedText: text,
                  isProcessing: false,
                }
              : img
          )
        );

        // Callback with extracted text
        onTextExtracted(text);
      } catch (error: any) {
        console.error("Text extraction error:", error);
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
        alert(`Failed to extract text from ${image.file.name}: ${error.message}`);
      }
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium">Upload Label Image</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a photo of your existing product label. We'll extract the text automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || images.length >= 1}
          >
            <Upload className="mr-2 h-4 w-4" />
            {images.length >= 1 ? "Replace Image" : "Add Image"}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || images.length >= 1}
        />

        {images.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <div className="relative aspect-video rounded-lg border-2 border-gray-200 bg-gray-50 overflow-hidden">
                    <img
                      src={image.preview}
                      alt="Label"
                      className="w-full h-full object-contain p-2"
                    />
                    {image.isProcessing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                    {image.extractedText && !image.isProcessing && (
                      <div className="absolute top-2 right-2">
                        <div className="rounded-full bg-green-500 p-1">
                          <svg
                            className="h-3 w-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveImage(image.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {image.extractedText && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Text extracted successfully
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

