"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import BusinessVisual from "@/components/BusinessVisual";
import { AppIcon } from "@/components/AppIcon";
import { api, getSession } from "@/lib/api";
import { getLoginPathForCurrentPage } from "@/lib/authFlow";

interface Service { id: string; name: string; price: string; durationMin: number }
interface Business {
  id: string; name: string; slug: string; logoUrl: string | null;
  description: string | null; address: string | null; distanceKm: number | null;
  services: Service[];
}

export default function SalonsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "done" | "denied">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) { router.replace(getLoginPathForCurrentPage()); return; }
    setAuthorized(true);
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    setLoading(true);
    api.get("/categories").then(({ data }) => {
      const category = data.find((item: { slug: string }) => item.slug === "salon");
      if (!category) throw new Error("Salon category is not configured yet.");
      return api.get("/businesses/nearby", { params: { categoryId: category.id, lat: coords?.lat, lng: coords?.lng } });
    }).then(({ data }) => { if (!cancelled) setBusinesses(data); })
      .catch(() => { if (!cancelled) setErrorMessage("Salons could not be loaded. Please try again shortly."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authorized, coords]);

  function useMyLocation() {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords: position }) => { setCoords({ lat: position.latitude, lng: position.longitude }); setLocationStatus("done"); },
      () => setLocationStatus("denied"), { timeout: 8000 }
    );
  }

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return businesses;
    return businesses.filter((business) => [business.name, business.description, business.address, ...business.services.map((service) => service.name)]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [businesses, searchQuery]);

  if (!authorized) return null;
  return (
    <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-fuchsia-700 to-rose-600 p-7 text-white shadow-xl sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-100">Discover salons & spas</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Find a service that fits your day</h1>
        <p className="mt-3 max-w-xl text-sm text-fuchsia-50 sm:text-base">Explore each salon’s listed services, prices and appointment details before you book.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 items-center gap-3 rounded-xl bg-white px-4 text-gray-500 shadow-sm">
            <AppIcon name="search" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search salons, services or areas" className="w-full bg-transparent py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400" />
          </label>
          <button onClick={useMyLocation} disabled={locationStatus === "locating"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30 disabled:opacity-60">
            <AppIcon name="location" />{locationStatus === "locating" ? "Finding you…" : coords ? "Nearby places" : "Use my location"}
          </button>
        </div>
        {locationStatus === "denied" && <p className="mt-3 text-sm text-fuchsia-100">Location is unavailable. You can still browse all salons.</p>}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><h2 className="text-xl font-semibold text-gray-900">Salons to explore</h2><p className="mt-1 text-sm text-gray-500">{coords ? "Sorted by distance from you" : "Business details and service prices come from each listing"}</p></div>
          <Link href="/services" className="text-sm font-medium text-brand-700 hover:underline">All categories</Link>
        </div>
        {errorMessage && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</p>}
        {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-gray-100" />)}</div>
          : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-700"><AppIcon name="beauty" size={25} /></div><h3 className="mt-4 font-semibold text-gray-900">No salons found</h3><p className="mt-1 text-sm text-gray-500">Try a different name, area or listed service.</p></div>
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((business) => (
            <Link key={business.id} href={`/book/${business.slug}`} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-fuchsia-300 hover:shadow-lg">
              <div className="flex items-start gap-4 p-5"><BusinessVisual name={business.name} slug="salon" logoUrl={business.logoUrl} className="h-16 w-16 rounded-xl" />
                <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-gray-900 group-hover:text-fuchsia-700">{business.name}</h3>{business.distanceKm !== null && <span className="shrink-0 text-xs text-gray-500">{business.distanceKm} km</span>}</div>
                  {business.address && <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><AppIcon name="location" size={14} /><span className="truncate">{business.address.startsWith("http") || business.address.includes("maps.google") ? "View location" : business.address}</span></p>}
                </div>
              </div>
              {business.description && <p className="px-5 pb-4 text-sm leading-6 text-gray-600 line-clamp-2">{business.description}</p>}
              <div className="border-t border-gray-100 px-5 py-4">{business.services.length ? <><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Listed services</p><div className="space-y-2">{business.services.slice(0,2).map((service) => <div key={service.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-gray-700">{service.name}</span><span className="shrink-0 font-semibold text-gray-900">₹{service.price}</span></div>)}</div></> : <p className="text-sm text-gray-500">View this salon for booking details.</p>}
                <div className="mt-4 flex items-center justify-between text-sm font-semibold text-fuchsia-700"><span>View salon</span><AppIcon name="arrowRight" size={17} /></div>
              </div>
            </Link>
          ))}</div>}
      </section>
    </main>
  );
}
