import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { getLabelText, getRenderLocales, resolveEUMarketProfile } from "@/lib/labeling/eu-market";

// Helper to safely extract product name string
export function getProductNameString(productName: any, language: string): string {
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
  const market = resolveEUMarketProfile(labelData.market?.destinationCountry);
  const requiredLocales = labelData.market?.requiredLocales?.length
    ? labelData.market.requiredLocales
    : market.requiredLocales;
  const renderLocales = labelData.market?.renderLocales?.length
    ? labelData.market.renderLocales
    : getRenderLocales(requiredLocales);
  const primaryLocale = renderLocales[0] || "en";
  const secondaryLocale = renderLocales[1];

  let html = `
    <div style="width: ${widthPx}px; min-height: ${heightPx}px; font-size: ${fontSize}pt; padding: 16px; font-family: Arial, sans-serif; background: white; border: 2px solid #1f2937;">
      <!-- Product Name -->
      <div style="margin-bottom: 12px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 4px;">
          ${escapeHtml(getProductNameString(labelData.productName, primaryLocale))}
        </div>
        ${secondaryLocale ? `<div style="font-size: 18px; color: #4b5563;">
          ${escapeHtml(getProductNameString(labelData.productName, secondaryLocale))}
        </div>` : ""}
      </div>
      <div style="border-top: 1px solid #d1d5db; margin: 12px 0;"></div>
  `;

  // Ingredients
  if ((productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients && labelData.ingredients.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-weight: bold; margin-bottom: 8px;">${escapeHtml(getLabelText(renderLocales, "ingredients"))}:</div>
        <div style="font-size: ${fontSize - 1}pt;">
    `;
    labelData.ingredients.forEach((ing) => {
      const ingNamePrimary = (ing.translations && typeof ing.translations === "object" && typeof ing.translations[primaryLocale] === "string")
        ? ing.translations[primaryLocale]
        : (typeof ing.name === "string" ? ing.name : "Ingredient");
      const ingNameSecondary = (secondaryLocale && ing.translations && typeof ing.translations === "object" && typeof ing.translations[secondaryLocale] === "string")
        ? ing.translations[secondaryLocale]
        : null;
      
      html += `
        <div style="margin-bottom: 4px;">
          <span style="${ing.isAllergen ? "font-weight: bold; color: #b91c1c;" : ""}">
            ${escapeHtml(ingNamePrimary)}
            ${ing.percentage ? ` (${escapeHtml(ing.percentage)}%)` : ""}
          </span>
          ${ingNameSecondary && ingNameSecondary !== ingNamePrimary ? `
            <div style="font-size: ${fontSize - 2}pt; color: #6b7280; margin-left: 8px;">
              ${escapeHtml(ingNameSecondary)}
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
        <div style="font-weight: bold; margin-bottom: 8px;">${escapeHtml(getLabelText(renderLocales, "nutrition"))}</div>
        <div style="font-size: ${fontSize - 2}pt; margin-bottom: 4px;">100g</div>
        <table style="width: 100%; font-size: ${fontSize - 1}pt; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">
                <div>${escapeHtml(getLabelText(renderLocales, "energy"))}</div>
                <div style="font-size: ${fontSize - 2}pt; color: #6b7280;">kJ / kcal</div>
              </td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">
                ${Math.round(energyKcal * 4.184)} kJ / ${energyKcal} kcal
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">${escapeHtml(getLabelText(renderLocales, "fat"))}</td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">${fat} g</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">${escapeHtml(getLabelText(renderLocales, "carbs"))}</td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">${carbs} g</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">${escapeHtml(getLabelText(renderLocales, "protein"))}</td>
              <td style="text-align: right; font-weight: bold; padding: 4px 0;">${protein} g</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 4px 0;">${escapeHtml(getLabelText(renderLocales, "salt"))}</td>
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
          <span style="font-weight: 500;">${escapeHtml(getLabelText(renderLocales, "bestBefore"))}:</span> ${escapeHtml(labelData.bestBeforeDate)}
        </div>
    `;
  }
  if (labelData.batchNumber) {
    html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 500;">${escapeHtml(getLabelText(renderLocales, "batch"))}:</span> ${escapeHtml(labelData.batchNumber)}
        </div>
    `;
  }
  if (labelData.netQuantity) {
    html += `
        <div style="margin-bottom: 4px;">
          <span style="font-weight: 500;">${escapeHtml(getLabelText(renderLocales, "netQuantity"))}:</span> ${escapeHtml(labelData.netQuantity)}
        </div>
    `;
  }
  
  html += `</div>`;

  // Origin Country
  if (labelData.originCountry) {
    html += `
      <div style="font-size: ${fontSize - 1}pt; margin-bottom: 12px;">
        <span style="font-weight: 500;">${escapeHtml(getLabelText(renderLocales, "originCountry"))}:</span> ${escapeHtml(labelData.originCountry)}
      </div>
    `;
  }

  // Importer Address
  html += `
      <div style="font-size: ${fontSize - 1}pt; margin-bottom: 12px;">
        <div style="font-weight: 500; margin-bottom: 4px;">${escapeHtml(getLabelText(renderLocales, "importer"))}:</div>
        <div>${escapeHtml(labelData.importerAddress || "")}</div>
      </div>
  `;

  // Storage Instructions
  if (labelData.storageInstructions) {
    html += `
      <div style="font-size: ${fontSize - 1}pt;">
        <span style="font-weight: 500;">${escapeHtml(getLabelText(renderLocales, "storage"))}:</span> ${escapeHtml(labelData.storageInstructions)}
      </div>
    `;
  }

  html += `</div>`;
  return html;
}
