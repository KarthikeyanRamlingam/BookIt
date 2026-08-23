import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Must be registered LAST, after all routes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Zod throws when req.body fails schema validation (e.g. a required
  // field left blank, or a string that doesn't match a regex like the
  // business slug pattern). Without this, it fell through to the generic
  // 500 branch below and just said "Internal server error".
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const field = firstIssue?.path?.join(".") || "field";
    return res.status(400).json({ error: `Invalid ${field}: ${firstIssue?.message}` });
  }

  // Prisma unique constraint violation
  if (err?.code === "P2002") {
    return res.status(409).json({ error: `Duplicate value for field: ${err.meta?.target}` });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}