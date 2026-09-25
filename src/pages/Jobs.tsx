import { AppShell, JOB_TYPE_LABELS, formatSalary, timeAgo } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Briefcase, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";

export default function Jobs() {
  const { user, signOut } = useAuth();
  const jobs = useQuery(api.jobs.browseJobs);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!jobs) return undefined;
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return jobs.filter((job) => {
      const matchesQuery =
        q.length === 0 ||
        job.title.toLocaleLowerCase("tr-TR").includes(q) ||
        job.company.toLocaleLowerCase("tr-TR").includes(q) ||
        job.location.toLocaleLowerCase("tr-TR").includes(q);
      const matchesType = typeFilter === "all" || job.type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [jobs, query, typeFilter]);

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
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {/* Page head */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Aktif iş ilanları
          </h1>
          <p className="text-sm text-muted-foreground">
            Şeffaf maaş aralıklarıyla yayınlanan pozisyonlara göz at.
          </p>
        </div>

        {/* Search + filters */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pozisyon, şirket veya konum ara…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["all", ...Object.keys(JOB_TYPE_LABELS)].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={
                  typeFilter === t
                    ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {t === "all" ? "Tümü" : JOB_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {filtered ? `${filtered.length} ilan` : "…"}
          </p>
        </div>

        {/* Job cards */}
        <div className="mt-8">
          {jobs === undefined ? (
            <div className="flex justify-center py-20">
              <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            </div>
          )
          : filtered && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="size-5" />
              </div>
              <p className="text-base font-semibold">Sonuç bulunamadı</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Aramanı değiştir veya filtreleri temizle.
              </p>
              <Button
                variant="outline"
                className="mt-5 bg-card"
                onClick={() => {
                  setQuery("");
                  setTypeFilter("all");
                }}
              >
                Filtreleri temizle
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered?.map((job) => (
                <Link
                  key={job._id}
                  to={`/jobs/${job._id}`}
                  className="group rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold tracking-tight group-hover:text-primary">
                        {job.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {job.company} · {job.location}
                      </p>
                    </div>
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Briefcase className="size-5" />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-medium">
                      {JOB_TYPE_LABELS[job.type]}
                    </Badge>
                    {job.hasApplied && (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        Başvurdun
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {timeAgo(job._creationTime)}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <p className="text-sm font-semibold">
                      {formatSalary(job.salaryMin, job.salaryMax)}
                    </p>
                    <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Detayları gör →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
