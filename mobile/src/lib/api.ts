// Günübirlik backend client — tüm admin-dışı endpointler.
// Mobil mirror of src/lib/api.ts.

import axios, { AxiosError } from "axios";
import {
  Platform,
} from "react-native";
import type {
  ApiApplication,
  ApiCategory,
  ApiConversation,
  ApiJob,
  ApiMessage,
  ApiNotification,
  ApiUser,
  GeocodeAddress,
  GeocodeSuggestion,
  JobCategory,
  JobStatus,
  Pagination,
  TwoFactorSetup,
  UserRole,
} from "./types";

export const API_BASE = "https://gunubirlik.space-z.ai/api/v1";
const TOKEN_KEY = "gb_token";
const USER_KEY = "gb_user";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------------- Token storage ----------------
// Minimal, dependency-free storage wrapper. In Expo Go, AsyncStorage would be
// ideal; SecureStore/AsyncStorage come with expo install. We keep an in-memory
// cache + react-native AsyncStorage via a lazy import if available.

let memoryToken: string | null = null;

type MinimalStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let storage: MinimalStorage | null = null;

async function getStorage(): Promise<MinimalStorage> {
  if (storage) return storage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const asyncStorage = require("@react-native-async-storage/async-storage");
    const resolved = (asyncStorage.default ?? asyncStorage) as MinimalStorage;
    storage = resolved;
    return resolved;
  } catch {
    // Fallback: in-memory only (token survives until app restart).
    const fallback: MinimalStorage = {
      getItem: async () => memoryToken,
      setItem: async (_k, v) => {
        memoryToken = v;
      },
      removeItem: async () => {
        memoryToken = null;
      },
    };
    storage = fallback;
    return fallback;
  }
}

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  const s = await getStorage();
  memoryToken = await s.getItem(TOKEN_KEY);
  return memoryToken;
}
export async function setToken(token: string | null): Promise<void> {
  memoryToken = token;
  const s = await getStorage();
  if (token) await s.setItem(TOKEN_KEY, token);
  else await s.removeItem(TOKEN_KEY);
}

/** Cache user JSON for fast offline bootstrap (also used by AuthProvider). */
export async function cacheUserForBootstrap(user: ApiUser | null): Promise<void> {
  await cacheUser(user);
}

export async function getCachedUser(): Promise<ApiUser | null> {
  const s = await getStorage();
  const raw = await s.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

async function cacheUser(user: ApiUser | null): Promise<void> {
  const s = await getStorage();
  if (user) await s.setItem(USER_KEY, JSON.stringify(user));
  else await s.removeItem(USER_KEY);
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Web (Expo for web build) would need credentials; native does not.
  if (Platform.OS === "web") {
    config.withCredentials = true;
  }
  return config;
});

function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { error?: string; message?: string } | undefined;
    return new ApiError(
      body?.error ?? body?.message ?? "Bir şeyler ters gitti. Lütfen tekrar dene.",
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
    const body = res.data as {
      success?: boolean;
      data?: LoginResult;
      requiresTwoFactor?: boolean;
    };
    if (body?.requiresTwoFactor) {
      return { requiresTwoFactor: true };
    }
    return body.data as LoginResult;
  } catch (err) {
    throw toApiError(err);
  }
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: UserRole;
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
  await setToken(null);
  await cacheUser(null);
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

export async function uploadAvatar(file: { uri: string; name: string; type: string }): Promise<{ avatarUrl: string }> {
  try {
    const form = new FormData();
    // React Native FormData file shape
    form.append("avatar", {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);
    const res = await api.post("/auth/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data as { avatarUrl: string };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await api.post("/auth/forgot-password", { email });
  } catch (err) {
    throw toApiError(err);
  }
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  try {
    await api.post("/auth/reset-password", { email, code, newPassword });
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- 2FA ----------------

export async function setup2fa(): Promise<TwoFactorSetup> {
  try {
    const res = await api.post("/auth/2fa/setup");
    return res.data.data as TwoFactorSetup;
  } catch (err) {
    throw toApiError(err);
  }
}

export async function verify2fa(code: string): Promise<{ enabled: boolean }> {
  try {
    const res = await api.post("/auth/2fa/verify", { code });
    return res.data.data as { enabled: boolean };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function disable2fa(code: string): Promise<{ enabled: boolean }> {
  try {
    const res = await api.post("/auth/2fa/disable", { code });
    return res.data.data as { enabled: boolean };
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- Google ----------------

export interface GoogleLoginResult {
  user?: ApiUser;
  token?: string;
  isNewUser?: boolean;
}

/** idToken comes from expo-auth-session Google provider (ID token). */
export async function googleLogin(idToken: string): Promise<GoogleLoginResult> {
  try {
    const res = await api.post("/auth/google", { idToken });
    return res.data.data as GoogleLoginResult;
  } catch (err) {
    throw toApiError(err);
  }
}

// ---------------- Email change ----------------

export async function requestEmailChange(newEmail: string): Promise<void> {
  try {
    await api.post("/auth/email-change/request", { newEmail });
  } catch (err) {
    throw toApiError(err);
  }
}

export async function confirmEmailChange(code: string): Promise<{ email: string }> {
  try {
    const res = await api.post("/auth/email-change/confirm", { code });
    return res.data.data as { email: string };
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

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeAddress> {
  try {
    const res = await api.get("/geocode/reverse", { params: { lat, lng } });
    return res.data.data as GeocodeAddress;
  } catch (err) {
    throw toApiError(err);
  }
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

export function suggestAddress(q: string) {
  return geocodeList("/geocode/suggest", q);
}

export function searchAddress(q: string) {
  return geocodeList("/geocode/search", q);
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

// ---------------- System ----------------

export async function checkHealth(): Promise<boolean> {
  try {
    await api.get("/health");
    return true;
  } catch {
    return false;
  }
}
