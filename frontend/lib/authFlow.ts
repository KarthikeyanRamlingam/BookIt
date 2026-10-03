import type { AuthUser } from "@/lib/api";

/**
 * Return only same-origin application paths. Authentication redirects come
 * from query strings and must never be allowed to send users off-site.
 */
export function getSafeRedirect(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return null;
  }

  try {
    const target = new URL(path, window.location.origin);
    if (target.origin !== window.location.origin) return null;
    if (target.pathname === "/login" || target.pathname === "/register") return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function getRequestedRedirect(): string | null {
  if (typeof window === "undefined") return null;
  return getSafeRedirect(new URLSearchParams(window.location.search).get("redirect"));
}

export function getLoginPathForCurrentPage(): string {
  if (typeof window === "undefined") return "/login";
  const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?redirect=${encodeURIComponent(returnPath)}`;
}

export function getPostAuthDestination(
  user: Pick<AuthUser, "role">,
  _requestedRedirect?: string | null,
): string {
  if (user.role === "PLATFORM_ADMIN") return "/dashboard/admin";
  if (user.role === "ADMIN" || user.role === "STAFF") return "/dashboard";
  return "/dashboard";
}
