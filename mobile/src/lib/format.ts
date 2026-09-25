import type { ApplicationStatus, JobCategory, JobStatus, Urgency } from "./types";

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  INSAAT: "İnşaat & Yapı",
  RESTAURANT: "Restoran & Gastronomi",
  TEMIZLIK: "Temizlik & Hijyen",
  NAKLIYE: "Nakliyat & Lojistik",
  TARIM: "Tarım & Hayvancılık",
  TEKNIK: "Teknik & Servis",
  SAGLIK: "Sağlık & Bakım",
  DIGER: "Diğer",
};

export const CATEGORY_ICONS: Record<JobCategory, string> = {
  INSAAT: "🏗️",
  RESTAURANT: "🍽️",
  TEMIZLIK: "🧹",
  NAKLIYE: "🚚",
  TARIM: "🌱",
  TEKNIK: "🔧",
  SAGLIK: "❤️",
  DIGER: "💼",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  OPEN: "Açık",
  FILLED: "Dolduruldu",
  CLOSED: "Kapandı",
  CANCELLED: "İptal",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "Beklemede",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  COMPLETED: "Tamamlandı",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  PENDING: "#b45309",
  ACCEPTED: "#047857",
  REJECTED: "#be123c",
  COMPLETED: "#4338ca",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  LOW: "Normal",
  MEDIUM: "Orta",
  HIGH: "Acil",
  NORMAL: "Normal",
  URGENT: "Acil",
};

export const URGENCY_COLORS: Record<Urgency, string> = {
  LOW: "#047857",
  MEDIUM: "#b45309",
  HIGH: "#be123c",
  NORMAL: "#047857",
  URGENT: "#be123c",
};

export function formatWage(amount: number, wageType: string, currency = "TRY"): string {
  const suffix = wageType === "HOURLY" ? "/saat" : "/gün";
  return `${amount.toLocaleString("tr-TR")} ₺${suffix}`;
}

export function formatDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function timeAgo(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDateShort(d);
}

export function timeRange(start: string, end: string): string {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

/** 0.42 → "420 m", 3.5 → "3,5 km", 13 → "13 km" */
export function formatDistance(km: number | null | undefined): string | null {
  if (km == null || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export function parseSkills(skills: string[] | string | null): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills;
  try {
    const parsed = JSON.parse(skills);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** İki nokta arası kuş uçuşu mesafe (km). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
