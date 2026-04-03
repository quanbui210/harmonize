/**
 * Compliance checker for product labels
 * Validates against Ruokavirasto and EU regulations
 */

import type { RegulatoryProductType } from "@/lib/regulatory/product-type";
import { resolveEUMarketProfile } from "@/lib/labeling/eu-market";

export interface LabelData {
  productName: {
    original: string;
    translations: Record<string, string | undefined>;
  };
  ingredients: Array<{
    name: string;
    percentage?: number; // QUID
    code?: string; // E-code
    functionalClass?: string;
    isAllergen: boolean;
    isHighlighted: boolean;
    translations: Record<string, string | undefined>;
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

export type LabelEndUse = "B2C" | "B2B" | "internal";

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

const QUID_STOP_WORDS = new Set([
  "and",
  "with",
  "without",
  "from",
  "for",
  "the",
  "a",
  "an",
  "in",
  "of",
  "style",
  "flavor",
  "flavour",
  "natural",
  "organic",
  "fresh",
  "dried",
  "slice",
  "slices",
  "piece",
  "pieces",
  "mix",
  "blend",
]);

function extractMatchTokens(value: string): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !QUID_STOP_WORDS.has(token));
}

function canonicalizeToken(token: string): string {
  if (token.endsWith("es") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

function getQUIDIngredientTargets(label: LabelData): Array<LabelData["ingredients"][number]> {
  const productNameText = [
    label.productName.original,
    ...Object.values(label.productName.translations || {}),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
  const normalizedProductName = ` ${normalizeForMatch(productNameText)} `;
  const productNameTokens = new Set(extractMatchTokens(productNameText).map(canonicalizeToken));

  return label.ingredients.filter((ingredient) => {
    const candidates = [
      ingredient.name,
      ...Object.values(ingredient.translations || {}),
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeForMatch(candidate);
      if (!normalizedCandidate || normalizedCandidate.length < 3) {
        return false;
      }
      if (normalizedProductName.includes(` ${normalizedCandidate} `)) {
        return true;
      }

      const candidateTokens = extractMatchTokens(candidate).map(canonicalizeToken);
      return candidateTokens.some((token) => productNameTokens.has(token));
    });
  });
}

/**
 * Run all compliance checks
 */
export function runComplianceChecks(
  label: LabelData,
  productType: RegulatoryProductType,
  options?: { destinationCountry?: string; requiredLocales?: string[]; endUse?: LabelEndUse }
): ComplianceResult[] {
  const results: ComplianceResult[] = [];
  const market = resolveEUMarketProfile(options?.destinationCountry);
  const endUse = options?.endUse ?? "B2C";
  const requiredLocales = (options?.requiredLocales && options.requiredLocales.length > 0)
    ? options.requiredLocales
    : market.requiredLocales;

  // Only run food-specific checks for food products
  if (productType === "FOOD" && endUse === "B2C") {
    const quidTargets = getQUIDIngredientTargets(label);
    if (quidTargets.length > 0) {
      const missingQUID = quidTargets.filter(
        (ing) => typeof ing.percentage !== "number" || Number.isNaN(ing.percentage)
      );
      const missingNames = missingQUID
        .map((ing) => {
          for (const locale of requiredLocales) {
            const value = ing.translations?.[locale];
            if (typeof value === "string" && value.length > 0) return value;
          }
          return ing.name;
        })
        .join(", ");
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

    if (market.countryCode === "FI" && label.nutritionInfo.salt > 1.2) {
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
  } else if (productType === "FOOD" && endUse !== "B2C") {
    results.push({
      ruleId: "quid-required",
      ruleName: "QUID Percentage Required",
      severity: "INFO",
      passed: true,
      message: `Skipped for ${endUse} workflow. Ensure trade documents contain composition details where required.`,
      source: "Regulation (EU) No 1169/2011, Article 22",
    });
  }

  if (endUse === "internal") {
    results.push({
      ruleId: "required-market-languages",
      ruleName: "Required Market Languages",
      severity: "INFO",
      passed: true,
      message: "Skipped for internal workflow.",
      source: "Regulation (EU) No 1169/2011, Article 15",
    });
  } else {
    const missingLocales = requiredLocales.filter((locale) => {
      const value = label.productName.translations?.[locale];
      return !(typeof value === "string" && value.trim().length > 0);
    });
    const isB2B = endUse === "B2B";
    results.push({
      ruleId: "required-market-languages",
      ruleName: "Required Market Languages",
      severity: isB2B ? "WARNING" : "CRITICAL",
      passed: missingLocales.length === 0,
      message: missingLocales.length === 0
        ? `Required locales present: ${requiredLocales.join(", ")}`
        : isB2B
          ? `Missing locales on pack (${missingLocales.join(", ")}). For B2B, provide these in accompanying trade documentation.`
          : `Missing translations for required locales: ${missingLocales.join(", ")}`,
      source: "Regulation (EU) No 1169/2011, Article 15",
    });
  }

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
    source: "Regulation (EU) No 1169/2011, Article 13",
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
      source: "Regulation (EU) No 1169/2011, Article 21",
    });
  }

  if (endUse === "internal") {
    results.push({
      ruleId: "eu-importer-address",
      ruleName: "EU Importer Address Required",
      severity: "INFO",
      passed: true,
      message: "Skipped for internal workflow.",
      source: "Regulation (EU) No 1169/2011, Article 8",
    });
  } else {
    results.push({
      ruleId: "eu-importer-address",
      ruleName: "EU Importer Address Required",
      severity: "CRITICAL",
      passed: isEUAddress(label.importerAddress),
      message: isEUAddress(label.importerAddress)
        ? "EU importer address found"
        : "Must include EU-based importer address. Original non-EU address is not sufficient",
      source: "Regulation (EU) No 1169/2011, Article 8",
    });
  }

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

