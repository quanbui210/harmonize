import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  const BATCH_SIZE = 20;
  const COUNTRY_CODE = "FI"; // Default to Finland
  let skip = 0;
  let totalProcessed = 0;

  console.log(`Starting justification fix for ${COUNTRY_CODE} rulings...`);

  while (true) {
    const rulings = await prisma.btiRuling.findMany({
      where: {
        country: COUNTRY_CODE,
        titleEn: { not: null }, // Only process enriched ones
      },
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: BATCH_SIZE,
    });

    if (rulings.length === 0) {
      console.log("No more rulings found.");
      break;
    }

    console.log(`Processing batch of ${rulings.length} rulings (offset: ${skip})...`);

    for (const ruling of rulings) {
      if (!ruling.justification) {
        console.log(`Skipping ${ruling.reference} (no justification)`);
        continue;
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
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
        
        process.stdout.write("."); // Progress indicator

      } catch (error) {
        console.error(`\nFailed to fix ${ruling.reference}:`, error);
      }
    }
    
    console.log(""); // Newline after batch
    totalProcessed += rulings.length;
    skip += BATCH_SIZE;
  }

  console.log(`Finished! Total processed: ${totalProcessed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
