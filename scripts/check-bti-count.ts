
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.btiRuling.count();
  console.log(`Total BTI Rulings: ${count}`);
  
  const fiCount = await prisma.btiRuling.count({
    where: { country: "FI" }
  });
  console.log(`Finnish Rulings: ${fiCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
