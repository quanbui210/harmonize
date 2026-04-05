import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Create Prisma client with optimized configuration for serverless
const createPrismaClient = () => {
  const baseUrl = process.env.DATABASE_URL;
  let datasourceUrl: string | undefined;

  // In serverless deployments, keep per-instance connection usage low.
  if (baseUrl && process.env.VERCEL) {
    try {
      const url = new URL(baseUrl);
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "20");
      }
      datasourceUrl = url.toString();
    } catch {
      datasourceUrl = baseUrl;
    }
  }

  return new PrismaClient({
    ...(datasourceUrl
      ? {
          datasources: {
            db: { url: datasourceUrl },
          },
        }
      : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
};


export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

// Always store in global to reuse across function invocations
// This works in serverless because globalThis is shared within the same container
globalForPrisma.prisma = prisma;

// Graceful shutdown is only needed for non-serverless long-running processes.
if (typeof process !== "undefined" && process.on && !process.env.VERCEL) {
  const disconnect = async () => {
    await prisma.$disconnect();
  };
  
  process.on("beforeExit", disconnect);
  process.on("SIGINT", disconnect);
  process.on("SIGTERM", disconnect);
}
