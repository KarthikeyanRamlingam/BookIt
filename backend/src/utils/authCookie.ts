import { Response } from "express";

const sameSite = (process.env.COOKIE_SAME_SITE || "lax") as "lax" | "strict" | "none";
const secure = process.env.NODE_ENV === "production";
const maxAge = Number(process.env.COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000;

export const AUTH_COOKIE_NAME = "bookit_session";

const cookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  path: "/api",
  maxAge,
} as const;

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
}

export function clearAuthCookie(res: Response) {
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
}
