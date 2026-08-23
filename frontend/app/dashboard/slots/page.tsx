"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface StaffMember {
  id: string;
  title?: string | null;
  user: { id: string; name: string };
}

interface Service {
  id: string;
  name: string;
  durationMin: number;
  active: boolean;
}

export default function SlotsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [daysAhead, setDaysAhead] = useState(14);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ createdCount: number } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get("/staff"), api.get("/services")])
      .then(([staffRes, svcRes]) => {
        setStaff(staffRes.data);
        setServices(svcRes.data.filter((s: Service) => s.active));
      })
      .catch((e) => setError(e?.response?.data?.error || "Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setResult(null);
    setGenError(null);
    try {
      const { data } = await api.post("/slots/generate", {
        staffId,
        serviceId,
        daysAhead,
      });
      setResult(data);
    } catch (e: any) {
      setGenError(e?.response?.data?.error || "Failed to generate slots");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        Loading…
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === serviceId);

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Generate Slots</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Create open appointment slots for a staff member and service combination.
          Safe to re-run — existing slots are skipped.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {staff.length === 0 || services.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-500">
          <p className="text-4xl mb-3">⚡</p>
          <p className="font-medium">Setup required first</p>
          <p className="text-sm mt-1">
            You need at least one{" "}
            {staff.length === 0 && (
              <a href="/dashboard/staff" className="text-brand-600 underline">
                staff member
              </a>
            )}
            {staff.length === 0 && services.length === 0 && " and "}
            {services.length === 0 && (
              <a href="/dashboard/services" className="text-brand-600 underline">
                active service
              </a>
            )}
            {" "}before generating slots. Also make sure{" "}
            <a href="/dashboard/hours" className="text-brand-600 underline">
              business hours
            </a>{" "}
            are configured.
          </p>
        </div>
      ) : (
        <form onSubmit={handleGenerate} className="space-y-5">
          <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Staff member *</label>
              <select
                required
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">Select a staff member…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user.name}
                    {s.title ? ` — ${s.title}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Service *</label>
              <select
                required
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">Select a service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMin} min)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Days ahead *</label>
              <input
                type="number"
                required
                min={1}
                max={60}
                value={daysAhead}
                onChange={(e) => setDaysAhead(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Generate slots for the next {daysAhead} days (max 60). Slots will be spaced{" "}
                {selectedService ? `every ${selectedService.durationMin} min` : "by service duration"} within business hours.
              </p>
            </div>
          </div>

          {/* Info box */}
          <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 text-sm text-brand-700">
            <p className="font-medium">ℹ️ How this works</p>
            <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs text-brand-600">
              <li>Slots are generated within your configured business hours</li>
              <li>Already-existing slots are automatically skipped</li>
              <li>You can re-run this at any time to extend the booking window</li>
              <li>Business hours must be set before generating slots</li>
            </ul>
          </div>

          {genError && <p className="text-sm text-red-600">{genError}</p>}

          {result && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              ✓ Created <strong>{result.createdCount}</strong> new slot{result.createdCount !== 1 ? "s" : ""}.
              {result.createdCount === 0 && " All slots for this period already exist."}
            </div>
          )}

          <button
            type="submit"
            disabled={generating}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating…" : "Generate slots"}
          </button>
        </form>
      )}
    </div>
  );
}
