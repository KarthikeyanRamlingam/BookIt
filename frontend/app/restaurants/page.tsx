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

const CUISINE_FILTERS = [
  { id: "all", label: "🍽️ All Cuisines" },
  { id: "brewery", label: "🍺 Microbreweries" },
  { id: "rooftop", label: "🌆 Rooftop Dining" },
  { id: "italian", label: "🍕 Italian & Pizza" },
  { id: "asian", label: "🥢 Pan-Asian & Sushi" },
  { id: "south-indian", label: "☕ South Indian & Dosa" },
  { id: "fine-dining", label: "✨ Fine Dining" },
  { id: "pure-veg", label: "🌿 Pure Veg" },
  { id: "cafe", label: "🥪 Breakfast & Cafes" },
];

export default function RestaurantsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCuisine, setSelectedCuisine] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "done" | "denied">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch category ID for restaurant
    api.get("/categories")
      .then(({ data }) => {
        const restCat = data.find((c: any) => c.slug === "restaurant");
        if (!restCat) {
          setErrorMessage("Restaurant category not found. Please run backend seed.");
          setLoading(false);
          return;
        }

        api.get("/businesses/nearby", {
          params: {
            categoryId: restCat.id,
            lat: coords?.lat,
            lng: coords?.lng,
          },
        })
        .then((res) => {
          setBusinesses(res.data);
          setLoading(false);
        })
        .catch(() => {
          setErrorMessage("Could not load restaurants. Ensure backend is running.");
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

  // Filter businesses by cuisine tag, search query, and meal session
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

      // Cuisine match
      if (selectedCuisine !== "all") {
        if (selectedCuisine === "brewery" && !descLower.includes("brew") && !descLower.includes("beer")) return false;
        if (selectedCuisine === "rooftop" && !descLower.includes("rooftop") && !descLower.includes("sunset") && !descLower.includes("open-air")) return false;
        if (selectedCuisine === "italian" && !descLower.includes("italian") && !descLower.includes("pizza") && !descLower.includes("pasta")) return false;
        if (selectedCuisine === "asian" && !descLower.includes("asian") && !descLower.includes("sushi") && !descLower.includes("thai") && !descLower.includes("burmese")) return false;
        if (selectedCuisine === "south-indian" && !descLower.includes("south indian") && !descLower.includes("dosa") && !descLower.includes("idli") && !descLower.includes("andhra")) return false;
        if (selectedCuisine === "fine-dining" && !descLower.includes("fine dining") && !descLower.includes("luxury") && !descLower.includes("taj") && !descLower.includes("oberoi")) return false;
        if (selectedCuisine === "pure-veg" && !descLower.includes("pure veg") && !descLower.includes("sattvic")) return false;
        if (selectedCuisine === "cafe" && !descLower.includes("breakfast") && !descLower.includes("cafe") && !descLower.includes("bistro") && !descLower.includes("bakehouse") && !descLower.includes("deli")) return false;
      }

      // Session match
      if (selectedSession !== "all") {
        if (selectedSession === "breakfast" && !descLower.includes("breakfast") && !descLower.includes("idli") && !descLower.includes("dosa") && !descLower.includes("pancake")) return false;
      }

      return true;
    });
  }, [businesses, selectedCuisine, searchQuery, selectedSession]);

  return (
    <div className="mx-auto max-w-6xl py-4 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700 p-8 md:p-10 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            🍽️ Instant Table Reservations
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Book Tables at Bengaluru's Best Restaurants
          </h1>
          <p className="mt-2 text-sm text-orange-100 sm:text-base">
            Reserve tables for Breakfast, Lunch, Hi-Tea & Dinner with guaranteed seating and instant token confirmation.
          </p>

          {/* Search bar in Hero */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 text-base">🔍</span>
              <input
                type="text"
                placeholder="Search restaurant, cuisine (e.g. Italian, Brewery, Dosa), or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-white py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
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

      {/* Meal Session Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 shrink-0">Session:</span>
        <button
          onClick={() => setSelectedSession("all")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 ${
            selectedSession === "all"
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-white border text-gray-700 hover:bg-gray-50"
          }`}
        >
          All Hours
        </button>
        <button
          onClick={() => setSelectedSession("breakfast")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 ${
            selectedSession === "breakfast"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-white border text-gray-700 hover:bg-gray-50"
          }`}
        >
          🌅 Breakfast (8:00 – 11:30 AM)
        </button>
        <button
          onClick={() => setSelectedSession("lunch")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 ${
            selectedSession === "lunch"
              ? "bg-orange-600 text-white shadow-sm"
              : "bg-white border text-gray-700 hover:bg-gray-50"
          }`}
        >
          ☀️ Lunch (12:00 – 3:30 PM)
        </button>
        <button
          onClick={() => setSelectedSession("hitea")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 ${
            selectedSession === "hitea"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-white border text-gray-700 hover:bg-gray-50"
          }`}
        >
          ☕ Hi-Tea (4:00 – 6:30 PM)
        </button>
        <button
          onClick={() => setSelectedSession("dinner")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 ${
            selectedSession === "dinner"
              ? "bg-indigo-900 text-white shadow-sm"
              : "bg-white border text-gray-700 hover:bg-gray-50"
          }`}
        >
          🌙 Dinner (7:00 – 11:00 PM)
        </button>
      </div>

      {/* Cuisine Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CUISINE_FILTERS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCuisine(c.id)}
            className={`rounded-xl border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-all ${
              selectedCuisine === c.id
                ? "border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-600 font-semibold shadow-sm"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Restaurant Grid */}
      {loading ? (
        <div className="py-12 text-center text-gray-500">
          <p className="text-3xl mb-2 animate-bounce">🍽️</p>
          <p className="font-medium">Loading Bengaluru's top restaurants…</p>
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-500">
          <p className="text-3xl mb-2">🍽️</p>
          <p className="font-semibold text-gray-800">No restaurants match your filters.</p>
          <p className="text-sm mt-1">Try clearing your search query or selecting "All Cuisines".</p>
          <button
            onClick={() => { setSelectedCuisine("all"); setSearchQuery(""); setSelectedSession("all"); }}
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
              className="group flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-amber-400 hover:shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 text-lg group-hover:text-amber-700 transition-colors">
                    {b.name}
                  </h3>
                  {b.distanceKm !== null && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
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

                {/* Table Types / Seating badges */}
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    👥 Table for 2
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    👨‍👩‍👧‍👦 Table for 4
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    🥂 Group for 6+
                  </span>
                  {b.description?.toLowerCase().includes("rooftop") && (
                    <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-800">
                      🌆 Rooftop Seating
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t pt-3.5">
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-900">🎟️ ₹50</span> Token Booking
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 group-hover:translate-x-0.5 transition-transform">
                  Reserve Table →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
