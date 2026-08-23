"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  price: string | number;
  active: boolean;
}

const emptyForm = { name: "", description: "", durationMin: 30, price: "" };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    setLoading(true);
    try {
      const { data } = await api.get("/services");
      setServices(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      durationMin: s.durationMin,
      price: String(s.price),
    });
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        durationMin: Number(form.durationMin),
        price: Number(form.price),
      };
      if (editingId) {
        await api.put(`/services/${editingId}`, payload);
      } else {
        await api.post("/services", payload);
      }
      await fetchServices();
      cancelForm();
    } catch (e: any) {
      setFormError(e?.response?.data?.error || "Failed to save service");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this service? Existing appointments are unaffected.")) return;
    try {
      await api.delete(`/services/${id}`);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: false } : s)));
    } catch (e: any) {
      alert(e?.response?.data?.error || "Failed to deactivate service");
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Services</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage the services your business offers.</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          + Add service
        </button>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">{editingId ? "Edit service" : "New service"}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Service name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Haircut & Style"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration (minutes) *</label>
                <input
                  type="number"
                  required
                  min={5}
                  value={form.durationMin}
                  onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price (₹) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Optional description shown to customers"
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
                {saving ? "Saving…" : editingId ? "Update service" : "Create service"}
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

      {/* Services list */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          Loading services…
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : services.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-500">
          <p className="text-4xl mb-3">✂️</p>
          <p className="font-medium">No services yet</p>
          <p className="text-sm mt-1">Add your first service to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between gap-4 ${
                !s.active ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{s.name}</p>
                  {!s.active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>
                {s.description && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{s.description}</p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                  <span>⏱ {s.durationMin} min</span>
                  <span>💰 ₹{Number(s.price).toFixed(2)}</span>
                </div>
              </div>
              {s.active && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(s)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Deactivate
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
