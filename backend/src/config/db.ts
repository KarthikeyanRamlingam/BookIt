import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across the app (and across
// hot-reloads in dev) to avoid exhausting DB connections.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
