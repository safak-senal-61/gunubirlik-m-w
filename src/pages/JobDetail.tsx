import { AppShell } from "@/components/AppShell";
import { JobMap } from "@/components/JobMap";
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
import { Textarea } from "@/components/ui/textarea";
import { useApiAuth } from "@/hooks/use-api-auth";
import { applyToJob, fetchJob, toggleSaveJob } from "@/lib/api";
import type { ApiJob } from "@/lib/api-types";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  JOB_STATUS_LABELS,
  URGENCY_CLASSES,
  URGENCY_LABELS,
  formatWage,
  parseSkills,
  timeAgo,
} from "@/lib/format";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Loader2,
  MapPin,
  Star,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useApiAuth();
  const [job, setJob] = useState<ApiJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetchJob(jobId)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : "İlan yüklenemedi"))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !job) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
          <p className="text-lg font-bold">İlan bulunamadı</p>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? "Bu ilan kaldırılmış olabilir."}</p>
          <Button asChild className="mt-6">
            <Link to="/jobs">İlanlara dön</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const isOwner = user?.id === job.employerId;
  const isWorker = user?.role === "WORKER";
  const skills = parseSkills(job.requiredSkills);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => navigate("/jobs")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Tüm ilanlar
        </button>

        {/* Header */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{job.title}</h1>
                <Badge variant="secondary">{JOB_STATUS_LABELS[job.status]}</Badge>
                {job.urgency !== "LOW" && (
                  <Badge className={`font-semibold ${URGENCY_CLASSES[job.urgency]}`}>
                    {URGENCY_LABELS[job.urgency]}
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="size-4" />
                {job.employer.companyName ?? job.employer.fullName}
                {job.employer.isVerified && <span className="text-emerald-600">✓ Doğrulanmış</span>}
              </p>
            </div>
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
              {CATEGORY_ICONS[job.category] ?? "💼"}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoTile icon={Calendar} label="İş günü" value={new Date(job.workDate).toLocaleDateString("tr-TR")} />
            <InfoTile
              icon={Clock}
              label="Saatler"
              value={`${job.startTime.slice(0, 5)}–${job.endTime.slice(0, 5)} (${job.durationHours} saat)`}
            />
            <InfoTile icon={MapPin} label="Konum" value={`${job.district}, ${job.city}`} />
            <InfoTile
              icon={Wallet}
              label="Ücret"
              value={`${formatWage(job.wageAmount, job.wageType)}${job.isWageNegotiable ? " · Pazarlık payı" : ""}`}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Yayınlandı {timeAgo(job.createdAt)} · {job.viewCount} görüntülenme · {job.applicationCount} başvuru
              {job.openingsTotal > 1 && ` · ${job.openingsFilled}/${job.openingsTotal} doluluk`}
            </p>
            {isWorker && !isOwner && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await toggleSaveJob(job.id);
                      toast.success(res.saved ? "İlan kaydedildi" : "Kayıt kaldırıldı");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
                    }
                  }}
                  className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  ♡ Kaydet
                </button>
                <ApplyDialog job={job} onApplied={() => window.location.reload()} />
              </div>
            )}
            {isOwner && (
              <Badge className="bg-primary/10 text-primary">Senin ilanın</Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
          <h2 className="text-base font-bold tracking-tight">İş açıklaması</h2>
          <div className="mt-3 space-y-3">
            {job.description.split("\n").filter(Boolean).map((para, i) => (
              <p key={i} className="text-sm leading-7 text-foreground/90">
                {para}
              </p>
            ))}
          </div>

          {skills.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aranan beceriler
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Badge key={s} variant="secondary" className="font-medium">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {job.locationNote && (
            <div className="mt-5 rounded-xl bg-muted/60 p-4 text-sm text-foreground/90">
              📍 {job.locationNote}
              {job.address && <span className="block text-xs text-muted-foreground">{job.address}</span>}
            </div>
          )}
        </div>

        {/* Mini map */}
        {job.latitude != null && job.longitude != null && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
            <div className="flex items-center justify-between px-6 pt-5">
              <h2 className="text-base font-bold tracking-tight">Konum</h2>
              <a
                href={`https://www.openstreetmap.org/?mlat=${job.latitude}&mlon=${job.longitude}#map=16/${job.latitude}/${job.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Büyük haritada aç →
              </a>
            </div>
            <JobMap
              jobs={[job]}
              className="mx-4 mb-4 mt-3 h-64 w-[calc(100%-2rem)] overflow-hidden rounded-xl"
            />
          </div>
        )}

        {/* Employer card */}
        <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
          <h2 className="text-base font-bold tracking-tight">İşveren</h2>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {(job.employer.companyName ?? job.employer.fullName).slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {job.employer.companyName ?? job.employer.fullName}
                {job.employer.isVerified && <span className="ml-1.5 text-emerald-600">✓</span>}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {job.employer.ratingAvg.toFixed(1)} ({job.employer.ratingCount} değerlendirme)
                {job.employer.phone && <> · {job.employer.phone}</>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/60 p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ApplyDialog({ job, onApplied }: { job: ApiJob; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [proposedWage, setProposedWage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await applyToJob(job.id, {
        message,
        ...(proposedWage ? { proposedWage: Number(proposedWage) } : {}),
      });
      toast.success("Başvurun gönderildi! 🎉");
      setOpen(false);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başvuru başarısız");
    } finally {
      setSaving(false);
    }
  };

  if (job.myApplication) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800">
        {job.myApplication.status === "PENDING" && "Başvurun beklemede"}
        {job.myApplication.status === "ACCEPTED" && "Başvurun kabul edildi ✓"}
        {job.myApplication.status === "REJECTED" && "Başvurun reddedildi"}
        {job.myApplication.status === "COMPLETED" && "İş tamamlandı"}
      </Badge>
    );
  }

  if (job.status !== "OPEN") {
    return (
      <Button variant="outline" disabled className="bg-card">
        Başvuruya kapalı
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Briefcase className="size-4" />
          Bu işe başvur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Başvurunu gönder</DialogTitle>
          <DialogDescription>
            Kısa bir mesaj yaz; işveren seni hemen görsün. Dilersen ücret teklifin de belirtebilirsin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apply-message">Mesajın</Label>
            <Textarea
              id="apply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Deneyimini ve neden uygun olduğunu kısaca anlat…"
              className="min-h-28"
              maxLength={1000}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apply-wage">Ücret teklifin (₺, opsiyonel)</Label>
            <Input
              id="apply-wage"
              type="number"
              min="0"
              value={proposedWage}
              onChange={(e) => setProposedWage(e.target.value)}
              placeholder={String(job.wageAmount)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              Gönder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

