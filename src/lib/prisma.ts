import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Create Prisma client with optimized configuration for serverless
const createPrismaClient = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
};

// CRITICAL: Use singleton pattern in ALL environments (including production)
// In serverless (Vercel), each function invocation can create a new Prisma client
// if we don't reuse it, which exhausts the connection pool
export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

// Always store in global to reuse across function invocations
// This works in serverless because globalThis is shared within the same container
globalForPrisma.prisma = prisma;

// Graceful shutdown on process termination (helps in long-running processes)
if (typeof process !== "undefined" && process.on) {
  const disconnect = async () => {
    await prisma.$disconnect();
  };
  
  process.on("beforeExit", disconnect);
  process.on("SIGINT", disconnect);
  process.on("SIGTERM", disconnect);
}

