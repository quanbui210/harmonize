"use client";

import type { ComplianceResult } from "@/lib/labeling/compliance-checker";
import { calculateComplianceScore } from "@/lib/labeling/compliance-checker";
import { Badge } from "@/components/ui/badge";

interface ComplianceAuditReportProps {
  productName: string;
  originCountry: string;
  complianceResults: ComplianceResult[];
}

export function ComplianceAuditReport({
  productName,
  originCountry,
  complianceResults,
}: ComplianceAuditReportProps) {
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
              <span className="font-medium">{index + 1}. {result.ruleName}:</span>
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
                    <div>Please enter the % of {productName.split(" ")[0]} from the front of the original pack. (e.g., 95%)</div>
                  )}
                  {result.message.includes("salt") && (
                    <div>Added mandatory warning: "Voimakassuolainen / Kraftigt saltad".</div>
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
        <h3 className="text-lg font-bold">Compliance Audit: {productName} ({originCountry})</h3>
        <div className={`text-sm font-medium ${statusColor}`}>
          Status: {status} ({score}% Compliant)
        </div>
      </div>

      {/* Language Check */}
      {languageChecks.length > 0 && (
        <div>
          {languageChecks.map((result, idx) => renderCheck(result, idx))}
        </div>
      )}

      {/* Ingredient & QUID Analysis */}
      {ingredientChecks.length > 0 && (
        <div>
          <div className="font-semibold mb-2">2. Ingredient & QUID Analysis:</div>
          {ingredientChecks.map((result, idx) => renderCheck(result, languageChecks.length + idx))}
        </div>
      )}

      {/* Allergen Detection */}
      {complianceResults.some((r) => r.ruleId.includes("allergen")) && (
        <div>
          <div className="font-semibold mb-2">3. Allergen Detection:</div>
          {complianceResults
            .filter((r) => r.ruleId.includes("allergen"))
            .map((result, idx) => renderCheck(result, languageChecks.length + ingredientChecks.length + idx))}
        </div>
      )}

      {/* Salt Warning Check */}
      {saltChecks.length > 0 && (
        <div>
          <div className="font-semibold mb-2">4. Salt Warning Check:</div>
          {saltChecks.map((result, idx) =>
            renderCheck(
              result,
              languageChecks.length + ingredientChecks.length + (complianceResults.some((r) => r.ruleId.includes("allergen")) ? 1 : 0) + idx
            )
          )}
        </div>
      )}

      {/* Entity Verification */}
      {entityChecks.length > 0 && (
        <div>
          <div className="font-semibold mb-2">5. Entity Verification:</div>
          {entityChecks.map((result, idx) =>
            renderCheck(
              result,
              languageChecks.length +
                ingredientChecks.length +
                (complianceResults.some((r) => r.ruleId.includes("allergen")) ? 1 : 0) +
                saltChecks.length +
                idx
            )
          )}
        </div>
      )}

      {/* Other Checks */}
      {otherChecks.length > 0 && (
        <div>
          {otherChecks.map((result, idx) =>
            renderCheck(
              result,
              languageChecks.length +
                ingredientChecks.length +
                (complianceResults.some((r) => r.ruleId.includes("allergen")) ? 1 : 0) +
                saltChecks.length +
                entityChecks.length +
                idx
            )
          )}
        </div>
      )}
    </div>
  );
}

