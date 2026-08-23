import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
});

// Attach the JWT (stored client-side after login) to every request.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== "undefined") {
        clearSession();
        const path = window.location.pathname;
        if (!path.startsWith("/login") && !path.startsWith("/register")) {
          window.location.href = "/login";
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

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function getSession(): { token: string; user: AuthUser } | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  if (!token || !userStr) return null;
  return { token, user: JSON.parse(userStr) };
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
