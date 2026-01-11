"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getVaultFilesAction, generateSupplierLinkAction, exportAuditPackageAction, getComplianceStatusAction, updateVaultFileTagAction } from "@/server/actions/vault";
import { FileText, Upload, Download, Link as LinkIcon, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { vaultTags } from "@/lib/constants/markets";
import type { VaultFile, VaultTag } from "@prisma/client";

type Props = {
  organizationId: string;
};

type ComplianceStatus = {
  htsLogicTreeAnalysis: boolean;
  supplierMSDS: boolean;
  factoryEvidence: boolean;
};

export function VaultDashboard({ organizationId }: Props) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [supplierLink, setSupplierLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus>({
    htsLogicTreeAnalysis: false,
    supplierMSDS: false,
    factoryEvidence: false,
  });

  useEffect(() => {
    loadFiles();
    loadComplianceStatus();
  }, []);

  const loadFiles = async () => {
    try {
      const result = await getVaultFilesAction({ organizationId });
      setFiles(result);
    } catch (error) {
      console.error("Failed to load files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadComplianceStatus = async () => {
    try {
      const status = await getComplianceStatusAction({ organizationId });
      setComplianceStatus(status);
    } catch (error) {
      console.error("Failed to load compliance status:", error);
    }
  };

  const handleTagChange = async (fileId: string, newTag: VaultTag) => {
    try {
      await updateVaultFileTagAction({
        fileId,
        organizationId,
        tag: newTag,
      });
      // Reload files and compliance status
      await loadFiles();
      await loadComplianceStatus();
    } catch (error) {
      console.error("Failed to update file tag:", error);
      alert("Failed to update file tag");
    }
  };

  const handleGenerateSupplierLink = async () => {
    try {
      const link = await generateSupplierLinkAction({ organizationId });
      setSupplierLink(link);
    } catch (error) {
      console.error("Failed to generate link:", error);
      alert("Failed to generate supplier link");
    }
  };

  const handleExportAudit = async () => {
    try {
      const url = await exportAuditPackageAction({ organizationId });
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("Failed to export audit package:", error);
      alert("Failed to export audit package");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button onClick={handleExportAudit} className="bg-blue-600 text-white hover:bg-blue-700">
          <Package className="mr-2 h-4 w-4" />
          Generate Audit Zip
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite Supplier</CardTitle>
          <CardDescription>
            Request documents directly via a secure upload link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {supplierLink ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-green-50 p-4">
                <p className="text-sm font-medium text-green-900">Secure Link Generated</p>
                <p className="mt-2 font-mono text-sm text-green-700 break-all">
                  {supplierLink}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(supplierLink);
                  alert("Link copied to clipboard!");
                }}
                className="w-full"
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerateSupplierLink}
              className="w-full bg-black text-white hover:bg-gray-800"
            >
              <Upload className="mr-2 h-4 w-4" />
              Send Secure Link
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Timeline</CardTitle>
          <CardDescription>
            Track your audit readiness progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">HTS Logic Tree Analysis</p>
                <p className="text-sm text-muted-foreground">
                  {complianceStatus.htsLogicTreeAnalysis
                    ? "AI reasoning confirmed classification"
                    : "Generate defense dossiers for your classifications"}
                </p>
              </div>
              {complianceStatus.htsLogicTreeAnalysis ? (
                <Badge className="bg-green-600">COMPLETED</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Supplier MSDS</p>
                <p className="text-sm text-muted-foreground">
                  {complianceStatus.supplierMSDS
                    ? "Material Safety Data Sheet received"
                    : "Request MSDS documents from your supplier"}
                </p>
              </div>
              {complianceStatus.supplierMSDS ? (
                <Badge className="bg-green-600">VERIFIED</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Factory Evidence</p>
                <p className="text-sm text-muted-foreground">
                  {complianceStatus.factoryEvidence
                    ? "Production flow charts and bill of materials"
                    : "Request technical specifications from your supplier"}
                </p>
              </div>
              {complianceStatus.factoryEvidence ? (
                <Badge className="bg-green-600">APPROVED</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vault Files</CardTitle>
          <CardDescription>
            All uploaded compliance documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading files...</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No files uploaded yet. Generate a supplier link to request documents.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.label}</TableCell>
                    <TableCell>
                      <Select
                        value={file.tag}
                        onValueChange={(value) => handleTagChange(file.id, value as VaultTag)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
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
                    </TableCell>
                    <TableCell>
                      {(file.sizeBytes / 1024).toFixed(2)} KB
                    </TableCell>
                    <TableCell>
                      {new Date(file.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

