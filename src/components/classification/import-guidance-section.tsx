"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, FileText, TestTube, Tag, Shield, CheckCircle } from "lucide-react";

interface ImportGuidance {
  importStatus: "ALLOWED" | "RESTRICTED" | "PROHIBITED";
  importStatusMessage: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  requiredDocuments: string[];
  foodSafetyRisks?: Array<{
    risk: string;
    level: "LOW" | "MEDIUM" | "HIGH";
    reason: string;
  }>;
  recommendedTests?: string[];
  labellingRequirements?: string[];
  borderControlLikelihood: "LOW" | "MEDIUM" | "HIGH";
  borderControlReason?: string;
  nextActions: string[];
}

interface ImportGuidanceSectionProps {
  guidance: ImportGuidance;
}

export function ImportGuidanceSection({ guidance }: ImportGuidanceSectionProps) {
  const getStatusIcon = () => {
    switch (guidance.importStatus) {
      case "ALLOWED":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "RESTRICTED":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "PROHIBITED":
        return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusColor = () => {
    switch (guidance.importStatus) {
      case "ALLOWED":
        return "bg-green-50 border-green-200 text-green-900";
      case "RESTRICTED":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "PROHIBITED":
        return "bg-red-50 border-red-200 text-red-900";
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "LOW":
        return "bg-green-100 text-green-800 border-green-300";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "HIGH":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Status */}
      <Card className={`border-2 ${getStatusColor()}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Import Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium mb-2">{guidance.importStatusMessage}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-muted-foreground">Risk Level:</span>
            <Badge className={getRiskColor(guidance.riskLevel)}>
              {guidance.riskLevel}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Required Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Required Documents
          </CardTitle>
          <CardDescription>
            Documents you must have before importing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guidance.requiredDocuments.map((doc, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{doc}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Food Safety Risks */}
      {guidance.foodSafetyRisks && guidance.foodSafetyRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Food Safety Risks
            </CardTitle>
            <CardDescription>
              Potential food safety concerns for this product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {guidance.foodSafetyRisks.map((risk, idx) => (
                <div key={idx} className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{risk.risk}</p>
                    <p className="text-xs text-muted-foreground mt-1">{risk.reason}</p>
                  </div>
                  <Badge className={getRiskColor(risk.level)}>
                    {risk.level}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Tests */}
      {guidance.recommendedTests && guidance.recommendedTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Recommended Lab Tests
            </CardTitle>
            <CardDescription>
              Tests recommended before first shipment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {guidance.recommendedTests.map((test, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm">{test}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Labelling Requirements */}
      {guidance.labellingRequirements && guidance.labellingRequirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Labelling Requirements
            </CardTitle>
            <CardDescription>
              EU labeling requirements for this product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {guidance.labellingRequirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{req}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Border Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Border Control Expectation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Likelihood of inspection:</span>
              <Badge className={getRiskColor(guidance.borderControlLikelihood)}>
                {guidance.borderControlLikelihood}
              </Badge>
            </div>
            {guidance.borderControlReason && (
              <p className="text-sm text-muted-foreground mt-2">
                {guidance.borderControlReason}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Actions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <CheckCircle2 className="h-5 w-5" />
            Next Steps
          </CardTitle>
          <CardDescription className="text-blue-700">
            Action items to complete before importing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guidance.nextActions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">{idx + 1}.</span>
                <span className="text-sm text-blue-900">{action}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

