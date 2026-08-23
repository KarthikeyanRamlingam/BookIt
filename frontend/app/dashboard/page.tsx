"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, getSession, AuthUser } from "@/lib/api";
import { enablePushNotifications, supportsPush } from "@/lib/push";
import QRScannerModal from "@/components/QRScannerModal";
import AddToCalendarDropdown from "@/components/AddToCalendarDropdown";

interface Appointment {
  id: string;
  tokenNumber?: number | null;
  status: string;
  service: { name: string; price: string };
  slot: { startTime: string; endTime?: string };
  business?: { name: string; address?: string; category?: { slug: string } };
  staff?: { user: { name: string } };
  customer?: { name: string; email: string };
  payment?: {
    status: string;
    amount?: string;
    refundAmount?: string | null;
    refundStatus?: string | null;
  } | null;
  review?: { id: string; rating: number } | null;
  checkIn?: { status: string; rejectionReason?: string | null } | null;
}

interface DashboardStats {
  today: { total: number; checkedIn: number; attended: number; noShow: number; cancelled: number };
  upcoming: number;
  pendingCheckIns: number;
}

interface LiveQueueAppointment {
  id: string;
  tokenNumber: number | null;
  customer: { name: string };
  service: { name: string; durationMin: number };
  staff: { user: { name: string } };
  slot: { startTime: string; endTime: string };
  checkedInAt: string;
  queuePosition?: number;
}

interface LiveQueue {
  updatedAt: string;
  current: LiveQueueAppointment | null;
  waiting: LiveQueueAppointment[];
  totalWaiting: number;
}

