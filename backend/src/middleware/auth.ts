import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { prisma } from "../config/db";
import { AUTH_COOKIE_NAME } from "../utils/authCookie";

// Extend Express's Request type with our decoded JWT payload.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      businessId?: string;
      business?: import("@prisma/client").Business;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((cookie) => cookie.trim().split("="))
    .find(([name]) => name === AUTH_COOKIE_NAME)?.[1];
  const token = bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : undefined);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
    if (!user || user.role !== payload.role) {
      return res.status(401).json({ error: "Session is no longer valid" });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
