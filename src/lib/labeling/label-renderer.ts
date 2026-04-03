/**
 * Label renderer for PDF/SVG export
 * Generates ready-to-print labels matching HTML preview structure exactly
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { EnhancedLabelData } from "./label-generator-enhanced";
import { getLabelText, getRenderLocales, resolveEUMarketProfile } from "./eu-market";

export interface LabelSize {
  name: string;
  width: number; // mm
  height: number; // mm
}

export const LABEL_SIZES: LabelSize[] = [
  { name: "Small (50×75mm)", width: 50, height: 75 },
  { name: "Medium (75×100mm)", width: 75, height: 100 },
  { name: "Standard (100×150mm)", width: 100, height: 150 },
  { name: "Large (150×200mm)", width: 150, height: 200 },
  { name: "Custom", width: 100, height: 150 },
];

/**
 * Convert mm to points (1mm = 2.83465 points at 72 DPI)
 */
function mmToPoints(mm: number): number {
  return mm * 2.83465;
}

function drawTextPiecesWrapped(args: {
  page: any;
  pieces: Array<{
    text: string;
    font: any;
    size: number;
    color: any;
  }>;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
}) {
  const { page, pieces, x, y, maxWidth, lineHeight } = args;
  let cx = x;
  let cy = y;

  for (const piece of pieces) {
    const tokens = piece.text.split(/(\s+)/g).filter((t) => t.length > 0);
    for (const token of tokens) {
      const tokenWidth = piece.font.widthOfTextAtSize(token, piece.size);
      const wouldOverflow = cx + tokenWidth > x + maxWidth;

      if (wouldOverflow && token.trim().length > 0 && cx > x) {
        cy -= lineHeight;
        cx = x;
      }

      page.drawText(token, {
        x: cx,
        y: cy,
        size: piece.size,
        font: piece.font,
        color: piece.color,
      });
      cx += tokenWidth;
    }
  }

  return { x: cx, y: cy };
}

function buildIngredientPieces(args: {
  ingredients: EnhancedLabelData["ingredients"];
  language: string;
  helvetica: any;
  helveticaBold: any;
  fontSize: number;
  normalColor: any;
}) {
  const { ingredients, language, helvetica, helveticaBold, fontSize, normalColor } = args;
  const pieces: Array<{ text: string; font: any; size: number; color: any }> = [];

  ingredients.forEach((ing, idx) => {
    const name = ing.translations[language] || ing.name;
    const percentage = ing.percentage != null ? ` (${ing.percentage}%)` : "";
    const text = `${name}${percentage}`;
    pieces.push({
      text,
      font: ing.isAllergen ? helveticaBold : helvetica,
      size: fontSize,
      color: ing.isAllergen ? rgb(0.7, 0, 0) : normalColor,
    });
    if (idx < ingredients.length - 1) {
      pieces.push({
        text: ", ",
        font: helvetica,
        size: fontSize,
        color: normalColor,
      });
    }
  });

  return pieces;
}

function resolveRenderLocales(labelData: EnhancedLabelData): string[] {
  const market = resolveEUMarketProfile(labelData.market?.destinationCountry);
  const requiredLocales = labelData.market?.requiredLocales?.length
    ? labelData.market.requiredLocales
    : market.requiredLocales;
  return labelData.market?.renderLocales?.length
    ? labelData.market.renderLocales
    : getRenderLocales(requiredLocales);
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
  if (!match) {
    return 0;
  }

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
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const kjMatch = normalized.match(/(\d+(?:\.\d+)?)\s*kj/i);
  if (kjMatch) {
    const parsed = Number(kjMatch[1]);
    if (Number.isFinite(parsed)) {
      return Number((parsed / 4.184).toFixed(1));
    }
  }

  return parseNutritionNumber(normalized);
}

/**
 * Generate PDF label - matches HTML preview structure exactly
 */
