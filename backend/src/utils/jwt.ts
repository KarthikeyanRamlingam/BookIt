import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN" | "PLATFORM_ADMIN";
}

const SECRET: jwt.Secret = process.env.JWT_SECRET || "dev_secret_change_me";
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}