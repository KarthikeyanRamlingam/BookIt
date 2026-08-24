"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getSession, AuthUser } from "@/lib/api";
import { getCategoryIcon } from "@/lib/categoryIcons";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  _count: { businesses: number };
}
interface Coords {
  lat: number;
  lng: number;
}
interface NearbyService {
  id: string;
  name: string;
  price: string;
  durationMin: number;
}
interface NearbyBusiness {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  distanceKm: number | null;
  services: NearbyService[];
}

const MEDICAL_SPECIALTY_SLUGS = new Set([
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
]);

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "denied" | "done">("idle");
  const [businesses, setBusinesses] = useState<NearbyBusiness[] | null>(null);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setUser(getSession()?.user ?? null);
  }, []);

  useEffect(() => {
    api
      .get("/categories")
      .then(({ data }) => setCategories(data))
      .catch(() => {
        setErrorMessage("Backend not running. Start the API server at http://localhost:4000 before loading doctor data.");
      });
  }, []);

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

  function skipLocation() {
    setCoords(null);
    setLocationStatus("done");
  }

  useEffect(() => {
    if (!selectedCategory || locationStatus !== "done") return;
    setLoadingBusinesses(true);
    api
      .get("/businesses/nearby", {
        params: {
          categoryId: selectedCategory.id,
          lat: coords?.lat,
          lng: coords?.lng,
        },
      })
      .then(({ data }) => setBusinesses(data))
      .finally(() => setLoadingBusinesses(false));
  }, [selectedCategory, locationStatus, coords]);

  if (user === undefined) return null;

  if (user === null) {
    return (
      <div className="mx-auto max-w-2xl text-center py-16 px-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Book local services in seconds
        </h1>
        <p className="mt-4 text-base text-slate-300">
          Salons, doctor appointments, restaurants, government offices — real-time availability, instant check-in.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/doctors" className="rounded-xl border border-blue-500/30 bg-blue-900/30 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-800/40 transition-colors shadow-sm">
            🩺 Doctors
          </Link>
          <Link href="/restaurants" className="rounded-xl border border-amber-500/30 bg-amber-900/30 px-4 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-800/40 transition-colors shadow-sm">
            🍽️ Restaurants
          </Link>
          <Link href="/salons" className="rounded-xl border border-pink-500/30 bg-pink-900/30 px-4 py-2.5 text-sm font-semibold text-pink-200 hover:bg-pink-800/40 transition-colors shadow-sm">
            💇 Salons & Spa
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  if (!selectedCategory) {
    const topCategories = categories.filter((c) => !MEDICAL_SPECIALTY_SLUGS.has(c.slug));
    return (
      <div className="mx-auto max-w-5xl py-8 px-4">
        <h1 className="text-3xl font-bold text-white tracking-tight">What are you looking to book?</h1>
        <p className="mt-2 text-sm text-slate-400">Pick a category to explore verified services and places near you.</p>

        {errorMessage ? (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-950/40 px-4 py-3 text-sm text-red-300">{errorMessage}</p>
        ) : topCategories.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">No categories yet — check back once businesses have signed up.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {topCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c)}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 text-center shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-blue-500 hover:bg-slate-800/90 hover:shadow-blue-500/10"
              >
                <span className="text-4xl transition-transform duration-200 group-hover:scale-110">{getCategoryIcon(c)}</span>
                <span className="text-base font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                  {c.name}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-700/60 px-2.5 py-0.5 text-xs font-medium text-slate-400 group-hover:border-blue-500/30 group-hover:text-slate-300">
                  {c._count.businesses} nearby
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (locationStatus !== "done") {
    return (
      <div className="mx-auto max-w-md text-center py-12 px-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          ← Change category
        </button>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-xl">
          <div className="text-4xl mb-3">{getCategoryIcon(selectedCategory)}</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Find {selectedCategory.name.toLowerCase()}s near you
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Share your location to see the closest options first, or skip to browse all available places.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={useMyLocation}
              disabled={locationStatus === "locating"}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-50 transition-all"
            >
              {locationStatus === "locating" ? "Locating…" : "📍 Use my current location"}
            </button>
            <button
              onClick={skipLocation}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Skip — browse all
            </button>
          </div>
          {locationStatus === "denied" && (
            <p className="mt-4 rounded-lg bg-amber-950/30 border border-amber-500/20 p-2.5 text-xs text-amber-300">
              Couldn&apos;t get your precise location — showing all {selectedCategory.name.toLowerCase()}s.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8 px-4">
      <button
        onClick={() => {
          setSelectedCategory(null);
          setBusinesses(null);
          setLocationStatus("idle");
        }}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
      >
        ← Back to categories
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>{getCategoryIcon(selectedCategory)}</span>
            <span>{selectedCategory.name} {coords ? "near you" : ""}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Available services and verified business locations</p>
        </div>
      </div>

      {(selectedCategory.slug === "doctor-appointment" || MEDICAL_SPECIALTY_SLUGS.has(selectedCategory.slug)) && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => {
              const docParent = categories.find((c) => c.slug === "doctor-appointment") || selectedCategory;
              setSelectedCategory(docParent);
            }}
            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
              selectedCategory.slug === "doctor-appointment"
                ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
            }`}
          >
            🏥 All Medical Specialties
          </button>
          {categories
            .filter((c) => MEDICAL_SPECIALTY_SLUGS.has(c.slug))
            .map((spec) => (
              <button
                key={spec.id}
                onClick={() => setSelectedCategory(spec)}
                className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                  selectedCategory.id === spec.id
                    ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                }`}
              >
                {getCategoryIcon(spec)} {spec.name}
              </button>
            ))}
        </div>
      )}

      {loadingBusinesses ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-400">Finding places…</p>
        </div>
      ) : !businesses || businesses.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-base font-semibold text-slate-200">No {selectedCategory.name.toLowerCase()}s found yet</p>
          <p className="text-sm text-slate-500 mt-1">Please check back soon or try another category.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/book/${b.slug}`}
              className="group block rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-md hover:border-blue-500/80 hover:bg-slate-800/90 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                    {b.name}
                  </h3>
                  {b.address && <p className="mt-1 text-sm text-slate-400">📍 {b.address}</p>}
                  {b.description && <p className="mt-2 text-sm text-slate-300 leading-relaxed">{b.description}</p>}
                </div>
                {b.distanceKm !== null && (
                  <span className="shrink-0 rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-semibold text-blue-400">
                    {b.distanceKm} km away
                  </span>
                )}
              </div>

              {b.services.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-800/80">
                  {b.services.map((s) => (
                    <span key={s.id} className="rounded-lg bg-slate-800 border border-slate-700/60 px-2.5 py-1 text-xs font-medium text-slate-300">
                      {s.name} · <strong className="text-white">₹{s.price}</strong>
                    </span>
                  ))}
                </div>
              )}

              {(selectedCategory.slug === "government-office" ||
                selectedCategory.slug === "doctor-appointment" ||
                MEDICAL_SPECIALTY_SLUGS.has(selectedCategory.slug)) && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
                  <span className="text-amber-400 font-medium flex items-center gap-1">🎟️ Token Queue Enabled</span>
                  <span className="font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">Get Token & Book →</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}