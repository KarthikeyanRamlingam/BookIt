import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import GoogleProvider from "@/components/GoogleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookIt — Appointment Booking Platform",
  description: "Book, reschedule, and manage appointments with local service businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <GoogleProvider>
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
              <div className="flex items-center gap-6 text-sm font-medium">
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
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-1.5 font-semibold text-white shadow-sm hover:border-slate-600 hover:bg-slate-800 transition-all"
                >
                  Log in
                </Link>
              </div>
            </div>
          </nav>
          <main>{children}</main>
        </GoogleProvider>
      </body>
    </html>
  );
}