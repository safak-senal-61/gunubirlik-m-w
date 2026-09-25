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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuth } from "@/hooks/use-api-auth";
import { changePassword, uploadAvatar } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
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
      </div>
    </AppShell>
  );
}
