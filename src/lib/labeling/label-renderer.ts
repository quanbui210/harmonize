/**
 * Label renderer for PDF/SVG export
 * Generates ready-to-print labels matching HTML preview structure exactly
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { EnhancedLabelData } from "./label-generator-enhanced";

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

  // 1. Product Name (bilingual)
  const productNameFI = labelData.productName.translations.fi || labelData.productName.original;
  page.drawText(productNameFI, {
    x: marginPoints,
    y: yPosition,
    size: titleSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });
  yPosition -= lineHeight + 2;

  const productNameSV = labelData.productName.translations.sv || labelData.productName.original;
  if (productNameSV !== productNameFI) {
    page.drawText(productNameSV, {
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
    page.drawText("Ainesosat / Ingredienser:", {
      x: marginPoints,
      y: yPosition,
      size: bodySize + 1,
      font: helveticaBold,
    });
    yPosition -= lineHeight + 4;

    for (const ing of labelData.ingredients) {
      const fiName = ing.translations.fi || ing.name;
      const svName = ing.translations.sv || ing.name;
      let fiText = fiName;
      if (ing.percentage) {
        fiText += ` (${ing.percentage}%)`;
      }

      // Finnish name (bold if allergen, red if allergen)
      page.drawText(fiText, {
        x: marginPoints,
        y: yPosition,
        size: bodySize - 1,
        font: ing.isAllergen ? helveticaBold : helvetica,
        color: ing.isAllergen ? rgb(0.7, 0, 0) : rgb(0, 0, 0),
        maxWidth: contentWidth,
      });
      yPosition -= lineHeight - 2;

      // Swedish name below (smaller, gray)
      if (svName !== fiName) {
        page.drawText(svName, {
          x: marginPoints + 8,
          y: yPosition,
          size: smallSize,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
          maxWidth: contentWidth - 8,
        });
        yPosition -= lineHeight - 4;
      } else {
        yPosition -= 2;
      }
    }
    yPosition -= sectionSpacing;
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
    page.drawText("Ravintoarvot / Näringsvärde", {
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
    const rows = [
      {
        labelFI: "Energia",
        labelSV: "Energi",
        sublabel: "kJ / kcal",
        value: `${Math.round((nutrition.energy || 0) * 4.184)} kJ / ${nutrition.energy || 0} kcal`,
      },
      { labelFI: "Rasva", labelSV: "Fett", value: `${nutrition.fat || 0} g` },
      { labelFI: "Hiilihydraatit", labelSV: "Kolhydrat", value: `${nutrition.carbs || 0} g` },
      { labelFI: "Proteiini", labelSV: "Protein", value: `${nutrition.protein || 0} g` },
      { labelFI: "Suola", labelSV: "Salt", value: `${nutrition.salt || 0} g` },
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

      // Label (left side) - Finnish
      page.drawText(row.labelFI, {
        x: tableX + 4,
        y: rowY - 4,
        size: bodySize,
        font: helvetica,
      });

      // Label (left side) - Swedish (smaller, below)
      page.drawText(row.labelSV, {
        x: tableX + 4,
        y: rowY - 12,
        size: smallSize,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

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
      page.drawText("Parasta ennen / Bäst före:", {
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
      page.drawText("Erä / Parti:", {
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
      page.drawText("Nettomäärä / Nettovikt:", {
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
    page.drawText("Alkuperämaa / Ursprungsland:", {
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
    page.drawText("Maahantuoja / Importör:", {
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
    page.drawText("Säilytys / Förvaring:", {
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

  // 1. Product Name (bilingual)
  const productNameFI = escapeXml(labelData.productName.translations.fi || labelData.productName.original);
  svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeTitle}" font-weight="bold" fill="#000">${productNameFI}</text>`;
  yPos += lineHeight + 4;

  const productNameSV = escapeXml(labelData.productName.translations.sv || labelData.productName.original);
  if (productNameSV !== productNameFI) {
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeLarge}" fill="#666">${productNameSV}</text>`;
    yPos += lineHeight;
  }
  yPos += sectionSpacing;

  // 2. Divider line
  svg += `<line x1="${marginPx}" y1="${yPos}" x2="${widthPx - marginPx}" y2="${yPos}" stroke="#ccc" stroke-width="1"/>`;
  yPos += sectionSpacing + 4;

  // 3. Ingredients (for food categories)
  if ((productCategory === "food" || productCategory === "meat" || productCategory === "supplements" || productCategory === "pet") && labelData.ingredients.length > 0) {
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">Ainesosat / Ingredienser:</text>`;
    yPos += lineHeight + 6;

    for (const ing of labelData.ingredients) {
      const fiName = escapeXml(ing.translations.fi || ing.name);
      const svName = escapeXml(ing.translations.sv || ing.name);
      const percentage = ing.percentage ? ` (${ing.percentage}%)` : "";
      const fillColor = ing.isAllergen ? "#b91c1c" : "#000";
      const fontWeight = ing.isAllergen ? "bold" : "normal";

      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" font-weight="${fontWeight}" fill="${fillColor}">${fiName}${percentage}</text>`;
      yPos += lineHeight - 2;

      if (svName !== fiName) {
        svg += `<text x="${marginPx + 8}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall * 0.85}" fill="#666">${svName}</text>`;
        yPos += lineHeight - 4;
      } else {
        yPos += 2;
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
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">Ravintoarvot / Näringsvärde</text>`;
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
    const rows = [
      {
        labelFI: "Energia",
        labelSV: "Energi",
        sublabel: "kJ / kcal",
        value: `${Math.round((nutrition.energy || 0) * 4.184)} kJ / ${nutrition.energy || 0} kcal`,
      },
      { labelFI: "Rasva", labelSV: "Fett", value: `${nutrition.fat || 0} g` },
      { labelFI: "Hiilihydraatit", labelSV: "Kolhydrat", value: `${nutrition.carbs || 0} g` },
      { labelFI: "Proteiini", labelSV: "Protein", value: `${nutrition.protein || 0} g` },
      { labelFI: "Suola", labelSV: "Salt", value: `${nutrition.salt || 0} g` },
    ];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowY = tableStartY - i * rowHeight;

      // Row separator (except first)
      if (i > 0) {
        svg += `<line x1="${tableX}" y1="${rowY}" x2="${tableX + tableWidth}" y2="${rowY}" stroke="#ccc" stroke-width="1"/>`;
      }

      // Label (left) - Finnish
      svg += `<text x="${tableX + 4}" y="${rowY - 6}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000">${escapeXml(row.labelFI)}</text>`;

      // Label (left) - Swedish (smaller, below)
      svg += `<text x="${tableX + 4}" y="${rowY - 14}" font-family="Arial, sans-serif" font-size="${fontSizeSmall * 0.85}" fill="#666">${escapeXml(row.labelSV)}</text>`;

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
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">Parasta ennen / Bäst före:</tspan> ${escapeXml(labelData.bestBeforeDate)}</text>`;
      yPos += lineHeight + 4;
    }
    if (labelData.batchNumber && yPos < heightPx - marginPx) {
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">Erä / Parti:</tspan> ${escapeXml(labelData.batchNumber)}</text>`;
      yPos += lineHeight + 4;
    }
    if (labelData.netQuantity && yPos < heightPx - marginPx) {
      svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">Nettomäärä / Nettovikt:</tspan> ${escapeXml(labelData.netQuantity)}</text>`;
      yPos += lineHeight + 4;
    }
  }

  // 7. Origin Country
  if (labelData.originCountry && yPos < heightPx - marginPx) {
    yPos += sectionSpacing;
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">Alkuperämaa / Ursprungsland:</tspan> ${escapeXml(labelData.originCountry)}</text>`;
    yPos += lineHeight + 4;
  }

  // 8. Importer Address
  if (yPos < heightPx - marginPx) {
    yPos += sectionSpacing;
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">Maahantuoja / Importör:</text>`;
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
    svg += `<text x="${marginPx}" y="${yPos}" font-family="Arial, sans-serif" font-size="${fontSizeSmall}" fill="#000"><tspan font-weight="bold">Säilytys / Förvaring:</tspan> ${escapeXml(labelData.storageInstructions)}</text>`;
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
