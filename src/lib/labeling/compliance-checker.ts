/**
 * Compliance checker for product labels
 * Validates against Ruokavirasto and EU regulations
 */

import type { RegulatoryProductType } from "@/lib/regulatory/product-type";

export interface LabelData {
  productName: {
    original: string;
    translations: {
      fi: string;
      sv: string;
    };
  };
  ingredients: Array<{
    name: string;
    percentage?: number; // QUID
    code?: string; // E-code
    functionalClass?: string;
    isAllergen: boolean;
    isHighlighted: boolean;
    translations: {
      fi: string;
      sv: string;
    };
  }>;
  nutritionInfo: {
    energy: number;
    fat: number;
    carbs: number;
    protein: number;
    salt: number; // percentage
  };
  warnings: string[];
  importerAddress: string;
  bestBeforeDate: string;
  labelDimensions: {
    width: number; // mm
    height: number; // mm
  };
  fontSize: number; // pt
}

export interface ComplianceResult {
  ruleId: string;
  ruleName: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  passed: boolean;
  message: string;
  source: string;
}

/**
 * Calculate x-height in mm from font size (pt) and label dimensions
 * Simplified calculation - assumes standard font metrics
 */
function calculateXHeight(fontSizePt: number, labelDimensions: { width: number; height: number }): number {
  // Approximate: x-height is typically ~0.5-0.6 of font size
  // Convert pt to mm: 1pt ≈ 0.352778mm
  const fontSizeMm = fontSizePt * 0.352778;
  const xHeight = fontSizeMm * 0.55; // Conservative estimate
  return xHeight;
}

/**
 * Check if address is EU-based
 */
function isEUAddress(address: string | undefined | null): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }
  
  const euCountries = [
    "finland", "sweden", "denmark", "germany", "france", "italy", "spain",
    "netherlands", "belgium", "austria", "poland", "portugal", "greece",
    "ireland", "czech", "romania", "hungary", "bulgaria", "croatia",
    "slovakia", "slovenia", "estonia", "latvia", "lithuania", "luxembourg",
    "malta", "cyprus"
  ];
  
  const lower = address.toLowerCase();
  return euCountries.some(country => lower.includes(country));
}

/**
 * Check if product name contains ingredient that requires QUID
 */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[%.,/#!$^&*;:{}=\-_`~()'"[\]\\|?<>+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getQUIDIngredientTargets(label: LabelData): Array<LabelData["ingredients"][number]> {
  const productNameText = [
    label.productName.original,
    label.productName.translations.fi,
    label.productName.translations.sv,
  ]
    .filter(Boolean)
    .join(" ");
  const normalizedProductName = ` ${normalizeForMatch(productNameText)} `;

  return label.ingredients.filter((ingredient) => {
    const candidates = [
      ingredient.name,
      ingredient.translations.fi,
      ingredient.translations.sv,
    ].filter(Boolean);

    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeForMatch(candidate);
      if (!normalizedCandidate || normalizedCandidate.length < 3) {
        return false;
      }
      return normalizedProductName.includes(` ${normalizedCandidate} `);
    });
  });
}

/**
 * Run all compliance checks
 */
