import { Logo, STATUS_META, formatSalary, timeAgo } from "@/components/AppShell";
import { JOB_TYPE_LABELS } from "@/components/AppShell";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Inbox,
  Loader2,
  LogOut,
  Plus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type Job = Doc<"jobs"> & {
  applicationCount: number;
  pendingCount: number;
};

export default function Dashboard() {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const jobs = useQuery(api.jobs.myJobs);
  const applicants = useQuery(api.applications.allApplicants);

  const [tab, setTab] = useState<"jobs" | "applicants">("jobs");
  const [createOpen, setCreateOpen] = useState(false);

  // ?new=1 opens the create dialog (e.g. from the header CTA)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!user.appRole) {
    return <Navigate to="/onboarding" replace />;
  }

  if (user.appRole === "seeker") {
    return <Navigate to="/jobs" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const activeJobs = (jobs ?? []).filter((j) => j.isActive).length;
  const totalApps = (jobs ?? []).reduce((sum, j) => sum + j.applicationCount, 0);
  const pendingApps = applicants?.filter((a) => a.status === "pending").length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user.companyName}
            </span>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* Greeting + stats */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Merhaba{user.companyName ? `, ${user.companyName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            İlanlarını yönet, başvuruları değerlendir.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard icon={Briefcase} label="Aktif ilan" value={String(activeJobs)} />
          <StatCard icon={Users} label="Toplam başvuru" value={String(totalApps)} />
          <StatCard icon={Inbox} label="Bekleyen başvuru" value={String(pendingApps)} highlight={pendingApps > 0} />
        </div>

        {/* Tabs */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border/70 bg-muted/60 p-1">
            {(
              [
                { key: "jobs", label: `İlanlarım (${jobs?.length ?? 0})` },
                {
                  key: "applicants",
                  label: `Başvurular (${applicants?.length ?? 0})`,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  tab === t.key
                    ? "rounded-full bg-card px-4 py-1.5 text-sm font-semibold shadow-soft"
                    : "rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5">
                <Plus className="size-4" />
                İlan ver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Yeni ilan yayınla</DialogTitle>
                <DialogDescription>
                  Pozisyon detaylarını gir; ilan anında iş arayanlara görünür.
                </DialogDescription>
              </DialogHeader>
              <CreateJobForm onDone={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {tab === "jobs" ? (
            <JobsTab jobs={jobs} />
          ) : (
            <ApplicantsTab applicants={applicants} />
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div
          className={
            highlight
              ? "flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
              : "flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function JobsTab({ jobs }: { jobs: Job[] | undefined }) {
  if (jobs === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Briefcase className="size-5" />
        </div>
        <p className="text-base font-semibold">Henüz ilanın yok</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          İlk ilanını yayınla ve adayların başvurularını bu ekrandan takip et.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <EmployerJobCard key={job._id} job={job} />
      ))}
    </div>
  );
}

function EmployerJobCard({ job }: { job: Job }) {
  const setJobActive = useMutation(api.jobs.setJobActive);
  const deleteJob = useMutation(api.jobs.deleteJob);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const applicants = useQuery(
    api.applications.jobApplicants,
    expanded ? { jobId: job._id } : "skip",
  );

  const handleToggle = async () => {
    setBusy(true);
    try {
      await setJobActive({ jobId: job._id, isActive: !job.isActive });
      toast.success(job.isActive ? "İlan duraklatıldı" : "İlan tekrar aktif");
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteJob({ jobId: job._id });
      toast.success("İlan ve başvuruları silindi");
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight">{job.title}</h3>
            {job.isActive ? (
              <Badge className="bg-emerald-100 text-emerald-800">Aktif</Badge>
            ) : (
              <Badge variant="secondary">Duraklatıldı</Badge>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" />
              {job.company}
            </span>
            <span>{job.location}</span>
            <span>{JOB_TYPE_LABELS[job.type]}</span>
            <span>{formatSalary(job.salaryMin, job.salaryMax)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={handleToggle}
          >
            {job.isActive ? "Duraklat" : "Aktifleştir"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            disabled={busy}
            onClick={() => {
              if (confirm("Bu ilan ve tüm başvuruları silinsin mi?")) {
                handleDelete();
              }
            }}
          >
            Sil
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between border-t border-border/60 px-5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <Users className="size-4" />
          {job.applicationCount} başvuru
          {job.pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800">
              {job.pendingCount} bekliyor
            </Badge>
          )}
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border/60 bg-muted/40 px-5 py-4">
          {applicants === undefined ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : applicants.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Bu ilana henüz başvuru yok.
            </p>
          ) : (
            applicants.map((app) => <ApplicantRow key={app._id} app={app} />)
          )}
        </div>
      )}
    </div>
  );
}

type Applicant = {
  _id: Id<"applications">;
  status: "pending" | "accepted" | "rejected";
  coverNote: string;
  applicantName: string;
  applicantEmail: string | null;
  _creationTime: number;
};

function ApplicantRow({ app }: { app: Applicant }) {
  const updateStatus = useMutation(api.applications.updateApplicationStatus);
  const [busy, setBusy] = useState(false);

  const set = async (status: "pending" | "accepted" | "rejected") => {
    setBusy(true);
    try {
      await updateStatus({ applicationId: app._id, status });
      if (status === "accepted") toast.success("Başvuru kabul edildi");
      if (status === "rejected") toast.success("Başvuru reddedildi");
      if (status === "pending") toast.success("Başvuru beklemede");
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };

  const meta = STATUS_META[app.status];

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">{app.applicantName}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>
              {meta.label}
            </span>
          </div>
          {app.applicantEmail && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {app.applicantEmail} · {timeAgo(app._creationTime)}
            </p>
          )}
          {app.coverNote && (
            <p className="mt-2 rounded-lg bg-muted/70 px-3 py-2 text-sm leading-6 text-foreground/90">
              “{app.coverNote}”
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {app.status !== "accepted" && (
            <Button
              size="sm"
              className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={busy}
              onClick={() => set("accepted")}
            >
              Kabul et
            </Button>
          )}
          {app.status !== "rejected" && (
            <Button
              size="sm"
              variant="outline"
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              disabled={busy}
              onClick={() => set("rejected")}
            >
              Reddet
            </Button>
          )}
          {app.status !== "pending" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => set("pending")}
            >
              Geri al
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ApplicantsTab({
  applicants,
}: {
  applicants:
    | {
        _id: Id<"applications">;
        _creationTime: number;
        status: "pending" | "accepted" | "rejected";
        coverNote: string;
        jobTitle: string;
        jobIsActive: boolean;
        applicantName: string;
        applicantEmail: string | null;
      }[]
    | undefined;
}) {
  if (applicants === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="size-5" />
        </div>
        <p className="text-base font-semibold">Henüz başvuru yok</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          İlanların yayında oldukça adayların başvuruları burada listelenecek.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {applicants.map((app) => (
        <div
          key={app._id}
          className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold">{app.applicantName}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[app.status].className}`}
                >
                  {STATUS_META[app.status].label}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">
                  {app.jobTitle}
                </span>
                {app.applicantEmail && <> · {app.applicantEmail}</>} ·{" "}
                {timeAgo(app._creationTime)}
              </p>
              {app.coverNote && (
                <p className="mt-2 rounded-lg bg-muted/70 px-3 py-2 text-sm leading-6 text-foreground/90">
                  “{app.coverNote}”
                </p>
              )}
            </div>
            <StatusButtons applicationId={app._id} status={app.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusButtons({
  applicationId,
  status,
}: {
  applicationId: Id<"applications">;
  status: "pending" | "accepted" | "rejected";
}) {
  const updateStatus = useMutation(api.applications.updateApplicationStatus);
  const [busy, setBusy] = useState(false);

  const set = async (next: "pending" | "accepted" | "rejected") => {
    setBusy(true);
    try {
      await updateStatus({ applicationId, status: next });
      toast.success("Başvuru güncellendi");
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 gap-2">
      {status !== "accepted" && (
        <Button
          size="sm"
          className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={busy}
          onClick={() => set("accepted")}
        >
          Kabul et
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          size="sm"
          variant="outline"
          className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          disabled={busy}
          onClick={() => set("rejected")}
        >
          Reddet
        </Button>
      )}
      {status !== "pending" && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => set("pending")}>
          Geri al
        </Button>
      )}
    </div>
  );
}

