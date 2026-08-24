"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getCategoryIcon } from "@/lib/categoryIcons";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  _count?: { businesses: number };
}

interface Business {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  distanceKm: number | null;
  services: Array<{ id: string; name: string; price: string; durationMin: number }>;
}

const SPECIALTY_SLUGS = new Set([
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

export default function DoctorsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "done" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    api
      .get("/categories")
      .then(({ data }) => {
        const parentDoc = data.find((c: Category) => c.slug === "doctor-appointment");
        const specialties = data.filter((c: Category) => SPECIALTY_SLUGS.has(c.slug));
        
        const allOption: Category = parentDoc || {
          id: "all-doctors",
          name: "All Doctor Specialties",
          slug: "doctor-appointment",
          icon: "🏥",
        };
        
        const list = [
          { ...allOption, name: "All Doctor Specialties", icon: "🏥" },
          ...specialties,
        ];
        
        setCategories(list);
        setSelectedCategory(list[0]);
      })
      .catch(() => {
        setErrorMessage("Backend not running. Start the API server at http://localhost:4000 before opening the doctor page.");
      });
  }, []);

  useEffect(() => {
    if (!selectedCategory || locationStatus !== "done") return;
    setLoading(true);
    api
      .get("/businesses/nearby", {
        params: {
          categoryId: selectedCategory.id,
          lat: coords?.lat,
          lng: coords?.lng,
        },
      })
      .then(({ data }) => setBusinesses(data))
      .catch(() => {
        setErrorMessage("The clinic list could not be loaded. Check that the backend is running on http://localhost:4000.");
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, locationStatus, coords]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
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

  return (
    <div className="mx-auto max-w-6xl py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-brand-600">Doctor booking</p>
          <h1 className="text-3xl font-semibold text-gray-900">Choose a specialist</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to services
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category)}
            className={`rounded-full border px-3 py-2 text-sm ${
              selectedCategory?.id === category.id
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {getCategoryIcon(category)} {category.name}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      )}

      <div className="mb-8 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedCategory ? `${selectedCategory.name} clinics` : "Doctor clinics"}
            </h2>
            <p className="text-sm text-gray-500">
              {coords ? "Showing nearby results" : "Showing all clinics"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={useMyLocation}
              disabled={locationStatus === "locating"}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {locationStatus === "locating" ? "Locating…" : "Use my location"}
            </button>
            <button
              onClick={skipLocation}
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Show all
            </button>
          </div>
        </div>

        {locationStatus === "denied" && (
          <p className="mt-3 text-sm text-red-600">Location access is unavailable, so we are showing all clinics.</p>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading doctors…</p>
      ) : businesses.length === 0 ? (
        <p className="text-gray-500">No doctors found for this specialty yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/book/${business.slug}`}
              className="block rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{business.name}</div>
                  {business.address && (
                    <div className="mt-1 text-sm text-gray-400 flex items-center gap-1">
                      <span>📍</span>
                      <span className="truncate">
                        {business.address.startsWith("http") || business.address.includes("maps.google")
                          ? "Pinned Location (Google Maps)"
                          : business.address}
                      </span>
                    </div>
                  )}
                </div>
                {business.distanceKm !== null && (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    {business.distanceKm} km
                  </span>
                )}
              </div>

              {business.description && <p className="mt-3 text-sm text-gray-600">{business.description}</p>}

              {business.services.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {business.services.map((service) => (
                    <span key={service.id} className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">
                      {service.name} · 🎟️ Token: ₹50
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-gray-500">Token-based booking</span>
                <span className="font-medium text-brand-700">Book now</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}