"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getSession } from "@/lib/api";

interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: string;
  active: boolean;
}
interface StaffMember {
  id: string;
  title?: string;
  user: { id: string; name: string; email: string };
}
interface BusinessHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
interface Business {
  id: string;
  name: string;
  slug: string;
  services: Service[];
  staff: StaffMember[];
  businessHours: BusinessHour[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TABS = ["Hours", "Services", "Staff", "Generate Slots"] as const;

export default function BusinessAdminPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Hours");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    loadBusiness();
  }, [router]);

  function loadBusiness() {
    setLoading(true);
    api
      .get("/businesses/mine")
      .then(({ data }) => setBusiness(data))
      .finally(() => setLoading(false));
  }

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  if (loading || !business) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{business.name}</h1>
      <p className="text-sm text-gray-500">
        Storefront: <code className="rounded bg-gray-100 px-1">/book/{business.slug}</code>
      </p>

      {notice && (
        <div className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</div>
      )}

      <div className="mt-6 flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${
              tab === t ? "border-b-2 border-brand-600 font-medium text-brand-700" : "text-gray-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Hours" && <HoursTab business={business} onSaved={loadBusiness} flash={flash} />}
        {tab === "Services" && <ServicesTab business={business} onChanged={loadBusiness} flash={flash} />}
        {tab === "Staff" && <StaffTab business={business} onChanged={loadBusiness} flash={flash} />}
        {tab === "Generate Slots" && <SlotsTab business={business} flash={flash} />}
      </div>
    </div>
  );
}

// ---------- Hours ----------
function HoursTab({
  business,
  onSaved,
  flash,
}: {
  business: Business;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  const initial = DAYS.map((_, dayOfWeek) => {
    const existing = business.businessHours.find((h) => h.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      open: !!existing,
      startTime: existing?.startTime ?? "09:00",
      endTime: existing?.endTime ?? "18:00",
    };
  });
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);

  function update(i: number, field: string, value: string | boolean) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      const hours = rows
        .filter((r) => r.open)
        .map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime }));
      await api.put("/businesses/hours", { hours });
      flash("Business hours updated");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-3">
      {rows.map((r, i) => (
        <div key={r.dayOfWeek} className="flex items-center gap-3">
          <label className="flex w-24 items-center gap-2 text-sm">
            <input type="checkbox" checked={r.open} onChange={(e) => update(i, "open", e.target.checked)} />
            {DAYS[r.dayOfWeek]}
          </label>
          <input
            type="time"
            disabled={!r.open}
            value={r.startTime}
            onChange={(e) => update(i, "startTime", e.target.value)}
            className="rounded-md border px-2 py-1 text-sm disabled:opacity-40"
          />
          <span className="text-gray-400">to</span>
          <input
            type="time"
            disabled={!r.open}
            value={r.endTime}
            onChange={(e) => update(i, "endTime", e.target.value)}
            className="rounded-md border px-2 py-1 text-sm disabled:opacity-40"
          />
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save hours"}
      </button>
    </div>
  );
}

// ---------- Services ----------
function ServicesTab({
  business,
  onChanged,
  flash,
}: {
  business: Business;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  const [form, setForm] = useState({ name: "", durationMin: "30", price: "" });
  const [saving, setSaving] = useState(false);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/services", {
        name: form.name,
        durationMin: Number(form.durationMin),
        price: Number(form.price),
      });
      setForm({ name: "", durationMin: "30", price: "" });
      flash("Service added");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeService(id: string) {
    await api.delete(`/services/${id}`);
    flash("Service deactivated");
    onChanged();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-2 font-medium">Current services</h3>
        <div className="space-y-2">
          {business.services.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border bg-white p-3 text-sm">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-gray-500">
                  {s.durationMin} min · ₹{s.price} {!s.active && "· inactive"}
                </div>
              </div>
              {s.active && (
                <button onClick={() => removeService(s.id)} className="text-xs text-red-600 hover:underline">
                  Deactivate
                </button>
              )}
            </div>
          ))}
          {business.services.length === 0 && <p className="text-sm text-gray-500">No services yet.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium">Add a service</h3>
        <form onSubmit={addService} className="space-y-3 rounded-md border bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">Duration (min)</label>
              <input
                required
                type="number"
                min={5}
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">Price (₹)</label>
              <input
                required
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-brand-600 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add service"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Staff ----------
function StaffTab({
  business,
  onChanged,
  flash,
}: {
  business: Business;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", title: "" });
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/staff", form);
      setTempPassword(data.tempPassword);
      setForm({ name: "", email: "", title: "" });
      flash("Staff member added");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeStaff(id: string) {
    await api.delete(`/staff/${id}`);
    flash("Staff member removed");
    onChanged();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-2 font-medium">Current staff</h3>
        <div className="space-y-2">
          {business.staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border bg-white p-3 text-sm">
              <div>
                <div className="font-medium">{s.user.name}</div>
                <div className="text-gray-500">
                  {s.user.email} {s.title && `· ${s.title}`}
                </div>
              </div>
              <button onClick={() => removeStaff(s.id)} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            </div>
          ))}
          {business.staff.length === 0 && <p className="text-sm text-gray-500">No staff yet.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium">Add staff</h3>
        {tempPassword && (
          <div className="mb-3 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
            Temporary password: <code className="font-mono">{tempPassword}</code> — share this with them
            securely; they can log in and should change it (password reset isn't built yet, so for now this
            is their login password).
          </div>
        )}
        <form onSubmit={addStaff} className="space-y-3 rounded-md border bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Title (optional)</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-brand-600 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add staff member"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- Generate Slots ----------
function SlotsTab({ business, flash }: { business: Business; flash: (m: string) => void }) {
  const [staffId, setStaffId] = useState(business.staff[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(business.services[0]?.id ?? "");
  const [daysAhead, setDaysAhead] = useState("14");
  const [generating, setGenerating] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const { data } = await api.post("/slots/generate", {
        staffId,
        serviceId,
        daysAhead: Number(daysAhead),
      });
      flash(`${data.createdCount} slot(s) created`);
    } finally {
      setGenerating(false);
    }
  }

  if (business.staff.length === 0 || business.services.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Add at least one staff member and one service before generating slots.
      </p>
    );
  }

  return (
    <form onSubmit={generate} className="max-w-md space-y-3 rounded-md border bg-white p-4">
      <div>
        <label className="block text-xs font-medium text-gray-600">Staff member</label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
        >
          {business.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.user.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600">Service</label>
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
        >
          {business.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMin} min)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600">Days ahead</label>
        <input
          type="number"
          min={1}
          max={60}
          value={daysAhead}
          onChange={(e) => setDaysAhead(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={generating}
        className="w-full rounded-md bg-brand-600 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate slots"}
      </button>
      <p className="text-xs text-gray-400">
        Safe to run again later — it skips times that already have a slot, so re-running weekly to extend
        the booking window won't create duplicates.
      </p>
    </form>
  );
}