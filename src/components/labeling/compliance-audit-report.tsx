"use client";

import type { ComplianceResult } from "@/lib/labeling/compliance-checker";
import { calculateComplianceScore } from "@/lib/labeling/compliance-checker";
import { Badge } from "@/components/ui/badge";

type ProductNameType = 
  | string 
  | { original?: string; translations?: { fi?: string; sv?: string } }
  | { fi?: string; sv?: string }
  | undefined;

interface ComplianceAuditReportProps {
  productName: ProductNameType;
  originCountry: string;
  complianceResults: ComplianceResult[];
}

/**
 * Safely extract product name as string from various formats
 * Handles: string, {original, translations}, {fi, sv}, undefined
 */
function getProductNameString(productName: ProductNameType): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";
  
  // Handle standard structure: {original: string, translations: {fi: string, sv: string}}
  if ("translations" in productName && productName.translations && typeof productName.translations === "object") {
    const trans = productName.translations;
    if (typeof trans.fi === "string") return trans.fi;
    if (typeof trans.sv === "string") return trans.sv;
    if ("original" in productName && typeof productName.original === "string") return productName.original;
  }
  
  // Handle edge case: direct {fi: string, sv: string} structure
  if ("fi" in productName && typeof productName.fi === "string") return productName.fi;
  if ("sv" in productName && typeof productName.sv === "string") return productName.sv;
  
  // Final fallback
  if ("original" in productName && typeof productName.original === "string") return productName.original;
  
  return "Product";
}

export function ComplianceAuditReport({
  productName,
  originCountry,
  complianceResults,
}: ComplianceAuditReportProps) {
  // Safely extract product name string
  const productNameString = getProductNameString(productName);
  const score = calculateComplianceScore(complianceResults);
  const status = score >= 100 ? "Fully Compliant" : score >= 80 ? "Action Required" : "Critical Issues";
  const statusColor = score >= 100 ? "text-green-600" : score >= 80 ? "text-yellow-600" : "text-red-600";

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge variant="destructive" className="text-xs">CRITICAL</Badge>;
      case "WARNING":
        return <Badge variant="outline" className="text-xs">WARNING</Badge>;
      case "INFO":
        return <Badge variant="outline" className="text-xs">INFO</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">PASS</Badge>;
    }
  };

  const getStatusText = (passed: boolean, severity: string) => {
    if (passed) return "PASS";
    if (severity === "CRITICAL") return "FAIL";
    if (severity === "WARNING") return "WARNING";
    return "INFO";
  };

  // Group results by category for better presentation
  const languageChecks = complianceResults.filter((r) => r.ruleId.includes("language"));
  const ingredientChecks = complianceResults.filter((r) => r.ruleId.includes("quid") || r.ruleId.includes("allergen") || r.ruleId.includes("functional"));
  const saltChecks = complianceResults.filter((r) => r.ruleId.includes("salt"));
  const entityChecks = complianceResults.filter((r) => r.ruleId.includes("importer") || r.ruleId.includes("address"));
  const otherChecks = complianceResults.filter(
    (r) =>
      !r.ruleId.includes("language") &&
      !r.ruleId.includes("quid") &&
      !r.ruleId.includes("allergen") &&
      !r.ruleId.includes("functional") &&
      !r.ruleId.includes("salt") &&
      !r.ruleId.includes("importer") &&
      !r.ruleId.includes("address")
  );

  const renderCheck = (result: ComplianceResult, index: number) => {
    const statusText = getStatusText(result.passed, result.severity);
    const isPass = result.passed;
    const isCritical = result.severity === "CRITICAL" && !isPass;

    return (
      <div key={index} className="mb-4 pb-4 border-b last:border-0">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{result.ruleName}:</span>
              <span className={isPass ? "text-gray-700" : isCritical ? "text-red-600" : "text-gray-700"}>
                {statusText}
              </span>
              {getSeverityBadge(result.severity)}
            </div>
            <div className="text-sm text-gray-700 mb-2">{result.message}</div>
            {!isPass && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm">
                <div className="font-medium text-yellow-800 mb-1">Action Required:</div>
                <div className="text-yellow-700">
                  {result.message.includes("QUID") && (
                    <div>Please enter the % of {productNameString.split(" ")[0]} from the front of the original pack. (e.g., 95%)</div>
                  )}
                  {result.message.includes("salt") && (
                    <div>Added mandatory warning: &quot;Voimakassuolainen / Kraftigt saltad&quot;.</div>
                  )}
                  {result.message.includes("importer") && (
                    <div>Must include EU-based importer address. Original {originCountry} address is not sufficient.</div>
                  )}
                  {result.message.includes("language") && (
                    <div>Generated Finnish and Swedish translations for all mandatory fields.</div>
                  )}
                  {result.message.includes("allergen") && (
                    <div>Automation: Automatically bolded in the ingredient list.</div>
                  )}
                  {!result.message.includes("QUID") &&
                    !result.message.includes("salt") &&
                    !result.message.includes("importer") &&
                    !result.message.includes("language") &&
                    !result.message.includes("allergen") && (
                      <div>{result.message}</div>
                    )}
                </div>
              </div>
            )}
            {isPass && result.ruleId.includes("allergen") && (
              <div className="text-sm text-green-700 mt-1">
                Detected: {result.message.includes("Sulfur") ? "Sulfur Dioxide" : "Allergens"}.
                <br />
                Automation: Automatically bolded in the ingredient list.
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">Source: {result.source}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-bold">Compliance Audit: {productNameString} ({originCountry})</h3>
        <div className={`text-sm font-medium ${statusColor}`}>
          Status: {status} ({score}% Compliant)
        </div>
      </div>

      {/* Language Check */}
      {languageChecks.length > 0 && (
        <div>
          <div className="font-semibold mb-2">1. Finnish and Swedish Required:</div>
          {languageChecks.map((result, idx) => renderCheck(result, idx))}
        </div>
      )}

      {/* Ingredient & QUID Analysis */}
      {ingredientChecks.length > 0 && (
        <div>
          <div className="font-semibold mb-2">2. Ingredient & QUID Analysis:</div>
          {ingredientChecks.map((result, idx) => renderCheck(result, idx))}
        </div>
      )}

      {/* Allergen Detection */}
      {complianceResults.some((r) => r.ruleId.includes("allergen")) && (
        <div>
          <div className="font-semibold mb-2">3. Allergen Detection:</div>
          {complianceResults
            .filter((r) => r.ruleId.includes("allergen"))
            .map((result, idx) => renderCheck(result, idx))}
        </div>
      )}

      {/* Font Size Check */}
      {otherChecks.some((r) => r.ruleId.includes("font")) && (
        <div>
          <div className="font-semibold mb-2">4. Minimum Font Size (1.2mm x-height):</div>
          {otherChecks
            .filter((r) => r.ruleId.includes("font"))
            .map((result, idx) => renderCheck(result, idx))}
        </div>
      )}

      {/* Entity Verification */}
      {entityChecks.length > 0 && (
        <div>
          <div className="font-semibold mb-2">5. Entity Verification:</div>
          {entityChecks.map((result, idx) => renderCheck(result, idx))}
        </div>
      )}

      {/* Other Checks (excluding font size which is now in its own section) */}
      {otherChecks.filter((r) => !r.ruleId.includes("font")).length > 0 && (
        <div>
          {otherChecks
            .filter((r) => !r.ruleId.includes("font"))
            .map((result, idx) => renderCheck(result, idx))}
        </div>
      )}
    </div>
  );
}

