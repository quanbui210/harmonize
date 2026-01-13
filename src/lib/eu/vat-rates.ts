/**
 * Destination-specific VAT rates for EU member states
 * These rates are used when calculating import costs for specific destinations
 */

export interface VATRateInfo {
  standard: number;
  reduced?: number;
  superReduced?: number;
  food?: number;
  books?: number;
  medicines?: number;
  notes?: string;
}

export const EU_VAT_RATES: Record<string, VATRateInfo> = {
  // Finland
  Finland: {
    standard: 25.5,
    reduced: 14, // Food, books, medicines
    food: 14,
    books: 14,
    medicines: 14,
    notes: "Food, books, and medicines: 14%. General goods: 25.5%",
  },
  // Sweden
  Sweden: {
    standard: 25,
    reduced: 12, // Food, books
    food: 12,
    books: 12,
    notes: "Food and books: 12%. General goods: 25%",
  },
  // Germany
  Germany: {
    standard: 19,
    reduced: 7, // Food, books, medicines
    food: 7,
    books: 7,
    medicines: 7,
    notes: "Food, books, medicines: 7%. General goods: 19%",
  },
  // France
  France: {
    standard: 20,
    reduced: 5.5, // Food, books
    superReduced: 2.1, // Medicines
    food: 5.5,
    books: 5.5,
    medicines: 2.1,
    notes: "Food and books: 5.5%. Medicines: 2.1%. General goods: 20%",
  },
  // Italy
  Italy: {
    standard: 22,
    reduced: 10, // Food, books
    superReduced: 4, // Medicines
    food: 10,
    books: 10,
    medicines: 4,
    notes: "Food and books: 10%. Medicines: 4%. General goods: 22%",
  },
  // Spain
  Spain: {
    standard: 21,
    reduced: 10, // Food, books
    superReduced: 4, // Medicines
    food: 10,
    books: 10,
    medicines: 4,
    notes: "Food and books: 10%. Medicines: 4%. General goods: 21%",
  },
  // Netherlands
  Netherlands: {
    standard: 21,
    reduced: 9, // Food, books, medicines
    food: 9,
    books: 9,
    medicines: 9,
    notes: "Food, books, medicines: 9%. General goods: 21%",
  },
  // Belgium
  Belgium: {
    standard: 21,
    reduced: 6, // Food, books, medicines
    superReduced: 0, // Some medicines
    food: 6,
    books: 6,
    medicines: 6,
    notes: "Food, books, medicines: 6%. General goods: 21%",
  },
  // Austria
  Austria: {
    standard: 20,
    reduced: 10, // Food, books
    superReduced: 0, // Some medicines
    food: 10,
    books: 10,
    medicines: 0,
    notes: "Food and books: 10%. General goods: 20%",
  },
  // Denmark
  Denmark: {
    standard: 25,
    notes: "Standard rate: 25% (no reduced rate)",
  },
  // Poland
  Poland: {
    standard: 23,
    reduced: 8, // Food, books
    superReduced: 5, // Medicines
    food: 8,
    books: 8,
    medicines: 5,
    notes: "Food and books: 8%. Medicines: 5%. General goods: 23%",
  },
  // Portugal
  Portugal: {
    standard: 23,
    reduced: 13, // Food, books
    superReduced: 6, // Medicines
    food: 13,
    books: 13,
    medicines: 6,
    notes: "Food and books: 13%. Medicines: 6%. General goods: 23%",
  },
  // Greece
  Greece: {
    standard: 24,
    reduced: 13, // Food, books
    superReduced: 6, // Medicines
    food: 13,
    books: 13,
    medicines: 6,
    notes: "Food and books: 13%. Medicines: 6%. General goods: 24%",
  },
  // Ireland
  Ireland: {
    standard: 23,
    reduced: 13.5, // Food, books
    superReduced: 9, // Medicines
    food: 13.5,
    books: 13.5,
    medicines: 9,
    notes: "Food and books: 13.5%. Medicines: 9%. General goods: 23%",
  },
  // Czech Republic
  Czech: {
    standard: 21,
    reduced: 15, // Food, books
    superReduced: 10, // Medicines
    food: 15,
    books: 15,
    medicines: 10,
    notes: "Food and books: 15%. Medicines: 10%. General goods: 21%",
  },
  // Romania
  Romania: {
    standard: 19,
    reduced: 9, // Food, books
    superReduced: 5, // Medicines
    food: 9,
    books: 9,
    medicines: 5,
    notes: "Food and books: 9%. Medicines: 5%. General goods: 19%",
  },
  // Hungary
  Hungary: {
    standard: 27,
    reduced: 18, // Food, books
    superReduced: 5, // Medicines
    food: 18,
    books: 18,
    medicines: 5,
    notes: "Food and books: 18%. Medicines: 5%. General goods: 27%",
  },
  // Bulgaria
  Bulgaria: {
    standard: 20,
    reduced: 9, // Food, books
    superReduced: 0, // Some medicines
    food: 9,
    books: 9,
    medicines: 0,
    notes: "Food and books: 9%. General goods: 20%",
  },
  // Croatia
  Croatia: {
    standard: 25,
    reduced: 13, // Food, books
    superReduced: 5, // Medicines
    food: 13,
    books: 13,
    medicines: 5,
    notes: "Food and books: 13%. Medicines: 5%. General goods: 25%",
  },
  // Slovakia
  Slovakia: {
    standard: 20,
    reduced: 10, // Food, books
    superReduced: 0, // Some medicines
    food: 10,
    books: 10,
    medicines: 0,
    notes: "Food and books: 10%. General goods: 20%",
  },
  // Slovenia
  Slovenia: {
    standard: 22,
    reduced: 9.5, // Food, books
    superReduced: 5, // Medicines
    food: 9.5,
    books: 9.5,
    medicines: 5,
    notes: "Food and books: 9.5%. Medicines: 5%. General goods: 22%",
  },
  // Estonia
  Estonia: {
    standard: 20,
    reduced: 9, // Food, books
    superReduced: 0, // Some medicines
    food: 9,
    books: 9,
    medicines: 0,
    notes: "Food and books: 9%. General goods: 20%",
  },
  // Latvia
  Latvia: {
    standard: 21,
    reduced: 12, // Food, books
    superReduced: 0, // Some medicines
    food: 12,
    books: 12,
    medicines: 0,
    notes: "Food and books: 12%. General goods: 21%",
  },
  // Lithuania
  Lithuania: {
    standard: 21,
    reduced: 9, // Food, books
    superReduced: 5, // Medicines
    food: 9,
    books: 9,
    medicines: 5,
    notes: "Food and books: 9%. Medicines: 5%. General goods: 21%",
  },
  // Luxembourg
  Luxembourg: {
    standard: 17,
    reduced: 8, // Food, books
    superReduced: 3, // Medicines
    food: 8,
    books: 8,
    medicines: 3,
    notes: "Food and books: 8%. Medicines: 3%. General goods: 17%",
  },
  // Malta
  Malta: {
    standard: 18,
    reduced: 7, // Food, books
    superReduced: 5, // Medicines
    food: 7,
    books: 7,
    medicines: 5,
    notes: "Food and books: 7%. Medicines: 5%. General goods: 18%",
  },
  // Cyprus
  Cyprus: {
    standard: 19,
    reduced: 9, // Food, books
    superReduced: 5, // Medicines
    food: 9,
    books: 9,
    medicines: 5,
    notes: "Food and books: 9%. Medicines: 5%. General goods: 19%",
  },
};

