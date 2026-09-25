import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCategories, fetchJobs, toggleSaveJob } from "@/lib/api";
import type { ApiCategory, ApiJob, JobCategory } from "@/lib/api-types";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  URGENCY_CLASSES,
  URGENCY_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import { Briefcase, ChevronLeft, ChevronRight, MapPin, Search, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Jobs() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasNext: false });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<JobCategory | "ALL">("ALL");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJobs({
        page,
        limit: 12,
        status: "OPEN",
        ...(category !== "ALL" ? { category } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
      });
      setJobs(res.items);
      setPagination({
        page: res.pagination.page,
        total: res.pagination.total,
        hasNext: res.pagination.hasNext,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İlanlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, category, city]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (job: ApiJob) => {
    setSaving(job.id);
    try {
      const res = await toggleSaveJob(job.id);
      setJobs((prev) =>
        res.saved
          ? prev.map((j) => (j.id === job.id ? { ...j, savedCount: j.savedCount + 1 } : j))
          : prev.map((j) => (j.id === job.id ? { ...j, savedCount: Math.max(0, j.savedCount - 1) } : j)),
      );
      toast.success(res.saved ? "İlan kaydedildi" : "Kayıt kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Bugünün işleri
          </h1>
          <p className="text-sm text-muted-foreground">
            Yakınındaki günlük işleri bul, hemen başvur.
          </p>
        </div>

        {/* Search + categories */}
        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              placeholder="Şehir ara: İstanbul, Ankara, İzmir…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <CategoryChip
              active={category === "ALL"}
              label="Tümü"
              icon="🌐"
              onClick={() => {
                setCategory("ALL");
                setPage(1);
              }}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.value}
                active={category === c.value}
                label={c.label}
                icon={CATEGORY_ICONS[c.value]}
                onClick={() => {
                  setCategory(c.value);
                  setPage(1);
                }}
              />
            ))}
          </div>
        </div>

        {/* Results */}
        <p className="mt-4 text-xs text-muted-foreground">
          {loading ? "Yükleniyor…" : `${pagination.total} ilan bulundu`}
        </p>

        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-2xl border border-border/60 bg-card"
              />
            ))
          ) : jobs.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Briefcase className="size-5" />
              </div>
              <p className="text-base font-semibold">İlan bulunamadı</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Filtreleri değiştirip tekrar dene; yeni ilanlar her gün ekleniyor.
              </p>
            </div>
          ) : (
            jobs.map((job) => (
              <JobCard key={job.id} job={job} onSave={() => handleSave(job)} saving={saving === job.id} />
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && jobs.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Önceki
            </Button>
            <span className="text-sm text-muted-foreground">
              Sayfa {pagination.page}
              {pagination.total > 0 && ` · ${pagination.total} ilan`}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CategoryChip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          : "flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      }
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

export function JobCard({
  job,
  onSave,
  saving,
}: {
  job: ApiJob;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div className="group flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/jobs/${job.id}`} className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold tracking-tight group-hover:text-primary">
            {job.title}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {job.employer.companyName ?? job.employer.fullName}
            {job.employer.isVerified && <span className="ml-1 text-emerald-600">✓</span>}
          </p>
        </Link>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
          {CATEGORY_ICONS[job.category] ?? "💼"}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="gap-1 font-medium">
          <MapPin className="size-3" />
          {job.district}, {job.city}
        </Badge>
        {job.urgency !== "LOW" && (
          <Badge className={`font-semibold ${URGENCY_CLASSES[job.urgency]}`}>
            {URGENCY_LABELS[job.urgency]}
          </Badge>
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>
          📅 {new Date(job.workDate).toLocaleDateString("tr-TR")} ·{" "}
          {job.startTime.slice(0, 5)}–{job.endTime.slice(0, 5)} ({job.durationHours} sa)
        </p>
        {job.openingsTotal > 1 && (
          <p>
            👥 {job.openingsFilled}/{job.openingsTotal} kişi alındı
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-sm">
        <p className="font-bold text-primary">{formatWage(job.wageAmount, job.wageType)}</p>
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
              aria-label="İlanı kaydet"
            >
              {saving ? "…" : "♡"}
            </button>
          )}
          <Link
            to={`/jobs/${job.id}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Detay →
          </Link>
        </div>
      </div>

      {job.employer.ratingAvg > 0 && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          {job.employer.ratingAvg.toFixed(1)} ({job.employer.ratingCount}) · {timeAgo(job.createdAt)}
        </p>
      )}
    </div>
  );
}
