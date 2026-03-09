
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
          model: "gpt-3.5-turbo", 
          messages: [
            {
              role: "system",
              content: `You are an expert customs classifier. Translate the following BTI ruling description and justification to English. 
1. Translate 'description' and 'justification' fully and accurately, preserving legal references (e.g., regulations, nomenclature codes). Do not summarize the justification; translate the full legal reasoning.
2. Extract 3-5 keywords. 
3. Assign a broad category (e.g. Textiles, Electronics, Food, Chemicals, Machinery, Other). 
4. Generate a short, descriptive title (max 10 words). 
Output JSON only.
              { 
                "titleEn": "Short descriptive title",
                "descriptionEn": "Full translation of description", 
                "justificationEn": "Full translation of justification", 
                "category": "Category", 
                "keywords": ["keyword1", "keyword2"] 
              }`
            },
            {
              role: "user",
              content: `DESC: ${ruling.description.substring(0, 4000)}\nJUST: ${ruling.justification?.substring(0, 4000) || "N/A"}`
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

export async function fixJustificationsBatch(skip = 0, batchSize = 20, countryCode = "FI") {
  const rulings = await prisma.btiRuling.findMany({
    where: {
      country: countryCode,
      titleEn: { not: null }, // Only process enriched ones
    },
    orderBy: { createdAt: 'desc' }, // Consistent ordering
    skip: skip,
    take: batchSize,
  });

  if (rulings.length === 0) return 0;

  console.log(`Fixing justifications for batch of ${rulings.length} rulings (skip: ${skip})...`);

  for (const ruling of rulings) {
    if (!ruling.justification) continue;

    try {
      // Skip if justificationEn seems long enough compared to justification (heuristic)
      // or just re-process to be safe. Let's re-process to be safe.
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert customs classifier. Translate the following BTI ruling justification to English.
1. Translate fully and accurately, preserving legal references. Do not summarize.
Output JSON only.
{ "justificationEn": "Full translation of justification" }`
          },
          {
            role: "user",
            content: `JUST: ${ruling.justification.substring(0, 4000)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.0,
      });

      const content = completion.choices[0].message.content;
      if (!content) continue;

      const result = JSON.parse(content);

      await prisma.btiRuling.update({
        where: { id: ruling.id },
        data: {
          justificationEn: result.justificationEn,
        },
      });

    } catch (error) {
      console.error(`Failed to fix justification for ${ruling.reference}:`, error);
    }
  }

  return rulings.length;
}