function CreateJobForm({ onDone }: { onDone: () => void }) {
  const createJob = useMutation(api.jobs.createJob);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<"full_time" | "part_time" | "contract" | "internship">(
    "full_time",
  );
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = Number(salaryMin);
    const max = Number(salaryMax);
    if (!title.trim() || !location.trim() || !description.trim()) {
      setError("Lütfen tüm alanları doldur.");
      return;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
      setError("Maaş aralığı pozitif sayılar olmalı.");
      return;
    }
    if (min > max) {
      setError("Alt maaş sınırı üst sınırdan büyük olamaz.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createJob({
        title,
        location,
        type,
        salaryMin: min,
        salaryMax: max,
        description,
      });
      toast.success("İlanın yayında! 🎉");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setSaving(false);
    }
  };

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="job-title" className="text-sm font-semibold">
          Pozisyon adı
        </label>
        <Input
          id="job-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn. Kıdemli Frontend Geliştirici"
          className="mt-1.5"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="job-location" className="text-sm font-semibold">
            Konum
          </label>
          <Input
            id="job-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Örn. İstanbul · Hibrit"
            className="mt-1.5"
            required
          />
        </div>
        <div>
          <label htmlFor="job-type" className="text-sm font-semibold">
            Çalışma şekli
          </label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id="job-type" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Tam zamanlı</SelectItem>
              <SelectItem value="part_time">Yarı zamanlı</SelectItem>
              <SelectItem value="contract">Sözleşmeli</SelectItem>
              <SelectItem value="internship">Staj</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="job-smin" className="text-sm font-semibold">
            Maaş (alt) ₺
          </label>
          <Input
            id="job-smin"
            type="number"
            min="0"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="45000"
            className="mt-1.5"
            required
          />
        </div>
        <div>
          <label htmlFor="job-smax" className="text-sm font-semibold">
            Maaş (üst) ₺
          </label>
          <Input
            id="job-smax"
            type="number"
            min="0"
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            placeholder="70000"
            className="mt-1.5"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="job-desc" className="text-sm font-semibold">
          Açıklama
        </label>
        <Textarea
          id="job-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Pozisyonun sorumlulukları, aradığın özellikler ve sunduğun olanaklar…"
          className="mt-1.5 min-h-28"
          required
        />
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
