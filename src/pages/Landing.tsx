import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Building2,
  Hammer,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

const categories = [
  { icon: "🏗️", label: "İnşaat" },
  { icon: "🍽️", label: "Restoran" },
  { icon: "🧹", label: "Temizlik" },
  { icon: "🚚", label: "Nakliyat" },
  { icon: "🌱", label: "Tarım" },
  { icon: "🔧", label: "Teknik" },
  { icon: "❤️", label: "Sağlık" },
  { icon: "💼", label: "Diğer" },
];

const workerFeatures = [
  {
    icon: MapPin,
    title: "Yakınındaki işi bul",
    description:
      "Konumuna göre sıralanan günlük iş ilanlarını dakikalar içinde keşfet.",
  },
  {
    icon: Wallet,
    title: "Ücret net yazılı",
    description:
      "Her ilanda günlük ya da saatlik ücret açık açık yazılır; pazarlık payı olanlar işaretlidir.",
  },
  {
    icon: MessageSquare,
    title: "Doğrudan mesajlaş",
    description:
      "İşverene soru sor, detayı konuş; telefon vermeden anlaş.",
  },
];

const employerFeatures = [
  {
    icon: CalendarClock,
    title: "Yarının işçisini bugün bul",
    description:
      "Tarih, saat ve kişi sayısını gir; ilanın anında yakındaki işçilere düşer.",
  },
  {
    icon: Building2,
    title: "Başvuruları tek ekrandan yönet",
    description:
      "Gelen başvuruları incele, kabul et, iş bitiminde tek tıkla tamamla ve puanla.",
  },
  {
    icon: ShieldCheck,
    title: "Puanlı ve doğrulanmış işçiler",
    description:
      "Yıldız puanı ve yorumlara bakarak güvenle karar ver.",
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
              <Hammer className="size-4" />
            </div>
            <span className="text-base font-extrabold tracking-tight">Günübirlik</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/jobs">
              <Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:inline-flex">
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
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-soft"
          >
            <MapPin className="size-3.5 text-primary" />
            Konum bazlı günlük iş platformu
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl"
          >
            Bugün iş,
            <span className="text-primary"> bugün </span>
            kazanç.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg"
          >
            Günübirlik; inşaattan restorana, temizlikten nakliyeye günlük işleri
            işçilerle dakikalar içinde buluşturur. Ücret net, mesafe yakın, süreç şeffaf.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Link to="/auth?returnTo=%2Fjobs">
              <Button size="lg" className="w-full gap-2 shadow-soft sm:w-auto">
                <Hammer className="size-4" />
                İş arıyorum
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/auth?returnTo=%2Fdashboard">
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 bg-card shadow-soft sm:w-auto"
              >
                <Building2 className="size-4" />
                İşçi arıyorum
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              Ücretsiz kayıt
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              Önceden belirlenmiş günlük ücret
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-emerald-600" />
              Mobil öncelikli tasarım
            </span>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-4 gap-3 sm:grid-cols-8"
        >
          {categories.map((c) => (
            <div
              key={c.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/70 bg-card px-2 py-4 shadow-soft"
            >
              <span className="text-2xl">{c.icon}</span>
              <span className="text-[11px] font-semibold text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Two audiences */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-border/70 bg-card p-8 shadow-soft"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Hammer className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">İşçiler için</h2>
                <p className="text-xs text-muted-foreground">Bugün iş bul, yarın kazanç.</p>
              </div>
            </div>
            <ul className="space-y-4">
              {workerFeatures.map((f) => (
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
            <Link to="/auth?returnTo=%2Fjobs" className="mt-6 block">
              <Button variant="outline" className="w-full gap-2 bg-card">
                Hemen başla
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
                <p className="text-xs opacity-70">İlan ver, seç, işini bitir.</p>
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
                    <p className="mt-0.5 text-sm leading-6 opacity-70">{f.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/auth?returnTo=%2Fdashboard" className="mt-6 block">
              <Button
                variant="outline"
                className="w-full gap-2 border-background/20 bg-background/10 text-background hover:bg-background/20 hover:text-background"
              >
                İlan ver
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Demo accounts */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-6 text-center shadow-soft"
        >
          <p className="text-sm font-bold">Demoyu hemen dene 🚀</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Test hesaplarıyla giriş yap:{" "}
            <span className="font-semibold text-foreground">worker1@example.com</span> (işçi) ·{" "}
            <span className="font-semibold text-foreground">ahmet@insaat.com</span> (işveren) —
            şifre: <span className="font-semibold text-foreground">123456</span>
          </p>
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
            Ertesi gün işe başla
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 opacity-80 sm:text-base">
            Kayıt ol, konumunu seç ve yakınındaki günlük işlere dakikalar içinde başvur.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/auth?returnTo=%2Fjobs">
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 border-primary-foreground/20 bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-auto"
              >
                İş arıyorum
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/auth?returnTo=%2Fdashboard">
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              >
                <Building2 className="size-4" />
                İşçi arıyorum
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Hammer className="size-3.5" />
            </div>
            <span className="font-bold">Günübirlik</span>
          </div>
          <span>© {new Date().getFullYear()} Günübirlik İş Bul · Konum bazlı günlük iş platformu</span>
        </div>
      </footer>
    </div>
  );
}
