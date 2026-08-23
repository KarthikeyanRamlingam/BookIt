"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getSession } from "@/lib/api";

type BusinessStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REJECTED";

interface BusinessApplication {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  timezone: string;
  status: BusinessStatus;
  createdAt: string;
  category?: { name: string } | null;
  owner: { name: string; email: string; phone?: string | null };
  _count: { services: number; staff: number; appointments: number };
}

const STATUS_LABELS: Record<BusinessStatus, string> = {
  PENDING_VERIFICATION: "Pending",
  ACTIVE: "Approved",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<BusinessApplication[]>([]);
  const [filter, setFilter] = useState<BusinessStatus>("PENDING_VERIFICATION");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "PLATFORM_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    loadApplications("PENDING_VERIFICATION");
  }, [router]);

  async function loadApplications(status: BusinessStatus, query = submittedSearch) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/admin/businesses", { params: { status, q: query || undefined } });
      setApplications(data);
      setFilter(status);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not load business applications.");
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
    loadApplications(filter, search.trim());
  }

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setActingId(id);
    setError(null);
    try {
      await api.patch(`/admin/businesses/${id}/decision`, { action });
      setApplications((current) => current.filter((application) => application.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not update this application.");
    } finally {
      setActingId(null);
    }
  }

  async function removeBusiness(application: BusinessApplication) {
    const confirmed = window.confirm(`Delete ${application.name}? This permanently removes its services, bookings, staff, and queue data.`);
    if (!confirmed) return;

    setActingId(application.id);
    setError(null);
    try {
      await api.delete(`/admin/businesses/${application.id}`);
      setApplications((current) => current.filter((item) => item.id !== application.id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not delete this business.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col gap-3 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Platform control</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Business approvals</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">Review new businesses before they become visible to customers.</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-widest text-blue-300">Showing</p>
          <p className="mt-1 text-lg font-black text-white">{applications.length} {STATUS_LABELS[filter].toLowerCase()}</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as BusinessStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => loadApplications(status)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              filter === status ? "bg-blue-600 text-white" : "border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="business-search" className="sr-only">Search businesses</label>
        <input
          id="business-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by business, owner, category, or location"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
        />
        <button type="submit" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">Search</button>
        {submittedSearch && (
          <button
            type="button"
            onClick={() => { setSearch(""); setSubmittedSearch(""); loadApplications(filter, ""); }}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white"
          >
            Clear
          </button>
        )}
      </form>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-400">Loading applications...</div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center">
          <p className="text-lg font-bold text-white">No {STATUS_LABELS[filter].toLowerCase()} applications</p>
          <p className="mt-2 text-sm text-slate-500">New submissions will appear here automatically when you refresh this view.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(
            applications.reduce<Record<string, BusinessApplication[]>>((groups, application) => {
              const category = application.category?.name || "Uncategorized";
              (groups[category] ||= []).push(application);
              return groups;
            }, {})
          ).map(([category, categoryApplications]) => (
            <section key={category}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-black text-white">{category}</h2>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400">{categoryApplications.length}</span>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                {categoryApplications.map((application) => (
            <article key={application.id} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-400">{application.category?.name || "Uncategorized"}</p>
                  <h2 className="mt-2 text-xl font-black text-white">{application.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">/{application.slug}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${application.status === "PENDING_VERIFICATION" ? "bg-amber-950/60 text-amber-300" : application.status === "ACTIVE" ? "bg-emerald-950/60 text-emerald-300" : "bg-slate-800 text-slate-300"}`}>
                  {STATUS_LABELS[application.status]}
                </span>
              </div>

              <div className="mt-5 grid gap-3 border-y border-slate-800 py-4 text-sm sm:grid-cols-2">
                <div><p className="text-xs uppercase tracking-wider text-slate-500">Owner</p><p className="mt-1 font-semibold text-slate-200">{application.owner.name}</p><p className="text-slate-400">{application.owner.email}</p></div>
                <div><p className="text-xs uppercase tracking-wider text-slate-500">Location</p><p className="mt-1 text-slate-200">{[application.address, application.city, application.state].filter(Boolean).join(", ") || "Not provided"}</p><p className="text-slate-500">{application.timezone}</p></div>
              </div>

              {application.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">{application.description}</p>}
              <div className="mt-5 flex gap-4 text-xs text-slate-500"><span>{application._count.services} services</span><span>{application._count.staff} staff</span><span>{application._count.appointments} appointments</span><span>{new Date(application.createdAt).toLocaleDateString()}</span></div>

              {application.status === "PENDING_VERIFICATION" && (
                <div className="mt-6 flex gap-3">
                  <button disabled={actingId === application.id} onClick={() => decide(application.id, "APPROVE")} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">Approve</button>
                  <button disabled={actingId === application.id} onClick={() => decide(application.id, "REJECT")} className="flex-1 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-900/40 disabled:opacity-50">Reject</button>
                </div>
              )}
              <button
                disabled={actingId === application.id}
                onClick={() => removeBusiness(application)}
                className="mt-3 w-full rounded-xl border border-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/30 disabled:opacity-50"
              >
                Delete business
              </button>
            </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
