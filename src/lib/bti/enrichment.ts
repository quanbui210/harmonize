
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

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

export async function enrichPendingRulings(batchSize = 10, countryCode = "FI") {
  console.log(`Starting BTI enrichment for ${countryCode} rulings...`);

  let processedCount = 0;

  while (true) {
    // 1. Fetch batch of unprocessed rulings
    const rulings = (await prisma.btiRuling.findMany({
      where: {
        country: countryCode,
        // @ts-ignore: field might not exist in generated client
        titleEn: null,
      },
      take: batchSize,
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
    
    // Break after one batch to prevent long-running serverless function timeouts
    // The UI can trigger it again
    break; 
  }

  console.log(`Finished! Total enriched: ${processedCount}`);
  return processedCount;
}
