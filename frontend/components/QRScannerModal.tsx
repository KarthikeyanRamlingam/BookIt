"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "@/lib/api";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  serviceName: string;
  businessName?: string;
  onSuccess: (data: any) => void;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  appointmentId,
  serviceName,
  businessName,
  onSuccess,
}: QRScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const elementId = "qr-reader-container";

  // Stop active camera
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn("Error stopping scanner:", err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  // Submit checkin request with parsed token
  const handleTokenScanned = useCallback(async (rawToken: string) => {
    let token = rawToken.trim();
    // Check if JSON payload (e.g. {"sessionToken":"...","v":1})
    try {
      if (token.startsWith("{") && token.endsWith("}")) {
        const parsed = JSON.parse(token);
        if (parsed.sessionToken) {
          token = parsed.sessionToken;
        }
      }
    } catch {
      // Use raw token
    }

    setSubmitting(true);
    setCameraError(null);

    // Stop camera once a code is detected
    await stopScanner();

    try {
      const { data } = await api.post("/user/checkin", {
        appointmentId,
        sessionToken: token,
      });

      // Try haptic vibration if supported on mobile
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate([100, 50, 100]); } catch {}
      }

      setScanSuccessMsg("✓ Check-in Verified! Waiting for business confirmation…");
      setTimeout(() => {
        onSuccess(data);
        onClose();
      }, 1800);
    } catch (err: any) {
      setCameraError(err?.response?.data?.error || "Invalid QR code. Please try scanning again.");
      setSubmitting(false);
    }
  }, [appointmentId, onSuccess, onClose, stopScanner]);

  // Start camera when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setCameraError(null);
      setScanSuccessMsg(null);
      setSubmitting(false);
      return;
    }

    let isMounted = true;

    async function startCamera() {
      // Small timeout to allow DOM element to render
      await new Promise((r) => setTimeout(r, 200));
      if (!isMounted) return;

      const container = document.getElementById(elementId);
      if (!container) return;

      try {
        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" }, // Prefer back camera on phones
          {
            fps: 10,
            qrbox: { width: 230, height: 230 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              handleTokenScanned(decodedText);
            }
          },
          () => {
            // Frame scan failure - expected while looking for QR
          }
        );

        if (isMounted) {
          setIsScanning(true);
        }
      } catch (err: any) {
        console.warn("Camera init error:", err);
        if (isMounted) {
          setCameraError("Camera access denied or unavailable. You can enter or paste the token manually below.");
          setShowManualInput(true);
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen, handleTokenScanned, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600">
              <span>📷</span> In-App Check-In Scanner
            </div>
            <h2 className="mt-1 text-lg font-bold text-gray-900">
              Scan Business QR Code
            </h2>
            <p className="text-xs text-gray-500">
              {serviceName} {businessName ? `at ${businessName}` : ""}
            </p>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="my-5 flex flex-col items-center">
          {scanSuccessMsg ? (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600 animate-bounce">
                ✓
              </div>
              <h3 className="font-bold text-lg text-gray-900">{scanSuccessMsg}</h3>
              <p className="text-xs text-gray-500">
                Staff has been notified. 90% refund (₹45.00) will be processed on confirmation!
              </p>
            </div>
          ) : (
            <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-black border-4 border-brand-500 shadow-lg">
              <div id={elementId} className="w-full h-full" />
              {isScanning && !submitting && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {/* Laser line overlay */}
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
                </div>
              )}
              {submitting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-400 border-t-transparent mb-2" />
                  <p className="text-xs font-semibold">Verifying Check-In…</p>
                </div>
              )}
            </div>
          )}

          {!scanSuccessMsg && (
            <p className="mt-3 text-center text-xs text-gray-500 max-w-xs">
              Point your phone camera at the dynamic QR code displayed at the business counter.
            </p>
          )}

          {cameraError && (
            <div className="mt-3 w-full rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {cameraError}
            </div>
          )}
        </div>

        {/* Manual Fallback Toggle */}
        {!scanSuccessMsg && (
          <div className="border-t pt-3 space-y-2">
            <button
              onClick={() => setShowManualInput((v) => !v)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline flex items-center justify-center gap-1 w-full"
            >
              <span>⌨️</span> {showManualInput ? "Hide manual entry" : "Enter or paste session code manually"}
            </button>

            {showManualInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualToken.trim()) handleTokenScanned(manualToken.trim());
                }}
                className="flex gap-2 pt-1"
              >
                <input
                  type="text"
                  placeholder="Paste UUID token here..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting || !manualToken.trim()}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Submit
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
