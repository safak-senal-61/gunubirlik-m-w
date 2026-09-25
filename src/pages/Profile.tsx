import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiAuth } from "@/hooks/use-api-auth";
import {
  changePassword,
  confirmEmailChange,
  disable2fa,
  requestEmailChange,
  setup2fa,
  updateMe,
  uploadAvatar,
  verify2fa,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user, refreshUser } = useApiAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const isEmployer = user.role === "EMPLOYER";

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
      await refreshUser();
      toast.success("Profil fotoğrafı güncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükleme başarısız");
    } finally {
      setUploading(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Şifren güncellendi");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Profilim</h1>
        <p className="text-sm text-muted-foreground">
          Hesap bilgilerin ve ayarların.
        </p>

        {/* Identity card */}
        <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative"
              disabled={uploading}
            >
              <Avatar className="size-20 border-2 border-border shadow-soft">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                <AvatarFallback className="bg-accent text-xl font-extrabold text-accent-foreground">
                  {user.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin text-white" />
                ) : (
                  <span className="text-[10px] font-bold text-white">DEĞİŞTİR</span>
                )}
              </span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </button>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2 className="text-xl font-extrabold tracking-tight">{user.fullName}</h2>
                {user.isVerified && (
                  <Badge className="gap-1 bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="size-3" />
                    Doğrulanmış
                  </Badge>
                )}
                <Badge variant="secondary" className="font-medium">
                  {isEmployer ? "İşveren" : "İşçi"}
                </Badge>
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <Mail className="size-3.5" /> {user.email}
                </p>
                {user.phone && (
                  <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                    <Phone className="size-3.5" /> {user.phone}
                  </p>
                )}
                {(user.city || user.district) && (
                  <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                    <MapPin className="size-3.5" /> {user.district}, {user.city}
                  </p>
                )}
                {isEmployer && user.companyName && (
                  <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                    <Building2 className="size-3.5" /> {user.companyName}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-1 rounded-2xl bg-amber-50 px-5 py-3">
              <span className="flex items-center gap-1 text-2xl font-extrabold text-amber-700">
                <Star className="size-5 fill-amber-500 text-amber-500" />
                {user.ratingAvg.toFixed(1)}
              </span>
              <span className="text-[11px] font-medium text-amber-700/80">
                {user.ratingCount} değerlendirme
              </span>
            </div>
          </div>

          {/* Worker extras */}
          {!isEmployer && (
            <div className="mt-6 grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-2">
              {user.skills.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Beceriler
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {user.skills.map((s) => (
                      <Badge key={s} variant="secondary" className="font-medium">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1 text-sm">
                {user.experienceYears !== null && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="size-3.5" /> {user.experienceYears} yıl deneyim
                  </p>
                )}
                {user.hourlyWageMin !== null && user.hourlyWageMax !== null && (
                  <p className="text-muted-foreground">
                    💰 Saatlik {user.hourlyWageMin}–{user.hourlyWageMax} ₺
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Üyelik: {formatDate(user.createdAt)}
                </p>
              </div>
            </div>
          )}

          {user.bio && (
            <div className="mt-5 rounded-xl bg-muted/60 p-4 text-sm leading-6 text-foreground/90">
              {user.bio}
            </div>
          )}

          <div className="mt-5 flex justify-end border-t border-border/60 pt-4">
            <EditProfileDialog
              user={user}
              onSaved={refreshUser}
            />
          </div>
        </div>

        {/* Security */}
        <Card className="mt-6 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Güvenlik</CardTitle>
            <CardDescription>Şifreni buradan değiştirebilirsin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePassword} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cur-pass">Mevcut şifre</Label>
                <Input
                  id="cur-pass"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pass">Yeni şifre</Label>
                <Input
                  id="new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="gap-1.5" disabled={savingPassword}>
                  {savingPassword ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Şifreyi güncelle
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Two-factor auth + email change */}
        <Card className="mt-6 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">İki Faktörlü Doğrulama (2FA)</CardTitle>
            <CardDescription>
              {user.twoFactorEnabled
                ? "Hesabın iki faktörlü doğrulama ile korunuyor."
                : "Hesabını ekstra bir katmanla koru; girişte authenticator kodu istenir."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <TwoFactorManager
              enabled={!!user.twoFactorEnabled}
              onChanged={refreshUser}
            />
            <EmailChangeDialog currentEmail={user.email} onChanged={refreshUser} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function TwoFactorManager({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // setup sonucu
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");

  const startSetup = async () => {
    setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const setup = await setup2fa();
      setQrCode(setup.qrCode);
      setSecret(setup.secret);
      setBackupCodes(setup.backupCodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await verify2fa(code);
      toast.success("2FA aktif edildi 🎉");
      await onChanged();
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod hatalı");
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    setBusy(true);
    setError(null);
    try {
      await disable2fa(code);
      toast.success("2FA kapatıldı");
      await onChanged();
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod hatalı");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setQrCode(null);
    setSecret(null);
    setBackupCodes([]);
    setCode("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      {enabled ? (
        <Button variant="outline" className="bg-card" onClick={() => setOpen(true)}>
          2FA'yı kapat
        </Button>
      ) : (
        <Button className="gap-1.5" onClick={startSetup}>
          <ShieldCheck className="size-4" />
          2FA'yı etkinleştir
        </Button>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{enabled ? "2FA'yı kapat" : "2FA'yı etkinleştir"}</DialogTitle>
          <DialogDescription>
            {enabled
              ? "Kapatmak için authenticator uygulamandaki güncel kodu gir."
              : "QR kodu authenticator uygulamanla okut (Google Authenticator, Authy vb.)."}
          </DialogDescription>
        </DialogHeader>

        {!enabled && (
          <div className="space-y-4">
            {busy && !qrCode ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : qrCode ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={qrCode}
                    alt="2FA QR kodu"
                    className="size-44 rounded-xl border border-border bg-white p-2"
                  />
                  {secret && (
                    <div className="w-full rounded-lg bg-muted px-3 py-2 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Manuel giriş için anahtar
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-bold tracking-widest select-all">{secret}</p>
                    </div>
                  )}
                </div>
                {backupCodes.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-800">
                      Yedek kodlar — güvenli bir yerde sakla (her biri tek kullanım):
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-amber-900 sm:grid-cols-5">
                      {backupCodes.map((c) => (
                        <span key={c} className="rounded bg-white/70 px-1.5 py-0.5 text-center">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="tfa-code">6 haneli kod</Label>
          <Input
            id="tfa-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Vazgeç
          </Button>
          {enabled ? (
            <Button
              variant="destructive"
              onClick={confirmDisable}
              disabled={busy || code.length !== 6}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              2FA'yı kapat
            </Button>
          ) : (
            <Button
              onClick={confirmEnable}
              disabled={busy || !qrCode || code.length !== 6}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Etkinleştir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailChangeDialog({
  currentEmail,
  onChanged,
}: {
  currentEmail: string;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestEmailChange(newEmail);
      setRequested(true);
      setInfo("Doğrulama kodu mevcut e-posta adresine gönderildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod gönderilemedi");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await confirmEmailChange(code);
      toast.success(`E-posta güncellendi: ${res.email}`);
      await onChanged();
      setOpen(false);
      setNewEmail("");
      setCode("");
      setRequested(false);
      setInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Doğrulama başarısız");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setNewEmail("");
    setCode("");
    setRequested(false);
    setError(null);
    setInfo(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button variant="outline" className="bg-card" onClick={() => setOpen(true)}>
        E-posta değiştir
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>E-posta değiştir</DialogTitle>
          <DialogDescription>
            Doğrulama kodu <span className="font-semibold">{currentEmail}</span> adresine gönderilir.
          </DialogDescription>
        </DialogHeader>

        {!requested ? (
          <div className="space-y-1.5">
            <Label htmlFor="ec-email">Yeni e-posta</Label>
            <Input
              id="ec-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="yeni@ornek.com"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="ec-code">Doğrulama kodu</Label>
            <Input
              id="ec-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>
        )}

        {info && <p className="text-sm text-emerald-600">{info}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Vazgeç
          </Button>
          {!requested ? (
            <Button onClick={request} disabled={busy || !newEmail.includes("@")} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Kod gönder
            </Button>
          ) : (
            <Button onClick={confirm} disabled={busy || code.length < 4} className="gap-1.5">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Onayla
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditProfileDialog({
  user,
  onSaved,
}: {
  user: NonNullable<ReturnType<typeof useApiAuth>["user"]>;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEmployer = user.role === "EMPLOYER";

  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [district, setDistrict] = useState(user.district ?? "");
  const [companyName, setCompanyName] = useState(user.companyName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [skills, setSkills] = useState(user.skills.join(", "));
  const [experienceYears, setExperienceYears] = useState(
    user.experienceYears != null ? String(user.experienceYears) : "",
  );
  const [hourlyWageMin, setHourlyWageMin] = useState(
    user.hourlyWageMin != null ? String(user.hourlyWageMin) : "",
  );
  const [hourlyWageMax, setHourlyWageMax] = useState(
    user.hourlyWageMax != null ? String(user.hourlyWageMax) : "",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMe({
        fullName,
        phone,
        city,
        district,
        ...(isEmployer && companyName ? { companyName } : {}),
        bio: bio || undefined,
        ...(skills.trim()
          ? { skills: skills.split(",").map((s) => s.trim()).filter(Boolean) }
          : {}),
        ...(experienceYears.trim() ? { experienceYears: Number(experienceYears) } : {}),
        ...(hourlyWageMin.trim() ? { hourlyWageMin: Number(hourlyWageMin) } : {}),
        ...(hourlyWageMax.trim() ? { hourlyWageMax: Number(hourlyWageMax) } : {}),
      });
      await onSaved();
      toast.success("Profil güncellendi");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profil güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  const label = "text-sm font-semibold";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Pencil className="size-4" />
          Profili düzenle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Profili düzenle</DialogTitle>
          <DialogDescription>
            Bilgilerini güncelle; işverenler ve işçiler bu bilgileri görür.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Ad Soyad</Label>
            <Input id="ep-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-phone">Telefon</Label>
            <Input id="ep-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+905321234567" />
          </div>
          {isEmployer && (
            <div className="space-y-1.5">
              <Label htmlFor="ep-company">Şirket adı</Label>
              <Input id="ep-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-city">İl</Label>
              <Input id="ep-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-district">İlçe</Label>
              <Input id="ep-district" value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
          </div>

          {!isEmployer && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ep-skills">
                  Beceriler <span className="text-xs font-normal text-muted-foreground">(virgülle ayır)</span>
                </Label>
                <Input
                  id="ep-skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="Boyacı, Tesisatçı"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ep-exp">Deneyim (yıl)</Label>
                  <Input
                    id="ep-exp"
                    type="number"
                    min="0"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-wmin">Saatlik min ₺</Label>
                  <Input
                    id="ep-wmin"
                    type="number"
                    min="0"
                    value={hourlyWageMin}
                    onChange={(e) => setHourlyWageMin(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-wmax">Saatlik max ₺</Label>
                  <Input
                    id="ep-wmax"
                    type="number"
                    min="0"
                    value={hourlyWageMax}
                    onChange={(e) => setHourlyWageMax(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ep-bio">Hakkımda</Label>
            <Textarea
              id="ep-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Kendini kısaca tanıt…"
              className="min-h-20"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Vazgeç
            </Button>
            <Button type="submit" className="gap-1.5" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
