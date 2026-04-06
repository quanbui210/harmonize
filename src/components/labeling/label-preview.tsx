"use client";

import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { Badge } from "@/components/ui/badge";
import { getLabelText, getRenderLocales, resolveEUMarketProfile } from "@/lib/labeling/eu-market";

interface LabelPreviewProps {
  labelData: EnhancedLabelData;
  productCategory: string;
}

function getProductNameString(productName: any, language: string): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";
  
  if (productName.translations && typeof productName.translations === "object") {
    const trans = productName.translations;
    if (typeof trans[language] === "string") return trans[language];
    const firstTranslation = Object.values(trans).find((value) => typeof value === "string");
    if (typeof firstTranslation === "string") return firstTranslation;
    if (typeof productName.original === "string") return productName.original;
  }
  
  if (typeof productName[language] === "string") return productName[language];
  if (typeof productName.original === "string") return productName.original;
  
  return "Product";
}

function parseNutritionNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEnergyKcal(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replace(",", ".");
  const kcalMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kcal/i);
  if (kcalMatch) {
    const parsed = Number(kcalMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }

  const kjMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kj/i);
  if (kjMatch) {
    const parsed = Number(kjMatch[1]);
    if (Number.isFinite(parsed)) return Number((parsed / 4.184).toFixed(1));
  }

  return parseNutritionNumber(normalized);
}

