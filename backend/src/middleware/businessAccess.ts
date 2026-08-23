import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import { ApiError } from "../middleware/errorHandler";

/**
 * Resolves the businessId for the currently authenticated ADMIN or STAFF user.
 * Attaches req.businessId so downstream handlers never trust a client-supplied value.
 */
export async function requireBusinessAccess(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    if (req.user.role === "ADMIN") {
      const business = await prisma.business.findUnique({ where: { ownerId: req.user.userId } });
      if (!business) return res.status(404).json({ error: "You don't own a business" });
      (req as any).businessId = business.id;
      (req as any).business = business;
      return next();
    }

    if (req.user.role === "STAFF") {
      const staff = await prisma.staffProfile.findUnique({ where: { userId: req.user.userId } });
      if (!staff) return res.status(403).json({ error: "Staff profile not found" });
      (req as any).businessId = staff.businessId;
      return next();
    }

    return res.status(403).json({ error: "Insufficient permissions" });
  } catch {
    next(new ApiError(500, "Authorization check failed"));
  }
}
