"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, clearSession, AuthUser } from "@/lib/api";

const CUSTOMER_NAV = [
  { href: "/dashboard", label: "My Appointments", icon: "📅" },
];

const ADMIN_NAV = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/checkin", label: "Check-in & QR", icon: "📱" },
  { href: "/dashboard/services", label: "Services", icon: "✂️" },
  { href: "/dashboard/hours", label: "Business Hours", icon: "🕐" },
  { href: "/dashboard/staff", label: "Staff", icon: "👥" },
  { href: "/dashboard/slots", label: "Generate Slots", icon: "⚡" },
];

const STAFF_NAV = [
  { href: "/dashboard", label: "Appointments", icon: "📅" },
  { href: "/dashboard/checkin", label: "Check-in & QR", icon: "📱" },
];

const PLATFORM_ADMIN_NAV = [
  { href: "/dashboard/admin", label: "Business Approvals", icon: "✅" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setUser(session.user);
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const navItems =
    user.role === "PLATFORM_ADMIN" ? PLATFORM_ADMIN_NAV : user.role === "ADMIN" ? ADMIN_NAV : user.role === "STAFF" ? STAFF_NAV : CUSTOMER_NAV;

  function logout() {
    clearSession();
    router.push("/");
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] gap-0 bg-slate-950 text-slate-100">
      {/* Dark Sidebar */}
      <aside className="w-60 shrink-0 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md pt-5 pb-6 flex flex-col justify-between">
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
                  <span className="text-lg">{item.icon}</span>
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
            <span>🚪</span>
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-6 md:p-8 bg-slate-950">
        {children}
      </main>
    </div>
  );
}