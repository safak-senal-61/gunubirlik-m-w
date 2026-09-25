import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileText,
  Inbox,
  MapPin,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

const features = [
  {
    icon: Search,
    title: "Akıllı ilan keşfi",
    description:
      "Sana uygun pozisyonları saniyeler içinde bul; konum, çalışma şekli ve maaş aralığına göre filtrele.",
  },
  {
    icon: FileText,
    title: "Tek tıkla başvuru",
    description:
      "Uzun formlar yok. Kısa bir ön yazı yaz, başvurun anında işverene ulaşsın.",
  },
  {
    icon: Inbox,
    title: "Şeffaf süreç takibi",
    description:
      "Başvurunun nerede olduğunu her an gör: beklemede, kabul veya ret — sürpriz yok.",
  },
];

const employerFeatures = [
  {
    icon: Sparkles,
    title: "Dakikalar içinde ilan yayınla",
    description:
      "Pozisyon, maaş aralığı ve konumu gir; ilanın anında aktif iş arayanlara görünür.",
  },
  {
    icon: Inbox,
    title: "Tüm başvurular tek yerde",
    description:
      "Adayları ön yazılarıyla birlikte incele, tek tıkla kabul et veya nazikçe reddet.",
  },
  {
    icon: Building2,
    title: "Markanı öne çıkar",
    description:
      "Şirket adınla yayınlanan ilanlar, sana gelen başvuruların sayısını canlı gösterir.",
  },
];

/** Send the chosen role through auth into onboarding preselection. */
function authHref(role: "seeker" | "employer") {
  return `/auth?returnTo=${encodeURIComponent(`/onboarding?role=${role}`)}`;
}

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/jobs">
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground sm:inline-flex"
              >
                İlanlara göz at
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gap-1.5">
                Giriş yap
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="surface-grid mask-fade-b pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-soft"
          >
            <Sparkles className="size-3.5 text-primary" />
            Türkiye'nin yeni iş ağı
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl"
          >
            Doğru işi bul,
            <span className="text-primary"> doğru insanı </span>
            bul.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg"
          >
            Selam İş; iş arayanlar için sade bir başvuru deneyimi, işverenler için
            dakikalar içinde yayınlanan ilanlar ve tek ekranda yönetilen başvurular
            sunar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Link to={authHref("seeker")}>
              <Button size="lg" className="w-full gap-2 shadow-soft sm:w-auto">
                İş arıyorum
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to={authHref("employer")}>
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 bg-card shadow-soft sm:w-auto"
              >
                <Building2 className="size-4" />
                İşverenim
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 flex items-center gap-4 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              Ücretsiz kayıt
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              E-posta ile güvenli giriş
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              Mobil öncelikli tasarım
            </span>
          </motion.div>
        </div>
      </section>

      {/* How it works — two audiences */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-border/70 bg-card p-8 shadow-soft"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">İş arayanlar için</h2>
                <p className="text-xs text-muted-foreground">
                  Bul, başvur, takip et.
                </p>
              </div>
            </div>
            <ul className="space-y-4">
              {features.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <f.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                      {f.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Link to={authHref("seeker")} className="mt-6 block">
              <Button variant="outline" className="w-full gap-2 bg-card">
                Ücretsiz başla
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-border/70 bg-foreground p-8 text-background shadow-lift"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-background/15 text-background">
                <Building2 className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">İşverenler için</h2>
                <p className="text-xs opacity-70">Yayınla, topla, değerlendir.</p>
              </div>
            </div>
            <ul className="space-y-4">
              {employerFeatures.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/10 text-background">
                    <f.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="mt-0.5 text-sm leading-6 opacity-70">
                      {f.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Link to={authHref("employer")} className="mt-6 block">
              <Button
                variant="outline"
                className="w-full gap-2 border-background/20 bg-background/10 text-background hover:bg-background/20 hover:text-background"
              >
                İlan vermeye başla
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 shadow-soft sm:grid-cols-3"
        >
          {[
            {
              icon: Search,
              value: "Saniyeler içinde",
              label: "Sana uygun ilanları keşfet",
            },
            {
              icon: Wallet,
              value: "Şeffaf maaş aralığı",
              label: "Her ilanda net rakamlar",
            },
            {
              icon: MapPin,
              value: "Türkiye geneli",
              label: "Uzaktan ve ofis pozisyonları",
            },
          ].map((s) => (
            <div key={s.value} className="flex flex-col gap-2 bg-card p-6">
              <s.icon className="size-4 text-primary" />
              <p className="text-base font-bold tracking-tight">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-lift sm:px-12"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">
            Hemen ilk başvurunu yap
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 opacity-80 sm:text-base">
            E-postanla giriş yap, rolünü seç ve dakikalar içinde iş hayatına bir
            adım at. Kayıt ücretsiz.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={authHref("seeker")}>
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 border-primary-foreground/20 bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-auto"
              >
                İş arıyorum
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to={authHref("employer")}>
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              >
                <Building2 className="size-4" />
                İşverenim
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <span>© {new Date().getFullYear()} Selam İş · Türkiye'nin iş ağı</span>
        </div>
      </footer>
    </div>
  );
}