export function runComplianceChecks(label: LabelData, productType: RegulatoryProductType): ComplianceResult[] {
  const results: ComplianceResult[] = [];

  // Only run food-specific checks for food products
  if (productType === "FOOD") {
    const quidTargets = getQUIDIngredientTargets(label);
    if (quidTargets.length > 0) {
      const missingQUID = quidTargets.filter((ing) => ing.percentage === undefined);
      const missingNames = missingQUID.map((ing) => ing.translations.fi || ing.name).join(", ");
      results.push({
        ruleId: "quid-required",
        ruleName: "QUID Percentage Required",
        severity: "CRITICAL",
        passed: missingQUID.length === 0,
        message: missingQUID.length === 0
          ? "QUID percentage present for ingredients emphasized in product name"
          : `Missing QUID for: ${missingNames}. Add percentage for emphasized ingredients`,
        source: "Regulation (EU) No 1169/2011, Article 22; Ruokavirasto Guide 17068/2, Section 5.3",
      });
    }

    // High salt warning (Finland-specific)
    if (label.nutritionInfo.salt > 1.2) {
      const hasWarning = label.warnings.some(w =>
        w.includes("Voimakassuolainen") || w.includes("Kraftigt saltad")
      );
      results.push({
        ruleId: "high-salt-warning",
        ruleName: "High Salt Warning (Finland)",
        severity: "CRITICAL",
        passed: hasWarning,
        message: hasWarning
          ? "High salt warning present"
          : `Salt content is ${label.nutritionInfo.salt.toFixed(1)}%. Must include "Voimakassuolainen / Kraftigt saltad" warning`,
        source: "Ruokavirasto Guide 17068/2, Section 9.2",
      });
    }
  }

  // Language requirement (all products)
  const hasFinnish = label.productName.translations.fi && label.productName.translations.fi.length > 0;
  const hasSwedish = label.productName.translations.sv && label.productName.translations.sv.length > 0;
  results.push({
    ruleId: "finnish-swedish-languages",
    ruleName: "Finnish and Swedish Required",
    severity: "CRITICAL",
    passed: Boolean(hasFinnish) && Boolean(hasSwedish),
    message: hasFinnish && hasSwedish
      ? "Both Finnish and Swedish translations present"
      : `Missing ${!hasFinnish ? "Finnish" : ""} ${!hasSwedish ? "Swedish" : ""} translation. Required by Finnish Product Safety Act 184/2025`,
    source: "Finnish Product Safety Act 184/2025, Section 3",
  });

  // Font size check
  const xHeight = calculateXHeight(label.fontSize, label.labelDimensions);
  results.push({
    ruleId: "font-size",
    ruleName: "Minimum Font Size (1.2mm x-height)",
    severity: "WARNING",
    passed: xHeight >= 1.2,
    message: xHeight >= 1.2
      ? `Font size compliant (x-height: ${xHeight.toFixed(2)}mm)`
      : `Font too small (x-height: ${xHeight.toFixed(2)}mm). Minimum required: 1.2mm`,
    source: "Ruokavirasto Guide 17068/2, Section 2.1",
  });

  const allergens = label.ingredients.filter(ing => ing.isAllergen);
  if (allergens.length > 0) {
    const allHighlighted = allergens.every(ing => ing.isHighlighted);
    results.push({
      ruleId: "allergen-highlighting",
      ruleName: "Allergen Visual Distinction",
      severity: "WARNING",
      passed: allHighlighted,
      message: allHighlighted
        ? "All allergens properly highlighted"
        : "Allergens must be visually distinct (bold, italic, or CAPS)",
      source: "Ruokavirasto Guide 17068/2, Section 2.3",
    });
  }

  results.push({
    ruleId: "eu-importer-address",
    ruleName: "EU Importer Address Required",
    severity: "CRITICAL",
    passed: isEUAddress(label.importerAddress),
    message: isEUAddress(label.importerAddress)
      ? "EU importer address found"
      : "Must include EU-based importer address. Original Asian address is not sufficient",
    source: "Ruokavirasto Guide 17068/2, Section 1.1",
  });

  // E-code functional classes
  const eCodes = label.ingredients.filter(ing => ing.code?.startsWith("E"));
  if (eCodes.length > 0) {
    const allHaveFunction = eCodes.every(ing => ing.functionalClass);
    results.push({
      ruleId: "functional-classes",
      ruleName: "E-Code Functional Classes",
      severity: "INFO",
      passed: allHaveFunction,
      message: allHaveFunction
        ? "All E-codes have functional classes"
        : "E-codes must include functional class (e.g., 'Flavor enhancer: E621' or 'Makuvahvenne: E621')",
      source: "Regulation (EU) No 1169/2011",
    });
  }

  return results;
}

/**
 * Calculate compliance score (0-100)
 */
export function calculateComplianceScore(results: ComplianceResult[]): number {
  if (results.length === 0) return 100;

  const weights = {
    CRITICAL: 10,
    WARNING: 5,
    INFO: 1,
  };

  let totalWeight = 0;
  let passedWeight = 0;

  for (const result of results) {
    const weight = weights[result.severity];
    totalWeight += weight;
    if (result.passed) {
      passedWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 100;
}