export async function generateLabelPDF(
  labelData: EnhancedLabelData,
  productCategory: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const minHeight = Math.max(labelData.labelDimensions.height, 200);
  const page = pdfDoc.addPage([mmToPoints(labelData.labelDimensions.width), mmToPoints(minHeight)]);

  const { width, height } = page.getSize();
  const margin = 5;
  const marginPoints = mmToPoints(margin);
  const contentWidth = width - marginPoints * 2;
  const minY = marginPoints;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let yPosition = height - marginPoints;
  const lineHeight = 16;
  const sectionSpacing = 12;
  const bodySize = 10;
  const smallSize = 8;
  const titleSize = 14;
  const subtitleSize = 12;
  const renderLocales = resolveRenderLocales(labelData);
  const primaryLocale = renderLocales[0] || "en";
  const secondaryLocale = renderLocales[1];

  const productNamePrimary = labelData.productName.translations[primaryLocale] || labelData.productName.original;
  page.drawText(productNamePrimary, {
    x: marginPoints,
    y: yPosition,
    size: titleSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= lineHeight + 2;

  const productNameSecondary = secondaryLocale
    ? (labelData.productName.translations[secondaryLocale] || labelData.productName.original)
    : null;
  if (productNameSecondary && productNameSecondary !== productNamePrimary) {
    page.drawText(productNameSecondary, {
      x: marginPoints,
      y: yPosition,
      size: subtitleSize,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= lineHeight;
  }
  yPosition -= sectionSpacing;

  // 2. Divider line
  page.drawLine({
    start: { x: marginPoints, y: yPosition },
    end: { x: width - marginPoints, y: yPosition },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  yPosition -= sectionSpacing;

  // 3. Ingredients (for food categories)
  if ((productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients.length > 0) {
    page.drawText(`${getLabelText([primaryLocale], "ingredients")}:`, {
      x: marginPoints,
      y: yPosition,
      size: bodySize + 1,
      font: helveticaBold,
    });
    yPosition -= lineHeight + 4;

    const fiPieces = buildIngredientPieces({
      ingredients: labelData.ingredients,
      language: primaryLocale,
      helvetica,
      helveticaBold,
      fontSize: bodySize - 1,
      normalColor: rgb(0, 0, 0),
    });
    const fiDrawn = drawTextPiecesWrapped({
      page,
      pieces: fiPieces,
      x: marginPoints,
      y: yPosition,
      maxWidth: contentWidth,
      lineHeight: lineHeight - 2,
    });
    yPosition = fiDrawn.y - (lineHeight - 2) + 6;

    if (secondaryLocale) {
      page.drawText(`${getLabelText([secondaryLocale], "ingredients")}:`, {
        x: marginPoints,
        y: yPosition,
        size: bodySize + 1,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      yPosition -= lineHeight + 2;

      const svPieces = buildIngredientPieces({
        ingredients: labelData.ingredients,
        language: secondaryLocale,
        helvetica,
        helveticaBold,
        fontSize: smallSize,
        normalColor: rgb(0.35, 0.35, 0.35),
      });
      const svDrawn = drawTextPiecesWrapped({
        page,
        pieces: svPieces,
        x: marginPoints,
        y: yPosition,
        maxWidth: contentWidth,
        lineHeight: lineHeight - 4,
      });
      yPosition = svDrawn.y - (lineHeight - 4) + sectionSpacing;
    } else {
      yPosition -= sectionSpacing;
    }
  }

  // 4. Warnings (black-bordered boxes) - BEFORE nutrition table
  if (labelData.warnings.length > 0 && yPosition > minY) {
    for (const warning of labelData.warnings) {
      if (yPosition < minY + 30) break; // Not enough space

      const warningHeight = 28;
      const warningY = yPosition - warningHeight;

      // Draw black border box
      page.drawRectangle({
        x: marginPoints,
        y: warningY,
        width: contentWidth,
        height: warningHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
      });

      // Draw warning text (uppercase, bold)
      const warningText = warning.toUpperCase();
      page.drawText(warningText, {
        x: marginPoints + 4,
        y: warningY + 8,
        size: bodySize - 1,
        font: helveticaBold,
        color: rgb(0, 0, 0),
        maxWidth: contentWidth - 8,
      });

      yPosition = warningY - sectionSpacing;
    }
  }

  // 5. Nutrition Table (for food categories)
  if ((productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.nutritionInfo && yPosition > minY) {
    page.drawText(getLabelText(renderLocales, "nutrition"), {
      x: marginPoints,
      y: yPosition,
      size: bodySize + 1,
      font: helveticaBold,
    });
    yPosition -= lineHeight - 2;

    page.drawText("100g", {
      x: marginPoints,
      y: yPosition,
      size: smallSize,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= lineHeight + 4;

    const tableX = marginPoints;
    const tableWidth = contentWidth;
    const rowHeight = 20;
    const tableStartY = yPosition;

    // Draw table border
    page.drawRectangle({
      x: tableX,
      y: tableStartY - (rowHeight * 5),
      width: tableWidth,
      height: rowHeight * 5,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    const nutrition = labelData.nutritionInfo;
    const energyKcal = parseEnergyKcal(nutrition.energy);
    const fat = parseNutritionNumber(nutrition.fat);
    const carbs = parseNutritionNumber(nutrition.carbs);
    const protein = parseNutritionNumber(nutrition.protein);
    const salt = parseNutritionNumber(nutrition.salt);
    const rows = [
      {
        labelPrimary: getLabelText([primaryLocale], "energy"),
        labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "energy") : "",
        sublabel: "kJ / kcal",
        value: `${Math.round(energyKcal * 4.184)} kJ / ${energyKcal} kcal`,
      },
      { labelPrimary: getLabelText([primaryLocale], "fat"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "fat") : "", value: `${fat} g` },
      { labelPrimary: getLabelText([primaryLocale], "carbs"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "carbs") : "", value: `${carbs} g` },
      { labelPrimary: getLabelText([primaryLocale], "protein"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "protein") : "", value: `${protein} g` },
      { labelPrimary: getLabelText([primaryLocale], "salt"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "salt") : "", value: `${salt} g` },
    ];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowY = tableStartY - (i * rowHeight);

      // Row separator (except first)
      if (i > 0) {
        page.drawLine({
          start: { x: tableX, y: rowY },
          end: { x: tableX + tableWidth, y: rowY },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
      }

      page.drawText(row.labelPrimary, {
        x: tableX + 4,
        y: rowY - 4,
        size: bodySize,
        font: helvetica,
      });

      if (row.labelSecondary) {
        page.drawText(row.labelSecondary, {
          x: tableX + 4,
          y: rowY - 12,
          size: smallSize,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      // Sublabel for energy row
      if (row.sublabel) {
        page.drawText(row.sublabel, {
          x: tableX + 4,
          y: rowY - 16,
          size: smallSize * 0.9,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      // Value (right side, right-aligned, bold)
      const valueWidth = helveticaBold.widthOfTextAtSize(row.value, bodySize);
      page.drawText(row.value, {
        x: tableX + tableWidth - valueWidth - 4,
        y: rowY - 4,
        size: bodySize,
        font: helveticaBold,
      });
    }

    yPosition = tableStartY - (rowHeight * 5) - sectionSpacing;
  }

  // 6. Best Before / Batch / Net Quantity
  if (yPosition > minY) {
    yPosition -= sectionSpacing;
    if (labelData.bestBeforeDate && yPosition > minY) {
      page.drawText(`${getLabelText(renderLocales, "bestBefore")}:`, {
        x: marginPoints,
        y: yPosition,
        size: bodySize,
        font: helvetica,
      });
      const dateWidth = helveticaBold.widthOfTextAtSize(labelData.bestBeforeDate, bodySize);
      page.drawText(labelData.bestBeforeDate, {
        x: width - marginPoints - dateWidth,
        y: yPosition,
        size: bodySize,
        font: helveticaBold,
      });
      yPosition -= lineHeight + 4;
    }
    if (labelData.batchNumber && yPosition > minY) {
      page.drawText(`${getLabelText(renderLocales, "batch")}:`, {
        x: marginPoints,
        y: yPosition,
        size: bodySize,
        font: helvetica,
      });
      const batchWidth = helveticaBold.widthOfTextAtSize(labelData.batchNumber, bodySize);
      page.drawText(labelData.batchNumber, {
        x: width - marginPoints - batchWidth,
        y: yPosition,
        size: bodySize,
        font: helveticaBold,
      });
      yPosition -= lineHeight + 4;
    }
    if (labelData.netQuantity && yPosition > minY) {
      page.drawText(`${getLabelText(renderLocales, "netQuantity")}:`, {
        x: marginPoints,
        y: yPosition,
        size: bodySize,
        font: helvetica,
      });
      const qtyWidth = helveticaBold.widthOfTextAtSize(labelData.netQuantity, bodySize);
      page.drawText(labelData.netQuantity, {
        x: width - marginPoints - qtyWidth,
        y: yPosition,
        size: bodySize,
        font: helveticaBold,
      });
      yPosition -= lineHeight + 4;
    }
  }

  // 7. Origin Country
  if (labelData.originCountry && yPosition > minY) {
    yPosition -= sectionSpacing;
    page.drawText(`${getLabelText(renderLocales, "originCountry")}:`, {
      x: marginPoints,
      y: yPosition,
      size: bodySize,
      font: helvetica,
    });
    const originWidth = helveticaBold.widthOfTextAtSize(labelData.originCountry, bodySize);
    page.drawText(labelData.originCountry, {
      x: width - marginPoints - originWidth,
      y: yPosition,
      size: bodySize,
      font: helveticaBold,
    });
    yPosition -= lineHeight + 4;
  }

  // 8. Importer Address
  if (yPosition > minY) {
    yPosition -= sectionSpacing;
    page.drawText(`${getLabelText(renderLocales, "importer")}:`, {
      x: marginPoints,
      y: yPosition,
      size: bodySize + 1,
      font: helveticaBold,
    });
    yPosition -= lineHeight + 2;

    if (labelData.importerAddress && yPosition > minY) {
      const addressLines = labelData.importerAddress.split(/,|\n/).filter((l) => l.trim());
      for (const line of addressLines) {
        if (yPosition <= minY) break;
        page.drawText(line.trim(), {
          x: marginPoints,
          y: yPosition,
          size: bodySize - 1,
          font: helvetica,
          maxWidth: contentWidth,
        });
        yPosition -= lineHeight;
      }
    }
  }

  // 9. Storage Instructions
  if (labelData.storageInstructions && yPosition > minY) {
    yPosition -= sectionSpacing;
    page.drawText(`${getLabelText(renderLocales, "storage")}:`, {
      x: marginPoints,
      y: yPosition,
      size: bodySize,
      font: helveticaBold,
    });
    yPosition -= lineHeight;
    if (yPosition > minY) {
      page.drawText(labelData.storageInstructions, {
        x: marginPoints,
        y: yPosition,
        size: bodySize - 1,
        font: helvetica,
        maxWidth: contentWidth,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Generate SVG label - matches HTML preview structure exactly
 */
export function generateLabelSVG(
  labelData: EnhancedLabelData,
  productCategory: string
): string {
  const width = labelData.labelDimensions.width;
  const height = labelData.labelDimensions.height;
  const margin = 5;

  // Convert mm to pixels (1mm = 3.7795px at 96 DPI)
  const widthPx = width * 3.7795;
  const heightPx = height * 3.7795;
  const marginPx = margin * 3.7795;
  const contentWidthPx = widthPx - marginPx * 2;

  let svg = `<svg width="${width}mm" height="${height}mm" viewBox="0 0 ${widthPx} ${heightPx}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs><clipPath id="labelClip"><rect x="0" y="0" width="${widthPx}" height="${heightPx}"/></clipPath></defs>`;
  svg += `<rect width="${widthPx}" height="${heightPx}" fill="white" stroke="#000" stroke-width="2"/>`;
  svg += `<g clip-path="url(#labelClip)">`;

  let yPos = marginPx + 20;
  const lineHeight = 18;
  const sectionSpacing = 12;
  const fontSize = 12;
  const fontSizeSmall = 10;
  const fontSizeLarge = 18;
  const fontSizeTitle = 24;
  const renderLocales = resolveRenderLocales(labelData);
  const primaryLocale = renderLocales[0] || "en";
  const secondaryLocale = renderLocales[1];

  const productNamePrimary = escapeXml(labelData.productName.translations[primaryLocale] || labelData.productName.original);
  svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeTitle}" font-weight="bold" fill="#000">${productNamePrimary}</text>`;
  yPos += lineHeight + 4;

  const secondaryName = secondaryLocale
    ? escapeXml(labelData.productName.translations[secondaryLocale] || labelData.productName.original)
    : "";
  if (secondaryLocale && secondaryName !== productNamePrimary) {
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeLarge}" fill="#666">${secondaryName}</text>`;
    yPos += lineHeight;
  }
  yPos += sectionSpacing;

  // 2. Divider line
  svg += `<line x1="${marginPx}" y1="${yPos}" x2="${widthPx - marginPx}" y2="${yPos}" stroke="#ccc" stroke-width="1"/>`;
  yPos += sectionSpacing + 4;

  // 3. Ingredients (for food categories)
  if ((productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients.length > 0) {
    const approxWidth = (text: string, size: number) => text.length * size * 0.56;

    const wrapPieces = (
      pieces: Array<{ text: string; fill: string; weight: string }>,
      size: number,
    ) => {
      const lines: Array<Array<{ text: string; fill: string; weight: string }>> = [];
      let current: Array<{ text: string; fill: string; weight: string }> = [];
      let currentWidth = 0;

      for (const piece of pieces) {
        const tokens = piece.text.split(/(\s+)/g).filter((t) => t.length > 0);
        for (const token of tokens) {
          const tokenWidth = approxWidth(token, size);
          const wouldOverflow = currentWidth + tokenWidth > contentWidthPx;

          if (wouldOverflow && token.trim().length > 0 && current.length > 0) {
            lines.push(current);
            current = [];
            currentWidth = 0;
          }

          current.push({ text: token, fill: piece.fill, weight: piece.weight });
          currentWidth += tokenWidth;
        }
      }

      if (current.length > 0) lines.push(current);
      return lines;
    };

    const buildSvgPieces = (language: string) => {
      const pieces: Array<{ text: string; fill: string; weight: string }> = [];
      labelData.ingredients.forEach((ing, idx) => {
        const name = escapeXml(ing.translations[language] || ing.name);
        const percentage = ing.percentage != null ? ` (${ing.percentage}%)` : "";
        pieces.push({
          text: `${name}${percentage}`,
          fill: ing.isAllergen ? "#b91c1c" : language === secondaryLocale ? "#444" : "#000",
          weight: ing.isAllergen ? "bold" : "normal",
        });
        if (idx < labelData.ingredients.length - 1) {
          pieces.push({ text: ", ", fill: language === secondaryLocale ? "#444" : "#000", weight: "normal" });
        }
      });
      return pieces;
    };

    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">${escapeXml(getLabelText([primaryLocale], "ingredients"))}:</text>`;
    yPos += lineHeight + 2;

    const fiLines = wrapPieces(buildSvgPieces(primaryLocale), fontSizeSmall);
    for (const line of fiLines) {
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000">`;
      for (const t of line) {
        svg += `<tspan font-weight="${t.weight}" fill="${t.fill}">${t.text}</tspan>`;
      }
      svg += `</text>`;
      yPos += lineHeight - 4;
    }

    if (secondaryLocale) {
      yPos += 6;
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">${escapeXml(getLabelText([secondaryLocale], "ingredients"))}:</text>`;
      yPos += lineHeight + 2;

      const svLines = wrapPieces(buildSvgPieces(secondaryLocale), fontSizeSmall * 0.9);
      for (const line of svLines) {
        svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall * 0.9}" fill="#444">`;
        for (const t of line) {
          svg += `<tspan font-weight="${t.weight}" fill="${t.fill}">${t.text}</tspan>`;
        }
        svg += `</text>`;
        yPos += lineHeight - 5;
      }
    }

    yPos += sectionSpacing;
  }

  // 4. Warnings (black-bordered boxes) - BEFORE nutrition table
  if (labelData.warnings.length > 0 && yPos < heightPx - marginPx - 30) {
    for (const warning of labelData.warnings) {
      if (yPos + 30 > heightPx - marginPx) break;

      const warningHeight = 28;
      const warningY = yPos;

      // Black border box
      svg += `<rect x="${marginPx}" y="${warningY}" width="${widthPx - marginPx * 2}" height="${warningHeight}" fill="none" stroke="#000" stroke-width="2"/>`;

      // Warning text (uppercase, bold)
      const warningText = escapeXml(warning.toUpperCase());
      svg += `<text x="${marginPx + 4}" y="${warningY + 18}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" font-weight="bold" fill="#000">${warningText}</text>`;

      yPos += warningHeight + sectionSpacing;
    }
  }

  // 5. Nutrition Table (for food categories)
  if ((productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.nutritionInfo && yPos < heightPx - marginPx - 100) {
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">${escapeXml(getLabelText(renderLocales, "nutrition"))}</text>`;
    yPos += lineHeight - 2;

    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall * 0.9}" fill="#666">100g</text>`;
    yPos += lineHeight + 4;

    const tableX = marginPx;
    const tableWidth = widthPx - marginPx * 2;
    const rowHeight = 22;
    const tableStartY = yPos;

    // Table border
    svg += `<rect x="${tableX}" y="${tableStartY - rowHeight * 5}" width="${tableWidth}" height="${rowHeight * 5}" fill="none" stroke="#ccc" stroke-width="1"/>`;

    const nutrition = labelData.nutritionInfo;
    const energyKcal = parseEnergyKcal(nutrition.energy);
    const fat = parseNutritionNumber(nutrition.fat);
    const carbs = parseNutritionNumber(nutrition.carbs);
    const protein = parseNutritionNumber(nutrition.protein);
    const salt = parseNutritionNumber(nutrition.salt);
    const rows = [
      {
        labelPrimary: getLabelText([primaryLocale], "energy"),
        labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "energy") : "",
        sublabel: "kJ / kcal",
        value: `${Math.round(energyKcal * 4.184)} kJ / ${energyKcal} kcal`,
      },
      { labelPrimary: getLabelText([primaryLocale], "fat"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "fat") : "", value: `${fat} g` },
      { labelPrimary: getLabelText([primaryLocale], "carbs"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "carbs") : "", value: `${carbs} g` },
      { labelPrimary: getLabelText([primaryLocale], "protein"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "protein") : "", value: `${protein} g` },
      { labelPrimary: getLabelText([primaryLocale], "salt"), labelSecondary: secondaryLocale ? getLabelText([secondaryLocale], "salt") : "", value: `${salt} g` },
    ];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowY = tableStartY - i * rowHeight;

      // Row separator (except first)
      if (i > 0) {
        svg += `<line x1="${tableX}" y1="${rowY}" x2="${tableX + tableWidth}" y2="${rowY}" stroke="#ccc" stroke-width="1"/>`;
      }

      // Label (left) - Finnish
      svg += `<text x="${tableX + 4}" y="${rowY - 6}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000">${escapeXml(row.labelPrimary)}</text>`;

      if (row.labelSecondary) {
        svg += `<text x="${tableX + 4}" y="${rowY - 14}" font-family="Arial, sans-serif" font-size="${fontSizeSmall * 0.85}" fill="#666">${escapeXml(row.labelSecondary)}</text>`;
      }

      // Sublabel for energy row
      if (row.sublabel) {
        svg += `<text x="${tableX + 4}" y="${rowY - 18}" font-family="Arial, sans-serif" font-size="${fontSizeSmall * 0.75}" fill="#666">${escapeXml(row.sublabel)}</text>`;
      }

      // Value (right, right-aligned, bold)
      svg += `<text x="${tableX + tableWidth - 4}" y="${rowY - 6}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" font-weight="bold" fill="#000" text-anchor="end">${escapeXml(row.value)}</text>`;
    }

    yPos = tableStartY - rowHeight * 5 - sectionSpacing;
  }

  // 6. Best Before / Batch / Net Quantity
  if (yPos < heightPx - marginPx) {
    yPos += sectionSpacing;
    if (labelData.bestBeforeDate && yPos < heightPx - marginPx) {
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">${escapeXml(getLabelText(renderLocales, "bestBefore"))}:</tspan> ${escapeXml(labelData.bestBeforeDate)}</text>`;
      yPos += lineHeight + 4;
    }
    if (labelData.batchNumber && yPos < heightPx - marginPx) {
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">${escapeXml(getLabelText(renderLocales, "batch"))}:</tspan> ${escapeXml(labelData.batchNumber)}</text>`;
      yPos += lineHeight + 4;
    }
    if (labelData.netQuantity && yPos < heightPx - marginPx) {
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">${escapeXml(getLabelText(renderLocales, "netQuantity"))}:</tspan> ${escapeXml(labelData.netQuantity)}</text>`;
      yPos += lineHeight + 4;
    }
  }

  // 7. Origin Country
  if (labelData.originCountry && yPos < heightPx - marginPx) {
    yPos += sectionSpacing;
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">${escapeXml(getLabelText(renderLocales, "originCountry"))}:</tspan> ${escapeXml(labelData.originCountry)}</text>`;
    yPos += lineHeight + 4;
  }

  // 8. Importer Address
  if (yPos < heightPx - marginPx) {
    yPos += sectionSpacing;
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">${escapeXml(getLabelText(renderLocales, "importer"))}:</text>`;
    yPos += lineHeight + 2;

    if (labelData.importerAddress && yPos < heightPx - marginPx) {
      const addressLines = escapeXml(labelData.importerAddress).split(/,|\n/).filter((l) => l.trim());
      addressLines.forEach((line, idx) => {
        if (yPos + idx * lineHeight < heightPx - marginPx) {
          svg += `<text x="${marginPx}" y="${yPos + idx * lineHeight}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000">${line.trim()}</text>`;
        }
      });
      yPos += addressLines.length * lineHeight;
    }
  }

  // 9. Storage Instructions
  if (labelData.storageInstructions && yPos < heightPx - marginPx) {
    yPos += sectionSpacing;
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">${escapeXml(getLabelText(renderLocales, "storage"))}:</tspan> ${escapeXml(labelData.storageInstructions)}</text>`;
  }

  svg += `</g></svg>`;
  return svg;
}

/**
 * Escape XML special characters for SVG text content
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
