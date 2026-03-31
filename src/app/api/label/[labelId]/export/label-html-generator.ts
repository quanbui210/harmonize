import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";

// Helper to safely extract product name string
export function getProductNameString(productName: any, language: "fi" | "sv" = "fi"): string {
  if (!productName) return "Product";
  if (typeof productName === "string") return productName;
  if (typeof productName !== "object") return "Product";
  
  if (productName.translations && typeof productName.translations === "object") {
    const trans = productName.translations;
    if (language === "fi" && typeof trans.fi === "string") return trans.fi;
    if (language === "sv" && typeof trans.sv === "string") return trans.sv;
    if (language === "fi" && typeof trans.sv === "string") return trans.sv;
    if (language === "sv" && typeof trans.fi === "string") return trans.fi;
    if (typeof productName.original === "string") return productName.original;
  }
  
  if (language === "fi" && typeof productName.fi === "string") return productName.fi;
  if (language === "sv" && typeof productName.sv === "string") return productName.sv;
  if (language === "fi" && typeof productName.sv === "string") return productName.sv;
  if (language === "sv" && typeof productName.fi === "string") return productName.fi;
  
  if (typeof productName.original === "string") return productName.original;
  
  return "Product";
}

// Escape HTML to prevent XSS
export function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  const str = String(text);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

export function generateLabelHTML(labelData: EnhancedLabelData, productCategory: string): string {
  const width = labelData.labelDimensions?.width || 100;
  const height = labelData.labelDimensions?.height || 150;
  const widthPx = width * 3.7795;
  const heightPx = height * 3.7795;
  const fontSize = labelData.fontSize || 10;
  const energyKcal = parseEnergyKcal(labelData.nutritionInfo?.energy);
  const fat = parseNutritionNumber(labelData.nutritionInfo?.fat);
  const carbs = parseNutritionNumber(labelData.nutritionInfo?.carbs);
  const protein = parseNutritionNumber(labelData.nutritionInfo?.protein);
  const salt = parseNutritionNumber(labelData.nutritionInfo?.salt);

  let html = `
    <div style="width: ${widthPx}px; min-height: ${heightPx}px; font-size: ${fontSize}pt; padding: 16px; font-family: Arial, sans-serif; background: white; border: 2px solid #1f2937;">
      <!-- Product Name -->
      <div style="margin-bottom: 12px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 4px;">
          ${escapeHtml(getProductNameString(labelData.productName, "fi"))}
        </div>
        <div style="font-size: 18px; color: #4b5563;">
          ${escapeHtml(getProductNameString(labelData.productName, "sv"))}
        </div>
      </div>
      <div style="border-top: 1px solid #d1d5db; margin: 12px 0;"></div>
  `;

  // Ingredients
  if ((productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients && labelData.ingredients.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: bold; margin-bottom: 8px;">Ainesosat / Ingredienser:</div>
        <div style="font-size: ${fontSize - 1}pt;">
    `;
    labelData.ingredients.forEach((ing) => {
      const ingNameFI = (ing.translations && typeof ing.translations === "object" && typeof ing.translations.fi === "string")
        ? ing.translations.fi
        : (typeof ing.name === "string" ? ing.name : "Ingredient");
      const ingNameSV = (ing.translations && typeof ing.translations === "object" && typeof ing.translations.sv === "string")
        ? ing.translations.sv
        : null;
      
      html += `
        <div style="margin-bottom: 4px;">
          <span style="${ing.isAllergen ? "font-weight: bold; color: #b91c1c;" : ""}">
            ${escapeHtml(ingNameFI)}
            ${ing.percentage ? ` (${escapeHtml(ing.percentage)}%)` : ""}
          </span>
          ${ingNameSV && ingNameSV !== ingNameFI ? `
            <div style="font-size: ${fontSize - 2}pt; color: #6b7280; margin-left: 8px;">
              ${escapeHtml(ingNameSV)}
            </div>
          ` : ""}
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  }

  // Warnings
  if (labelData.warnings && labelData.warnings.length > 0) {
    labelData.warnings.forEach((warning) => {
      html += `
        <div style="border: 2px solid black; padding: 8px; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; font-size: ${fontSize - 1}pt;">
          ${escapeHtml(warning)}
        </div>
      `;
    });
  }

  // Nutrition Table
  if (labelData.nutritionInfo) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: bold; margin-bottom: 8px;">Ravintoarvot / Näringsvärde</div>
        <div style="font-size: ${fontSize - 2}pt; margin-bottom: 4px;">100g</div>
        <table style="width: 100%; font-size: ${fontSize - 1}pt; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">
                <div>Energia / Energi</div>
                <div style="font-size: ${fontSize - 2}pt; color: #6b7280;">kJ / kcal</div>
              </td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">
                ${Math.round(energyKcal * 4.184)} kJ / ${energyKcal} kcal
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">Rasva / Fett</td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">${fat} g</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">Hiilihydraatit / Kolhydrat</td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">${carbs} g</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">Proteiini / Protein</td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">${protein} g</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">Suola / Salt</td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">${salt} g</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  // Additional info
  html += `
      <div style="font-size: ${fontSize - 1}pt; margin-bottom: 12px;">
  `;
  
  if (labelData.bestBeforeDate) {
    html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 500;">Parasta ennen / Bäst före:</span> ${escapeHtml(labelData.bestBeforeDate)}
        </div>
    `;
  }
  if (labelData.batchNumber) {
    html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 500;">Erä / Parti:</span> ${escapeHtml(labelData.batchNumber)}
        </div>
    `;
  }
  if (labelData.netQuantity) {
    html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 500;">Nettomäärä / Nettovikt:</span> ${escapeHtml(labelData.netQuantity)}
        </div>
    `;
  }
  
  html += `</div>`;

  // Origin Country
  if (labelData.originCountry) {
    html += `
      <div style="font-size: ${fontSize - 1}pt; margin-bottom: 12px;">
        <span style="font-weight: 500;">Alkuperämaa / Ursprungsland:</span> ${escapeHtml(labelData.originCountry)}
      </div>
    `;
  }

  // Importer Address
  html += `
      <div style="font-size: ${fontSize - 1}pt; margin-bottom: 12px;">
        <div style="font-weight: 500; margin-bottom: 4px;">Maahantuoja / Importör:</div>
        <div>${escapeHtml(labelData.importerAddress || "")}</div>
      </div>
  `;

  // Storage Instructions
  if (labelData.storageInstructions) {
    html += `
      <div style="font-size: ${fontSize - 1}pt;">
        <span style="font-weight: 500;">Säilytys / Förvaring:</span> ${escapeHtml(labelData.storageInstructions)}
      </div>
    `;
  }

  html += `</div>`;
  return html;
}