function getLocalizedText(value: unknown, locales: string[]): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const localeMap = value as Record<string, unknown>;
  for (const locale of locales) {
    const candidate = localeMap[locale];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const fallback = Object.values(localeMap).find(
    (candidate) => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return typeof fallback === "string" ? fallback.trim() : "";
}

export function LabelPreview({ labelData, productCategory }: LabelPreviewProps) {
  const width = labelData.labelDimensions?.width || 100;
  const height = labelData.labelDimensions?.height || 150;
  
  // Convert mm to pixels (assuming 96 DPI, 1mm = 3.7795px)
  const widthPx = width * 3.7795;
  const heightPx = height * 3.7795;
  const energyKcal = parseEnergyKcal(labelData.nutritionInfo?.energy);
  const fat = parseNutritionNumber(labelData.nutritionInfo?.fat);
  const carbs = parseNutritionNumber(labelData.nutritionInfo?.carbs);
  const protein = parseNutritionNumber(labelData.nutritionInfo?.protein);
  const salt = parseNutritionNumber(labelData.nutritionInfo?.salt);
  const market = resolveEUMarketProfile(labelData.market?.destinationCountry);
  const requiredLocales = labelData.market?.requiredLocales?.length
    ? labelData.market.requiredLocales
    : market.requiredLocales;
  const renderLocales = labelData.market?.renderLocales?.length
    ? labelData.market.renderLocales
    : getRenderLocales(requiredLocales);
  const primaryLocale = renderLocales[0] || "en";
  const secondaryLocale = renderLocales[1];
  const warningTexts = (Array.isArray(labelData.warnings) ? labelData.warnings : [])
    .map((warning) => getLocalizedText(warning, renderLocales))
    .filter((warning) => warning.length > 0);
  const storageInstructionText = getLocalizedText(labelData.storageInstructions, renderLocales);

  return (
    <div
      className="bg-white border-2 border-gray-800 p-4 font-sans"
      style={{
        width: `${widthPx}px`,
        minHeight: `${heightPx}px`,
        fontSize: `${labelData.fontSize || 10}pt`,
      }}
    >
      {/* Product Name */}
      <div className="mb-3">
        <div className="text-2xl font-bold mb-1">
          {getProductNameString(labelData.productName, primaryLocale)}
        </div>
        {secondaryLocale && (
          <div className="text-lg text-gray-600">
            {getProductNameString(labelData.productName, secondaryLocale)}
          </div>
        )}
      </div>
      <div className="border-t border-gray-300 my-3"></div>

      {/* Ingredients */}
      {(productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients && labelData.ingredients.length > 0 && (
        <div className="mb-3">
          <div className="font-bold mb-1">{getLabelText(renderLocales, "ingredients")}:</div>
          <div className="text-sm leading-snug text-gray-900">
            {labelData.ingredients.map((ing, idx) => {
              const ingNamePrimary =
                ing.translations && typeof ing.translations === "object" && typeof ing.translations[primaryLocale] === "string"
                  ? ing.translations[primaryLocale]
                  : typeof ing.name === "string"
                    ? ing.name
                    : "Ingredient";

              return (
                <span key={`primary-${idx}`}>
                  <span className={ing.isAllergen ? "font-bold text-red-700" : ""}>
                    {ingNamePrimary}
                    {ing.percentage != null ? ` (${ing.percentage}%)` : ""}
                  </span>
                  {idx < labelData.ingredients.length - 1 ? ", " : ""}
                </span>
              );
            })}
          </div>

          {secondaryLocale && (
            <>
              <div className="font-bold mt-2 mb-1">{getLabelText([secondaryLocale], "ingredients")}:</div>
              <div className="text-xs leading-snug text-gray-700">
                {labelData.ingredients.map((ing, idx) => {
                  const ingNameSecondary =
                    ing.translations && typeof ing.translations === "object" && typeof ing.translations[secondaryLocale] === "string"
                      ? ing.translations[secondaryLocale]
                      : typeof ing.name === "string"
                        ? ing.name
                        : "Ingredient";

                  return (
                    <span key={`secondary-${idx}`}>
                      <span className={ing.isAllergen ? "font-bold text-red-700" : ""}>
                        {ingNameSecondary}
                        {ing.percentage != null ? ` (${ing.percentage}%)` : ""}
                      </span>
                      {idx < labelData.ingredients.length - 1 ? ", " : ""}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Warnings */}
      {warningTexts.length > 0 && (
        <div className="mb-3">
          {warningTexts.map((warning, idx) => (
            <div
              key={idx}
              className="border-2 border-black p-2 mb-2 font-bold uppercase text-sm"
            >
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Nutrition Table */}
      {labelData.nutritionInfo && (
        <div className="mb-3">
          <div className="font-bold mb-2">{getLabelText(renderLocales, "nutrition")}</div>
          <div className="text-xs mb-1">100g</div>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>{getLabelText(renderLocales, "energy")}</div>
                  <div className="text-xs text-gray-500">kJ / kcal</div>
                </td>
                <td className="text-right font-bold py-1">
                  {Math.round(energyKcal * 4.184)} kJ / {energyKcal} kcal
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>{getLabelText(renderLocales, "fat")}</div>
                </td>
                <td className="text-right font-bold py-1">
                  {fat} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>{getLabelText(renderLocales, "carbs")}</div>
                </td>
                <td className="text-right font-bold py-1">
                  {carbs} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>{getLabelText(renderLocales, "protein")}</div>
                </td>
                <td className="text-right font-bold py-1">
                  {protein} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>{getLabelText(renderLocales, "salt")}</div>
                </td>
                <td className="text-right font-bold py-1">
                  {salt} g
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 text-sm space-y-1">
        {labelData.bestBeforeDate && (
          <div>
            <span className="font-medium">{getLabelText(renderLocales, "bestBefore")}:</span> {labelData.bestBeforeDate}
          </div>
        )}
        {labelData.batchNumber && (
          <div>
            <span className="font-medium">{getLabelText(renderLocales, "batch")}:</span> {labelData.batchNumber}
          </div>
        )}
        {labelData.netQuantity && (
          <div>
            <span className="font-medium">{getLabelText(renderLocales, "netQuantity")}:</span> {labelData.netQuantity}
          </div>
        )}
      </div>

      {/* Origin Country */}
      {labelData.originCountry && (
        <div className="mb-3 text-sm">
          <span className="font-medium">{getLabelText(renderLocales, "originCountry")}:</span> {labelData.originCountry}
        </div>
      )}

      {/* Importer Address */}
      <div className="mb-3 text-sm">
        <div className="font-medium mb-1">{getLabelText(renderLocales, "importer")}:</div>
        <div>{labelData.importerAddress}</div>
      </div>

      {/* Storage Instructions */}
      {storageInstructionText && (
        <div className="text-sm">
          <span className="font-medium">{getLabelText(renderLocales, "storage")}:</span> {storageInstructionText}
        </div>
      )}
    </div>
  );
}
