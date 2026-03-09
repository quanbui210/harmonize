
"use client";

import { useState } from "react";
import { uploadBtiCsvAction, triggerEnrichmentAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Sparkles, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualRulingForm } from "@/components/admin/manual-ruling-form";

export default function AdminRulingsPage() {
  const [uploading, setUploading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichCount, setEnrichCount] = useState<number | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const count = await uploadBtiCsvAction(formData);
      toast.success(`Successfully processed ${count} rulings`);
      // Reset form
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const count = await triggerEnrichmentAction();
      setEnrichCount(count);
      if (count > 0) {
        toast.success(`Enriched ${count} rulings`);
      } else {
        toast.info("No pending rulings to enrich");
      }
    } catch (error: any) {
      toast.error(error.message || "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage BTI Rulings</h1>
        <p className="text-muted-foreground">Ingest new rulings and trigger AI enrichment.</p>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        {/* Main Content (Left 2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>
            
            <TabsContent value="csv">
              <div className="rounded-xl border bg-card text-card-foreground shadow p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Bulk Ingestion</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a BTI CSV file. The file should match the standard EBTI export format.
                </p>
                
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="csvFile">CSV File</Label>
                    <Input id="csvFile" name="csvFile" type="file" accept=".csv" required />
                  </div>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Upload & Process
                  </Button>
                </form>
              </div>
            </TabsContent>
            
            <TabsContent value="manual">
              <div className="rounded-xl border bg-card text-card-foreground shadow p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <FilePlus className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Create Single Ruling</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Manually enter details for a new BTI ruling. It will be enriched by AI automatically.
                </p>
                
                <ManualRulingForm />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar (Right 1/3) */}
        <div className="space-y-6">
          {/* Enrichment Card */}
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">AI Enrichment</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Trigger OpenAI to translate, categorize, and tag pending Finnish rulings.
              Processes in batches of 10.
            </p>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <Button onClick={handleEnrich} disabled={enriching} variant="secondary" className="w-full">
                  {enriching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Trigger Enrichment Batch
                </Button>
                {enrichCount !== null && (
                  <span className="text-sm text-center text-muted-foreground">
                    Last run: {enrichCount} enriched
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
