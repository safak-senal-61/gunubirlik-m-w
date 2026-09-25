import {
  AppShell,
  JOB_TYPE_LABELS,
  formatSalary,
  timeAgo,
} from "@/components/AppShell";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Clock,
  Loader2,
  MapPin,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user, isLoading, signOut, isAuthenticated } = useAuth();

  const job = useQuery(
    api.jobs.getJob,
    jobId ? { jobId: jobId as Id<"jobs"> } : "skip",
  );

  if (!isLoading && !isAuthenticated) {
    return <NavigateToAuth jobId={jobId} />;
  }

  if (isLoading || job === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (job === null) {
    return (
      <AppShell
        navLinks={[{ label: "İş ilanları", to: "/jobs" }]}
        user={user}
        onSignOut={async () => {
          await signOut();
          navigate("/");
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
          <p className="text-lg font-bold">İlan bulunamadı</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu ilan kaldırılmış olabilir.
          </p>
          <Button asChild className="mt-6">
            <Link to="/jobs">İlanlara dön</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const navLinks = [
    { label: "İş ilanları", to: "/jobs" },
    { label: "Başvurularım", to: "/applications" },
  ];

  return (
    <AppShell
      navLinks={navLinks}
      user={user}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => navigate("/jobs")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Tüm ilanlar
        </button>

        {/* Header card */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {job.title}
                </h1>
                {!job.isActive && (
                  <Badge variant="secondary">Başvuruya kapalı</Badge>
                )}
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="size-4" />
                {job.company}
              </p>
            </div>
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Briefcase className="size-7" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InfoTile icon={MapPin} label="Konum" value={job.location} />
            <InfoTile
              icon={Clock}
              label="Çalışma şekli"
              value={JOB_TYPE_LABELS[job.type]}
            />
            <InfoTile
              icon={Wallet}
              label="Maaş aralığı"
              value={formatSalary(job.salaryMin, job.salaryMax)}
            />
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              Yayınlandı {timeAgo(job._creationTime)}
            </p>
            <ApplyDialog
              jobId={job._id}
              isActive={job.isActive}
              canApply={user?.appRole !== "employer"}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
          <h2 className="text-base font-bold tracking-tight">Pozisyon hakkında</h2>
          <div className="mt-3 space-y-3">
            {job.description.split("\n").filter(Boolean).map((para, i) => (
              <p key={i} className="text-sm leading-7 text-foreground/90">
                {para}
              </p>
            ))}
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

function NavigateToAuth({ jobId }: { jobId?: string }) {
  const returnTo = jobId ? `/jobs/${jobId}` : "/jobs";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Briefcase className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-bold">Başvuru yapmak için giriş yap</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Giriş yaptıktan sonra bu ilana geri döneceksin.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}>
            Giriş yap
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/jobs">İlanlara dön</Link>
        </Button>
      </div>
    </div>
  );
}

function ApplyDialog({
  jobId,
  isActive,
  canApply,
}: {
  jobId: Id<"jobs">;
  isActive: boolean;
  canApply: boolean;
}) {
  const applyToJob = useMutation(api.applications.applyToJob);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setSaving(true);
    setError(null);
    try {
      await applyToJob({ jobId, coverNote: note });
      toast.success("Başvurun iletildi! 🎉");
      setOpen(false);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  if (!isActive) {
    return (
      <Button variant="outline" disabled className="bg-card">
        Başvuruya kapalı
      </Button>
    );
  }

  if (!canApply) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">Bu işe başvur</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Başvurunu gönder</DialogTitle>
          <DialogDescription>
            Kısa bir ön yazı yaz; işveren başvurunu hemen görsün.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Neden bu pozisyon sana uygun? Birkaç cümleyle anlat…"
          className="min-h-32"
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground">
          {note.length}/1000 karakter
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={handleApply} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Başvuruyu gönder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
