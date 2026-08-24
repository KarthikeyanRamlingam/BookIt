"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, clearSession, AuthUser } from "@/lib/api";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    function syncAuth() {
      const session = getSession();
      setUser(session ? session.user : null);
    }
    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, [pathname]);

  function handleLogout() {
    clearSession();
    setUser(null);
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-slate-900 border border-slate-700/80 shadow-md shadow-blue-600/20 group-hover:border-blue-500 transition-all flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="BookIt Logo"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-blue-400 transition-colors">
            BookIt
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
          <Link href="/doctors" className="text-slate-300 hover:text-white transition-colors">
            🩺 Doctors
          </Link>
          <Link href="/restaurants" className="text-slate-300 hover:text-white transition-colors">
            🍽️ Restaurants
          </Link>
          <Link href="/salons" className="text-slate-300 hover:text-white transition-colors">
            💇 Salons & Spa
          </Link>
          <Link href="/dashboard" className="text-slate-300 hover:text-white transition-colors">
            Dashboard
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-blue-500 transition-all"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-[11px]">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </span>
                <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-red-500/20 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40 hover:text-red-200 transition-all"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-1.5 font-semibold text-white shadow-sm hover:border-slate-600 hover:bg-slate-800 transition-all"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
