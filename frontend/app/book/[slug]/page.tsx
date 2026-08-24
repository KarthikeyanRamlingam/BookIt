"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getSession } from "@/lib/api";
import AddToCalendarDropdown from "@/components/AddToCalendarDropdown";

interface Service {
  id: string;
  name: string;
  tokenFee?: string;
  durationMin: number;
}

interface Business {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  mapUrl?: string;
  category?: { id: string; name: string; slug: string };
  services: Service[];
}

interface Slot {
  id: string;
  startTime: string;
  endTime?: string;
  staff: { user: { name: string } };
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string;
}

interface ReviewSummary {
  averageRating: number | null;
  count: number;
  reviews: Review[];
}

interface TokenInfo {
  token: string;
  waitMinutes: number;
}

const TOKEN_CATEGORY_SLUGS = new Set([
  "doctor-appointment",
  "general-practitioners",
  "cardiologists",
  "pediatricians",
  "dermatologists",
  "neurologists",
  "endocrinologists",
  "gastroenterologists",
  "psychiatrists",
  "orthopedics",
  "dentists",
  "ophthalmologists",
  "gynecologists",
  "government-office",
]);

const SPECIALTY_WAIT_MINUTES: Record<string, number> = {
  "general-practitioners": 18,
  cardiologists: 22,
  pediatricians: 20,
  dermatologists: 17,
  neurologists: 25,
  endocrinologists: 21,
  gastroenterologists: 24,
  psychiatrists: 19,
  orthopedics: 20,
  dentists: 15,
  ophthalmologists: 18,
  gynecologists: 22,
  "government-office": 15,
};

