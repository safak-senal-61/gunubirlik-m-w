import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiAuth } from "@/hooks/use-api-auth";
import {
  addressToFormFields,
  locateAndReverse,
  type Coords,
} from "@/hooks/use-geolocation";
import {
  createJob,
  deleteJob,
  fetchApplications,
  fetchCategories,
  fetchJobs,
  updateJob,
} from "@/lib/api";
import type { ApiCategory, ApiJob, JobCategory, JobStatus } from "@/lib/api-types";
import {
  CATEGORY_ICONS,
  JOB_STATUS_LABELS,
  URGENCY_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import {
  Briefcase,
  Inbox,
  Loader2,
  LocateFixed,
  Plus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const STATUS_CLASSES: Record<JobStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-800",
  FILLED: "bg-indigo-100 text-indigo-800",
  CLOSED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-stone-200 text-stone-700",
};

export default function Dashboard() {
  const { user } = useApiAuth();
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJobs({ mine: true, limit: 50 });
      setJobs(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İlanlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalApps = jobs.reduce((s, j) => s + j.applicationCount, 0);
  const openJobs = jobs.filter((j) => j.status === "OPEN").length;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Merhaba{user?.companyName ? `, ${user.companyName}` : ""} 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              İlanlarını yönet, başvuruları takip et.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="mt-3 gap-1.5 sm:mt-0">
                <Plus className="size-4" />
                İlan ver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Yeni günübirlik iş ilanı</DialogTitle>
                <DialogDescription>
                  Detayları gir; ilanın anında işçilere görünür.
                </DialogDescription>
              </DialogHeader>
              <CreateJobForm
                onDone={() => {
                  setCreateOpen(false);
                  load();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard icon={Briefcase} label="Açık ilan" value={String(openJobs)} />
          <StatCard icon={Inbox} label="Toplam başvuru" value={String(totalApps)} />
          <StatCard icon={Users} label="Tüm ilanlar" value={String(jobs.length)} />
        </div>

        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Briefcase className="size-5" />
              </div>
              <p className="text-base font-semibold">Henüz ilanın yok</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                İlk günübirlik iş ilanını yayınla; işçiler aynı gün başvursun.
              </p>
            </div>
          ) : (
            jobs.map((job) => <EmployerJobCard key={job.id} job={job} onChanged={load} />)
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function EmployerJobCard({ job, onChanged }: { job: ApiJob; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: JobStatus) => {
    setBusy(true);
    try {
      await updateJob(job.id, { status });
      toast.success("İlan güncellendi");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Bu ilan kalıcı olarak silinsin mi?")) return;
    setBusy(true);
    try {
      await deleteJob(job.id);
      toast.success("İlan silindi");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silme başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">{CATEGORY_ICONS[job.category]}</span>
            <h3 className="text-base font-bold tracking-tight">{job.title}</h3>
            <Badge className={`font-medium ${STATUS_CLASSES[job.status]}`}>
              {JOB_STATUS_LABELS[job.status]}
            </Badge>
            {job.urgency !== "LOW" && (
              <Badge variant="secondary" className="font-medium">
                {URGENCY_LABELS[job.urgency]}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            📅 {new Date(job.workDate).toLocaleDateString("tr-TR")} ·{" "}
            {job.startTime.slice(0, 5)}–{job.endTime.slice(0, 5)} · {job.district}, {job.city}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatWage(job.wageAmount, job.wageType)} · {job.applicationCount} başvuru ·{" "}
            {job.openingsFilled}/{job.openingsTotal} doluluk · {timeAgo(job.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap shrink-0 items-center gap-2">
          {job.status === "OPEN" ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("CLOSED")}>
              Kapat
            </Button>
          ) : job.status === "CLOSED" || job.status === "CANCELLED" ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus("OPEN")}>
              Yeniden aç
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            disabled={busy}
            onClick={remove}
          >
            Sil
          </Button>
        </div>
      </div>
      <div className="border-t border-border/60 px-5 py-3">
        <Link
          to={`/applications?jobId=${job.id}`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Başvuruları gör ({job.applicationCount}) →
        </Link>
      </div>
    </div>
  );
}

function CreateJobForm({ onDone }: { onDone: () => void }) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<JobCategory>("INSAAT");
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [wageAmount, setWageAmount] = useState("");
  const [wageType, setWageType] = useState<"DAILY" | "HOURLY">("DAILY");
  const [city, setCity] = useState("İstanbul");
  const [district, setDistrict] = useState("Kadıköy");
  const [address, setAddress] = useState("");
  const [latLng, setLatLng] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [openingsTotal, setOpeningsTotal] = useState("1");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategory(cats[0].value);
    }).catch(() => {});
  }, []);

  // Auto-compute duration from start/end times
  const durationHours = (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return Math.round((diff / 60) * 10) / 10;
  })();

  const grabLocation = async () => {
    setLocating(true);
    try {
      const { coords, address: addr } = await locateAndReverse();
      const fields = addressToFormFields(addr);
      if (fields.city) setCity(fields.city);
      if (fields.district) setDistrict(fields.district);
      if (fields.addressText) setAddress(fields.addressText);
      setLatLng(coords);
      toast.success("Konum alındı ve forma işlendi 📍");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konum alınamadı");
    } finally {
      setLocating(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wage = Number(wageAmount);
    const openings = Number(openingsTotal);
    if (!title.trim() || !description.trim() || !workDate || !wage) {
      setError("Lütfen zorunlu alanları doldur.");
      return;
    }
    if (description.trim().length < 20) {
      setError("Açıklama en az 20 karakter olmalı.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createJob({
        title,
        description,
        category,
        workDate,
        startTime,
        endTime,
        durationHours,
        wageAmount: wage,
        wageType,
        city,
        district,
        ...(address ? { address } : {}),
        ...(latLng ? { latitude: latLng.lat, longitude: latLng.lng } : {}),
        openingsTotal: openings || 1,
        urgency,
        ...(requiredSkills.trim()
          ? { requiredSkills: requiredSkills.split(",").map((s) => s.trim()).filter(Boolean) }
          : {}),
      });
      toast.success("İlanın yayında! 🎉");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İlan oluşturulamadı");
    } finally {
      setSaving(false);
    }
  };

  const label = "text-sm font-semibold";
  const input = "mt-1.5";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="cj-title" className={label}>İş başlığı *</Label>
        <Input id="cj-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. İnşaat İşçisi Aranıyor" className={input} required />
      </div>

      <div>
        <Label htmlFor="cj-cat" className={label}>Kategori *</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as JobCategory)}>
          <SelectTrigger id="cj-cat" className={`${input} w-full`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.icon} {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="cj-desc" className={label}>Açıklama * <span className="text-xs font-normal text-muted-foreground">(min 20 karakter)</span></Label>
        <Textarea id="cj-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Yapılacak işleri, beklenen deneyimi ve sağlanan olanakları yaz…" className={`${input} min-h-24`} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cj-date" className={label}>İş günü *</Label>
          <Input id="cj-date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className={input} required />
        </div>
        <div>
          <Label className={label}>Süre</Label>
          <p className={`${input} rounded-lg bg-muted px-3 py-2 text-sm`}>{durationHours} saat</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cj-start" className={label}>Başlangıç *</Label>
          <Input id="cj-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={input} required />
        </div>
        <div>
          <Label htmlFor="cj-end" className={label}>Bitiş *</Label>
          <Input id="cj-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={input} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cj-wage" className={label}>Ücret (₺) *</Label>
          <Input id="cj-wage" type="number" min="0" value={wageAmount} onChange={(e) => setWageAmount(e.target.value)} placeholder="2500" className={input} required />
        </div>
        <div>
          <Label htmlFor="cj-wagetype" className={label}>Ücret türü</Label>
          <Select value={wageType} onValueChange={(v) => setWageType(v as "DAILY" | "HOURLY")}>
            <SelectTrigger id="cj-wagetype" className={`${input} w-full`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Günlük</SelectItem>
              <SelectItem value="HOURLY">Saatlik</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cj-city" className={label}>İl *</Label>
          <Input id="cj-city" value={city} onChange={(e) => setCity(e.target.value)} className={input} required />
        </div>
        <div>
          <Label htmlFor="cj-district" className={label}>İlçe *</Label>
          <Input id="cj-district" value={district} onChange={(e) => setDistrict(e.target.value)} className={input} required />
        </div>
      </div>

      {/* Konum Al: GPS + reverse geocoding ile il/ilçe/adres + koordinat */}
      <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">İş konumu</p>
            <p className="truncate text-xs text-muted-foreground">
              {latLng
                ? `📍 ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)} — ilan haritada gösterilecek`
                : "Konum ekle; işçiler ilanı haritada ve mesafe sıralamasında görsün."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-card" disabled={locating} onClick={grabLocation}>
              {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
              {locating ? "Alınıyor…" : "Konum Al"}
            </Button>
            {latLng && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLatLng(null)}>
                Kaldır
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cj-openings" className={label}>Kişi sayısı</Label>
          <Input id="cj-openings" type="number" min="1" value={openingsTotal} onChange={(e) => setOpeningsTotal(e.target.value)} className={input} />
        </div>
        <div>
          <Label htmlFor="cj-urgency" className={label}>Aciliyet</Label>
          <Select value={urgency} onValueChange={(v) => setUrgency(v as "LOW" | "MEDIUM" | "HIGH")}>
            <SelectTrigger id="cj-urgency" className={`${input} w-full`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Normal</SelectItem>
              <SelectItem value="MEDIUM">Orta</SelectItem>
              <SelectItem value="HIGH">Acil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="cj-address" className={label}>Adres (opsiyonel)</Label>
        <Input id="cj-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mahalle, cadde…" className={input} />
      </div>

      <div>
        <Label htmlFor="cj-skills" className={label}>Aranan beceriler <span className="text-xs font-normal text-muted-foreground">(virgülle ayır)</span></Label>
        <Input id="cj-skills" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="İnşaat işçisi, Kalıpçı" className={input} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Yayınla
        </Button>
      </div>
    </form>
  );
}
