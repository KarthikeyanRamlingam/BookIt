"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { api, getSession } from "@/lib/api";

interface CheckInRecord {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  initiatedAt: string;
  rejectionReason?: string | null;
  user: { name: string; email: string };
  booking: {
    id: string;
    service: { name: string; durationMin: number };
    slot: { startTime: string; endTime: string };
  };
}

const QR_TTL = 60; // seconds before auto-refresh

export default function CheckInPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ id: string; value: string } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"qr" | "checkins">("qr");

  // Redirect non-business users
  useEffect(() => {
    const session = getSession();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
      router.push("/dashboard");
    }
  }, [router]);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Draw QR on canvas ─────────────────────────────────────────────────────
  const drawQR = useCallback(async (token: string) => {
    if (!canvasRef.current) return;
    // Encode as JSON payload — only session token, no personal data
    const payload = JSON.stringify({ sessionToken: token, v: 1 });
    await QRCode.toCanvas(canvasRef.current, payload, {
      width: 260,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    });
  }, []);

  // ─── Generate / Refresh QR Session ────────────────────────────────────────
  const generateSession = useCallback(async () => {
    setGeneratingQR(true);
    try {
      const { data } = await api.post("/business/checkin-session");
      setSessionToken(data.token);
      setSecondsLeft(data.expiresInSeconds ?? QR_TTL);
      await drawQR(data.token);
    } catch (err: any) {
      showToast("error", err?.response?.data?.error || "Failed to generate QR session");
    } finally {
      setGeneratingQR(false);
    }
  }, [drawQR]);

  // ─── Load existing session on mount ───────────────────────────────────────
  useEffect(() => {
    api.get("/business/checkin-session/current").then(async ({ data }) => {
      if (data.token) {
        setSessionToken(data.token);
        setSecondsLeft(data.secondsLeft ?? QR_TTL);
        await drawQR(data.token);
      } else {
        await generateSession();
      }
    }).catch(() => generateSession());
  }, [drawQR, generateSession]);

  // ─── Countdown timer + auto-refresh ──────────────────────────────────────
  useEffect(() => {
    if (!sessionToken) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          generateSession();
          return QR_TTL;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionToken, generateSession]);

  // ─── Load pending check-ins ───────────────────────────────────────────────
  const loadCheckIns = useCallback(async () => {
    try {
      const { data } = await api.get("/business/checkins");
      setCheckIns(data);
    } catch {
      // Silently handle — business may have no check-ins yet
    }
  }, []);

  useEffect(() => {
    loadCheckIns();
    const interval = setInterval(loadCheckIns, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, [loadCheckIns]);

  // ─── Confirm Check-in ─────────────────────────────────────────────────────
  async function confirmCheckIn(id: string) {
    setActionLoading(id);
    try {
      await api.post(`/business/checkins/${id}/confirm`);
      showToast("success", "Customer checked in successfully! ✓");
      setCheckIns((prev) => prev.map((c) => c.id === id ? { ...c, status: "CONFIRMED" } : c));
    } catch (err: any) {
      showToast("error", err?.response?.data?.error || "Confirmation failed");
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Reject Check-in ──────────────────────────────────────────────────────
  async function rejectCheckIn(id: string) {
    const reason = rejectReason?.id === id ? rejectReason.value : "";
    setActionLoading(id);
    try {
      await api.post(`/business/checkins/${id}/reject`, { reason });
      showToast("success", "Check-in rejected.");
      setCheckIns((prev) => prev.map((c) => c.id === id ? { ...c, status: "REJECTED", rejectionReason: reason } : c));
      setRejectReason(null);
    } catch (err: any) {
      showToast("error", err?.response?.data?.error || "Rejection failed");
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCheckIns = checkIns.filter((c) => c.status === "PENDING");
  const recentCheckIns = checkIns.filter((c) => c.status !== "PENDING").slice(0, 10);
  const progressPct = (secondsLeft / QR_TTL) * 100;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg text-white transition-all ${
          toast.type === "success" ? "bg-green-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Check-in Management</h1>
        <p className="text-sm text-gray-500 mt-1">Display the QR code at your business counter. Customers scan it to initiate check-in.</p>
      </div>

      {/* Mobile tabs */}
      <div className="flex sm:hidden gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("qr")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "qr" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}
        >
          📱 QR Code
        </button>
        <button
          onClick={() => setActiveTab("checkins")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "checkins" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}
        >
          Check-ins
          {pendingCheckIns.length > 0 && (
            <span className="rounded-full bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center">{pendingCheckIns.length}</span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* ─── QR Panel ─────────────────────────────────────────── */}
        <div className={`${activeTab !== "qr" ? "hidden sm:block" : ""}`}>
          <div className="bg-white rounded-2xl border shadow-sm p-6 flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-4">
              <h2 className="font-semibold text-gray-800">Customer Check-in QR</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${secondsLeft > 20 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                🔄 {secondsLeft}s
              </span>
            </div>

            {/* QR Canvas */}
            <div className="relative rounded-2xl border-4 border-brand-100 overflow-hidden bg-white p-2 shadow-inner">
              <canvas ref={canvasRef} className="block" />
              {generatingQR && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${secondsLeft > 20 ? "bg-green-500" : "bg-orange-400"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              QR refreshes every {QR_TTL} seconds for security. Customers must have an active booking to check in.
            </p>

            <button
              onClick={generateSession}
              disabled={generatingQR}
              className="mt-4 w-full rounded-xl border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
            >
              {generatingQR ? "Refreshing…" : "🔄 Refresh QR Now"}
            </button>
          </div>
        </div>

        {/* ─── Check-ins Panel ──────────────────────────────────── */}
        <div className={`${activeTab !== "checkins" ? "hidden sm:block" : ""} space-y-4`}>
          {/* Pending */}
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Pending Confirmations</h2>
              {pendingCheckIns.length > 0 && (
                <span className="rounded-full bg-red-500 text-white text-xs px-2 py-0.5 font-bold animate-pulse">
                  {pendingCheckIns.length} new
                </span>
              )}
            </div>

            {pendingCheckIns.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No pending check-ins</p>
            ) : (
              <div className="space-y-3">
                {pendingCheckIns.map((c) => (
                  <div key={c.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{c.user.name}</p>
                        <p className="text-xs text-gray-500">{c.booking.service.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(c.booking.slot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {new Date(c.initiatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} arrived
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-200 text-amber-800 text-xs px-2 py-0.5 font-semibold shrink-0">
                        Pending
                      </span>
                    </div>

                    {rejectReason?.id === c.id ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          placeholder="Reason for rejection (optional)"
                          value={rejectReason.value}
                          onChange={(e) => setRejectReason({ id: c.id, value: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => rejectCheckIn(c.id)}
                            disabled={actionLoading === c.id}
                            className="flex-1 rounded-lg bg-red-600 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm Reject
                          </button>
                          <button
                            onClick={() => setRejectReason(null)}
                            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => confirmCheckIn(c.id)}
                          disabled={actionLoading === c.id}
                          className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === c.id ? "…" : "✓ Confirm"}
                        </button>
                        <button
                          onClick={() => setRejectReason({ id: c.id, value: "" })}
                          disabled={actionLoading === c.id}
                          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent */}
          {recentCheckIns.length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Recent Check-ins</h2>
              <div className="space-y-2">
                {recentCheckIns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="font-medium text-gray-800">{c.user.name}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500">{c.booking.service.name}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.status === "CONFIRMED"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {c.status === "CONFIRMED" ? "✓ Confirmed" : "✗ Rejected"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}