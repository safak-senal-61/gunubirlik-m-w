import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { Building2, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { Logo } from "@/components/AppShell";

export default function Onboarding() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAppRole = useMutation(api.users.setAppRole);
  const [saving, setSaving] = useState(false);

  // Preselect the role when arriving from a landing CTA (?role=seeker|employer)
  const initialRole =
    searchParams.get("role") === "employer"
      ? "employer"
      : searchParams.get("role") === "seeker"
        ? "seeker"
        : null;

  const [selectedRole, setSelectedRole] = useState<"seeker" | "employer" | null>(
    initialRole,
  );
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user?.appRole) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, user, navigate]);

  const handleContinue = async () => {
    if (!selectedRole) return;
    if (selectedRole === "employer" && !companyName.trim()) {
      setError("Lütfen şirket adını gir.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setAppRole({
        appRole: selectedRole,
        companyName:
          selectedRole === "employer" ? companyName.trim() : undefined,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-xs text-muted-foreground">
            Hoş geldin{user?.name ? `, ${user.name}` : ""}
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center">
            <p className="text-sm font-semibold text-primary">Neredeyse hazır</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              Selam İş'e nasıl katılmak istersin?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Bu seçimi daha sonra değiştiremezsin; deneyimin buna göre şekillenir.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Seeker card */}
            <button
              type="button"
              onClick={() => {
                setSelectedRole("seeker");
                setError(null);
              }}
              className={cnCard(selectedRole === "seeker")}
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="size-5" />
              </div>
              <p className="mt-4 text-base font-bold tracking-tight">
                İş arıyorum
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                İlanlara göz at, kısa bir ön yazıyla başvur ve süreçlerini takip et.
              </p>
            </button>

            {/* Employer card */}
            <button
              type="button"
              onClick={() => {
                setSelectedRole("employer");
                setError(null);
              }}
              className={cnCard(selectedRole === "employer")}
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <p className="mt-4 text-base font-bold tracking-tight">
                İşverenim
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                İlan yayınla, gelen başvuruları tek ekrandan yönet ve adaylarla
                iletişimde kal.
              </p>
            </button>
          </div>

          {selectedRole === "employer" && (
            <div className="mt-6 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
              <label
                htmlFor="companyName"
                className="text-sm font-semibold"
              >
                Şirket adın
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Örn. Akıllı Yazılım A.Ş."
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                İlanların bu isimle yayınlanır.
              </p>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          <Button
            size="lg"
            className="mt-8 w-full gap-2"
            disabled={!selectedRole || saving}
            onClick={handleContinue}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Devam et
          </Button>
        </div>
      </main>
    </div>
  );
}

function cnCard(active: boolean) {
  const base =
    "group relative rounded-2xl border bg-card p-6 text-left shadow-soft transition-all duration-200";
  return active
    ? `${base} border-primary ring-2 ring-primary/25`
    : `${base} border-border/70 hover:border-primary/40 hover:shadow-lift`;
}
