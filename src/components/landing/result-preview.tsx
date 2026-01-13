"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Package, AlertCircle } from "lucide-react";

export function ResultPreview() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative">
      <div className="border border-border rounded-lg bg-background p-6 flex flex-col min-w-[450px] max-w-[550px] h-[600px] shadow-sm">
        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* Header */}
        <div className="space-y-1.5 pb-2 flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Dossier ID
          </p>
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-sm font-semibold tracking-tight">
              H-AI_092384_VERIFIED
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <CheckCircle2 className="h-3 w-3" />
              COMPLIANT
            </span>
          </div>
        </div>

        {/* Compliance Score */}
        <div className="space-y-1.5 flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            GRI Compliance Score
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xl font-serif font-semibold tracking-tight">92%</span>
              <span className="text-xs text-muted-foreground italic">Defensible</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000 ease-out"
                style={{ 
                  width: animated ? "92%" : "0%",
                }}
              />
            </div>
          </div>
        </div>

        {/* Classification Codes */}
        <div className="pt-1.5 border-t border-border/30 flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Classification Codes
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">CN Code (EU)</p>
              <p className="font-mono text-base font-semibold tracking-tight">
                1905 90 60
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">HS Code</p>
              <p className="font-mono text-base font-semibold tracking-tight">
                19.05.90
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic mt-1.5">
            Prepared foodstuffs, other
          </p>
        </div>

        {/* Label Status */}
        <div className="pt-1.5 border-t border-border/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Product Label
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <CheckCircle2 className="h-3 w-3" />
              Ready
            </span>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Bilingual (Finnish/Swedish) label generated and compliant
          </p>
        </div>

        {/* Required Documents */}
        <div className="pt-1.5 border-t border-border/30 flex-shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Required Documents
          </p>
          <ul className="space-y-1">
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="italic">Commercial invoice from supplier</span>
            </li>
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <Package className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="italic">Packing list with net weights</span>
            </li>
            <li className="flex items-start gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="italic">Certificate of origin (if applicable)</span>
            </li>
          </ul>
        </div>

        {/* Status & Next Steps */}
        <div className="pt-1.5 border-t border-border/30 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                Legal Precedent
              </p>
              <p className="text-xs font-serif font-semibold tracking-tight">
                Rule 3(b) Applied
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                Audit Status
              </p>
              <p className="text-xs font-serif font-semibold tracking-tight">
                Defensible Ready
              </p>
            </div>
          </div>
        </div>

        {/* AI Reasoning Preview */}
        <div className="pt-1.5 border-t border-border/30 flex-1 min-h-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            AI Reasoning
          </p>
          <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2 overflow-hidden">
            Classification based on Section XVI, Note 2(a) of the Harmonized System Tariff. 
            Product characteristics align with heading 1905, specifically subheading 1905 90 60 
            for other prepared foodstuffs...
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
