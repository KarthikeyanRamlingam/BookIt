import { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "crypto";

export function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return res.status(503).json({ error: "Scheduled jobs are not configured" });
  const expected = Buffer.from(configuredSecret);
  const received = Buffer.from(req.header("x-cron-secret") || "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return res.status(401).json({ error: "Invalid job credential" });
  }
  next();
}
