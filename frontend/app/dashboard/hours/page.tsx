"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface BusinessHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface MealBreaks {
  breakfastStart: string;
  breakfastEnd: string;
  lunchStart: string;
  lunchEnd: string;
  dinnerStart: string;
  dinnerEnd: string;
}

const defaultHours: BusinessHour[] = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
];

export default function BusinessHoursPage() {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breaks, setBreaks] = useState<MealBreaks>({
    breakfastStart: "", breakfastEnd: "", lunchStart: "", lunchEnd: "", dinnerStart: "", dinnerEnd: "",
  });

  useEffect(() => {
    Promise.all([api.get("/businesses/mine"), api.get("/business/settings")])
      .then(([businessResponse, settingsResponse]) => {
        const data = businessResponse.data;
        const settings = settingsResponse.data;
        setBreaks({
          breakfastStart: settings.breakfastStart || "", breakfastEnd: settings.breakfastEnd || "",
          lunchStart: settings.lunchStart || "", lunchEnd: settings.lunchEnd || "",
          dinnerStart: settings.dinnerStart || "", dinnerEnd: settings.dinnerEnd || "",
        });
        if (data.businessHours && data.businessHours.length > 0) {
          setHours(
            data.businessHours.map((h: BusinessHour) => ({
              dayOfWeek: h.dayOfWeek,
              startTime: h.startTime,
              endTime: h.endTime,
            }))
          );
        } else {
          setHours(defaultHours);
        }
      })
      .catch((e) => setError(e?.response?.data?.error || "Failed to load business"))
      .finally(() => setLoading(false));
  }, []);

  function isEnabled(day: number) {
    return hours.some((h) => h.dayOfWeek === day);
  }

  function toggleDay(day: number) {
    if (isEnabled(day)) {
      setHours((prev) => prev.filter((h) => h.dayOfWeek !== day));
    } else {
      setHours((prev) =>
        [...prev, { dayOfWeek: day, startTime: "09:00", endTime: "18:00" }].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek
        )
      );
    }
  }

  function updateHour(day: number, field: "startTime" | "endTime", value: string) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === day ? { ...h, [field]: value } : h))
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/businesses/hours", { hours });
      await api.patch("/business/settings", Object.fromEntries(
        Object.entries(breaks).map(([key, value]) => [key, value || null])
      ));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to update hours");
    } finally {
      setSaving(false);
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

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Business Hours</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Set the days and times your business is open. Slots will be generated within these hours.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <div className="rounded-xl border bg-white shadow-sm divide-y">
          {DAYS.map((dayName, dayIndex) => {
            const enabled = isEnabled(dayIndex);
            const hour = hours.find((h) => h.dayOfWeek === dayIndex);

            return (
              <div
                key={dayIndex}
                className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                  enabled ? "" : "bg-gray-50"
                }`}
              >
                {/* Toggle */}
                <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleDay(dayIndex)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      enabled ? "bg-brand-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        enabled ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-sm font-medium ${
                      enabled ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {dayName}
                  </span>
                </label>

                {/* Times */}
                {enabled && hour ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={hour.startTime}
                      onChange={(e) => updateHour(dayIndex, "startTime", e.target.value)}
                      className="rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input
                      type="time"
                      value={hour.endTime}
                      onChange={(e) => updateHour(dayIndex, "endTime", e.target.value)}
                      className="rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Closed</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="font-medium text-gray-900">Meal breaks</h2>
          <p className="mt-1 text-xs text-gray-500">Slots overlapping these breaks will not be generated.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
              <div key={meal}>
                <label className="block text-xs font-medium capitalize text-gray-600">{meal}</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="time" value={breaks[`${meal}Start`]} onChange={(e) => setBreaks({ ...breaks, [`${meal}Start`]: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm" />
                  <span className="text-gray-400">-</span>
                  <input type="time" value={breaks[`${meal}End`]} onChange={(e) => setBreaks({ ...breaks, [`${meal}End`]: e.target.value })} className="w-full rounded-lg border px-2 py-1.5 text-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {success && (
          <p className="mt-3 text-sm text-green-600 font-medium">✓ Business hours saved!</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save hours"}
          </button>
          <p className="text-xs text-gray-400">
            {hours.length} day{hours.length !== 1 ? "s" : ""} enabled
          </p>
        </div>
      </form>
    </div>
  );
}
