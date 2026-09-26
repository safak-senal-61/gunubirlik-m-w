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
  clearApiCache();
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

// ---------------- QR ile işe başlama / bitirme ----------------

export type QrType = "CHECK_IN" | "CHECK_OUT";

export interface QrCodeData {
  token: string;
  qrImageDataUrl: string;
  expiresAt: string;
}

/** İşveren: application için CHECK_IN / CHECK_OUT QR'ı üretir (5 dk geçerli, tek kullanımlık). */
export async function generateApplicationQr(id: string, type: QrType): Promise<QrCodeData> {
  try {
    const res = await api.post(`/applications/${id}/qr-code`, { type });
    return res.data.data as QrCodeData;
  } catch (err) {
    throw toApiError(err);
  }
}

/** İşçi: işveren ekranındaki QR'ı taradığında token'ı backend'e gönderir. */
export async function scanQr(token: string): Promise<{ message: string }> {
  try {
    const res = await api.post("/qr/scan", { token });
    return res.data.data as { message: string };
  } catch (err) {
    throw toApiError(err);
  }
}

export interface QrStatusData {
  hasActiveQr: boolean;
  type?: QrType | null;
  expiresAt?: string | null;
  scannedAt?: string | null;
}

export async function fetchQrStatus(id: string): Promise<QrStatusData> {
  try {
    const res = await api.get(`/applications/${id}/qr-status`);
    return res.data.data as QrStatusData;
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

// ---------------- Bakım modu ----------------

export interface MaintenanceStatus {
  maintenanceMode: boolean;
  maintenanceTitle?: string | null;
  maintenanceMessage?: string | null;
  maintenanceEndTime?: string | null;
  maintenanceStartedAt?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  contactInstagram?: string | null;
  contactTwitter?: string | null;
  contactWebsite?: string | null;
  siteName?: string | null;
  updatedAt?: string | null;
}

/** Herkese açık bakım durumu. Hata olursa { maintenanceMode:false } döner (uygulama açılır kalır). */
export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const res = await api.get("/maintenance/status");
    return res.data.data as MaintenanceStatus;
  } catch {
    // Bakım endpoint'i erişilemezse uygulamayı kilitleme.
    return { maintenanceMode: false };
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

// ---------------- Basit önbellek (stale-while-revalidate) ----------------
// Liste uçlarını AsyncStorage'a yazar; uygulama açılışında anında eski veri
// gösterilir, arka planda tazelenir. Böylece her ekranda "Yükleniyor…" dönmez.

const CACHE_PREFIX = "gb_cache_";
const CACHE_TTL = 5 * 60 * 1000; // 5 dk sonra arka plan yenilemesi zaten yapılır

const memoryCache = new Map<string, { at: number; data: unknown }>();

async function readCache<T>(key: string): Promise<{ at: number; data: T } | null> {
  const mem = memoryCache.get(key);
  if (mem) return mem as { at: number; data: T };
  try {
    const s = await getStorage();
    const raw = await s.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(key: string, data: unknown): Promise<void> {
  const entry = { at: Date.now(), data };
  memoryCache.set(key, entry);
  try {
    const s = await getStorage();
    await s.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // önbellek yazılamazsa sessiz geç
  }
}

export function clearApiCache(): void {
  memoryCache.clear();
  void (async () => {
    try {
      const s = await getStorage();
      const raw = await s.getItem(CACHE_PREFIX + "__keys");
      if (raw) {
        const keys = JSON.parse(raw) as string[];
        await Promise.all(keys.map((k) => s.removeItem(CACHE_PREFIX + k)));
      }
      await s.removeItem(CACHE_PREFIX + "__keys");
    } catch {
      // yok say
    }
  })();
}

async function registerCacheKey(key: string): Promise<void> {
  try {
    const s = await getStorage();
    const raw = await s.getItem(CACHE_PREFIX + "__keys");
    const keys = raw ? (JSON.parse(raw) as string[]) : [];
    if (!keys.includes(key)) {
      keys.push(key);
      await s.setItem(CACHE_PREFIX + "__keys", JSON.stringify(keys));
    }
  } catch {
    // yok say
  }
}

/**
 * stale-while-revalidate: önce önbellekteki veri döner (anında), sonra ağ tazelemesi yapılır.
 * `force` ise (pull-to-refresh) doğrudan ağdan çeker. Arka plan yenilemesi bitince
 * `onUpdate` ile ekran da taze veriyi alır.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { force?: boolean; onUpdate?: (data: T) => void },
): Promise<{ data: T; fromCache: boolean; cacheAge: number | null }> {
  if (opts?.force) {
    const data = await fetcher();
    await writeCache(key, data);
    void registerCacheKey(key);
    return { data, fromCache: false, cacheAge: 0 };
  }
  const cached = await readCache<T>(key);
  const fresh = cached != null && Date.now() - cached.at < CACHE_TTL;
  if (fresh && cached) {
    return { data: cached.data, fromCache: true, cacheAge: Date.now() - cached.at };
  }
  if (cached) {
    // Eski veri hemen dönülür; ağ yenilemesi arka planda, bitince onUpdate çağrılır.
    void fetcher()
      .then(async (data) => {
        await writeCache(key, data);
        opts?.onUpdate?.(data);
      })
      .catch(() => {});
    return { data: cached.data, fromCache: true, cacheAge: Date.now() - cached.at };
  }
  const data = await fetcher();
  await writeCache(key, data);
  void registerCacheKey(key);
  return { data, fromCache: false, cacheAge: null };
}
