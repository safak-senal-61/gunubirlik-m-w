import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useApiAuth } from "@/hooks/use-api-auth";
import {
  fetchApplications,
  rateApplication,
  updateApplicationStatus,
} from "@/lib/api";
import type { ApiApplication } from "@/lib/api-types";
import {
  APPLICATION_STATUS_CLASSES,
  APPLICATION_STATUS_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import { FileText, Inbox, Loader2, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Applications() {
  const { user } = useApiAuth();
  const [apps, setApps] = useState<ApiApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED">("ALL");
  const isEmployer = user?.role === "EMPLOYER";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setApps(await fetchApplications());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Başvurular yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);
  const counts = {
    ALL: apps.length,
    PENDING: apps.filter((a) => a.status === "PENDING").length,
    ACCEPTED: apps.filter((a) => a.status === "ACCEPTED").length,
    REJECTED: apps.filter((a) => a.status === "REJECTED").length,
    COMPLETED: apps.filter((a) => a.status === "COMPLETED").length,
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {isEmployer ? "Gelen başvurular" : "Başvurularım"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEmployer
              ? "İlanlarına yapılan başvurları değerlendir, kabul et veya reddet."
              : "Gönderdiğin başvuruların durumunu buradan takip et."}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {(
            [
              ["ALL", "Tümü"],
              ["PENDING", "Beklemede"],
              ["ACCEPTED", "Kabul"],
              ["REJECTED", "Ret"],
              ["COMPLETED", "Tamamlandı"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                filter === key
                  ? "rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-full border border-border/70 bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {apps.length === 0 ? <Inbox className="size-5" /> : <FileText className="size-5" />}
              </div>
              <p className="text-base font-semibold">
                {apps.length === 0
                  ? isEmployer
                    ? "Henüz başvuru yok"
                    : "Henüz başvurun yok"
                  : "Bu filtrede başvuru yok"}
              </p>
              {!isEmployer && apps.length === 0 && (
                <Button asChild className="mt-5">
                  <Link to="/jobs">İlanlara göz at</Link>
                </Button>
              )}
            </div>
          ) : (
            filtered.map((app) => (
              <ApplicationCard key={app.id} app={app} isEmployer={isEmployer} onChanged={load} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ApplicationCard({
  app,
  isEmployer,
  onChanged,
}: {
  app: ApiApplication;
  isEmployer: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const meta = APPLICATION_STATUS_LABELS[app.status];
  const statusCls = APPLICATION_STATUS_CLASSES[app.status];

  const act = async (status: "ACCEPTED" | "REJECTED" | "COMPLETED", note?: string) => {
    setBusy(true);
    try {
      await updateApplicationStatus(app.id, status, note);
      toast.success(
        status === "ACCEPTED"
          ? "Başvuru kabul edildi"
          : status === "REJECTED"
            ? "Başvuru reddedildi"
            : "İş tamamlandı olarak işaretlendi",
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setBusy(false);
    }
  };

  const jobTitle = app.job?.title ?? "İlan kaldırıldı";
  const otherParty = isEmployer
    ? app.worker?.fullName ?? "İşçi"
    : app.job?.employer?.companyName ?? app.job?.employer?.fullName ?? "İşveren";

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight">{jobTitle}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusCls}`}>
              {meta}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isEmployer ? (
              <>
                {otherParty}
                {app.worker?.ratingAvg ? ` · ${app.worker.ratingAvg.toFixed(1)}★` : ""}
                {app.worker?.phone ? ` · ${app.worker.phone}` : ""}
              </>
            ) : (
              <>
                {otherParty} · {app.job ? `${app.job.district}, ${app.job.city}` : ""}
                {app.job ? ` · ${formatWage(app.job.wageAmount, app.job.wageType)}` : ""}
              </>
            )}
          </p>
          {app.job?.workDate && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              📅 {new Date(app.job.workDate).toLocaleDateString("tr-TR")} ·{" "}
              {app.job.startTime?.slice(0, 5)}–{app.job.endTime?.slice(0, 5)}
            </p>
          )}
          {app.message && (
            <p className="mt-2 rounded-lg bg-muted/70 px-3 py-2 text-sm leading-6 text-foreground/90">
              “{app.message}”
            </p>
          )}
          {app.proposedWage && (
            <p className="mt-1.5 text-xs font-semibold text-primary">
              Teklif: {app.proposedWage.toLocaleString("tr-TR")} ₺
            </p>
          )}
          {app.employerNote && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              İşveren notu: {app.employerNote}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {timeAgo(app.createdAt)}
          </p>
        </div>

        {isEmployer && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {app.status === "PENDING" && (
              <>
                <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => act("ACCEPTED")}>
                  Kabul et
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  disabled={busy}
                  onClick={() => act("REJECTED")}
                >
                  Reddet
                </Button>
              </>
            )}
            {app.status === "ACCEPTED" && (
              <Button size="sm" disabled={busy} onClick={() => act("COMPLETED")}>
                Tamamlandı
              </Button>
            )}
            {app.status === "COMPLETED" && !app.rating && (
              <Button size="sm" variant="outline" className="bg-card" onClick={() => setRatingOpen(true)}>
                <Star className="size-4" />
                Puan ver
              </Button>
            )}
            {app.rating && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                <Star className="size-3 fill-amber-500 text-amber-500" />
                {app.rating}/5
              </span>
            )}
          </div>
        )}

        {!isEmployer && app.status === "COMPLETED" && !app.rating && (
          <Button size="sm" variant="outline" className="shrink-0 bg-card" onClick={() => setRatingOpen(true)}>
            <Star className="size-4" />
            İşvereni puanla
          </Button>
        )}
        {!isEmployer && app.rating && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <Star className="size-3 fill-amber-500 text-amber-500" />
            {app.rating}/5
          </span>
        )}
      </div>

      <RatingDialog
        open={ratingOpen}
        onOpenChange={setRatingOpen}
        onSubmit={async (rating, comment) => {
          try {
            await rateApplication(app.id, rating, comment);
            toast.success("Puanın kaydedildi");
            setRatingOpen(false);
            onChanged();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Puanlama başarısız");
          }
        }}
      />
    </div>
  );
}

function RatingDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Değerlendir</DialogTitle>
          <DialogDescription>Tamamlanan iş için 1–5 yıldız ve yorum bırak.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1.5 py-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} yıldız`}>
              <Star
                className={
                  n <= rating
                    ? "size-8 fill-amber-400 text-amber-400 transition-transform hover:scale-110"
                    : "size-8 text-muted-foreground/40 transition-transform hover:scale-110"
                }
              />
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Yorumun (opsiyonel)…"
          className="min-h-20"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(rating, comment || undefined);
              setBusy(false);
            }}
          >
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Gönder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
