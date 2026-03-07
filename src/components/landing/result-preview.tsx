"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, BarChart3, FileCheck, Scale, FileText, Package, AlertTriangle, TrendingUp } from "lucide-react";

export function ResultPreview() {
  const [animated, setAnimated] = useState(false);
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const SWAP_INTERVAL = 7500; 
    
    const interval = setInterval(() => {
      // Only toggle showLabel, don't change contentKey to avoid remounting
      setShowLabel((prev) => !prev);
    }, SWAP_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <div className="border border-border rounded-lg bg-background flex flex-col min-w-[500px] max-w-[580px] h-[600px] shadow-sm relative">
        {/* Label Content */}
        <div 
          className={`absolute inset-0 p-4 flex flex-col space-y-3 overflow-y-auto transition-opacity duration-1800 ${showLabel ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
        >
          {/* Label Preview Section */}
          <div className="mt-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Label Status
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 className="h-3 w-3" />
                Ready for Review
              </span>
            </div>
            <div className="border-2 border-border rounded-md p-2 bg-muted/20">
              <div className="space-y-1.5 text-xs">
                <div>
                  <div className="font-semibold text-sm mb-0.5">Organic Quinoa Pasta</div>
                  <div className="text-muted-foreground italic text-xs">Ekologisk Quinoapasta</div>
                </div>
                <div className="border-t border-border/30 pt-1.5">
                  <div className="font-medium mb-0.5 text-xs">Ainesosat / Ingredienser:</div>
                  <div className="text-muted-foreground italic space-y-0.5 text-xs">
                    <div>Quinoa , Durumvete , Vatten</div>
                    <div className="text-red-600 font-semibold">Gluten</div>
                  </div>
                </div>
                <div className="border-t border-border/30 pt-1.5">
                  <div className="font-medium mb-0.5 text-xs">Ravintoarvot / Näringsvärde</div>
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground text-xs">
                    <div>Energia: 1520 kJ / 363 kcal</div>
                    <div>Rasva: 2.5 g</div>
                    <div>Hiilihydraatit: 68 g</div>
                    <div>Proteiini: 14 g</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compliance Analysis */}
          <div className="border-t border-border/30 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 mt-1">
              Compliance Analysis
            </p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">Allergen Declaration</p>
                  <p className="text-xs text-muted-foreground italic leading-tight">Gluten clearly marked per EU 1169/2011</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">Nutrition Table</p>
                  <p className="text-xs text-muted-foreground italic leading-tight">Mandatory values present and formatted</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">Importer Address</p>
                  <p className="text-xs text-muted-foreground italic leading-tight">Complete importer information provided</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">QUID Compliance</p>
                  <p className="text-xs text-muted-foreground italic leading-tight">Quantitative ingredient declarations missing or incomplete</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {/* <div className="border-t border-border/30 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 mt-1">
              Quick Stats
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="text-center p-1.5 bg-muted/20 rounded">
                <BarChart3 className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                <p className="text-xs font-semibold">92%</p>
                <p className="text-xs text-muted-foreground italic">Score</p>
              </div>
              <div className="text-center p-1.5 bg-muted/20 rounded">
                <FileCheck className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                <p className="text-xs font-semibold">3/4</p>
                <p className="text-xs text-muted-foreground italic">Checks</p>
              </div>
              <div className="text-center p-1.5 bg-muted/20 rounded">
                <Scale className="h-3.5 w-3.5 mx-auto mb-0.5 text-primary" />
                <p className="text-xs font-semibold">1</p>
                <p className="text-xs text-muted-foreground italic">Ruling</p>
              </div>
            </div>
          </div> */}

          {/* Detailed Reasoning - Compact */}
          <div className="border-t border-border/30 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 mt-1">
              Classification Analysis
            </p>
            <div className="space-y-1.5 text-xs text-muted-foreground italic leading-relaxed">
              <p className="line-clamp-2">
                <span className="font-semibold text-foreground">Primary:</span> Heading 1905 covers prepared foodstuffs obtained by swelling or roasting cereals or cereal products.
              </p>
              <p className="line-clamp-2">
                <span className="font-semibold text-foreground">Subheading 1905 90 60:</span> Applies to other prepared foodstuffs not elsewhere specified. Product contains 45% quinoa and 30% durum wheat.
              </p>
              <p className="line-clamp-1">
                <span className="font-semibold text-foreground">Legal Basis:</span> BTI ruling EU-2021-1832, Section XVI, Note 2(a).
              </p>
            </div>
          </div>
        </div>
        {/* Dossier Content */}
        <div 
          className={`absolute inset-0 p-4 flex flex-col space-y-3 overflow-hidden transition-opacity duration-1800 ${!showLabel ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
        >
          {/* Header */}
          <div className="space-y-1 pb-1.5 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dossier ID
            </p>
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs font-semibold tracking-tight">
                TC_092384_VERIFIED
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <CheckCircle2 className="h-3 w-3" />
                COMPLIANT
              </span>
            </div>
          </div>

          {/* Compliance Score */}
          <div className="flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              GRI Compliance Score
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-lg font-serif font-semibold tracking-tight">92%</span>
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
          <div className="border-t border-border/30 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 mt-1">
              Classification Codes
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">CN Code (EU)</p>
                <p className="font-mono text-sm font-semibold tracking-tight">
                  1905 90 60
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">HS Code</p>
                <p className="font-mono text-sm font-semibold tracking-tight">
                  19.05.90
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic mt-1">
              Prepared foodstuffs, other
            </p>
          </div>

          {/* Label Status */}
          <div className="border-t border-border/30 flex-shrink-0">
            <div className="flex items-center justify-between mb-0.5 mt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Product Label
              </p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 className="h-3 w-3" />
                Ready
              </span>
            </div>
            <p className="text-xs text-muted-foreground italic leading-tight">
              Bilingual (Finnish/Swedish) label generated and compliant
            </p>
          </div>

          {/* Required Documents */}
          <div className="border-t border-border/30 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 mt-1">
              Required Documents
            </p>
            <ul className="space-y-0.5">
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="italic leading-tight">Commercial invoice from supplier</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <Package className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="italic leading-tight">Packing list with net weights</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="italic leading-tight">Certificate of origin (if applicable)</span>
              </li>
            </ul>
          </div>

          {/* Status & Next Steps */}
          <div className="border-t border-border/30 flex-shrink-0">
            <div className="grid grid-cols-2 gap-2 mt-1">
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

          {/* Duty & Tax Information */}
          {/* <div className="border-t border-border/30 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 mt-1">
              Duty & Tax Rates
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Import Duty</p>
                <p className="text-xs font-serif font-semibold tracking-tight">12.8%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">VAT Rate</p>
                <p className="text-xs font-serif font-semibold tracking-tight">24%</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic mt-1 leading-tight">
              Rates based on CN code 1905 90 60, EU tariff schedule
            </p>
          </div> */}

          {/* Risk Indicators */}
          {/* <div className="border-t border-border/30 flex-shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 mt-1">
              Risk Assessment
            </p>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">Low Classification Risk</p>
                  <p className="text-xs text-muted-foreground italic leading-tight">Strong binding precedent support</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold">Quota Monitoring</p>
                  <p className="text-xs text-muted-foreground italic leading-tight">No current restrictions, monitor for updates</p>
                </div>
              </div>
            </div>
          </div> */}

          {/* AI Reasoning Preview */}
          <div className="mt-4 border-t border-border/30 flex-1 min-h-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 mt-1">
              AI Reasoning
            </p>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              Classification based on Section XVI, Note 2(a) of the Harmonized System Tariff. 
              Product characteristics align with heading 1905, specifically subheading 1905 90 60 
              for other prepared foodstuffs. The classification is confirmed by binding BTI ruling 
              EU-2021-1832 and follows the General Rules for Interpretation of the Combined Nomenclature.
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer Disclaimer */}
      <div className="mt-4 pt-4 border-t border-border/30">
        <p className="text-xs text-muted-foreground italic text-center leading-relaxed">
          Results are informational and non-binding. Final decisions rest with EU customs authorities.
        </p>
      </div>
    </div>
  );
}
