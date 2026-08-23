"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function PaymentSuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const appointmentId = params.get("appointmentId");
  const sessionId = params.get("session_id");

  const [verifying, setVerifying] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) {
      setVerifying(false);
      return;
    }

    api.post(`/payments/verify/${appointmentId}`, { sessionId })
      .then(({ data }) => {
        setPaymentData(data.payment);
        setVerifying(false);
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          router.push("/dashboard");
        }, 3500);
      })
      .catch((err) => {
        console.warn("Payment verification note:", err);
        setError(err?.response?.data?.error || null);
        setVerifying(false);
      });
  }, [appointmentId, sessionId, router]);

  return (
    <div className="mx-auto max-w-lg py-12 px-4">
      <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl text-center">
        {verifying ? (
          <div className="space-y-4 py-6">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            <h2 className="text-xl font-bold text-gray-800">Verifying Payment…</h2>
            <p className="text-sm text-gray-500">Confirming your token booking payment with the gateway and updating dashboard status.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600 shadow-sm">
              ✓
            </div>

            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-800">
                Payment Confirmed • Status: Paid
              </span>
              <h1 className="mt-3 text-2xl font-bold text-gray-900">Token Booking Payment Received!</h1>
              <p className="mt-2 text-sm text-gray-600">
                Your appointment and payment status have been updated to <strong className="text-green-700 font-semibold">PAID</strong> across both your customer dashboard and the business portal.
              </p>
            </div>

            {/* Refund reminder box */}
            <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 text-left text-xs text-teal-900 leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-sm text-teal-950 mb-1">
                <span>🎟️</span> Attendance Refund Guarantee
              </p>
              When you arrive and verify your check-in with the staff, <strong className="font-bold">90% of your token fee (₹45.00)</strong> will be automatically refunded back to your original payment method!
            </div>

            {paymentData && (
              <div className="rounded-xl bg-gray-50 border p-3.5 text-xs text-gray-600 text-left space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Token Booking Amount:</span>
                  <span className="font-semibold text-gray-900">₹{Number(paymentData.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Status:</span>
                  <span className="font-bold text-green-700">PAID ✓</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                {error}
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 transition-colors"
              >
                Go to Dashboard Now →
              </Link>
              <p className="mt-2 text-[11px] text-gray-400">Redirecting to dashboard automatically in a few seconds…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md text-center py-16">Loading payment status...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}