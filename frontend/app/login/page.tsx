"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { api, saveSession } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  // ── Email / Password login ──
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      saveSession(data.token, data.user);
      router.push(data.user.role === "PLATFORM_ADMIN" ? "/dashboard/admin" : "/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  // ── Real Google Sign-In: receives verified ID token from Google ──
  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setError("Google sign-in failed. Please try again.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Send the real Google ID token (JWT) to our backend for server-side verification
      const { data } = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });
      saveSession(data.token, data.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleError() {
    setError("Google sign-in was cancelled or failed. Please try again.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg shadow-blue-600/20 group-hover:border-blue-500 transition-all flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="BookIt Logo"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <span className="text-2xl font-black text-white tracking-tight group-hover:text-blue-400 transition-colors">
              BookIt
            </span>
          </Link>
          <p className="mt-2 text-sm text-slate-400">Sign in to manage bookings & appointments</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 rounded-3xl shadow-2xl border border-slate-800 p-8 backdrop-blur-xl">
          <h1 className="text-xl font-bold text-white text-center mb-2">{adminMode ? "Platform admin sign in" : "Welcome back"}</h1>
          <button type="button" onClick={() => setAdminMode((current) => !current)} className="mb-6 block mx-auto text-xs font-semibold text-blue-400 hover:text-blue-300">
            {adminMode ? "Use customer or business login" : "Platform administrator login"}
          </button>

          {/* ── Real Google Sign-In Button ── */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              shape="pill"
              size="large"
              text="continue_with"
              width="340"
              useOneTap
            />
            <p className="text-[11px] text-slate-500 text-center">
              Clicking above opens the real Google account picker
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 absolute">
              or sign in with email
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-950/40 border border-red-500/30 p-3.5 text-xs font-medium text-red-300 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── Email + Password Form ── */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Password
                </label>
                <Link href="/register" className="text-xs text-blue-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-blue-400 hover:underline">
              Create one free
            </Link>
          </p>
        </div>

        {/* Business Registration Banner */}
        <div className="mt-5 bg-slate-900/60 rounded-3xl border border-slate-800 p-6 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🏢</span>
            <div>
              <p className="font-bold text-white text-sm">Are you a business owner?</p>
              <p className="text-xs text-slate-400">Manage bookings, automated check-ins & staff</p>
            </div>
          </div>
          <Link
            href="/business/register"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-950/30 px-4 py-2.5 text-sm font-semibold text-blue-300 hover:bg-blue-900/40 transition-colors"
          >
            <span>🚀</span>
            Register Your Business
          </Link>
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-600 leading-relaxed">
          By continuing, you agree to our{" "}
          <span className="text-slate-400 underline cursor-pointer">Terms of Service</span> and{" "}
          <span className="text-slate-400 underline cursor-pointer">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}