"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, logoutSession, AuthUser } from "@/lib/api";
import { getPostAuthDestination } from "@/lib/authFlow";
import { AppIcon, type AppIconName } from "@/components/AppIcon";

type DashboardNavItem = { href: string; label: string; icon: AppIconName };

const CUSTOMER_NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "My Appointments", icon: "calendar" },
];

const ADMIN_NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/checkin", label: "Check-in & QR", icon: "ticket" },
  { href: "/dashboard/services", label: "Services", icon: "sparkle" },
  { href: "/dashboard/hours", label: "Business Hours", icon: "clock" },
  { href: "/dashboard/staff", label: "Staff", icon: "staff" },
  { href: "/dashboard/slots", label: "Generate Slots", icon: "calendar" },
];

const STAFF_NAV: DashboardNavItem[] = [
  { href: "/dashboard", label: "Appointments", icon: "calendar" },
  { href: "/dashboard/checkin", label: "Check-in & QR", icon: "ticket" },
];

const PLATFORM_ADMIN_NAV: DashboardNavItem[] = [
  { href: "/dashboard/admin", label: "Business Approvals", icon: "check" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    const role = session.user.role;
    const isOwnerPath = ["/dashboard/services", "/dashboard/hours", "/dashboard/staff", "/dashboard/slots", "/dashboard/business"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
    const allowed =
      (role === "PLATFORM_ADMIN" && pathname === "/dashboard/admin") ||
      (role === "CUSTOMER" && pathname === "/dashboard") ||
      (role === "STAFF" && ["/dashboard", "/dashboard/checkin"].includes(pathname)) ||
      (role === "ADMIN" && pathname !== "/dashboard/admin");

    if (!allowed || (role === "STAFF" && isOwnerPath)) {
      router.replace(getPostAuthDestination(session.user));
      return;
    }
    setUser(session.user);
  }, [router, pathname]);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const navItems =
    user.role === "PLATFORM_ADMIN" ? PLATFORM_ADMIN_NAV : user.role === "ADMIN" ? ADMIN_NAV : user.role === "STAFF" ? STAFF_NAV : CUSTOMER_NAV;
  const isOwnerTool = user.role === "ADMIN" && pathname !== "/dashboard";

  async function logout() {
    await logoutSession();
    router.push("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] gap-0 bg-slate-950 text-slate-100">
      {/* Dark Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-slate-800/80 bg-slate-900/60 pb-6 pt-5 backdrop-blur-md md:flex">
        <div>
          {/* User profile capsule */}
          <div className="mx-3 mb-6 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-inner">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-base font-bold shrink-0 shadow-md shadow-blue-600/30">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{user.name}</p>
              <p className="text-xs font-medium text-blue-400">
                {user.role === "CUSTOMER" ? "Customer" : user.role === "PLATFORM_ADMIN" ? "Platform Admin" : user.role === "ADMIN" ? "Business Owner" : "Staff"}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><AppIcon name={item.icon} /></span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom logout */}
        <div className="px-3 border-t border-slate-800/80 pt-4">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400 hover:bg-red-950/40 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all"
          >
            <AppIcon name="logout" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className={`min-w-0 flex-1 overflow-auto p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 ${isOwnerTool ? "bg-slate-50 text-slate-900" : "bg-slate-950"}`}>
        {children}
      </section>

      <nav aria-label="Dashboard navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-stretch gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[10px] font-semibold transition ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}>
                <AppIcon name={item.icon} size={18} />
                <span className="max-w-[76px] truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
