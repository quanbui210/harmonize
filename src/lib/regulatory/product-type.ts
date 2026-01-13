/**
 * Simple utility to determine regulatory product type from CN code chapter
 * Used for routing to appropriate regulatory documents (Ruokavirasto, Tukes, etc.)
 * 
 * Note: AI already detects product types well, this is just for simple chapter-based routing
 */

export type RegulatoryProductType = "FOOD" | "ELECTRONICS" | "TOYS" | "COSMETICS" | "GENERAL";

/**
 * Determine regulatory product type from CN code chapter
 * Simple, rule-based - no overcomplication
 */
export function getRegulatoryProductType(cnCode: string): RegulatoryProductType {
  if (!cnCode || cnCode.length < 2) {
    return "GENERAL";
  }

  const chapter = parseInt(cnCode.substring(0, 2), 10);

  // Food products (Chapters 1-24)
  if (chapter >= 1 && chapter <= 24) {
    return "FOOD";
  }

  // Electronics (Chapters 84-85)
  if (chapter === 84 || chapter === 85) {
    return "ELECTRONICS";
  }

  // Toys (Chapter 95)
  if (chapter === 95) {
    return "TOYS";
  }

  // Cosmetics (Chapter 33)
  if (chapter === 33) {
    return "COSMETICS";
  }

  return "GENERAL";
}

