
"use client";

import { useState } from "react";
import { createBtiRulingAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ManualRulingForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      reference: formData.get("reference") as string,
      country: formData.get("country") as string,
      hsCode: formData.get("hsCode") as string,
      description: formData.get("description") as string,
      justification: formData.get("justification") as string,
      startDate: new Date(formData.get("startDate") as string),
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : undefined,
      language: formData.get("language") as string,
    };

    try {
      await createBtiRulingAction(data);
      toast.success("Ruling created successfully");
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to create ruling");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="reference">BTI Reference</Label>
          <Input id="reference" name="reference" placeholder="e.g. FI-2024-1234" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Issuing Country</Label>
          <Select name="country" defaultValue="FI">
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FI">Finland (FI)</SelectItem>
              <SelectItem value="DE">Germany (DE)</SelectItem>
              <SelectItem value="NL">Netherlands (NL)</SelectItem>
              <SelectItem value="FR">France (FR)</SelectItem>
              <SelectItem value="SE">Sweden (SE)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hsCode">HS/CN Code</Label>
        <Input id="hsCode" name="hsCode" placeholder="e.g. 85171200" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description of Goods</Label>
        <Textarea 
          id="description" 
          name="description" 
          placeholder="Detailed technical description..." 
          className="h-32"
          required 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="justification">Classification Justification</Label>
        <Textarea 
          id="justification" 
          name="justification" 
          placeholder="Legal reasoning for the classification..." 
          className="h-24"
          required 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date (Optional)</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select name="language" defaultValue="EN">
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EN">English (EN)</SelectItem>
              <SelectItem value="FI">Finnish (FI)</SelectItem>
              <SelectItem value="DE">German (DE)</SelectItem>
              <SelectItem value="FR">French (FR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Ruling
      </Button>
    </form>
  );
}
