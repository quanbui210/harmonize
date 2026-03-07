
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to bypass type checking for new fields if client is outdated
type EnrichedBtiRuling = {
  id: string;
  reference: string;
  description: string;
  justification: string | null;
  descriptionEn?: string | null;
  titleEn?: string | null;
  justificationEn?: string | null;
  category?: string | null;
  keywords?: string[];
};

async function main() {
  console.log("Starting BTI enrichment for Finnish rulings...");

  let processedCount = 0;
  const BATCH_SIZE = 10;

  while (true) {
    // 1. Fetch batch of unprocessed FI rulings
    // We check for titleEn being null to identify unprocessed ones (even if desc is done)
    // Casting to any to avoid TS errors if client is outdated
    const rulings = (await prisma.btiRuling.findMany({
      where: {
        country: "FI",
        // @ts-ignore: field might not exist in generated client
        titleEn: null,
      },
      take: BATCH_SIZE,
    })) as unknown as EnrichedBtiRuling[];

    if (rulings.length === 0) {
      console.log("No more rulings to process.");
      break;
    }

    console.log(`Processing batch of ${rulings.length} rulings...`);

    // 2. Process each ruling
    for (const ruling of rulings) {
      try {
        console.log(`Enriching ${ruling.reference}...`);
        
        // Use a shorter prompt for speed/cost
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini", 
          messages: [
            {
              role: "system",
              content: `Translate to English. Extract 3-5 keywords. Assign broad category (e.g. Textiles, Electronics, Food, Chemicals, Machinery, Other). Generate a short, descriptive title (max 10 words). JSON only.
              { 
                "titleEn": "Short descriptive title",
                "descriptionEn": "...", 
                "justificationEn": "...", 
                "category": "...", 
                "keywords": ["..."] 
              }`
            },
            {
              role: "user",
              content: `DESC: ${ruling.description.substring(0, 1000)}\nJUST: ${ruling.justification?.substring(0, 500) || "N/A"}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.0,
        });

        const content = completion.choices[0].message.content;
        if (!content) continue;
        
        const result = JSON.parse(content);

        // 3. Update database
        // @ts-ignore: fields might not exist in generated client
        await prisma.btiRuling.update({
          where: { id: ruling.id },
          data: {
            titleEn: result.titleEn,
            descriptionEn: result.descriptionEn,
            justificationEn: result.justificationEn,
            category: result.category,
            keywords: result.keywords || [],
          },
        });

        processedCount++;
      } catch (error) {
        console.error(`Failed to process ${ruling.reference}:`, error);
      }
    }
  }

  console.log(`Finished! Total enriched: ${processedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
