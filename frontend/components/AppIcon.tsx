import type { ReactNode } from "react";

export type AppIconName =
  | "calendar"
  | "clock"
  | "location"
  | "search"
  | "arrowRight"
  | "medical"
  | "restaurant"
  | "beauty"
  | "people"
  | "ticket"
  | "check"
  | "store"
  | "sparkle"
  | "logout"
  | "dashboard"
  | "staff";

const paths: Record<AppIconName, ReactNode> = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  arrowRight: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  medical: <><path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M14 3h6v6M20 3l-9 9" /><path d="M8 16h8M12 12v8" /></>,
  restaurant: <><path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M17 3v18M17 3c3 2 3 7 0 9" /></>,
  beauty: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5" /></>,
  ticket: <><path d="M3 8a2 2 0 0 0 0 4v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 1 0-4V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2Z" /><path d="M13 5v2m0 3v2m0 3v2" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  store: <><path d="M3 10h18l-1.5-6h-15L3 10Z" /><path d="M5 10v10h14V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
  sparkle: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
  staff: <><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0M19 8h3m-1.5-1.5v3" /></>,
};

export function AppIcon({
  name,
  size = 20,
  className = "",
}: {
  name: AppIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

export function ServiceIcon({ slug, className = "", size = 22 }: { slug: string; className?: string; size?: number }) {
  const name: AppIconName = slug.includes("doctor") || slug.includes("cardio") || slug.includes("clinic") || slug.includes("dent")
    ? "medical"
    : slug.includes("restaurant") || slug.includes("cafe")
      ? "restaurant"
      : slug.includes("salon") || slug.includes("spa")
        ? "beauty"
        : slug.includes("government")
          ? "store"
          : "calendar";

  return <AppIcon name={name} size={size} className={className} />;
}
