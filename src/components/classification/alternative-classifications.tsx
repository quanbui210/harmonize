"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Info } from "lucide-react";

interface AlternativeClassification {
  cnCode: string;
  htsCode: string;
  confidence: number;
  dutyRate: number;
  vatRate: number;
  reasoning: string;
  tradeOffs?: string;
}

interface AlternativeClassificationsProps {
  alternatives: AlternativeClassification[];
  primaryCode: string;
  primaryDutyRate: number;
  primaryVatRate: number;
}

function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}

export function AlternativeClassifications({
  alternatives,
  primaryCode,
  primaryDutyRate,
  primaryVatRate,
}: AlternativeClassificationsProps) {
  if (alternatives.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Alternative Classifications
        </CardTitle>
        <CardDescription>
          Other possible CN codes for this product. Consider applying for Binding Tariff Information (BTI) for legal certainty.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              This product has multiple possible classifications. The primary code ({formatCNCode(primaryCode)}) is recommended, but alternatives may be valid depending on interpretation.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {alternatives.map((alt, index) => {
            const dutyDiff = alt.dutyRate - primaryDutyRate;
            const vatDiff = alt.vatRate - primaryVatRate;
            const isLowerDuty = dutyDiff < 0;
            const isHigherDuty = dutyDiff > 0;

            return (
              <div
                key={index}
                className="border rounded-lg p-4 space-y-3 bg-muted/30"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-lg">
                        {formatCNCode(alt.cnCode)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(alt.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alt.reasoning}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Duty Rate</p>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alt.dutyRate.toFixed(2)}%</span>
                      {isLowerDuty && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                          -{Math.abs(dutyDiff).toFixed(2)}% vs primary
                        </Badge>
                      )}
                      {isHigherDuty && (
                        <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                          +{dutyDiff.toFixed(2)}% vs primary
                        </Badge>
                      )}
                      {dutyDiff === 0 && (
                        <Badge variant="outline" className="text-xs">
                          Same as primary
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">VAT Rate</p>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{alt.vatRate.toFixed(2)}%</span>
                      {vatDiff !== 0 && (
                        <Badge variant="outline" className="text-xs">
                          {vatDiff > 0 ? "+" : ""}{vatDiff.toFixed(2)}% vs primary
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {alt.tradeOffs && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Trade-offs:</p>
                    <p className="text-sm">{alt.tradeOffs}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            Recommendation: Apply for Binding Tariff Information (BTI)
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            For ambiguous classifications like this, we recommend applying for a BTI from your national customs authority. A BTI provides legally binding classification for 3-6 years and protects against retroactive duty adjustments.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

