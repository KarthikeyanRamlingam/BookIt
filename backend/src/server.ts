import "dotenv/config";
import app from "./app";
import { sweepNoShows } from "./services/noShowService";
import { prisma } from "./config/db";
import type { Server } from "http";

const PORT = Number(process.env.PORT) || 4000;

const NO_SHOW_SWEEP_INTERVAL_MS = 60 * 1000;
const runScheduledJobs = process.env.RUN_SCHEDULED_JOBS === "true";
let server: Server | undefined;
let noShowTimer: NodeJS.Timeout | undefined;

async function runScheduledNoShowSweep() {
  try {
    const swept = await sweepNoShows();

    if (swept > 0) {
      console.log(`No-show sweep marked ${swept} appointment(s).`);
    }
  } catch (error) {
    console.error("Scheduled no-show sweep failed:", error);
  }
}

async function startServer() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error";
    const staleTenant = detail.includes("tenant/user") || detail.includes("ENOTFOUND");
    console.error(
      staleTenant
        ? "Database connection failed: the configured hosted database tenant is invalid or unavailable. Replace DATABASE_URL and DIRECT_URL with current provider connection strings."
        : "Database connection failed. Verify DATABASE_URL, DIRECT_URL, database availability, and credentials."
    );
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`API server listening on port ${PORT}`);

    if (runScheduledJobs) {
      void runScheduledNoShowSweep();
      noShowTimer = setInterval(runScheduledNoShowSweep, NO_SHOW_SWEEP_INTERVAL_MS);
      noShowTimer.unref();
    }
  });
}

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down gracefully.`);
  if (noShowTimer) clearInterval(noShowTimer);
  if (!server) {
    await prisma.$disconnect();
    process.exit(0);
  }
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void startServer();
