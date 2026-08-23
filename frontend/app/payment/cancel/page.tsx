"use client";

import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-semibold text-gray-800">Payment cancelled</h1>
      <p className="mt-2 text-gray-600">
        No charge was made. You can try again anytime from your dashboard.
      </p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-md bg-brand-600 px-4 py-2 text-white">
        Back to dashboard
      </Link>
    </div>
  );
}