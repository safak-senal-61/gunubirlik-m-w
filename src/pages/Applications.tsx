import {
  AppShell,
  JOB_TYPE_LABELS,
  STATUS_META,
  formatSalary,
  timeAgo,
} from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { FileText, Inbox } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";

export default function Applications() {
  const { user, signOut } = useAuth();
  const apps = useQuery(api.applications.myApplications);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">(
    "all",
  );
  const navigate = useNavigate();

  const filtered =
    apps === undefined ? undefined : filter === "all" ? apps : apps.filter((a) => a.status === filter);

  const counts = {
    all: apps?.length ?? 0,
    pending: apps?.filter((a) => a.status === "pending").length ?? 0,
    accepted: apps?.filter((a) => a.status === "accepted").length ?? 0,
    rejected: apps?.filter((a) => a.status === "rejected").length ?? 0,
  };

  return (
    <AppShell
      navLinks={[
        { label: "İş ilanları", to: "/jobs" },
        { label: "Başvurularım", to: "/applications" },
      ]}
      user={user}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Başvurularım
          </h1>
          <p className="text-sm text-muted-foreground">
            Gönderdiğin başvuruların durumunu buradan takip et.
          </p>
        </div>

        {/* Status filters */}
        <div className="mt-6 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Tümü"],
              ["pending", "Beklemede"],
              ["accepted", "Kabul edilen"],
              ["rejected", "Reddedilen"],
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

        {/* List */}
        <div className="mt-6 space-y-3">
          {apps === undefined ? (
            <div className="flex justify-center py-16">
              <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            </div>
          ) : filtered && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {apps.length === 0 ? (
                  <Inbox className="size-5" />
                ) : (
                  <FileText className="size-5" />
                )}
              </div>
              <p className="text-base font-semibold">
                {apps.length === 0
                  ? "Henüz başvurun yok"
                  : "Bu filtrede başvuru yok"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {apps.length === 0
                  ? "Aktif ilanlara göz atıp ilk başvurunu birkaç dakikada yapabilirsin."
                  : "Başka bir durum filtresi seçebilirsin."}
              </p>
              {apps.length === 0 && (
                <Button asChild className="mt-5">
                  <Link to="/jobs">İlanlara göz at</Link>
                </Button>
              )}
            </div>
          ) : (
            filtered?.map((app) => {
              const meta = STATUS_META[app.status];
              return (
                <div
                  key={app._id}
                  className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold tracking-tight">
                          {app.job?.title ?? "İlan kaldırıldı"}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      {app.job && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {app.job.company} · {app.job.location} ·{" "}
                          {JOB_TYPE_LABELS[app.job.type]} ·{" "}
                          {formatSalary(app.job.salaryMin, app.job.salaryMax)}
                        </p>
                      )}
                      {app.coverNote && (
                        <p className="mt-2 rounded-lg bg-muted/70 px-3 py-2 text-sm leading-6 text-foreground/90">
                          “{app.coverNote}”
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Başvuru {timeAgo(app._creationTime)} gönderildi
                      </p>
                    </div>
                    {app.job && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="shrink-0 bg-card"
                      >
                        <Link to={`/jobs/${app.job._id}`}>İlanı gör</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
