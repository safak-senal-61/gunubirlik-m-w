import axios, { AxiosError } from "axios";
import type {
  ApiApplication,
  ApiCategory,
  ApiConversation,
  ApiJob,
  ApiMessage,
  ApiNotification,
  ApiUser,
  GeocodeAddress,
  JobCategory,
  JobStatus,
  Pagination,
} from "./api-types";

export const API_BASE = "https://gunubirlik.space-z.ai/api/v1";
const TOKEN_KEY = "gb_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const body = err.response?.data as { error?: string } | undefined;
    return new ApiError(
      body?.error ?? "Bir şeyler ters gitti. Lütfen tekrar dene.",
      err.response?.status ?? 0,
    );
  }
  return new ApiError(
    err instanceof Error ? err.message : "Bilinmeyen hata",
    0,
  );
}

// ---------------- Auth ----------------

export interface LoginResult {
  user?: ApiUser;
  token?: string;
  requiresTwoFactor?: boolean;
}

export async function login(email: string, password: string, twoFactorCode?: string): Promise<LoginResult> {
  try {
    const res = await api.post("/auth/login", {
      email,
      password,
      ...(twoFactorCode ? { twoFactorCode } : {}),
    });
    return res.data.data as LoginResult;
  } catch (err) {
    throw toApiError(err);
  }
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: "WORKER" | "EMPLOYER";
  city: string;
  district: string;
  companyName?: string;
}

export async function register(payload: RegisterPayload): Promise<LoginResult> {
  try {
    const res = await api.post("/auth/register", payload);
    return res.data.data as LoginResult;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // token might already be invalid; ignore
  }
  setToken(null);
}

