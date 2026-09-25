// Types for the Günübirlik backend API (https://gunubirlik.space-z.ai/api/v1).
// Shapes verified against live responses.

export type JobCategory =
  | "INSAAT"
  | "RESTAURANT"
  | "TEMIZLIK"
  | "NAKLIYE"
  | "TARIM"
  | "TEKNIK"
  | "SAGLIK"
  | "DIGER";

export type JobStatus = "OPEN" | "FILLED" | "CLOSED" | "CANCELLED";

/** The API sends both LOW/MEDIUM/HIGH (on create) and NORMAL/URGENT (seed data). */
export type Urgency = "LOW" | "MEDIUM" | "HIGH" | "NORMAL" | "URGENT";

export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED";

export type UserRole = "WORKER" | "EMPLOYER";

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiCategory {
  value: JobCategory;
  label: string;
  icon: string;
}

export interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  city: string;
  district: string;
  companyName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  skills: string[];
  experienceYears: number | null;
  hourlyWageMin: number | null;
  hourlyWageMax: number | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Employer info embedded in job objects (subset of ApiUser). */
export interface ApiEmployer {
  id: string;
  fullName: string;
  companyName: string | null;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  avatarUrl: string | null;
  phone?: string;
}

export interface ApiJob {
  id: string;
  employerId: string;
  employer: ApiEmployer;
  title: string;
  description: string;
  category: JobCategory;
  requiredSkills: string[] | string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  wageAmount: number;
  wageType: "DAILY" | "HOURLY";
  currency: string;
  isWageNegotiable: boolean;
  city: string;
  district: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationNote: string | null;
  openingsTotal: number;
  openingsFilled: number;
  status: JobStatus;
  urgency: Urgency;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  applicationCount: number;
  savedCount: number;
  /** Present when the current user has applied to this job. */
  myApplication: ApiApplication | null;
}

export interface ApiApplication {
  id: string;
  jobId?: string;
  job?: ApiJob | null;
  worker?: {
    id?: string;
    fullName: string;
    avatarUrl?: string | null;
    ratingAvg?: number;
    ratingCount?: number;
    phone?: string;
  } | null;
  status: ApplicationStatus;
  message?: string | null;
  proposedWage?: number | null;
  employerNote?: string | null;
  rating?: number | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiConversation {
  id: string;
  participant: {
    id: string;
    fullName: string;
    companyName?: string | null;
    avatarUrl?: string | null;
    role?: UserRole;
  };
  job?: { id: string; title: string } | null;
  lastMessage?: { id?: string; content: string; createdAt: string } | null;
  unreadCount: number;
  updatedAt?: string;
}

export interface ApiMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead?: boolean;
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    jobId?: string;
    conversationId?: string;
    applicationId?: string;
  } | null;
}
