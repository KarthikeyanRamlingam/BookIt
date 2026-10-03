import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN" | "PLATFORM_ADMIN";
}

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters in production");
}
const SECRET: jwt.Secret = configuredSecret || "development-only-secret-change-before-deploy";
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}
