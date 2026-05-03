type DecimalLike = {
  toNumber: () => number;
};

function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as DecimalLike).toNumber === "function"
  );
}

function toNumberOrNull(value: unknown) {
  if (value == null) {
    return null;
  }

  if (isDecimalLike(value)) {
    return value.toNumber();
  }

  return typeof value === "number" ? value : Number(value);
}

function parseJsonString(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function serializeProduct<T extends Record<string, any>>(product: T) {
  return {
    ...product,
    materials: Array.isArray(product.materials)
      ? product.materials.map((material: Record<string, unknown>) => ({
          ...material,
          percentage: toNumberOrNull(material.percentage),
        }))
      : product.materials,
  };
}

export function serializeDutySummary<T extends Record<string, any> | null | undefined>(
  dutySummary: T,
) {
  if (!dutySummary) {
    return null;
  }

  return {
    ...dutySummary,
    baseValue: toNumberOrNull(dutySummary.baseValue),
    dutyRate: toNumberOrNull(dutySummary.dutyRate),
    vatRate: toNumberOrNull(dutySummary.vatRate),
    mpfRate: toNumberOrNull(dutySummary.mpfRate),
    section301Rate: toNumberOrNull(dutySummary.section301Rate),
    estimatedDuty: toNumberOrNull(dutySummary.estimatedDuty),
    estimatedTaxes: toNumberOrNull(dutySummary.estimatedTaxes),
  };
}

export function serializeClassification<T extends Record<string, any>>(
  classification: T,
) {
  return {
    ...classification,
    confidence: toNumberOrNull(classification.confidence),
    humanNotes: parseJsonString(classification.humanNotes),
    refinementAnswer: parseJsonString(classification.refinementAnswer),
    product: classification.product
      ? serializeProduct(classification.product)
      : classification.product,
    dutySummary: serializeDutySummary(classification.dutySummary),
  };
}