export default function BookingPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookedAppointmentId, setBookedAppointmentId] = useState<string | null>(null);
  const [bookedAppointment, setBookedAppointment] = useState<any | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showReviews, setShowReviews] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [queueMinutesLeft, setQueueMinutesLeft] = useState<number | null>(null);
  const [tokenPreview, setTokenPreview] = useState<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isTokenFlow = !!business?.category && TOKEN_CATEGORY_SLUGS.has(business.category.slug);
  const isRestaurant = business?.category?.slug === "restaurant";
  const isSalon = business?.category?.slug === "salon";
  const [occasionNote, setOccasionNote] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotificationsEnabled(Notification.permission === "granted");
  }, []);

  useEffect(() => {
    setIsAuthenticated(!!getSession());
  }, []);

  useEffect(() => {
    if (!tokenInfo || !isTokenFlow || !bookedAppointmentId) return;
    setQueueMinutesLeft(tokenInfo.waitMinutes);
    const interval = setInterval(() => {
      setQueueMinutesLeft((current) => {
        if (current === null) return tokenInfo.waitMinutes;
        if (current <= 1) {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Queue token update", {
              body: `Your token ${tokenInfo.token} is nearly up. Please be ready for your counter/desk call.`,
            });
          }
          return 0;
        }
        return current - 1;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [tokenInfo, isTokenFlow, bookedAppointmentId]);

  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setMessage("This browser does not support push notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
    if (permission === "granted") {
      setMessage("Queue alerts enabled. You will be notified when your token is almost ready.");
    }
  }

  useEffect(() => {
    api.get(`/businesses/${params.slug}`).then(({ data }) => setBusiness(data));
    api.get(`/reviews/business/${params.slug}`).then(({ data }) => setReviewSummary(data));
  }, [params.slug]);

  useEffect(() => {
    if (!selectedService) return;
    let active = true;
    const loadSlots = () => {
      api
        .get("/slots/availability", { params: { serviceId: selectedService } })
        .then(({ data }) => {
          if (active) setSlots(data);
        });
    };
    loadSlots();
    const interval = setInterval(loadSlots, 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedService]);

  useEffect(() => {
    if (!isTokenFlow || !selectedDateStr || bookedAppointmentId) {
      setTokenPreview(null);
      return;
    }
    const date = new Date(selectedDateStr);
    const dateParam = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    api.get(`/businesses/${params.slug}/token-preview`, { params: { date: dateParam } })
      .then(({ data }) => setTokenPreview(data.nextTokenNumber))
      .catch(() => setTokenPreview(null));
  }, [isTokenFlow, selectedDateStr, bookedAppointmentId, params.slug]);

  // Map slots by Date string
  const slotsByDateMap = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = new Date(slot.startTime).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots]);

  const availableDateKeys = useMemo(() => {
    return Array.from(slotsByDateMap.keys()).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [slotsByDateMap]);

  useEffect(() => {
    if (!slots.length) return;
    const nextDate = availableDateKeys[0];
    if (!selectedDateStr || !availableDateKeys.includes(selectedDateStr)) {
      setSelectedDateStr(nextDate);
    }
  }, [slots, availableDateKeys, selectedDateStr]);

  const selectedDateSlots = useMemo(() => {
    if (!selectedDateStr) return [] as Slot[];
    return slotsByDateMap.get(selectedDateStr) || [];
  }, [selectedDateStr, slotsByDateMap]);

  function buildTokenInfo(selectedDateKey: string | null): TokenInfo | null {
    if (!business?.category || !selectedDateKey) return null;
    const isGovt = business.category.slug === "government-office";
    const waitBase = SPECIALTY_WAIT_MINUTES[business.category.slug] ?? (isGovt ? 15 : 18);
    const dateValue = new Date(selectedDateKey);
    const queueBoost = ((dateValue.getDate() + business.name.length) % 7) * 2;
    const waitMinutes = waitBase + queueBoost;
    const tokenNumber = 102 + ((dateValue.getDate() * 7) % 25) + (business.name.length % 9);
    const prefix = isGovt ? "GOV" : business.category.slug.slice(0, 3).toUpperCase();
    return { token: `${prefix}-${String(tokenNumber).padStart(3, "0")}`, waitMinutes };
  }

  // Token flow: auto-pick the first available slot for the selected date and book it.
  async function bookTokenForDate() {
    if (!selectedDateStr || !selectedService) return;
    if (!getSession()) {
      setMessage("Please log in to get your queue token.");
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const dateSlots = slotsByDateMap.get(selectedDateStr) || [];
    if (dateSlots.length === 0) {
      setMessage("No queue slots available for this date. Please pick another date.");
      return;
    }
    await book(dateSlots[0].id);
  }

  async function payNow() {
    if (!bookedAppointmentId) return;
    setPaying(true);
    setMessage(null);
    try {
      const { data } = await api.post(`/payments/checkout/${bookedAppointmentId}`);
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setMessage("Payment session is ready — please continue from the dashboard.");
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Payment could not be started right now.");
    } finally {
      setPaying(false);
    }
  }

  async function book(slotId: string) {
    if (!getSession()) {
      setMessage("Please log in before confirming this appointment.");
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setBooking(slotId);
    setMessage(null);
    try {
      const payload: { slotId: string; notes?: string } = { slotId };
      if (occasionNote) payload.notes = occasionNote;

      const { data } = await api.post("/appointments", payload);
      setBookedAppointment(data);
      setBookedAppointmentId(data.id);
      if (isTokenFlow) {
        const estimate = buildTokenInfo(selectedDateStr);
        setTokenInfo({
          token: data.tokenNumber
            ? `TOKEN-${String(data.tokenNumber).padStart(3, "0")}`
            : estimate?.token || "TOKEN-PENDING",
          waitMinutes: estimate?.waitMinutes || 0,
        });
        const isGovt = business?.category?.slug === "government-office";
        setMessage(
          `Booked! Your token is ready. Check in at the ${isGovt ? "government office" : "clinic"} when check-in opens.`
        );
      } else if (isRestaurant) {
        setMessage("Table reserved successfully! Check your dashboard for reservation details.");
      } else {
        setMessage("Booked! Check your dashboard for details.");
      }
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      setSelectedSlotId(null);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setMessage("Your session has expired. Please log in again before confirming this appointment.");
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      } else {
        setMessage(err?.response?.data?.error || "That slot was just taken — pick another.");
      }
    } finally {
      setBooking(null);
    }
  }

  if (!business) return <p className="p-6 text-slate-300">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl py-4 text-slate-100">
      {/* Header Info */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-white">{business.name}</h1>
            {isRestaurant && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                🍽️ Restaurant Dining
              </span>
            )}
            {isSalon && (
              <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-800">
                💇 Salon & Spa
              </span>
            )}
          </div>
          {(business.address || business.mapUrl) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              {business.address?.startsWith("http") ? (
                <a
                  href={business.address}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300 underline"
                >
                  <span>📍</span> View on Google Maps
                </a>
              ) : (
                <>
                  <span>📍 {[business.address, business.city, business.state].filter(Boolean).join(", ")}</span>
                  {business.mapUrl && (
                    <a
                      href={business.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300 underline text-xs"
                    >
                      (View on Map)
                    </a>
                  )}
                </>
              )}
            </div>
          )}
          {business.description && <p className="mt-1 text-sm text-slate-300">{business.description}</p>}
        </div>
        {reviewSummary && reviewSummary.count > 0 && (
          <button
            onClick={() => setShowReviews((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <span className="text-yellow-500">★</span>
            <span className="font-medium text-gray-900">{reviewSummary.averageRating}</span>
            <span className="text-gray-400">({reviewSummary.count})</span>
          </button>
        )}
      </div>

      {showReviews && reviewSummary && (
        <div className="mt-4 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          {reviewSummary.reviews.map((r) => (
            <div key={r.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-yellow-500">{"★".repeat(r.rating)}</span>
                <span className="font-medium text-gray-900">{r.customerName}</span>
                <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.comment && <p className="mt-1 text-sm text-gray-600">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="mt-6 grid gap-6 md:grid-cols-12">
        {/* Services Sidebar */}
        <div className="md:col-span-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {isRestaurant ? "1. Select Table & Party Size" : isSalon ? "1. Select Treatment / Service" : "1. Select Service"}
            </h2>
            <div className="mt-3 space-y-2">
              {business.services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedService(s.id);
                    setMessage(null);
                    setSelectedSlotId(null);
                    setBookedAppointmentId(null);
                    setTokenInfo(null);
                  }}
                  className={`block w-full rounded-xl border p-4 text-left transition-all ${
                    selectedService === s.id
                      ? "border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-600"
                      : "bg-white hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="mt-1 text-xs text-brand-700 font-medium">
                    🎟️ {isRestaurant ? "Reservation Token" : "Token Booking Fee"}: ₹{s.tokenFee || "50"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Occasion / Special Request for Restaurants */}
          {isRestaurant && (
            <div className="rounded-xl border bg-white p-4 space-y-2 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Special Occasion / Request (Optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["🎂 Birthday", "💍 Anniversary", "🌹 Romantic Date", "💼 Business Dining", "🌿 Quiet Table"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setOccasionNote(occasionNote === tag ? "" : tag)}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                      occasionNote === tag
                        ? "bg-amber-600 text-white font-medium shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — different for token vs time-slot flows */}
        <div className="md:col-span-8 space-y-6">

          {message && (
            <div
              className={`rounded-xl border p-4 text-sm font-semibold shadow-md transition-all ${
                message.startsWith("Booked") || message.startsWith("Table") || message.startsWith("Confirmed")
                  ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                  : message.startsWith("Please log in")
                  ? "border-amber-500/50 bg-amber-950/80 text-amber-300"
                  : "border-rose-500/50 bg-rose-950/90 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>
                  {message.startsWith("Booked") || message.startsWith("Table") || message.startsWith("Confirmed")
                    ? "✓"
                    : message.startsWith("Please log in")
                    ? "⚠️"
                    : "⚠️"}
                </span>
                <span>{message}</span>
              </div>
            </div>
          )}

          {!selectedService ? (
            <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/70 p-10 text-center text-slate-300">
              <p className="text-3xl mb-2">{isTokenFlow ? "🎟️" : isRestaurant ? "🍽️" : "📅"}</p>
              <p className="font-medium">
                {isRestaurant ? "Select a table size from the left to view available reservation slots." : "Select a service to continue."}
              </p>
            </div>
          ) : isTokenFlow ? (
            /* ─── TOKEN QUEUE FLOW: pick a date, get a token ─── */
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-100">2. Pick a Date</h2>
              {availableDateKeys.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/70 p-8 text-center text-slate-300">
                  <p className="text-2xl mb-2">😕</p>
                  <p className="font-medium">No queue slots available right now.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableDateKeys.map((dk) => {
                    const d = new Date(dk);
                    const isToday = new Date().toDateString() === dk;
                    return (
                      <button
                        key={dk}
                        onClick={() => { setSelectedDateStr(dk); setBookedAppointmentId(null); setTokenInfo(null); setMessage(null); }}
                        className={`flex flex-col items-center rounded-xl border px-4 py-3 text-sm transition-all ${
                          selectedDateStr === dk
                            ? "border-brand-600 bg-brand-600 text-white shadow-md"
                            : "bg-white text-gray-900 hover:border-brand-300 hover:bg-brand-50"
                        }`}
                      >
                        <span className="text-xs font-medium uppercase opacity-80">
                          {isToday ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" })}
                        </span>
                        <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                        <span className="text-xs opacity-70">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedDateStr && !bookedAppointmentId && (
                <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Queue Date</p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(selectedDateStr).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <p className="text-sm text-gray-500">Clinic hours: 9:00 AM – 6:00 PM</p>
                      {tokenPreview !== null && (
                        <p className="mt-2 text-sm font-semibold text-brand-700">
                          Next token: TOKEN-{String(tokenPreview).padStart(3, "0")}
                        </p>
                      )}
                    </div>
                    <button
                      disabled={!!booking}
                      onClick={bookTokenForDate}
                      className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      {booking
                        ? "Getting Token…"
                        : !isAuthenticated
                        ? "Log in to Get Token"
                        : "🎟️ Get Token"}
                    </button>
                  </div>
                </div>
              )}

              {tokenInfo && bookedAppointmentId && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎟️</span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Your Queue Token</p>
                      <p className="text-3xl font-extrabold text-green-900 tracking-wide">{tokenInfo.token}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-700 rounded-lg bg-white border px-4 py-3">
                    <span>Estimated wait</span>
                    <span className="font-bold text-brand-700">
                      {queueMinutesLeft === null ? tokenInfo.waitMinutes : queueMinutesLeft} mins
                    </span>
                  </div>

                  {!notificationsEnabled && (
                    <button
                      onClick={enableNotifications}
                      className="w-full rounded-lg border py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      🔔 Enable queue alerts
                    </button>
                  )}

                  <div className="flex flex-col items-end gap-1 pt-1">
                    <p className="text-xs text-gray-500">Pay token booking fee online to confirm your spot.</p>
                    <button
                      onClick={payNow}
                      disabled={paying}
                      className="rounded-xl border border-brand-600 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                    >
                      {paying ? "Processing…" : `💳 Pay Token Fee (₹${business.services.find(s => s.id === selectedService)?.tokenFee || "50"})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ─── TIME-SLOT FLOW: restaurants, salons, etc. ─── */
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-slate-100">
                {isRestaurant ? "2. Select Reservation Date & Dining Session" : "2. Select Date & Time"}
              </h2>

              <CalendarGrid
                availableDateKeys={availableDateKeys}
                selectedDateStr={selectedDateStr}
                onSelectDate={(d) => {
                  setSelectedDateStr(d);
                  setSelectedSlotId(null);
                }}
              />

              {selectedDateStr && (
                <TimeSlotMatrix
                  slots={selectedDateSlots}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={(id) => setSelectedSlotId(id)}
                  isTokenFlow={false}
                  isRestaurant={isRestaurant}
                />
              )}

              {selectedSlotId && (
                <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                        {isRestaurant ? "Reserved Dining Slot" : "Appointment Time"}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatSlotTimeRange(selectedDateSlots.find((s) => s.id === selectedSlotId))}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selectedDateStr} {occasionNote && `• ${occasionNote}`}
                      </p>
                    </div>
                    <button
                      disabled={booking === selectedSlotId}
                      onClick={() => book(selectedSlotId)}
                      className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      {booking === selectedSlotId
                        ? "Confirming…"
                        : !isAuthenticated
                          ? "Log in to confirm"
                          : isRestaurant
                            ? "Reserve Table"
                            : "Confirm Appointment"}
                    </button>
                  </div>
                </div>
              )}

              {bookedAppointmentId && (
                <div className="rounded-2xl border-2 border-brand-300 bg-brand-50 p-5 shadow-md">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Booking confirmed</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      Your date and time are reserved. Complete payment to confirm your booking.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AddToCalendarDropdown
                      appointmentId={bookedAppointmentId}
                      serviceName={bookedAppointment?.service?.name || business.services.find(s => s.id === selectedService)?.name || "Appointment"}
                      businessName={bookedAppointment?.business?.name || business.name}
                      startTime={bookedAppointment?.slot?.startTime ? new Date(bookedAppointment.slot.startTime).toISOString() : new Date().toISOString()}
                      endTime={bookedAppointment?.slot?.endTime ? new Date(bookedAppointment.slot.endTime).toISOString() : undefined}
                      location={bookedAppointment?.business?.address || business.address}
                    />
                  </div>
                  <div className="flex flex-col sm:items-end gap-1.5">
                    <button
                      onClick={payNow}
                      disabled={paying}
                      className="rounded-xl border border-brand-600 bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      {paying ? "Processing…" : `💳 Pay Reservation Token (₹${business.services.find(s => s.id === selectedService)?.tokenFee || "50"})`}
                    </button>
                    <p className="text-[11px] text-gray-500">
                      90% refunded upon arrival & check-in verification.
                    </p>
                  </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helpers
function formatSlotTimeRange(slot?: Slot): string {
  if (!slot) return "";
  const start = new Date(slot.startTime);
  const startStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (slot.endTime) {
    const end = new Date(slot.endTime);
    const endStr = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${startStr} - ${endStr}`;
  }
  // default 30 min duration formatting if endTime not explicitly populated
  const end = new Date(start.getTime() + 30 * 60000);
  const endStr = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${startStr} - ${endStr}`;
}

// --- Interactive Month Calendar Grid ---
function CalendarGrid({
  availableDateKeys,
  selectedDateStr,
  onSelectDate,
}: {
  availableDateKeys: string[];
  selectedDateStr: string | null;
  onSelectDate: (dateStr: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (availableDateKeys.length > 0) return new Date(availableDateKeys[0]);
    return new Date();
  });

  const availableSet = useMemo(() => new Set(availableDateKeys), [availableDateKeys]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthTitle = currentMonth.toLocaleString("default", { month: "long", year: "numeric" });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayOfWeek });

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{monthTitle}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border px-2.5 py-1 text-sm font-medium hover:bg-gray-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border px-2.5 py-1 text-sm font-medium hover:bg-gray-50"
          >
            →
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {paddingDays.map((_, idx) => (
          <div key={`pad-${idx}`} className="h-10" />
        ))}

        {days.map((dayNum) => {
          const dateObj = new Date(year, month, dayNum);
          const dateStr = dateObj.toDateString();
          const isAvailable = availableSet.has(dateStr);
          const isSelected = selectedDateStr === dateStr;

          return (
            <button
              key={dayNum}
              disabled={!isAvailable}
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex h-10 flex-col items-center justify-center rounded-xl text-sm font-medium transition-all ${
                isSelected
                  ? "bg-brand-600 text-white font-bold shadow-md scale-105"
                  : isAvailable
                  ? "bg-brand-50 text-brand-900 hover:bg-brand-100 hover:scale-105"
                  : "text-gray-300 cursor-not-allowed"
              }`}
            >
              <span>{dayNum}</span>
              {isAvailable && !isSelected && (
                <span className="h-1 w-1 rounded-full bg-brand-600 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Categorized Time Slot Matrix Component ---
function TimeSlotMatrix({
  slots,
  selectedSlotId,
  onSelectSlot,
  isRestaurant = false,
}: {
  slots: Slot[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  isTokenFlow: boolean;
  isRestaurant?: boolean;
}) {
  const [activeSession, setActiveSession] = useState<"all" | "breakfast" | "lunch" | "hitea" | "dinner">("all");

  const grouped = useMemo(() => {
    const breakfast: Slot[] = [];
    const lunch: Slot[] = [];
    const hitea: Slot[] = [];
    const dinner: Slot[] = [];

    for (const slot of slots) {
      const hour = new Date(slot.startTime).getHours();
      if (hour >= 8 && hour < 12) breakfast.push(slot);
      else if (hour >= 12 && hour < 16) lunch.push(slot);
      else if (hour >= 16 && hour < 19) hitea.push(slot);
      else dinner.push(slot);
    }
    return { breakfast, lunch, hitea, dinner };
  }, [slots]);

  if (!slots.length) {
    return (
      <div className="rounded-xl border bg-white p-6 text-center text-gray-500 text-sm">
        No open slots available for this date.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900">
          {isRestaurant ? "Available Dining Time Slots" : "Available Time Slots"}
        </h3>

        {/* Meal Session Filter Tabs for Restaurants */}
        {isRestaurant && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSession("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                activeSession === "all"
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Sessions
            </button>
            {grouped.breakfast.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSession("breakfast")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeSession === "breakfast"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                🌅 Breakfast
              </button>
            )}
            {grouped.lunch.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSession("lunch")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeSession === "lunch"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                ☀️ Lunch
              </button>
            )}
            {grouped.hitea.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSession("hitea")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeSession === "hitea"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                ☕ Hi-Tea
              </button>
            )}
            {grouped.dinner.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSession("dinner")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  activeSession === "dinner"
                    ? "bg-indigo-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                🌙 Dinner
              </button>
            )}
          </div>
        )}
      </div>

      {/* Breakfast Section */}
      {grouped.breakfast.length > 0 && (activeSession === "all" || activeSession === "breakfast") && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <span>🌅</span> {isRestaurant ? "Breakfast / Brunch (08:00 AM – 11:30 AM)" : "Morning (08:00 AM – 12:00 PM)"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {grouped.breakfast.map((slot) => (
              <SlotPill
                key={slot.id}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lunch Section */}
      {grouped.lunch.length > 0 && (activeSession === "all" || activeSession === "lunch") && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
            <span>☀️</span> {isRestaurant ? "Lunch Session (12:00 PM – 03:30 PM)" : "Afternoon (12:00 PM – 04:00 PM)"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {grouped.lunch.map((slot) => (
              <SlotPill
                key={slot.id}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hi-Tea Section */}
      {grouped.hitea.length > 0 && (activeSession === "all" || activeSession === "hitea") && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
            <span>☕</span> {isRestaurant ? "Hi-Tea & Sundowner (04:00 PM – 06:30 PM)" : "Late Afternoon (04:00 PM – 06:30 PM)"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {grouped.hitea.map((slot) => (
              <SlotPill
                key={slot.id}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dinner Section */}
      {grouped.dinner.length > 0 && (activeSession === "all" || activeSession === "dinner") && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
            <span>🌙</span> {isRestaurant ? "Dinner Session (07:00 PM – 11:00 PM)" : "Evening (07:00 PM onwards)"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {grouped.dinner.map((slot) => (
              <SlotPill
                key={slot.id}
                slot={slot}
                isSelected={selectedSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SlotPill({
  slot,
  isSelected,
  onSelect,
}: {
  slot: Slot;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const timeRange = formatSlotTimeRange(slot);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-3 text-left transition-all ${
        isSelected
          ? "border-brand-600 bg-brand-600 text-white font-medium shadow-sm ring-2 ring-brand-600"
          : "bg-white border-gray-200 text-gray-800 hover:border-brand-300 hover:bg-brand-50"
      }`}
    >
      <div className="text-sm font-semibold">{timeRange}</div>
      <div className={`mt-0.5 text-xs truncate ${isSelected ? "text-brand-100" : "text-gray-400"}`}>
        with {slot.staff.user.name}
      </div>
    </button>
  );
}