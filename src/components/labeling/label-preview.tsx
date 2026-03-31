"use client";

import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { Badge } from "@/components/ui/badge";

interface LabelPreviewProps {
  labelData: EnhancedLabelData;
  productCategory: string;
}

// Helper to safely extract product name string - handles all possible structures
function getProductNameString(productName: any, language: "fi" | "sv" = "fi"): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";
  
  // Handle standard structure: {original: string, translations: {fi: string, sv: string}}
  if (productName.translations && typeof productName.translations === "object") {
    const trans = productName.translations;
    if (language === "fi" && typeof trans.fi === "string") return trans.fi;
    if (language === "sv" && typeof trans.sv === "string") return trans.sv;
    // Fallback to other language or original
    if (language === "fi" && typeof trans.sv === "string") return trans.sv;
    if (language === "sv" && typeof trans.fi === "string") return trans.fi;
    if (typeof productName.original === "string") return productName.original;
  }
  
  // Handle edge case: direct {fi: string, sv: string} structure
  if (language === "fi" && typeof productName.fi === "string") return productName.fi;
  if (language === "sv" && typeof productName.sv === "string") return productName.sv;
  if (language === "fi" && typeof productName.sv === "string") return productName.sv;
  if (language === "sv" && typeof productName.fi === "string") return productName.fi;
  
  // Final fallback
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
          {getProductNameString(labelData.productName, "fi")}
        </div>
        <div className="text-lg text-gray-600">
          {getProductNameString(labelData.productName, "sv")}
        </div>
      </div>
      <div className="border-t border-gray-300 my-3"></div>

      {/* Ingredients */}
      {(productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients && labelData.ingredients.length > 0 && (
        <div className="mb-3">
          <div className="font-bold mb-1">Ainesosat:</div>
          <div className="text-sm leading-snug text-gray-900">
            {labelData.ingredients.map((ing, idx) => {
              const ingNameFI =
                ing.translations && typeof ing.translations === "object" && typeof ing.translations.fi === "string"
                  ? ing.translations.fi
                  : typeof ing.name === "string"
                    ? ing.name
                    : "Ingredient";

              return (
                <span key={`fi-${idx}`}>
                  <span className={ing.isAllergen ? "font-bold text-red-700" : ""}>
                    {ingNameFI}
                    {ing.percentage != null ? ` (${ing.percentage}%)` : ""}
                  </span>
                  {idx < labelData.ingredients.length - 1 ? ", " : ""}
                </span>
              );
            })}
          </div>

          <div className="font-bold mt-2 mb-1">Ingredienser:</div>
          <div className="text-xs leading-snug text-gray-700">
            {labelData.ingredients.map((ing, idx) => {
              const ingNameSV =
                ing.translations && typeof ing.translations === "object" && typeof ing.translations.sv === "string"
                  ? ing.translations.sv
                  : typeof ing.name === "string"
                    ? ing.name
                    : "Ingredient";

              return (
                <span key={`sv-${idx}`}>
                  <span className={ing.isAllergen ? "font-bold text-red-700" : ""}>
                    {ingNameSV}
                    {ing.percentage != null ? ` (${ing.percentage}%)` : ""}
                  </span>
                  {idx < labelData.ingredients.length - 1 ? ", " : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Warnings */}
      {labelData.warnings && labelData.warnings.length > 0 && (
        <div className="mb-3">
          {labelData.warnings.map((warning, idx) => (
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
          <div className="font-bold mb-2">Ravintoarvot / Näringsvärde</div>
          <div className="text-xs mb-1">100g</div>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Energia / Energi</div>
                  <div className="text-xs text-gray-500">kJ / kcal</div>
                </td>
                <td className="text-right font-bold py-1">
                  {Math.round(energyKcal * 4.184)} kJ / {energyKcal} kcal
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Rasva / Fett</div>
                </td>
                <td className="text-right font-bold py-1">
                  {fat} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Hiilihydraatit / Kolhydrat</div>
                </td>
                <td className="text-right font-bold py-1">
                  {carbs} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Proteiini / Protein</div>
                </td>
                <td className="text-right font-bold py-1">
                  {protein} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Suola / Salt</div>
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
            <span className="font-medium">Parasta ennen / Bäst före:</span> {labelData.bestBeforeDate}
          </div>
        )}
        {labelData.batchNumber && (
          <div>
            <span className="font-medium">Erä / Parti:</span> {labelData.batchNumber}
          </div>
        )}
        {labelData.netQuantity && (
          <div>
            <span className="font-medium">Nettomäärä / Nettovikt:</span> {labelData.netQuantity}
          </div>
        )}
      </div>

      {/* Origin Country */}
      {labelData.originCountry && (
        <div className="mb-3 text-sm">
          <span className="font-medium">Alkuperämaa / Ursprungsland:</span> {labelData.originCountry}
        </div>
      )}

      {/* Importer Address */}
      <div className="mb-3 text-sm">
        <div className="font-medium mb-1">Maahantuoja / Importör:</div>
        <div>{labelData.importerAddress}</div>
      </div>

      {/* Storage Instructions */}
      {labelData.storageInstructions && (
        <div className="text-sm">
          <span className="font-medium">Säilytys / Förvaring:</span> {labelData.storageInstructions}
        </div>
      )}
    </div>
  );
}

