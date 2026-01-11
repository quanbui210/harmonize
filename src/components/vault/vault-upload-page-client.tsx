"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { uploadSupplierFileAction } from "@/server/actions/vault";
import { vaultTags } from "@/lib/constants/markets";
import type { VaultTag } from "@prisma/client";

type Props = {
  token: string;
  organizationId: string;
};

type FileWithTag = {
  file: File;
  tag: VaultTag;
};

export function VaultUploadPageClient({ token, organizationId }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<FileWithTag[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: FileWithTag[] = Array.from(e.target.files).map((file) => ({
        file,
        tag: "OTHER" as VaultTag, // Default tag, user will select
      }));
      setFiles(newFiles);
      setError(null);
    }
  };

  const handleTagChange = (index: number, tag: VaultTag) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], tag };
      return updated;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one file to upload");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      for (const { file, tag } of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("token", token);
        formData.append("organizationId", organizationId);
        formData.append("label", file.name);
        formData.append("tag", tag);

        await uploadSupplierFileAction(formData);
      }

      setUploaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  if (uploaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Upload Successful!</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Your files have been uploaded successfully. Thank you!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Compliance Documents
          </CardTitle>
          <CardDescription>
            Upload documents requested by your customer for customs classification and compliance purposes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">What documents should I upload?</h3>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Lab Test (LAB_TEST):</strong> MSDS, quality certificates, material composition tests, safety certifications, or any laboratory test reports</li>
              <li><strong>Specification (SPEC):</strong> Technical datasheets, technical drawings, detailed product descriptions, or factory production documents</li>
              <li><strong>Invoice:</strong> Commercial invoices showing product details and pricing</li>
              <li><strong>Photo:</strong> Images showing product appearance, packaging, or labeling</li>
              <li><strong>Other:</strong> Any other compliance documents</li>
            </ul>
            <p className="text-xs text-blue-700 mt-3">
              <strong>Why?</strong> These documents help your customer correctly classify products for customs, calculate duties, and maintain compliance records for audits.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Files</label>
            <p className="text-xs text-muted-foreground">Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF (Max 50MB per file)</p>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                className="flex-1"
                disabled={isUploading}
              />
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Selected files:</p>
                {files.map((fileWithTag, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fileWithTag.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(fileWithTag.file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Select
                      value={fileWithTag.tag}
                      onValueChange={(value) => handleTagChange(idx, value as VaultTag)}
                      disabled={isUploading}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {vaultTags.map((tag) => (
                          <SelectItem key={tag.value} value={tag.value}>
                            {tag.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "Files"}
              </>
            )}
          </Button>

          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> This is a secure upload link. Files will be encrypted and stored securely. 
              Only the requesting organization will have access to these files.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

