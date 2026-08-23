import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

// Usage: router.post("/x", requireAuth, requireRole("ADMIN", "STAFF"), handler)
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this action" });
    }
    next();
  };
}
