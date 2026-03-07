
import { PrismaClient } from "@prisma/client";

// Client for Staging (Source) - uses default DATABASE_URL from .env
const prismaStaging = new PrismaClient();

// Client for Production (Target) - uses PROD_DATABASE_URL env var
const prodUrl = process.env.PROD_DATABASE_URL;
if (!prodUrl) {
  console.error("Error: PROD_DATABASE_URL environment variable is required.");
  console.error("Usage: PROD_DATABASE_URL='postgresql://...' npx tsx scripts/migrate-bti-prod.ts");
  process.exit(1);
}

const prismaProd = new PrismaClient({
  datasources: {
    db: {
      url: prodUrl,
    },
  },
});

const BATCH_SIZE = 50;

async function main() {
  console.log("Starting migration from Staging to Production...");

  // 1. Fetch count
  const count = await prismaStaging.btiRuling.count();
  console.log(`Found ${count} rulings in Staging.`);

  let processed = 0;
  // Start from 0
  let skip = 0;

  while (processed < count) {
    // 2. Fetch data from Staging
    // We use raw query to get the vector as text, and keywords as is
    const rulings: any[] = await prismaStaging.$queryRawUnsafe(`
      SELECT 
        id, 
        reference, 
        country, 
        "hsCode", 
        description, 
        justification, 
        "startDate", 
        "endDate", 
        language, 
        "descriptionVector"::text as "vectorStr",
        "createdAt", 
        "updatedAt",
        "descriptionEn",
        "justificationEn",
        "titleEn",
        "category",
        keywords
      FROM "BtiRuling"
      ORDER BY "createdAt" ASC
      LIMIT ${BATCH_SIZE} OFFSET ${skip}
    `);

    if (rulings.length === 0) break;

    console.log(`Migrating batch of ${rulings.length} records (offset ${skip})...`);

    // 3. Insert into Prod
    for (const r of rulings) {
      try {
        // Prepare vector value
        // If vectorStr is null, we pass null. If it's a string, we pass it.
        const vectorVal = r.vectorStr ? r.vectorStr : null;
        
        await prismaProd.$executeRaw`
          INSERT INTO "BtiRuling" (
            id,
            reference,
            country,
            "hsCode",
            description,
            justification,
            "startDate",
            "endDate",
            language,
            "descriptionVector",
            "createdAt",
            "updatedAt",
            "descriptionEn",
            "justificationEn",
            "titleEn",
            "category",
            "keywords"
          ) VALUES (
            ${r.id}::uuid,
            ${r.reference},
            ${r.country},
            ${r.hsCode},
            ${r.description},
            ${r.justification},
            ${r.startDate},
            ${r.endDate},
            ${r.language},
            ${vectorVal}::vector,
            ${r.createdAt},
            ${r.updatedAt},
            ${r.descriptionEn},
            ${r.justificationEn},
            ${r.titleEn},
            ${r.category},
            ${r.keywords}
          )
          ON CONFLICT (reference) DO UPDATE SET
            country = EXCLUDED.country,
            "hsCode" = EXCLUDED."hsCode",
            description = EXCLUDED.description,
            justification = EXCLUDED.justification,
            "startDate" = EXCLUDED."startDate",
            "endDate" = EXCLUDED."endDate",
            language = EXCLUDED.language,
            "descriptionVector" = EXCLUDED."descriptionVector",
            "updatedAt" = EXCLUDED."updatedAt",
            "descriptionEn" = EXCLUDED."descriptionEn",
            "justificationEn" = EXCLUDED."justificationEn",
            "titleEn" = EXCLUDED."titleEn",
            "category" = EXCLUDED."category",
            "keywords" = EXCLUDED."keywords";
        `;
      } catch (err) {
        console.error(`Failed to migrate ruling ${r.reference}:`, err);
      }
    }

    processed += rulings.length;
    skip += BATCH_SIZE;
    console.log(`Progress: ${processed}/${count}`);
  }

  console.log("Migration complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaStaging.$disconnect();
    await prismaProd.$disconnect();
  });
