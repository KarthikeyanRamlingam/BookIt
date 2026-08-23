"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, saveSession } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

const BUSINESS_TYPES = [
  { slug: "restaurant", label: "Restaurant", icon: "🍽️", desc: "Table bookings & dining reservations" },
  { slug: "doctor-appointment", label: "Doctor / Clinic", icon: "🩺", desc: "Medical appointments & consultations" },
  { slug: "salon", label: "Salon & Spa", icon: "💇", desc: "Hair styling, beauty treatments & wellness" },
  { slug: "government-office", label: "Government Office", icon: "🏛️", desc: "Document services & public sector" },
  { slug: "other", label: "Other Business", icon: "🏢", desc: "Any other service-based business" },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STEPS = [
  { id: 1, label: "Business Type" },
  { id: 2, label: "Business Info" },
  { id: 3, label: "Your Account" },
  { id: 4, label: "Working Hours" },
  { id: 5, label: "Check-in Settings" },
  { id: 6, label: "Review & Submit" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function BusinessRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Form state
  const [categorySlug, setCategorySlug] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("India");
  const [postalCode, setPostalCode] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri default
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [checkInBeforeMinutes, setCheckInBeforeMinutes] = useState(30);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [autoNoShow, setAutoNoShow] = useState(true);

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  function toggleDay(d: number) {
    setWorkingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  function validateStep(): string | null {
    if (step === 1 && !categorySlug) return "Please select a business type.";
    if (step === 2) {
      if (!businessName.trim()) return "Business name is required.";
      if (!address.trim()) return "Business address is required.";
      if (!city.trim()) return "City is required.";
    }
    if (step === 3) {
      if (!ownerName.trim()) return "Owner name is required.";
      if (!email.trim() || !email.includes("@")) return "Valid email is required.";
      if (password.length < 6) return "Password must be at least 6 characters.";
      if (password !== confirmPassword) return "Passwords do not match.";
    }
    if (step === 4 && workingDays.length === 0) return "Select at least one working day.";
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => s + 1);
  }

  function back() {
    setError(null);
    setStep((s) => s - 1);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/register-business", {
        categorySlug,
        businessName,
        description,
        address,
        city,
        state,
        country,
        postalCode,
        businessPhone,
        ownerName,
        email,
        phone: phone || undefined,
        password,
        workingDays,
        openTime,
        closeTime,
        checkInBeforeMinutes,
        gracePeriodMinutes,
        autoNoShow,
      });
      saveSession(data.token, data.user);
      router.push("/dashboard?registered=1");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-brand-700">
            <span className="text-3xl">📅</span>
            <span>BookIt</span>
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Register Your Business</h1>
          <p className="mt-1 text-sm text-gray-500">
            Join thousands of businesses managing appointments on BookIt
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center shrink-0">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                  step === s.id
                    ? "bg-brand-600 text-white shadow-md"
                    : step > s.id
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > s.id ? "✓" : s.id}
              </div>
              <span
                className={`ml-1.5 text-xs font-medium hidden sm:block ${
                  step === s.id ? "text-brand-700" : step > s.id ? "text-green-600" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 w-8 sm:w-12 ${step > s.id ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

          {/* Step 1 — Business Type */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">What type of business is this?</h2>
              <p className="text-sm text-gray-500 mb-5">Select the category that best describes your business.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => setCategorySlug(t.slug)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      categorySlug === t.slug
                        ? "border-brand-500 bg-brand-50 shadow-sm"
                        : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{t.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{t.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                    </div>
                    {categorySlug === t.slug && (
                      <span className="ml-auto text-brand-500 text-lg shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Business Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Business Information</h2>
              <p className="text-sm text-gray-500 mb-4">Tell us about your business location and contact details.</p>

              <Field label="Business Name *" id="businessName">
                <Input id="businessName" value={businessName} onChange={setBusinessName} placeholder="e.g. Bodycraft Salon, City Clinic" />
              </Field>
              <Field label="Description" id="desc">
                <textarea
                  id="desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe your services..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                />
              </Field>
              <Field label="Street Address *" id="address">
                <Input id="address" value={address} onChange={setAddress} placeholder="123 Main Street" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City *" id="city">
                  <Input id="city" value={city} onChange={setCity} placeholder="Bengaluru" />
                </Field>
                <Field label="State" id="state">
                  <Input id="state" value={state} onChange={setState} placeholder="Karnataka" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country" id="country">
                  <Input id="country" value={country} onChange={setCountry} placeholder="India" />
                </Field>
                <Field label="Postal Code" id="postalCode">
                  <Input id="postalCode" value={postalCode} onChange={setPostalCode} placeholder="560001" />
                </Field>
              </div>
              <Field label="Business Phone" id="bPhone">
                <Input id="bPhone" value={businessPhone} onChange={setBusinessPhone} placeholder="+91 98765 43210" />
              </Field>
            </div>
          )}

          {/* Step 3 — Owner Account */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Your Account</h2>
              <p className="text-sm text-gray-500 mb-4">Create your business owner login credentials.</p>

              <Field label="Your Full Name *" id="ownerName">
                <Input id="ownerName" value={ownerName} onChange={setOwnerName} placeholder="Priya Sharma" />
              </Field>
              <Field label="Email Address *" id="email">
                <Input id="email" type="email" value={email} onChange={setEmail} placeholder="priya@mybusiness.com" />
              </Field>
              <Field label="Phone (optional)" id="phone">
                <Input id="phone" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
              </Field>
              <Field label="Password *" id="password">
                <Input id="password" type="password" value={password} onChange={setPassword} placeholder="Min. 6 characters" />
              </Field>
              <Field label="Confirm Password *" id="confirmPwd">
                <Input id="confirmPwd" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" />
              </Field>
            </div>
          )}

          {/* Step 4 — Working Hours */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Working Hours</h2>
              <p className="text-sm text-gray-500 mb-4">Select which days you operate and your opening / closing times.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Working Days *</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-all ${
                        workingDays.includes(idx)
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Opening Time" id="openTime">
                  <input
                    id="openTime"
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                  />
                </Field>
                <Field label="Closing Time" id="closeTime">
                  <input
                    id="closeTime"
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Step 5 — Check-in Settings */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Check-in Settings</h2>
              <p className="text-sm text-gray-500 mb-4">Configure how check-in and no-show rules work for your business.</p>

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                <strong>How it works:</strong> Customers can check in by scanning your business QR code within the configured window. If they don't check in within the grace period, they may be automatically marked as no-show.
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-in opens before appointment
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={checkInBeforeMinutes}
                      onChange={(e) => setCheckInBeforeMinutes(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-20 text-sm font-semibold text-brand-700 text-right">
                      {checkInBeforeMinutes} min
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grace period after appointment time
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={5}
                      value={gracePeriodMinutes}
                      onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-20 text-sm font-semibold text-brand-700 text-right">
                      {gracePeriodMinutes} min
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Auto No-show</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Automatically mark bookings as no-show after grace period
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoNoShow((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoNoShow ? "bg-brand-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        autoNoShow ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs text-gray-600">
                  <p className="font-semibold mb-1">Example for a 4:00 PM appointment:</p>
                  <p>✅ Check-in opens at <strong>{formatTimeOffset("16:00", -checkInBeforeMinutes)}</strong></p>
                  <p>⏰ Check-in closes at <strong>{formatTimeOffset("16:00", gracePeriodMinutes)}</strong></p>
                  {autoNoShow && <p>🚫 Auto no-show at <strong>{formatTimeOffset("16:00", gracePeriodMinutes)}</strong></p>}
                </div>
              </div>
            </div>
          )}

          {/* Step 6 — Review */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Review & Submit</h2>
              <p className="text-sm text-gray-500 mb-4">Please verify your details before submitting.</p>

              <ReviewRow label="Business Type" value={BUSINESS_TYPES.find((t) => t.slug === categorySlug)?.label || categorySlug} />
              <ReviewRow label="Business Name" value={businessName} />
              <ReviewRow label="Address" value={`${address}, ${city}, ${state}, ${country} ${postalCode}`} />
              {businessPhone && <ReviewRow label="Business Phone" value={businessPhone} />}
              <ReviewRow label="Owner Name" value={ownerName} />
              <ReviewRow label="Email" value={email} />
              <ReviewRow label="Working Days" value={workingDays.map((d) => DAYS[d]).join(", ")} />
              <ReviewRow label="Working Hours" value={`${openTime} – ${closeTime}`} />
              <ReviewRow label="Check-in Window" value={`${checkInBeforeMinutes} min before appointment`} />
              <ReviewRow label="Grace Period" value={`${gracePeriodMinutes} min after appointment`} />
              <ReviewRow label="Auto No-show" value={autoNoShow ? "Enabled" : "Disabled"} />

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                <strong>⏳ Pending Verification:</strong> Your business will be reviewed by our team before going live. You'll be able to log in and configure services while waiting for approval.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            {step > 1 ? (
              <button
                onClick={back}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                ← Back
              </button>
            ) : (
              <Link href="/login" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                ← Login instead
              </Link>
            )}

            {step < STEPS.length ? (
              <button
                onClick={next}
                className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-all"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={loading}
                className="rounded-lg bg-brand-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-all"
              >
                {loading ? "Registering…" : "🚀 Register Business"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Already registered?{" "}
          <Link href="/login" className="text-brand-600 hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({
  id, value, onChange, placeholder, type = "text",
}: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
    />
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0 w-40">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function formatTimeOffset(base: string, offsetMinutes: number): string {
  const [h, m] = base.split(":").map(Number);
  const total = h * 60 + m + offsetMinutes;
  const hours = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mins = ((total % 1440) + 1440) % 1440 % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayH = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayH}:${String(mins).padStart(2, "0")} ${suffix}`;
}
