import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApiAuth } from "@/hooks/use-api-auth";
import { Bell, LogOut, MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchNotifications } from "@/lib/api";
import { Link, useNavigate } from "react-router";

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className="flex items-center gap-2 transition-opacity hover:opacity-80"
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground shadow-soft">
        G
      </div>
      <span className="text-base font-bold tracking-tight">Günübirlik</span>
    </Link>
  );
}

const seekerLinks = [
  { label: "İş İlanları", to: "/jobs" },
  { label: "Başvurularım", to: "/applications" },
  { label: "Mesajlar", to: "/messages" },
];

const employerLinks = [
  { label: "Panelim", to: "/dashboard" },
  { label: "Başvurular", to: "/applications" },
  { label: "Mesajlar", to: "/messages" },
];

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useApiAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  // Poll unread notification count periodically
  useEffect(() => {
    let active = true;
    const load = () => {
      fetchNotifications()
        .then((r) => {
          if (active) setUnread(r.unreadCount);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!user) return null;

  const isEmployer = user.role === "EMPLOYER";
  const navLinks = isEmployer ? employerLinks : seekerLinks;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              to="/notifications"
              className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Bildirimler"
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <Avatar className="size-9 border border-border/80 shadow-soft">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">
                      {user.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-semibold">{user.fullName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {isEmployer ? user.companyName : `${user.ratingAvg.toFixed(1)}★ · ${user.ratingCount} değerlendirme`}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  Profilim
                </DropdownMenuItem>
                {navLinks.map((link) => (
                  <DropdownMenuItem
                    key={link.to}
                    className="md:hidden"
                    onClick={() => navigate(link.to)}
                  >
                    {link.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate("/");
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Çıkış yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="sticky bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden">
        <div className="flex">
          {[
            ...(isEmployer
              ? [{ label: "Panel", to: "/dashboard", icon: "briefcase" }]
              : [{ label: "İşler", to: "/jobs", icon: "briefcase" }]),
            { label: "Başvuru", to: "/applications", icon: "file" },
            { label: "Mesaj", to: "/messages", icon: "chat" },
            { label: "Profil", to: "/profile", icon: "user" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground"
            >
              {item.icon === "briefcase" && <BriefcaseIcon />}
              {item.icon === "file" && <FileIcon />}
              {item.icon === "chat" && <MessagesSquare className="size-5" />}
              {item.icon === "user" && <UserIcon />}
              {item.label}
            </Link>
          ))}
          <Link
            to="/notifications"
            className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground"
          >
            <Bell className="size-5" />
            Bildirim
          </Link>
        </div>
      </nav>

      <footer className="hidden border-t border-border/60 py-8 md:block">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <span>© {new Date().getFullYear()} Günübirlik İş Bul · Konum bazlı günlük iş platformu</span>
        </div>
      </footer>
    </div>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
