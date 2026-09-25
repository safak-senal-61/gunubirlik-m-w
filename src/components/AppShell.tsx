import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className="flex items-center gap-2 transition-opacity hover:opacity-80"
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground shadow-soft">
        S
      </div>
      <span className="text-base font-bold tracking-tight">Selam İş</span>
    </Link>
  );
}

export const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "Tam zamanlı",
  part_time: "Yarı zamanlı",
  contract: "Sözleşmeli",
  internship: "Staj",
};

export const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Beklemede",
    className: "bg-amber-100 text-amber-800",
  },
  accepted: {
    label: "Kabul edildi",
    className: "bg-emerald-100 text-emerald-800",
  },
  rejected: {
    label: "Reddedildi",
    className: "bg-rose-100 text-rose-800",
  },
};

export function formatSalary(min: number, max: number) {
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}b ₺` : `${n} ₺`);
  return `${fmt(min)} – ${fmt(max)}`;
}

export function timeAgo(creationTime: number) {
  const diff = Date.now() - creationTime;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return new Date(creationTime).toLocaleDateString("tr-TR");
}

export function AppShell({
  navLinks,
  user,
  onSignOut,
  children,
}: {
  navLinks: { label: string; to: string }[];
  user?: { name?: string; email?: string; appRole?: string } | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex">
            {navLinks.map((link) => (
              <a
                key={link.to}
                href={link.to}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(link.to);
                }}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user?.appRole === "employer" && (
              <Button
                size="sm"
                className="hidden gap-1.5 sm:inline-flex"
                onClick={() => navigate("/dashboard?new=1")}
              >
                <PlusIcon />
                İlan ver
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <Avatar className="size-9 border border-border/80 shadow-soft">
                    <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">
                      {(user?.name || user?.email || "K")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-semibold">
                    {user?.name || "Misafir kullanıcı"}
                  </p>
                  {user?.email && (
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navLinks.map((link) => (
                  <DropdownMenuItem key={link.to} onClick={() => navigate(link.to)}>
                    {link.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOut className="mr-2 size-4" />
                  Çıkış yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <span>© {new Date().getFullYear()} Selam İş · Türkiye'nin iş ağı</span>
        </div>
      </footer>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function JobLocationIcon() {
  return <MapPin className="size-4 text-muted-foreground" />;
}
