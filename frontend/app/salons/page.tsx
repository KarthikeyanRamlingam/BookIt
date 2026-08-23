"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface Business {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  distanceKm: number | null;
  services: Array<{ id: string; name: string; tokenFee?: string; durationMin: number }>;
}

const TREATMENT_FILTERS = [
  { id: "all", label: "✨ All Treatments" },
  { id: "hair", label: "✂️ Haircut & Styling" },
  { id: "skin", label: "💆 Facials & Skin Glow" },
  { id: "spa", label: "🧖 Spa & Body Massage" },
  { id: "nails", label: "💅 Nails & Pedicure" },
  { id: "mens", label: "🧔 Men's Grooming" },
  { id: "bridal", label: "💄 Bridal & Makeover" },
];

const GENDER_FILTERS = [
  { id: "all", label: "All Salons" },
  { id: "unisex", label: "Unisex" },
  { id: "women", label: "Women Only" },
  { id: "men", label: "Men's Barbershop" },
  { id: "spa", label: "Luxury Day Spa" },
];

export default function SalonsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTreatment, setSelectedTreatment] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "done" | "denied">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch category ID for salon
    api.get("/categories")
      .then(({ data }) => {
        const salonCat = data.find((c: any) => c.slug === "salon");
        if (!salonCat) {
          setErrorMessage("Salon category not found. Please run backend seed.");
          setLoading(false);
          return;
        }

        api.get("/businesses/nearby", {
          params: {
            categoryId: salonCat.id,
            lat: coords?.lat,
            lng: coords?.lng,
          },
        })
        .then((res) => {
          setBusinesses(res.data);
          setLoading(false);
        })
        .catch(() => {
          setErrorMessage("Could not load salons. Ensure backend is running.");
          setLoading(false);
        });
      })
      .catch(() => {
        setErrorMessage("Could not connect to backend server.");
        setLoading(false);
      });
  }, [coords]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("done");
      },
      () => setLocationStatus("denied"),
      { timeout: 8000 }
    );
  }

  // Filter businesses by treatment, gender type, and search query
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      const descLower = (b.description || "").toLowerCase();
      const nameLower = b.name.toLowerCase();
      const addressLower = (b.address || "").toLowerCase();

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = nameLower.includes(q) || descLower.includes(q) || addressLower.includes(q);
        if (!match) return false;
      }

      // Gender/Type match
      if (selectedGender !== "all") {
        if (selectedGender === "unisex" && !descLower.includes("unisex")) return false;
        if (selectedGender === "women" && !descLower.includes("women")) return false;
        if (selectedGender === "men" && !descLower.includes("men's") && !descLower.includes("barber")) return false;
        if (selectedGender === "spa" && !descLower.includes("day spa") && !descLower.includes("massage") && !descLower.includes("ayurvedic")) return false;
      }

      // Treatment match
      if (selectedTreatment !== "all") {
        if (selectedTreatment === "hair" && !descLower.includes("hair") && !descLower.includes("balayage") && !descLower.includes("keratin")) return false;
        if (selectedTreatment === "skin" && !descLower.includes("facial") && !descLower.includes("skin") && !descLower.includes("hydra")) return false;
        if (selectedTreatment === "spa" && !descLower.includes("spa") && !descLower.includes("massage") && !descLower.includes("tissue")) return false;
        if (selectedTreatment === "nails" && !descLower.includes("nail") && !descLower.includes("pedicure") && !descLower.includes("manicure")) return false;
        if (selectedTreatment === "mens" && !descLower.includes("barber") && !descLower.includes("grooming") && !descLower.includes("shave")) return false;
        if (selectedTreatment === "bridal" && !descLower.includes("bridal") && !descLower.includes("makeup") && !descLower.includes("makeover")) return false;
      }

      return true;
    });
  }, [businesses, selectedTreatment, selectedGender, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl py-4 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-pink-600 to-rose-500 p-8 md:p-10 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            💇 Luxury Beauty & Stylist Appointments
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Book Top Salons & Spas in Bengaluru
          </h1>
          <p className="mt-2 text-sm text-pink-100 sm:text-base">
            Reserve senior hair stylists, aesthetic skin facials, luxury massages & nail art with instant time-slot booking.
          </p>

          {/* Search bar in Hero */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-base">🔍</span>
              <input
                type="text"
                placeholder="Search salon, treatment (e.g. Balayage, Hydra-Facial, Spa), or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-white py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
            <button
              onClick={useMyLocation}
              disabled={locationStatus === "locating"}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/20 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md hover:bg-white/30 transition-colors"
            >
              📍 {locationStatus === "locating" ? "Locating…" : locationStatus === "done" ? "Near You" : "Find Near Me"}
            </button>
          </div>
        </div>
      </div>

      {/* Gender / Salon Type Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 shrink-0">Type:</span>
        {GENDER_FILTERS.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGender(g.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 ${
              selectedGender === g.id
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white border text-gray-700 hover:bg-gray-50"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Treatment Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TREATMENT_FILTERS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTreatment(t.id)}
            className={`rounded-xl border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-all ${
              selectedTreatment === t.id
                ? "border-pink-600 bg-pink-50 text-pink-900 ring-1 ring-pink-600 font-semibold shadow-sm"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Salon Grid */}
      {loading ? (
        <div className="py-12 text-center text-gray-500">
          <p className="text-3xl mb-2 animate-bounce">💇</p>
          <p className="font-medium">Loading Bengaluru's top salons and spas…</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-500">
          <p className="text-3xl mb-2">💇</p>
          <p className="font-semibold text-gray-800">No salons match your filters.</p>
          <p className="text-sm mt-1">Try clearing your search query or selecting "All Treatments".</p>
          <button
            onClick={() => { setSelectedTreatment("all"); setSelectedGender("all"); setSearchQuery(""); }}
            className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((b) => (
            <Link
              key={b.id}
              href={`/book/${b.slug}`}
              className="group flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-pink-400 hover:shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-pink-700 transition-colors">
                    {b.name}
                  </h3>
                  {b.distanceKm !== null && (
                    <span className="shrink-0 rounded-full bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-800">
                      📍 {b.distanceKm} km
                    </span>
                  )}
                </div>

                {b.address && (
                  <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                    <span>📍</span> {b.address}
                  </p>
                )}

                {b.description && (
                  <p className="mt-2.5 text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {b.description}
                  </p>
                )}

                {/* Service tags */}
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-800">
                    ✂️ Haircare
                  </span>
                  <span className="rounded-md bg-pink-50 px-2 py-0.5 text-[11px] font-medium text-pink-800">
                    💆 Hydra-Facial
                  </span>
                  <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                    🧖 Body Spa
                  </span>
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    💅 Pedicure
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t pt-3.5">
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-900">🎟️ ₹50</span> Booking Token
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-pink-700 group-hover:translate-x-0.5 transition-transform">
                  Book Stylist →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