/**
 * Get VAT rate for a destination country and product type
 */
export function getVATRate(
  destinationCountry: string,
  productType?: "food" | "books" | "medicines" | "general"
): number {
  const countryKey = Object.keys(EU_VAT_RATES).find(
    (key) => key.toLowerCase() === destinationCountry.toLowerCase()
  );

  if (!countryKey) {
    // Default to standard EU rate if country not found
    return 20;
  }

  const rates = EU_VAT_RATES[countryKey];

  if (productType === "food" && rates.food !== undefined) {
    return rates.food;
  }
  if (productType === "books" && rates.books !== undefined) {
    return rates.books;
  }
  if (productType === "medicines" && rates.medicines !== undefined) {
    return rates.medicines;
  }

  return rates.standard;
}

/**
 * Detect product type from description for VAT rate selection
 */
export function detectProductTypeForVAT(
  productName: string,
  description: string
): "food" | "books" | "medicines" | "general" {
  const lowerName = productName.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const combined = `${lowerName} ${lowerDesc}`;

  // Food products
  if (
    combined.match(/\b(food|edible|consumable|ingredient|snack|fruit|vegetable|meat|dairy|beverage|drink)\b/) ||
    lowerName.match(/\b(mango|trail mix|dried|nuts|seeds)\b/)
  ) {
    return "food";
  }

  // Books
  if (combined.match(/\b(book|magazine|journal|publication|manual|guide)\b/)) {
    return "books";
  }

  // Medicines
  if (
    combined.match(/\b(medicine|pharmaceutical|drug|tablet|capsule|prescription|medical device)\b/)
  ) {
    return "medicines";
  }

  return "general";
}

