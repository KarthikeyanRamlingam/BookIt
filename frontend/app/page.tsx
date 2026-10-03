"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/api";
import { getPostAuthDestination } from "@/lib/authFlow";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    router.replace(session ? getPostAuthDestination(session.user) : "/login");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" aria-label="Loading your dashboard" />
    </div>
  );
}
