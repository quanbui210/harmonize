"use client";

import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { Badge } from "@/components/ui/badge";

interface LabelPreviewProps {
  labelData: EnhancedLabelData;
  productCategory: string;
}

export function LabelPreview({ labelData, productCategory }: LabelPreviewProps) {
  const width = labelData.labelDimensions?.width || 100;
  const height = labelData.labelDimensions?.height || 150;
  
  // Convert mm to pixels (assuming 96 DPI, 1mm = 3.7795px)
  const widthPx = width * 3.7795;
  const heightPx = height * 3.7795;

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
          {labelData.productName?.translations?.fi || labelData.productName?.original || "Product"}
        </div>
        <div className="text-lg text-gray-600">
          {labelData.productName?.translations?.sv || labelData.productName?.original || "Product"}
        </div>
      </div>
      <div className="border-t border-gray-300 my-3"></div>

      {/* Ingredients */}
      {(productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients && labelData.ingredients.length > 0 && (
        <div className="mb-3">
          <div className="font-bold mb-2">Ainesosat / Ingredienser:</div>
          <div className="space-y-1 text-sm">
            {labelData.ingredients.map((ing, idx) => (
              <div key={idx} className="mb-1">
                <span
                  className={ing.isAllergen ? "font-bold text-red-700" : ""}
                >
                  {ing.translations?.fi || ing.name}
                  {ing.percentage && ` (${ing.percentage}%)`}
                </span>
                {ing.translations?.sv && (
                  <div className="text-xs text-gray-500 ml-2">
                    {ing.translations.sv}
                  </div>
                )}
              </div>
            ))}
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
                  {Math.round((labelData.nutritionInfo.energy || 0) * 4.184)} kJ / {labelData.nutritionInfo.energy || 0} kcal
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Rasva / Fett</div>
                </td>
                <td className="text-right font-bold py-1">
                  {labelData.nutritionInfo.fat || 0} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Hiilihydraatit / Kolhydrat</div>
                </td>
                <td className="text-right font-bold py-1">
                  {labelData.nutritionInfo.carbs || 0} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Proteiini / Protein</div>
                </td>
                <td className="text-right font-bold py-1">
                  {labelData.nutritionInfo.protein || 0} g
                </td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-1">
                  <div>Suola / Salt</div>
                </td>
                <td className="text-right font-bold py-1">
                  {labelData.nutritionInfo.salt || 0} g
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Best Before / Batch / Net Quantity */}
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

