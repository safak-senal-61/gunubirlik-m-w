import { AppShell } from "@/components/AppShell";
import { JobMap } from "@/components/JobMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCategories, fetchJobs, suggestAddress, toggleSaveJob } from "@/lib/api";
import type { ApiCategory, ApiJob, JobCategory } from "@/lib/api-types";
import {
  CATEGORY_ICONS,
  URGENCY_CLASSES,
  URGENCY_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import {
  formatDistance,
  getCurrentPosition,
  haversineKm,
  type Coords,
} from "@/hooks/use-geolocation";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  List,
  LocateFixed,
  Map,
  MapPin,
  Search,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const RADIUS_OPTIONS = [1, 3, 5, 10, 25] as const;
const PAGE_SIZE = 24;

export default function Jobs() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasNext: false });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<JobCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Konum durumları
  const [locationQuery, setLocationQuery] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locLabel, setLocLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"distance" | "new">("new");
  const [view, setView] = useState<"list" | "map">("list");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<
    { displayName: string; lat: number; lng: number; city: string | null }[]
  >([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Autocomplete debounce
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (locationQuery.trim().length < 2 || coords) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      suggestAddress(locationQuery.trim())
        .then((items) => {
          setSuggestions(items.slice(0, 6));
          setShowSuggest(true);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [locationQuery, coords]);

  // Dışına tıklayınca önerileri kapat
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (suggestBoxRef.current && !suggestBoxRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJobs({
        page,
        limit: PAGE_SIZE,
        status: "OPEN",
        ...(category !== "ALL" ? { category } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
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
  }, [page, category, search, coords]);

  useEffect(() => {
    load();
  }, [load]);

  // Mesafe hesapla: sunucu distanceKm varsa onu, yoksa haversine kullan
  const withDistance = useMemo(
    () =>
      jobs.map((job) => {
        let km = job.distanceKm ?? null;
        if (km == null && coords && job.latitude != null && job.longitude != null) {
          km = haversineKm(coords, { lat: job.latitude, lng: job.longitude });
        }
        return { job, km };
      }),
    [jobs, coords],
  );

  // Yarıçap filtresi (sunucu radius'u filtrelemediği için istemci tarafında) + sıralama
  const visible = useMemo(() => {
    let list = withDistance;
    if (radiusKm != null) {
      list = list.filter(({ job, km }) => {
        if (km != null) return km <= radiusKm;
        // Konumu olmayan ilan yarıçap filtresinde gösterilmez
        return false;
      });
    }
    if (coords && sortBy === "distance") {
      list = [...list].sort((a, b) => {
        const av = a.km ?? Number.POSITIVE_INFINITY;
        const bv = b.km ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
    } else if (sortBy === "new") {
      list = [...list].sort(
        (a, b) => new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime(),
      );
    }
    return list;
  }, [withDistance, radiusKm, coords, sortBy]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const c = await getCurrentPosition();
      setCoords(c);
      setLocLabel("Konumum");
      setLocationQuery("");
      setSuggestions([]);
      setPage(1);
      toast.success("Konumun alındı — mesafeler hesaplanıyor");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konum alınamadı");
    } finally {
      setLocating(false);
    }
  };

  const pickSuggestion = (s: { displayName: string; lat: number; lng: number }) => {
    setCoords({ lat: s.lat, lng: s.lng });
    setLocLabel(s.displayName.split(",").slice(0, 2).join(",").trim());
    setShowSuggest(false);
    setPage(1);
  };

  const clearLocation = () => {
    setCoords(null);
    setLocLabel(null);
    setLocationQuery("");
    setRadiusKm(null);
    setSuggestions([]);
    setPage(1);
  };

  const handleSave = async (job: ApiJob) => {
    setSaving(job.id);
    try {
      const res = await toggleSaveJob(job.id);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, savedCount: res.saved ? j.savedCount + 1 : Math.max(0, j.savedCount - 1) }
            : j,
        ),
      );
      toast.success(res.saved ? "İlan kaydedildi" : "Kayıt kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setSaving(null);
    }
  };

  const mapJobs = visible.map(({ job }) => job).filter((j) => j.latitude != null && j.longitude != null);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Bugünün işleri</h1>
          <p className="text-sm text-muted-foreground">
            Yakınındaki günlük işleri bul, hemen başvur.
          </p>
        </div>

        {/* Konum + arama */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div ref={suggestBoxRef} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                placeholder="Adres, mahalle, ilçe ara…"
                className="pl-9"
              />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.lat},${s.lng},${s.displayName}`}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.displayName.split(",").slice(0, 3).join(", ")}</span>
                        {s.city && <span className="block truncate text-xs text-muted-foreground">{s.city}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={coords ? "default" : "outline"}
                className="gap-1.5"
                disabled={locating}
                onClick={useMyLocation}
              >
                {locating ? <LocateFixed className="size-4 animate-pulse" /> : <Crosshair className="size-4" />}
                {locating ? "Alınıyor…" : "Konumum"}
              </Button>
              <div className="flex rounded-lg border border-border/70 bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="Liste görünümü"
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="size-3.5" />
                  Liste
                </button>
                <button
                  type="button"
                  onClick={() => setView("map")}
                  aria-label="Harita görünümü"
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Map className="size-3.5" />
                  Harita
                </button>
              </div>
            </div>
          </div>

          {/* Aktif konum rozeti + yarıçap filtresi */}
          {coords && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <MapPin className="size-3" />
                {locLabel ?? "Konumum"}
                <button
                  type="button"
                  onClick={clearLocation}
                  className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
                  aria-label="Konumu temizle"
                >
                  <X className="size-3" />
                </button>
              </span>
              <span className="text-xs text-muted-foreground">Yarıçap:</span>
              <button
                type="button"
                onClick={() => setRadiusKm(null)}
                className={
                  radiusKm == null
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                Tümü
              </button>
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusKm(r)}
                  className={
                    radiusKm === r
                      ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                      : "rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {r} km
                </button>
              ))}
              {coords && (
                <div className="ml-auto flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Sırala:</span>
                  <button
                    type="button"
                    onClick={() => setSortBy("distance")}
                    className={`rounded-md px-2 py-1 font-semibold transition-colors ${sortBy === "distance" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Mesafe
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("new")}
                    className={`rounded-md px-2 py-1 font-semibold transition-colors ${sortBy === "new" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Yeni
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Kategori çipleri + metin araması */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Briefcase className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="İlan başlığı veya açıklamada ara…"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-1 sm:justify-end">
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
        </div>

        {/* Sonuç sayısı */}
        <p className="mt-4 text-xs text-muted-foreground">
          {loading
            ? "Yükleniyor…"
            : `${visible.length} ilan${coords ? (radiusKm != null ? ` · ${radiusKm} km içinde` : " · konumuna göre") : ""}`}
        </p>

        {/* İçerik: liste veya harita */}
        {view === "map" ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
            <JobMap
              jobs={mapJobs}
              userCoords={coords}
              radiusKm={radiusKm}
              className="h-[60vh] min-h-[420px] w-full"
            />
            {!loading && mapJobs.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Haritada gösterilecek konumlu ilan yok.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-2xl border border-border/60 bg-card"
                />
              ))
            ) : visible.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Briefcase className="size-5" />
                </div>
                <p className="text-base font-semibold">İlan bulunamadı</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {radiusKm != null
                    ? `Seçtiğin ${radiusKm} km yarıçapta ilan yok; yarıçapı büyütmeyi dene.`
                    : "Filtreleri değiştirip tekrar dene; yeni ilanlar her gün ekleniyor."}
                </p>
              </div>
            ) : (
              visible.map(({ job, km }) => (
                <JobCard
                  key={job.id}
                  job={job}
                  distanceKm={km}
                  onSave={() => handleSave(job)}
                  saving={saving === job.id}
                />
              ))
            )}
          </div>
        )}

        {/* Sayfalama */}
        {view === "list" && !loading && jobs.length > 0 && (
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
  distanceKm,
  onSave,
  saving,
}: {
  job: ApiJob;
  distanceKm?: number | null;
  onSave?: () => void;
  saving?: boolean;
}) {
  const dist = formatDistance(distanceKm);

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
        {dist && (
          <Badge className="gap-1 bg-primary/10 font-semibold text-primary">
            {dist}
          </Badge>
        )}
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
