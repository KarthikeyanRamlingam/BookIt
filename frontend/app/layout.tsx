import type { Metadata, Viewport } from "next";
import GoogleProvider from "@/components/GoogleProvider";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BookIt — Book local services", template: "%s · BookIt" },
  description: "Book, reschedule, and manage appointments with local service businesses.",
  applicationName: "BookIt",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#020617" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        <GoogleProvider>
          <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-2 text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
          <Navbar />
          <main id="main-content">{children}</main>
        </GoogleProvider>
      </body>
    </html>
  );
}
