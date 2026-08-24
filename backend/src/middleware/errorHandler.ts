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
    const target = Array.isArray(err.meta?.target)
      ? err.meta.target.join(", ")
      : err.meta?.target || "unique field";
    return res.status(409).json({ error: `Conflict: duplicate value for ${target}` });
  }

  // Prisma record not found
  if (err?.code === "P2025") {
    return res.status(404).json({ error: err.meta?.cause || "Record not found" });
  }

  // Prisma foreign key constraint failed
  if (err?.code === "P2003") {
    return res.status(400).json({ error: `Foreign key constraint failed on field: ${err.meta?.field_name || "relation"}` });
  }

  console.error("Unhandled server error:", err);
  const errorMessage = process.env.NODE_ENV === "production" ? "Internal server error" : (err?.message || "Internal server error");
  return res.status(500).json({ error: errorMessage });
}