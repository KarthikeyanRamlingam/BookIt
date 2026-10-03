"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, logoutSession, AuthUser } from "@/lib/api";
import { getPostAuthDestination } from "@/lib/authFlow";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function syncAuth() {
      setUser(getSession()?.user ?? null);
    }
    syncAuth();
    setMenuOpen(false);
    window.addEventListener("storage", syncAuth);
    window.addEventListener("auth-change", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("auth-change", syncAuth);
    };
  }, [pathname]);

  async function handleLogout() {
    await logoutSession();
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
      <nav aria-label="Main navigation" className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="BookIt home">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg shadow-blue-600/10 transition group-hover:border-blue-500">
              <Image src="/logo.png" alt="" width={36} height={36} className="object-contain" priority />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">Book<span className="text-blue-400">It</span></span>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link href={getPostAuthDestination(user)} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">{user.name?.charAt(0).toUpperCase() || "U"}</span>
                  <span className="max-w-32 truncate">{user.name}</span>
                </Link>
                <button onClick={handleLogout} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white">Log out</button>
              </>
            ) : (
              !isLoginPage && <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">Log in</Link>
                <Link href="/register" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500">Get started</Link>
              </>
            )}
          </div>

          {!(isLoginPage && !user) && <button type="button" aria-label="Toggle navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-200 md:hidden">
            <span aria-hidden="true" className="text-xl">{menuOpen ? "×" : "☰"}</span>
          </button>}
        </div>

        {menuOpen && !(isLoginPage && !user) && (
          <div className="border-t border-slate-800 py-3 md:hidden">
            <div className="grid gap-1">
              {user && <Link href={getPostAuthDestination(user)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white">Dashboard</Link>}
            </div>
            <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
              {user ? (
                <button onClick={handleLogout} className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200">Log out</button>
              ) : isLoginPage ? null : (
                <>
                  <Link href="/login" className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold text-slate-200">Log in</Link>
                  <Link href="/register" className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white">Get started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
