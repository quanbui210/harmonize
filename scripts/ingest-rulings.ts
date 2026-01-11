/**
 * Script to ingest binding rulings into the database
 * 
 * Usage:
 *   npm run tsx scripts/ingest-rulings.ts
 * 
 * Or with custom data:
 *   npm run tsx scripts/ingest-rulings.ts -- --file path/to/rulings.json
 */

import { PrismaClient, MarketCode } from "@prisma/client";
import { ingestRulingsAction } from "../src/server/actions/rulings";

const prisma = new PrismaClient();

// Example rulings data - Replace with your actual data
const EXAMPLE_RULINGS = [
  {
    market: MarketCode.EU,
    reference: "BTI-DE/123456/2021",
    title: "Electric neck massager with heating function",
    body: `**Binding Tariff Information Decision**

**Product Description:**
The product is an electric neck massager with integrated heating function. It consists of:
- Electric motor for vibration
- Heating elements (PTC ceramic heaters)
- Soft fabric cover
- Control panel with temperature and intensity settings
- Power supply unit (AC adapter)

**Classification Decision:**
The product is classified under CN code **9019.10.00** - "Mechano-therapy appliances; massage apparatus; psychological aptitude-testing apparatus".

**Legal Reasoning:**
According to Chapter 90, Note 1, medical, surgical, dental or veterinary instruments and apparatus (heading 9018) are excluded from this chapter. However, the product in question is a massage apparatus designed for therapeutic purposes, not a medical instrument.

The product's essential character is determined by its massage function, which is provided by the electric motor. The heating function is ancillary to the massage function.

**GRI Applied:**
- GRI 1: Classification according to the terms of the headings
- GRI 3(b): Essential character determined by the massage function

**Validity:**
This BTI is valid from 15 January 2021 to 14 January 2026.`,
    htsCode: "9019100000",
    issuedAt: new Date("2021-01-15"),
  },
  {
    market: MarketCode.EU,
    reference: "BTI-FR/789012/2020",
    title: "Unmanned aerial vehicle (drone) for commercial photography",
    body: `**Binding Tariff Information Decision**

**Product Description:**
The product is an unmanned aerial vehicle (UAV) designed for commercial photography and videography. Specifications:
- Weight: 1.2 kg (including battery)
- Maximum flight time: 25 minutes
- Camera: 4K video, 12MP still photos
- GPS navigation system
- Remote control unit
- Carrying case

**Classification Decision:**
The product is classified under CN code **8806.00.00** - "Other aircraft (for example, helicopters, aeroplanes); spacecraft (including satellites) and suborbital and spacecraft launch vehicles".

**Legal Reasoning:**
Heading 8806 covers aircraft, including unmanned aircraft. The product is an unmanned aircraft designed for flight, regardless of its intended use for photography.

The camera and photography equipment are integral parts of the aircraft and do not change its essential character as an aircraft.

**GRI Applied:**
- GRI 1: Classification according to the terms of the headings
- Note 1 to Chapter 88: Aircraft are classified in this chapter regardless of their intended use

**Validity:**
This BTI is valid from 10 March 2020 to 9 March 2025.`,
    htsCode: "8806000000",
    issuedAt: new Date("2020-03-10"),
  },
  {
    market: MarketCode.US,
    reference: "NY N123456",
    title: "Smartphone with protective case and screen protector",
    body: `**Customs Ruling**

**Product Description:**
The product consists of:
1. A smartphone (Apple iPhone 14 Pro)
2. A protective silicone case
3. A tempered glass screen protector
4. All items packaged together in a retail box

**Classification Decision:**
The smartphone is classified under HTSUS **8517.12.00** - "Telephones for cellular networks or for other wireless networks: Smartphones".

The protective case and screen protector are classified separately under their respective headings as they are not considered part of a set for retail sale.

**Legal Reasoning:**
According to GRI 3(b), sets for retail sale are classified according to the component that gives the set its essential character. However, the protective accessories are not essential to the function of the smartphone and are considered separate articles.

**Additional Notes:**
- The smartphone and accessories are packaged together but sold as separate items
- Each item must be declared separately on the entry documents

**Effective Date:**
This ruling is effective from 1 January 2023.`,
    htsCode: "8517120000",
    issuedAt: new Date("2023-01-01"),
  },
];

async function main() {
  console.log("🚀 Starting ruling ingestion...\n");

  try {
    const result = await ingestRulingsAction({
      rulings: EXAMPLE_RULINGS,
    });

    console.log(`✅ Ingestion complete!`);
    console.log(`   Total: ${result.total}`);
    console.log(`   Successful: ${result.successful}`);
    console.log(`   Failed: ${result.failed}\n`);

    if (result.failed > 0) {
      console.log("❌ Failed rulings:");
      result.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   - ${r.reference}: ${(r as any).error}`);
        });
    }

    // Show summary
    const totalRulings = await prisma.bindingRuling.count();
    console.log(`\n📊 Total rulings in database: ${totalRulings}`);
    
    const byMarket = await prisma.bindingRuling.groupBy({
      by: ["market"],
      _count: true,
    });
    
    console.log("\n📈 Rulings by market:");
    byMarket.forEach(({ market, _count }) => {
      console.log(`   ${market}: ${_count}`);
    });
  } catch (error) {
    console.error("❌ Error ingesting rulings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