interface MyLiveQueue {
  updatedAt: string;
  appointmentStatus: string;
  serviceName: string;
  currentServiceName: string | null;
  currentTokenNumber: number | null;
  myTokenNumber: number | null;
  myQueueNumber: number | null;
  peopleAhead: number;
  waitingCount: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  CONFIRMED:        { label: "Confirmed",         bg: "bg-emerald-950/60 border border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
  CHECK_IN_PENDING: { label: "Check-in Pending",  bg: "bg-amber-950/60 border border-amber-500/30",     text: "text-amber-400",   dot: "bg-amber-400"   },
  CHECKED_IN:       { label: "Checked In",        bg: "bg-teal-950/60 border border-teal-500/30",       text: "text-teal-400",    dot: "bg-teal-400"    },
  ATTENDED:         { label: "Attended",          bg: "bg-purple-950/60 border border-purple-500/30",   text: "text-purple-400",  dot: "bg-purple-400"  },
  COMPLETED:        { label: "Completed",         bg: "bg-blue-950/60 border border-blue-500/30",       text: "text-blue-400",    dot: "bg-blue-400"    },
  CANCELLED:        { label: "Cancelled",         bg: "bg-red-950/60 border border-red-500/30",         text: "text-red-400",     dot: "bg-red-400"     },
  NO_SHOW:          { label: "No Show",           bg: "bg-slate-800/80 border border-slate-700",        text: "text-slate-400",   dot: "bg-slate-400"   },
  PENDING:          { label: "Pending",           bg: "bg-slate-800/80 border border-slate-700",        text: "text-slate-400",   dot: "bg-slate-400"   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "bg-slate-800 border border-slate-700", text: "text-slate-400", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PaymentBadge({ payment }: { payment: Appointment["payment"] }) {
  if (payment?.refundStatus === "REFUNDED_90_PERCENT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-950/60 border border-teal-500/30 px-2.5 py-0.5 text-xs font-semibold text-teal-300">
        🎟️ 90% Refunded
      </span>
    );
  }
  if (payment?.refundStatus === "RETAINED_NO_SHOW") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-950/60 border border-red-500/30 px-2.5 py-0.5 text-xs font-semibold text-red-400">
        🚫 Token Retained
      </span>
    );
  }
  if (payment?.status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
        ✓ Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/60 border border-amber-500/30 px-2.5 py-0.5 text-xs font-medium text-amber-300">
      ● Unpaid
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [activeScanAppointment, setActiveScanAppointment] = useState<Appointment | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [liveQueue, setLiveQueue] = useState<LiveQueue | null>(null);
  const [myLiveQueue, setMyLiveQueue] = useState<MyLiveQueue | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const loadData = useCallback(async (role: string) => {
    try {
      if (role === "CUSTOMER") {
        const { data } = await api.get("/appointments/mine");
        setAppointments(data);
      } else {
        const [apptRes, statsRes] = await Promise.all([
          api.get("/business/appointments"),
          api.get("/business/dashboard"),
        ]);
        setAppointments(apptRes.data);
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push("/login"); return; }
    setUser(session.user);
    loadData(session.user.role);
    if (searchParams.get("registered") === "1") {
      showToast("Business registered! Pending verification.");
    }
  }, [router, loadData, searchParams]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      loadData(user.role);
    }, 5000);

    return () => clearInterval(interval);
  }, [user, loadData]);

  useEffect(() => {
    if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) return;

    let active = true;
    const loadQueue = async () => {
      try {
        const { data } = await api.get("/business/queue/live");
        if (active) setLiveQueue(data);
      } catch (err) {
        console.error("Failed to load live queue:", err);
      }
    };

    loadQueue();
    const interval = setInterval(loadQueue, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "CUSTOMER") return;
    const activeAppointment = appointments.find((appointment) =>
      ["CONFIRMED", "CHECK_IN_PENDING", "CHECKED_IN"].includes(appointment.status) &&
      ["government-office", "doctor-appointment", "general-practitioners", "cardiologists", "pediatricians", "dermatologists", "neurologists", "endocrinologists", "gastroenterologists", "psychiatrists", "orthopedics", "dentists", "ophthalmologists", "gynecologists"].includes(appointment.business?.category?.slug || "")
    );
    if (!activeAppointment) {
      setMyLiveQueue(null);
      return;
    }

    let active = true;
    const loadMyQueue = async () => {
      try {
        const { data } = await api.get(`/user/queue/${activeAppointment.id}`);
        if (active) setMyLiveQueue(data);
      } catch (err) {
        console.error("Failed to load personal live queue:", err);
      }
    };

    loadMyQueue();
    const interval = setInterval(loadMyQueue, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, appointments]);

  async function cancel(id: string) {
    try {
      await api.post(`/appointments/${id}/cancel`);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "CANCELLED" } : a)));
      showToast("Appointment cancelled.");
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Could not cancel appointment", "error");
    }
  }

  async function markAttended(id: string) {
    try {
      await api.post(`/business/appointments/${id}/attended`);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: "ATTENDED" } : a)));
      showToast("Marked as Attended ✓");
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Could not mark attended", "error");
    }
  }

  async function payNow(id: string) {
    setPayingId(id);
    try {
      const { data } = await api.post(`/payments/checkout/${id}`);
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      alert(err?.response?.data?.error || "Could not start checkout");
      setPayingId(null);
    }
  }

  async function submitReview(appointmentId: string, rating: number, comment: string) {
    try {
      const review = await api.post("/reviews", { appointmentId, rating, comment: comment || undefined });
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, review: review.data } : a))
      );
      setReviewingId(null);
      showToast("Review submitted! Thank you ⭐");
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Could not submit review", "error");
    }
  }

  async function enableReminders() {
    try {
      await enablePushNotifications(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "");
      setPushEnabled(true);
      showToast("Appointment reminders enabled.");
    } catch (err: any) {
      showToast(err?.message || "Could not enable appointment reminders.", "error");
    }
  }

  if (!user) return null;
  const isAdmin = user.role === "ADMIN" || user.role === "STAFF";
  const upcoming = appointments.filter((a) => !["CANCELLED", "COMPLETED", "ATTENDED", "NO_SHOW"].includes(a.status));
  const past = appointments.filter((a) => ["CANCELLED", "COMPLETED", "ATTENDED", "NO_SHOW"].includes(a.status));

  return (
    <div className="min-h-full max-w-5xl mx-auto space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-2xl backdrop-blur-md animate-fadeIn ${
          toast.type === "error" ? "bg-red-600/90 border border-red-500/50" : "bg-emerald-600/90 border border-emerald-500/50"
        }`}>
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {isAdmin ? "Business Dashboard" : "My Appointments"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isAdmin ? "Manage live appointments and verify customer check-ins" : "View your upcoming schedules, scan check-in QR codes, and sync calendars"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href="/dashboard/checkin" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 shadow-sm hover:bg-slate-800 hover:text-white transition-colors">
              📱 Check-in & QR
            </Link>
          )}
          {user.role === "CUSTOMER" && (
            <div className="flex items-center gap-3">
              {supportsPush() && !pushEnabled && (
                <button onClick={enableReminders} className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/50 transition-colors">
                  Enable reminders
                </button>
              )}
              <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors">
                ＋ Book Appointment
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Admin Stat Cards */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Today Total" value={stats.today.total} icon="📅" color="blue" />
          <StatCard label="Checked In" value={stats.today.checkedIn} icon="✅" color="teal" />
          <StatCard label="Attended" value={stats.today.attended} icon="🏁" color="purple" />
          <StatCard label="No Shows" value={stats.today.noShow} icon="🚫" color="red" />
          <StatCard label="Upcoming" value={stats.upcoming} icon="🔜" color="green" />
        </div>
      )}

      {/* Admin Pending Check-ins Alert */}
      {isAdmin && stats && stats.pendingCheckIns > 0 && (
        <Link href="/dashboard/checkin" className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/40 p-4 text-sm text-amber-200 hover:bg-amber-900/40 transition-colors shadow-lg shadow-amber-950/20">
          <span className="text-xl animate-bounce">🔔</span>
          <div>
            <p className="font-semibold">{stats.pendingCheckIns} customer{stats.pendingCheckIns > 1 ? "s" : ""} waiting for check-in</p>
            <p className="text-xs text-amber-400/80 mt-0.5">Click to verify customer arrivals and mark attendance</p>
          </div>
          <span className="ml-auto text-sm font-bold text-amber-400">Review →</span>
        </Link>
      )}

      {isAdmin && <LiveQueuePanel queue={liveQueue} />}
      {!isAdmin && myLiveQueue && <MyLiveQueuePanel queue={myLiveQueue} />}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading appointments…</p>
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState isCustomer={user.role === "CUSTOMER"} />
      ) : isAdmin ? (
        <AdminList appointments={appointments} isAdmin={isAdmin} onMarkAttended={markAttended} onCancel={cancel} />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-4">
                {upcoming.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    payingId={payingId}
                    reviewingId={reviewingId}
                    onPay={payNow}
                    onCancel={cancel}
                    onScan={setActiveScanAppointment}
                    onReview={setReviewingId}
                    onSubmitReview={submitReview}
                  />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-slate-600" />
                Past Appointments ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    payingId={payingId}
                    reviewingId={reviewingId}
                    onPay={payNow}
                    onCancel={cancel}
                    onScan={setActiveScanAppointment}
                    onReview={setReviewingId}
                    onSubmitReview={submitReview}
                    isPast
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* QR Scanner Modal */}
      {activeScanAppointment && (
        <QRScannerModal
          isOpen={!!activeScanAppointment}
          onClose={() => setActiveScanAppointment(null)}
          appointmentId={activeScanAppointment.id}
          serviceName={activeScanAppointment.service.name}
          businessName={activeScanAppointment.business?.name}
          onSuccess={() => {
            showToast("Check-in submitted! Staff will confirm your arrival.");
            setAppointments((prev) =>
              prev.map((appt) =>
                appt.id === activeScanAppointment.id ? { ...appt, status: "CHECK_IN_PENDING" } : appt
              )
            );
            setActiveScanAppointment(null);
          }}
        />
      )}
    </div>
  );
}

function LiveQueuePanel({ queue }: { queue: LiveQueue | null }) {
  return (
    <section className="rounded-2xl border border-blue-500/25 bg-slate-900/90 p-6 shadow-xl shadow-blue-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            <h2 className="text-lg font-bold text-white">Live token queue</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Verified arrivals, ordered by check-in time.</p>
        </div>
        {queue && <span className="text-xs text-slate-500">Updated {new Date(queue.updatedAt).toLocaleTimeString()}</span>}
      </div>

      {!queue ? (
        <p className="mt-5 text-sm text-slate-400">Loading live queue...</p>
      ) : !queue.current ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
          No checked-in customers are waiting right now.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Now serving</p>
            <p className="mt-2 text-3xl font-black text-white">Token #{queue.current.tokenNumber}</p>
            <p className="mt-1 text-sm text-emerald-200">{queue.current.service.name}</p>
            <p className="mt-3 text-xs text-emerald-300/70">Staff: {queue.current.staff.user.name}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Waiting next</p>
              <span className="text-xs text-blue-300">{queue.totalWaiting} waiting</span>
            </div>
            {queue.waiting.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Queue is clear after the current customer.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {queue.waiting.slice(0, 4).map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Token #{appointment.tokenNumber}</p>
                      <p className="text-xs text-slate-500">{appointment.service.name}</p>
                    </div>
                    <span className="text-xs font-bold text-blue-300">#{appointment.queuePosition}</span>
                  </div>
                ))}
                {queue.waiting.length > 4 && <p className="pt-1 text-xs text-slate-500">+ {queue.waiting.length - 4} more</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MyLiveQueuePanel({ queue }: { queue: MyLiveQueue }) {
  const pending = queue.appointmentStatus === "WAITING_FOR_CHECK_IN";
  return (
    <section className="rounded-2xl border border-teal-500/25 bg-slate-900/90 p-6 shadow-xl shadow-teal-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${pending ? "bg-amber-400" : "animate-pulse bg-teal-400"}`} />
            <h2 className="text-lg font-bold text-white">Live queue status</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">{queue.serviceName}</p>
        </div>
        <span className="text-xs text-slate-500">Updated {new Date(queue.updatedAt).toLocaleTimeString()}</span>
      </div>

      {pending ? (
        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-950/30 p-4 text-sm text-amber-200">
          Your token is reserved. Check in at the business when check-in opens.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-teal-950/40 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-400">Your position</p>
            <p className="mt-1 text-3xl font-black text-white">Token #{queue.myTokenNumber}</p>
          </div>
          <div className="rounded-xl bg-slate-800/70 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">People ahead</p>
            <p className="mt-1 text-3xl font-black text-white">{queue.peopleAhead}</p>
          </div>
          <div className="rounded-xl bg-slate-800/70 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Now serving</p>
            <p className="mt-2 truncate text-sm font-bold text-white">
              {queue.currentTokenNumber ? `Token #${queue.currentTokenNumber}` : "No one"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">{queue.currentServiceName || ""}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function AppointmentCard({
  appointment: a,
  payingId,
  reviewingId,
  onPay,
  onCancel,
  onScan,
  onReview,
  onSubmitReview,
  isPast = false,
}: {
  appointment: Appointment;
  payingId: string | null;
  reviewingId: string | null;
  onPay: (id: string) => void;
  onCancel: (id: string) => void;
  onScan: (a: Appointment) => void;
  onReview: (id: string | null) => void;
  onSubmitReview: (id: string, rating: number, comment: string) => Promise<void>;
  isPast?: boolean;
}) {
  const dt = new Date(a.slot.startTime);
  const mon = dt.toLocaleDateString([], { month: "short" });
  const day = dt.getDate();
  const dateStr = dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const showActions = a.status !== "CANCELLED";

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl transition-all hover:border-slate-700 ${isPast ? "opacity-75 bg-slate-900/50" : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 pt-6 pb-5">
        <div className="flex items-start gap-4">
          {/* Date Tile */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl bg-slate-800 border border-slate-700/80 w-16 h-16 text-center shadow-inner">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wide leading-none">{mon}</span>
            <span className="text-2xl font-black text-white leading-tight mt-0.5">{day}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white capitalize">{a.service.name}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-slate-400">
              {a.business?.name && (
                <span className="flex items-center gap-1 text-slate-300">
                  <span>🏢</span> {a.business.name}
                </span>
              )}
              {a.staff?.user.name && (
                <span className="flex items-center gap-1">
                  <span>👤</span> {a.staff.user.name}
                </span>
              )}
              <span className="flex items-center gap-1 font-medium text-blue-300">
                <span>🕐</span> {dateStr} at {timeStr}
              </span>
            </div>
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
          <StatusBadge status={a.status} />
          <PaymentBadge payment={a.payment} />
        </div>
      </div>

      {/* Status banners */}
      {a.status === "CHECK_IN_PENDING" && (
        <div className="mx-6 mb-4 flex items-center gap-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 px-4 py-3 text-sm text-amber-200">
          <span className="animate-spin text-base">⏳</span>
          <span className="font-medium">Awaiting staff confirmation…</span>
          <span className="text-xs text-amber-400/70 ml-auto">Takes ~1-2 mins</span>
        </div>
      )}
      {a.status === "CHECKED_IN" && (
        <div className="mx-6 mb-4 flex items-center gap-2.5 rounded-xl bg-teal-950/40 border border-teal-500/30 px-4 py-3 text-sm text-teal-300 font-medium">
          <span>✅</span> You are checked in — please relax and wait to be called!
        </div>
      )}

      {/* Action Row */}
      {showActions && (
        <div className="border-t border-slate-800/80 px-6 py-3.5 flex flex-wrap items-center gap-3 bg-slate-950/40 rounded-b-2xl">
          {a.status === "CONFIRMED" && (
            <button
              onClick={() => onScan(a)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4m10-16h4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4M9 9h1v1H9V9zm5 0h1v1h-1V9zm-5 5h1v1H9v-1zm5 0h1v1h-1v-1z" />
              </svg>
              Scan QR to Check In
            </button>
          )}

          {a.status === "CONFIRMED" && a.payment?.status !== "PAID" && (
            <button
              onClick={() => onPay(a.id)}
              disabled={payingId === a.id}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-60 active:scale-95 transition-all"
            >
              {payingId === a.id ? "Redirecting…" : "💳 Pay Now"}
            </button>
          )}

          <AddToCalendarDropdown
            appointmentId={a.id}
            serviceName={a.service.name}
            businessName={a.business?.name}
            startTime={new Date(a.slot.startTime).toISOString()}
            endTime={a.slot.endTime ? new Date(a.slot.endTime).toISOString() : undefined}
            location={a.business?.address}
          />

          {(a.status === "ATTENDED" || a.status === "COMPLETED") && !a.review && (
            <button
              onClick={() => onReview(reviewingId === a.id ? null : a.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition-colors"
            >
              ⭐ Leave Review
            </button>
          )}
          {a.review && (
            <span className="flex items-center gap-1 text-sm text-amber-400 font-medium">
              {"★".repeat(a.review.rating)}
              <span className="text-slate-400 text-xs ml-1 font-normal">(Rated {a.review.rating}/5)</span>
            </span>
          )}

          <div className="flex-1" />

          {a.status === "CONFIRMED" && (
            <button
              onClick={() => onCancel(a.id)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
            >
              ✕ Cancel
            </button>
          )}
        </div>
      )}

      {/* Review Section */}
      {reviewingId === a.id && (
        <div className="border-t border-slate-800 px-6 py-6 bg-slate-950/80 rounded-b-2xl">
          <ReviewForm onSubmit={(r, c) => onSubmitReview(a.id, r, c)} onCancel={() => onReview(null)} />
        </div>
      )}
    </div>
  );
}

function AdminList({
  appointments,
  isAdmin,
  onMarkAttended,
  onCancel,
}: {
  appointments: Appointment[];
  isAdmin: boolean;
  onMarkAttended: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {appointments.map((a) => {
        const dt = new Date(a.slot.startTime);
        return (
          <div key={a.id} className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-md hover:border-slate-700 transition-all">
            <div className="flex items-center gap-5 px-6 py-4">
              <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl bg-slate-800 border border-slate-700/80 w-12 h-12 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                  {dt.toLocaleDateString([], { month: "short" })}
                </span>
                <span className="text-lg font-black text-white leading-tight mt-0.5">{dt.getDate()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-bold text-white capitalize">{a.service.name}</span>
                  {a.customer && <span className="text-sm text-slate-300">👤 {a.customer.name}</span>}
                  <span className="text-sm text-slate-400">
                    🕐 {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {dt.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <StatusBadge status={a.status} />
                  <PaymentBadge payment={a.payment} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.status === "CHECKED_IN" && isAdmin && (
                  <button
                    onClick={() => onMarkAttended(a.id)}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 shadow-md shadow-purple-600/30 transition-colors"
                  >
                    ✓ Mark Attended
                  </button>
                )}
                {a.status === "CONFIRMED" && isAdmin && (
                  <button
                    onClick={() => onCancel(a.id)}
                    className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/40 transition-colors"
                  >
                    ✕ Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ isCustomer }: { isCustomer: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/60 py-20 px-8 text-center shadow-xl">
      <div className="text-5xl mb-4">📅</div>
      <h3 className="text-xl font-bold text-white mb-1">No appointments yet</h3>
      <p className="text-sm text-slate-400 max-w-xs">
        {isCustomer
          ? "Browse verified local services and schedule your next appointment in seconds."
          : "No appointments scheduled for your business yet."}
      </p>
      {isCustomer && (
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors">
          Browse Services →
        </Link>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-950/30   border-blue-500/30   text-blue-400",
    teal:   "bg-teal-950/30   border-teal-500/30   text-teal-400",
    purple: "bg-purple-950/30 border-purple-500/30 text-purple-400",
    red:    "bg-red-950/30    border-red-500/30    text-red-400",
    green:  "bg-emerald-950/30 border-emerald-500/30 text-emerald-400",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] ?? "bg-slate-900 border-slate-800 text-slate-300"}`}>
      <div className="text-2xl mb-3">{icon}</div>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="text-xs font-semibold mt-1 opacity-80 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function ReviewForm({ onSubmit, onCancel }: { onSubmit: (r: number, c: string) => Promise<void>; onCancel: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(rating, comment); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-lg">
      <div>
        <p className="text-sm font-semibold text-slate-200 mb-2">Rate your experience</p>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`text-3xl leading-none transition-transform hover:scale-110 ${n <= rating ? "text-amber-400" : "text-slate-700"}`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm text-slate-400 font-medium">{rating} out of 5 stars</span>
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your feedback or experience..."
        rows={3}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none transition-all"
      />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? "Submitting…" : "Submit Review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}