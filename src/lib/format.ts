import type {
  ApplicationStatus,
  JobCategory,
  JobStatus,
  Urgency,
} from "./api-types";

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

export const APPLICATION_STATUS_CLASSES: Record<ApplicationStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  COMPLETED: "bg-indigo-100 text-indigo-800",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  LOW: "Normal",
  MEDIUM: "Orta",
  HIGH: "Acil",
};

export const URGENCY_CLASSES: Record<Urgency, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-rose-100 text-rose-800",
};

export function formatWage(amount: number, wageType: string, currency = "TRY") {
  const suffix = wageType === "HOURLY" ? "/saat" : "/gün";
  return `${amount.toLocaleString("tr-TR")} ₺${suffix}`;
}

export function formatDate(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function timeAgo(input: string | Date) {
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

export function timeRange(start: string, end: string) {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
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
