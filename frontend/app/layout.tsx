import type { Metadata } from "next";
import GoogleProvider from "@/components/GoogleProvider";
import Navbar from "@/components/Navbar";
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
          <Navbar />
          <main>{children}</main>
        </GoogleProvider>
      </body>
    </html>
  );
}