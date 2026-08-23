"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface StaffMember {
  id: string;
  title?: string | null;
  user: { id: string; name: string; email: string };
}

const emptyForm = { name: "", email: "", title: "" };

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<{ name: string; tempPassword: string } | null>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    try {
      const { data } = await api.get("/staff");
      setStaff(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm(emptyForm);
    setFormError(null);
    setLastAdded(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setFormError(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const { data } = await api.post("/staff", {
        name: form.name,
        email: form.email,
        title: form.title || undefined,
      });
      setLastAdded({ name: data.staff.name, tempPassword: data.tempPassword });
      setShowForm(false);
      await fetchStaff();
    } catch (e: any) {
      setFormError(e?.response?.data?.error || "Failed to add staff member");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name} from your team? This cannot be undone.`)) return;
    try {
      await api.delete(`/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to remove staff member");
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Staff</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage your team members.</p>
        </div>
        <button
          onClick={openAdd}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          + Add staff
        </button>
      </div>

      {/* Temp password notice */}
      {lastAdded && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            ✓ {lastAdded.name} added — share their temporary password:
          </p>
          <code className="mt-1.5 block rounded-lg bg-white border border-amber-200 px-3 py-2 text-sm font-mono text-amber-900 select-all">
            {lastAdded.tempPassword}
          </code>
          <p className="mt-2 text-xs text-amber-700">
            They can log in with this password and should change it immediately. This won't be shown again.
          </p>
          <button
            onClick={() => setLastAdded(null)}
            className="mt-2 text-xs text-amber-700 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Add team member</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Job title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Senior Stylist"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add team member"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          Loading staff…
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">No staff members yet</p>
          <p className="text-sm mt-1">Add your first team member to assign them to services.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((s) => (
            <div key={s.id} className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-sm">
                  {s.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{s.user.name}</p>
                  <p className="text-xs text-gray-500">
                    {s.title && <span className="mr-2">{s.title}</span>}
                    {s.user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(s.id, s.user.name)}
                className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
