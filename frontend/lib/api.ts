import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const publicAuthPage = path === "/login" || path === "/register" || path === "/business/register";
        if (!publicAuthPage) {
          clearSession();
          const returnPath = `${path}${window.location.search}${window.location.hash}`;
          window.location.href = `/login?redirect=${encodeURIComponent(returnPath)}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN" | "PLATFORM_ADMIN";
  phone?: string;
  loyaltyPoints?: number;
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: string;
  tokenFee?: string;
  active: boolean;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  title?: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
}

export interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  serviceId: string;
  staffId: string;
  service?: Service;
  staff?: Staff;
}

export interface Appointment {
  id: string;
  status: string;
  notes?: string;
  createdAt: string;
  service: Service;
  slot: Slot;
  staff: Staff & { user?: { name: string; email: string } };
  customer?: { name: string; email: string; phone?: string };
  business: Business;
  payment?: { status: string; amount?: string; id: string } | null;
  review?: { id: string; rating: number; comment?: string } | null;
  qrCode?: string;
  checkedInAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  _count?: { businesses: number };
}

export function saveSession(_token: string | undefined, user: AuthUser) {
  localStorage.setItem("user", JSON.stringify(user));
  window.dispatchEvent(new Event("auth-change"));
}

export function getSession(): { user: AuthUser } | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return { user: JSON.parse(userStr) };
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("user");
  if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-change"));
}

export async function logoutSession() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearSession();
  }
}