export async function fetchMe(): Promise<ApiUser> {
  try {
    const res = await api.get("/auth/me");
    return res.data.data as ApiUser;
  } catch (err) {
    throw toApiError(err);
  }
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  city?: string;
  district?: string;
  companyName?: string;
  bio?: string;
  skills?: string[];
  experienceYears?: number | null;
  hourlyWageMin?: number | null;
  hourlyWageMax?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** PUT /auth/me — update profile fields. */
export async function updateMe(payload: UpdateProfilePayload): Promise<ApiUser> {
  try {
    const res = await api.put("/auth/me", payload);
    return res.data.data as ApiUser;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  } catch (err) {
    throw toApiError(err);
  }
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  try {
    const form = new FormData();
    form.append("avatar", file);
    const res = await api.post("/auth/avatar", form);
    return res.data.data as { avatarUrl: string };
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- Jobs ----------------

export interface JobsQuery {
  page?: number;
  limit?: number;
  category?: JobCategory;
  status?: JobStatus;
  city?: string;
  district?: string;
  mine?: boolean;
  search?: string;
  /** Reference coordinates; server adds distanceKm to each job when sent. */
  lat?: number;
  lng?: number;
}

export async function fetchJobs(query: JobsQuery = {}): Promise<{ items: ApiJob[]; pagination: Pagination }> {
  try {
    const res = await api.get("/jobs", { params: query });
    return res.data.data as { items: ApiJob[]; pagination: Pagination };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchJob(id: string): Promise<ApiJob> {
  try {
    const res = await api.get(`/jobs/${id}`);
    return res.data.data as ApiJob;
  } catch (err) {
    throw toApiError(err);
  }
}

export interface CreateJobPayload {
  title: string;
  description: string;
  category: JobCategory;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  wageAmount: number;
  wageType: "DAILY" | "HOURLY";
  latitude?: number;
  longitude?: number;
  city: string;
  district: string;
  address?: string;
  locationNote?: string;
  openingsTotal: number;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  requiredSkills?: string[];
}

export async function createJob(payload: CreateJobPayload): Promise<ApiJob> {
  try {
    const res = await api.post("/jobs", payload);
    return res.data.data as ApiJob;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateJob(id: string, payload: Partial<CreateJobPayload> & { status?: JobStatus }): Promise<ApiJob> {
  try {
    const res = await api.put(`/jobs/${id}`, payload);
    return res.data.data as ApiJob;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function deleteJob(id: string): Promise<void> {
  try {
    await api.delete(`/jobs/${id}`);
  } catch (err) {
    throw toApiError(err);
  }
}

export async function toggleSaveJob(id: string): Promise<{ saved: boolean }> {
  try {
    const res = await api.post(`/jobs/${id}/save`);
    return res.data.data as { saved: boolean };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchSavedJobs(): Promise<ApiJob[]> {
  try {
    const res = await api.get("/jobs/saved");
    const data = res.data.data;
    return (Array.isArray(data) ? data : data?.items ?? []) as ApiJob[];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  try {
    const res = await api.get("/jobs/categories");
    return res.data.data as ApiCategory[];
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- Geocoding ----------------

/** GET /geocode/reverse — resolve an address from GPS coordinates. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeAddress> {
  try {
    const res = await api.get("/geocode/reverse", { params: { lat, lng } });
    return res.data.data as GeocodeAddress;
  } catch (err) {
    throw toApiError(err);
  }
}

export interface GeocodeSuggestion {
  displayName: string;
  lat: number;
  lng: number;
  city: string | null;
  type: string;
  importance: number;
}

async function geocodeList(url: string, q: string): Promise<GeocodeSuggestion[]> {
  try {
    const res = await api.get(url, { params: { q } });
    const data = res.data.data as { items?: GeocodeSuggestion[] } | GeocodeSuggestion[];
    if (Array.isArray(data)) return data;
    return data.items ?? [];
  } catch (err) {
    throw toApiError(err);
  }
}

/** GET /geocode/suggest — address autocomplete while typing. */
export function suggestAddress(q: string) {
  return geocodeList("/geocode/suggest", q);
}

/** GET /geocode/search — full address search. */
export function searchAddress(q: string) {
  return geocodeList("/geocode/search", q);
}

// ---------------- System ----------------

export async function checkHealth(): Promise<boolean> {
  try {
    await api.get("/health");
    return true;
  } catch {
    return false;
  }
}

// ---------------- Applications ----------------

export async function applyToJob(
  jobId: string,
  payload: { message?: string; proposedWage?: number },
): Promise<ApiApplication> {
  try {
    const res = await api.post("/applications", { jobId, ...payload });
    return res.data.data as ApiApplication;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchApplications(): Promise<ApiApplication[]> {
  try {
    const res = await api.get("/applications");
    const data = res.data.data;
    return (Array.isArray(data) ? data : data?.items ?? []) as ApiApplication[];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchApplicationsByJob(jobId: string): Promise<ApiApplication[]> {
  try {
    const res = await api.get("/applications/by-job", { params: { jobId } });
    const data = res.data.data;
    return (Array.isArray(data) ? data : data?.items ?? []) as ApiApplication[];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateApplicationStatus(
  id: string,
  status: "ACCEPTED" | "REJECTED" | "COMPLETED",
  employerNote?: string,
): Promise<ApiApplication> {
  try {
    const res = await api.put(`/applications/${id}`, { status, ...(employerNote ? { employerNote } : {}) });
    return res.data.data as ApiApplication;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function rateApplication(id: string, rating: number, comment?: string): Promise<void> {
  try {
    await api.post(`/applications/${id}/rate`, { rating, ...(comment ? { comment } : {}) });
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- Conversations ----------------

export async function fetchConversations(): Promise<ApiConversation[]> {
  try {
    const res = await api.get("/conversations");
    const data = res.data.data;
    return (Array.isArray(data) ? data : data?.items ?? []) as ApiConversation[];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function fetchMessages(conversationId: string): Promise<ApiMessage[]> {
  try {
    const res = await api.get(`/conversations/${conversationId}/messages`);
    const data = res.data.data;
    return (Array.isArray(data) ? data : data?.items ?? []) as ApiMessage[];
  } catch (err) {
    throw toApiError(err);
  }
}

export async function sendMessage(payload: {
  recipientId: string;
  jobId?: string;
  conversationId?: string;
  content: string;
}): Promise<ApiMessage> {
  try {
    const res = await api.post("/conversations", payload);
    return res.data.data as ApiMessage;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    await api.post("/conversations/read", { conversationId });
  } catch {
    // non-critical
  }
}

// ---------------- Notifications ----------------

export async function fetchNotifications(): Promise<{ items: ApiNotification[]; unreadCount: number }> {
  try {
    const res = await api.get("/notifications");
    const data: unknown = res.data.data;
    if (Array.isArray(data)) {
      const items = data as ApiNotification[];
      return { items, unreadCount: items.filter((n) => !n.isRead).length };
    }
    const obj = (data ?? {}) as { items?: ApiNotification[]; unreadCount?: number };
    return {
      items: obj.items ?? [],
      unreadCount: obj.unreadCount ?? obj.items?.filter((n) => !n.isRead).length ?? 0,
    };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await api.put(`/notifications/${id}`);
  } catch (err) {
    throw toApiError(err);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await api.post("/notifications/read-all");
  } catch (err) {
    throw toApiError(err);
  }
}

export async function deleteNotification(id: string): Promise<void> {
  try {
    await api.delete(`/notifications/${id}`);
  } catch (err) {
    throw toApiError(err);
  }
}
