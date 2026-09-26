import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Badge, Card, C, PrimaryButton, SectionTitle, StatCard } from "@/components/ui";
import {
  changePassword,
  confirmEmailChange,
  disable2fa,
  fetchApplications,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
  setup2fa,
  updateMe,
  uploadAvatar,
  verify2fa,
} from "@/lib/api";
import type { ApiApplication, ApiUser } from "@/lib/types";
import { APPLICATION_STATUS_LABELS, formatWage } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

type SettingsTab = "account" | "wallet" | "security" | "notifications" | "policies" | "about";

const TABS: { key: SettingsTab; icon: string; label: string }[] = [
  { key: "account", icon: "👤", label: "Hesap" },
  { key: "wallet", icon: "👛", label: "Cüzdan" },
  { key: "security", icon: "🔒", label: "Güvenlik" },
  { key: "notifications", icon: "🔔", label: "Bildirim" },
  { key: "policies", icon: "📜", label: "Politikalar" },
  { key: "about", icon: "ℹ️", label: "Hakkında" },
];

export default function ProfileScreen({ refreshKey }: { refreshKey: number }) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("account");

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabStrip} contentContainerStyle={styles.tabStripInner}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text style={[styles.tabIcon, tab === t.key && styles.tabIconActive]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
        {tab === "account" && <AccountTab user={user} refreshKey={refreshKey} />}
        {tab === "wallet" && <WalletTab user={user} />}
        {tab === "security" && <SecurityTab user={user} />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "policies" && <PoliciesTab />}
        {tab === "about" && <AboutTab onLogout={() => logout()} />}
      </ScrollView>
    </View>
  );
}

/* ================= HE SAP ================= */

function AccountTab({ user, refreshKey }: { user: ApiUser; refreshKey: number }) {
  const { refreshUser } = useAuth();
  const isEmployer = user.role === "EMPLOYER";

  return (
    <>
      <Card>
        <View style={styles.idRow}>
          <Pressable
            onPress={async () => {
              try {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                  Alert.alert("İzin gerekli", "Galeri erişimi olmadan fotoğraf seçilemez.");
                  return;
                }
                const res = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.8,
                });
                if (res.canceled || !res.assets?.[0]) return;
                const a = res.assets[0];
                const uri = a.uri ?? "";
                const name = a.fileName ?? `avatar-${Date.now()}.jpg`;
                const type = a.mimeType ?? "image/jpeg";
                await uploadAvatar({ uri, name, type });
                await refreshUser();
                Alert.alert("Tamam", "Profil fotoğrafın güncellendi.");
              } catch (err) {
                Alert.alert("Fotoğraf yüklenemedi", err instanceof Error ? err.message : "Tekrar dene.");
              }
            }}
          >
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.fullName.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.avatarEdit}>📷 Değiştir</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.fullName}</Text>
              {user.isVerified && <Badge label="✓ Doğrulanmış" color={C.emerald} bg={C.emeraldBg} />}
            </View>
            <Text style={styles.meta}>{user.email}</Text>
            {user.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
            {user.city || user.district ? <Text style={styles.meta}>📍 {user.district}, {user.city}</Text> : null}
            {isEmployer && user.companyName ? <Text style={styles.meta}>🏢 {user.companyName}</Text> : null}
          </View>
          <View style={styles.ratingBox}>
            <Text style={styles.ratingValue}>⭐ {user.ratingAvg.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>{user.ratingCount} değerlendirme</Text>
          </View>
        </View>

        {!isEmployer && user.skills.length > 0 && (
          <View style={styles.skillsRow}>
            {user.skills.map((s) => (
              <Badge key={s} label={s} color={C.text} bg={C.stoneBg} />
            ))}
          </View>
        )}

        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        <Text style={styles.memberSince}>Üyelik: {formatDate(user.createdAt)}</Text>
      </Card>

      <EditProfileSection user={user} onSaved={refreshUser} />

      {!isEmployer && <WorkerStatsSection refreshKey={refreshKey} />}
    </>
  );
}

/* ================= HESAP: profil düzenle ================= */

function EditProfileSection({ user, onSaved }: { user: ApiUser; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const isEmployer = user.role === "EMPLOYER";
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [district, setDistrict] = useState(user.district ?? "");
  const [companyName, setCompanyName] = useState(user.companyName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [skills, setSkills] = useState(user.skills.join(", "));
  const [exp, setExp] = useState(user.experienceYears != null ? String(user.experienceYears) : "");
  const [wMin, setWMin] = useState(user.hourlyWageMin != null ? String(user.hourlyWageMin) : "");
  const [wMax, setWMax] = useState(user.hourlyWageMax != null ? String(user.hourlyWageMax) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateMe({
        fullName,
        phone,
        city,
        district,
        ...(isEmployer && companyName ? { companyName } : {}),
        ...(bio ? { bio } : {}),
        ...(skills.trim() ? { skills: skills.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
        ...(exp ? { experienceYears: Number(exp) } : {}),
        ...(wMin ? { hourlyWageMin: Number(wMin) } : {}),
        ...(wMax ? { hourlyWageMax: Number(wMax) } : {}),
      });
      await onSaved();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return <PrimaryButton label="✏️ Profili düzenle" variant="outline" onPress={() => setOpen(true)} />;
  }

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Profili düzenle</SectionTitle>
      <Field label="Ad Soyad" value={fullName} onChangeText={setFullName} />
      <Field label="Telefon" value={phone} onChangeText={setPhone} />
      {isEmployer && <Field label="Şirket adı" value={companyName} onChangeText={setCompanyName} />}
      <View style={styles.row}>
        <View style={styles.half}><Field label="İl" value={city} onChangeText={setCity} /></View>
        <View style={styles.half}><Field label="İlçe" value={district} onChangeText={setDistrict} /></View>
      </View>
      {!isEmployer && (
        <>
          <Field label="Beceriler (virgülle)" value={skills} onChangeText={setSkills} />
          <View style={styles.row}>
            <View style={styles.half}><Field label="Deneyim (yıl)" value={exp} onChangeText={(v) => setExp(v.replace(/\D/g, ""))} keyboardType="number-pad" /></View>
            <View style={styles.half}><Field label="Saatlik min ₺" value={wMin} onChangeText={(v) => setWMin(v.replace(/\D/g, ""))} keyboardType="number-pad" /></View>
            <View style={styles.half}><Field label="max ₺" value={wMax} onChangeText={(v) => setWMax(v.replace(/\D/g, ""))} keyboardType="number-pad" /></View>
          </View>
        </>
      )}
      <Field label="Hakkımda" value={bio} onChangeText={setBio} multiline />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setOpen(false)} /></View>
        <View style={styles.half}><PrimaryButton label="Kaydet" loading={saving} onPress={submit} /></View>
      </View>
    </Card>
  );
}

/* ================= HESAP: işçi istatistikleri ================= */

function WorkerStatsSection({ refreshKey }: { refreshKey: number }) {
  const { refreshUser } = useAuth();
  const [apps, setApps] = useState<ApiApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setApps(await fetchApplications());
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const completed = apps.filter((a) => a.status === "COMPLETED");
  const earned = completed.reduce((sum, a) => sum + (a.job ? a.job.wageAmount * (a.job.wageType === "HOURLY" ? a.job.durationHours : 1) : 0), 0);
  const visible = showAll ? completed : completed.slice(0, 5);

  return (
    <>
      <View style={styles.statRow}>
        <StatCard emoji="✅" label="Tamamlanan iş" value={String(completed.length)} />
        <StatCard emoji="💰" label="Toplam kazanç" value={`${earned.toLocaleString("tr-TR")} ₺`} />
        <StatCard emoji="📥" label="Başvuru" value={String(apps.length)} />
      </View>

      <Card style={{ gap: 10 }}>
        <SectionTitle>İş geçmişim</SectionTitle>
        {loading ? (
          <Text style={styles.desc}>Yükleniyor…</Text>
        ) : completed.length === 0 ? (
          <Text style={styles.desc}>Henüz tamamlanmış işin yok. Başvuruların kabul edildikten sonra burada birikir.</Text>
        ) : (
          <>
            {visible.map((a) => (
              <View key={a.id} style={styles.historyRow}>
                <Text style={styles.historyTitle} numberOfLines={1}>{a.job?.title ?? "İş"}</Text>
                <Text style={styles.historyMeta}>
                  {a.job ? `${new Date(a.job.workDate).toLocaleDateString("tr-TR")} · ${formatWage(a.job.wageAmount, a.job.wageType)}` : APPLICATION_STATUS_LABELS[a.status]}
                  {a.rating ? ` · ⭐ ${a.rating}/5` : ""}
                </Text>
              </View>
            ))}
            {completed.length > 5 && (
              <PrimaryButton label={showAll ? "Daha az göster" : `Tümünü göster (${completed.length})`} variant="ghost" onPress={() => setShowAll(!showAll)} />
            )}
            <Text style={styles.miniNote}>💡 Tamamlanan işlerden sonra karşı taraftan puan beklemeyi unutma.</Text>
          </>
        )}
        <PrimaryButton label="Yenile" variant="ghost" onPress={async () => { await load(); await refreshUser(); }} />
      </Card>
    </>
  );
}

/* ================= CÜZDAN ================= */

function WalletTab({ user }: { user: ApiUser }) {
  const { refreshUser } = useAuth();
  const [apps, setApps] = useState<ApiApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const isEmployer = user.role === "EMPLOYER";

  const load = useCallback(async () => {
    try {
      setApps(await fetchApplications());
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completed = apps.filter((a) => a.status === "COMPLETED");
  const pendingPay = apps.filter((a) => a.status === "ACCEPTED");
  const jobValue = (a: ApiApplication) => (a.job ? a.job.wageAmount * (a.job.wageType === "HOURLY" ? a.job.durationHours : 1) : 0);

  const receivedTotal = completed.reduce((s, a) => s + jobValue(a), 0);
  const expectedTotal = pendingPay.reduce((s, a) => s + jobValue(a), 0);

  return (
    <>
      <Card style={{ gap: 12 }}>
        <View style={styles.walletHeader}>
          <Text style={styles.walletTitle}>Cüzdanım</Text>
          <Badge label={isEmployer ? "İşveren hesabı" : "İşçi hesabı"} color={C.primary} bg={C.primarySoft} />
        </View>
        <Text style={styles.walletBalance}>{receivedTotal.toLocaleString("tr-TR")} ₺</Text>
        <Text style={styles.walletSub}>{isEmployer ? "tamamlanan işlerde ödenen tutar" : "tamamlanan işlerden kazanılan tutar"}</Text>

        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bekleyen ödeme</Text>
          <Text style={styles.infoValueStrong}>{expectedTotal.toLocaleString("tr-TR")} ₺ ({pendingPay.length} iş)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tamamlanan</Text>
          <Text style={styles.infoValue}>{completed.length} iş</Text>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Ödeme akışı nasıl işler?</SectionTitle>
        <Text style={styles.flowStep}>1️⃣ İşveren işi <Text style={styles.flowStrong}>Tamamlandı</Text> yapar → sistemde otomatik <Text style={styles.flowStrong}>bekleyen ödeme</Text> oluşur.</Text>
        <Text style={styles.flowStep}>2️⃣ Platform yönetimi ödeme kaydını onaylar.</Text>
        <Text style={styles.flowStep}>3️⃣ İşveren ödemeyi <Text style={styles.flowStrong}>Ödendi</Text> işaretler.</Text>
        <Text style={styles.flowStep}>4️⃣ İşçi <Text style={styles.flowStrong}>Aldım</Text> onayı verir → işlem kapanır.</Text>
        <Text style={styles.flowStep}>5️⃣ Anlaşmazlıkta <Text style={styles.flowStrong}>İtiraz</Text> → yönetim çözümler.</Text>
        <Text style={styles.miniNote}>
          ℹ️ Otomatik ödeme: İşçi, işverenin CHECK_OUT (İşi Bitir) QR'ını okuttuğunda iş COMPLETED olur ve sistemde
          otomatik PENDING ödeme talebi oluşur. Yönetim onayından sonra işveren ödemeyi işaretler, işçi alım onayı verir.
        </Text>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Ödeme kayıtları</SectionTitle>
        {loading ? (
          <Text style={styles.desc}>Yükleniyor…</Text>
        ) : completed.length === 0 && pendingPay.length === 0 ? (
          <Text style={styles.desc}>Henüz ödeme kaydı yok. Tamamlanan işler burada listelenir.</Text>
        ) : (
          <>
            {pendingPay.map((a) => (
              <View key={a.id} style={styles.ledgerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{a.job?.title ?? "İş"}</Text>
                  <Text style={styles.historyMeta}>{a.job ? new Date(a.job.workDate).toLocaleDateString("tr-TR") : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.ledgerAmount}>{jobValue(a).toLocaleString("tr-TR")} ₺</Text>
                  <Badge label="Bekliyor" color={C.amber} bg={C.amberBg} />
                </View>
              </View>
            ))}
            {completed.map((a) => (
              <View key={a.id} style={styles.ledgerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{a.job?.title ?? "İş"}</Text>
                  <Text style={styles.historyMeta}>{a.job ? new Date(a.job.workDate).toLocaleDateString("tr-TR") : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.ledgerAmount}>{jobValue(a).toLocaleString("tr-TR")} ₺</Text>
                  <Badge label={isEmployer ? "Ödendi" : "Alındı"} color={C.emerald} bg={C.emeraldBg} />
                </View>
              </View>
            ))}
          </>
        )}
        <PrimaryButton label="Yenile" variant="ghost" onPress={async () => { await load(); await refreshUser(); }} />
      </Card>
    </>
  );
}

/* ================= GÜVENLİK ================= */

function SecurityTab({ user }: { user: ApiUser }) {
  const { refreshUser } = useAuth();
  return (
    <>
      <TwoFactorSection enabled={!!user.twoFactorEnabled} onChanged={refreshUser} />
      <PasswordSection />
      <EmailChangeSection currentEmail={user.email} onChanged={refreshUser} />
      <AccountSecuritySection user={user} />
      <ForgotPasswordInline />
    </>
  );
}

function AccountSecuritySection({ user }: { user: ApiUser }) {
  const rows: { icon: string; label: string; value: string; danger?: boolean }[] = [
    { icon: "📧", label: "E-posta doğrulanmış", value: user.emailVerified ? "Evet ✓" : "Hayır" },
    { icon: "🔐", label: "İki faktörlü koruma", value: user.twoFactorEnabled ? "Açık ✓" : "Kapalı" },
    { icon: "🌐", label: "Giriş yöntemi", value: user.provider === "GOOGLE" ? "Google hesabı" : "E-posta + şifre" },
    { icon: "⚠️", label: "Uyarı sayısı", value: String(user.warningCount ?? 0), danger: (user.warningCount ?? 0) > 0 },
    { icon: "🚩", label: "Rapor sayısı", value: String(user.flagCount ?? 0), danger: (user.flagCount ?? 0) > 0 },
  ];

  return (
    <Card style={{ gap: 8 }}>
      <SectionTitle>Hesap güvenlik durumu</SectionTitle>
      {rows.map((r) => (
        <View key={r.label} style={styles.secRow}>
          <Text style={styles.secIcon}>{r.icon}</Text>
          <Text style={styles.secLabel}>{r.label}</Text>
          <Text style={[styles.secValue, r.danger && styles.secValueDanger]}>{r.value}</Text>
        </View>
      ))}
      {user.isSuspended || user.isPermanentlyBanned ? (
        <View style={styles.banBox}>
          <Text style={styles.banText}>
            {user.isPermanentlyBanned
              ? "🚫 Hesabın kalıcı olarak askıya alınmış. Destekle iletişime geç."
              : `⏸️ Hesabın ${user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleDateString("tr-TR") : "belirsiz"} tarihine kadar askıda.`}
          </Text>
        </View>
      ) : (
        <Text style={styles.miniNote}>✅ Hesabın aktif ve good standing'de. Kurallara uymaya devam et!</Text>
      )}
    </Card>
  );
}

function TwoFactorSection({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");

  const start = async () => {
    setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const setup = await setup2fa();
      setQr(setup.qrCode);
      setSecret(setup.secret);
      setBackupCodes(setup.backupCodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setQr(null); setSecret(null); setBackupCodes([]); setCode(""); setError(null);
  };

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>İki Faktörlü Doğrulama (2FA)</SectionTitle>
      <Text style={styles.desc}>
        {enabled
          ? "Hesabın iki faktörlü doğrulama ile korunuyor."
          : "Hesabını ekstra bir katmanla koru; girişte authenticator kodu istenir."}
      </Text>

      {!open && (
        enabled ? (
          <PrimaryButton label="2FA'yı kapat" variant="outline" onPress={() => setOpen(true)} />
        ) : (
          <PrimaryButton label="🔐 2FA'yı etkinleştir" onPress={start} />
        )
      )}

      {open && (
        <>
          {!enabled && (
            <>
              {busy && !qr ? (
                <Text style={styles.desc}>QR oluşturuluyor…</Text>
              ) : qr ? (
                <>
                  <Image source={{ uri: qr }} style={styles.qrImage} resizeMode="contain" />
                  {secret ? <Text style={styles.secretText}>Manuel anahtar: {secret}</Text> : null}
                  <Text style={styles.backupTitle}>Yedek kodlar (tek kullanım):</Text>
                  <Text style={styles.backupCodes}>{backupCodes.join("  ·  ")}</Text>
                </>
              ) : null}
            </>
          )}
          <Field label="6 haneli kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <View style={styles.half}>
              <PrimaryButton label="Vazgeç" variant="ghost" onPress={() => { setOpen(false); reset(); }} />
            </View>
            <View style={styles.half}>
              {enabled ? (
                <PrimaryButton
                  label="Kapat"
                  variant="danger"
                  loading={busy}
                  disabled={code.length !== 6}
                  onPress={async () => {
                    setBusy(true); setError(null);
                    try {
                      await disable2fa(code);
                      await onChanged();
                      setOpen(false); reset();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Kod hatalı");
                    } finally { setBusy(false); }
                  }}
                />
              ) : (
                <PrimaryButton
                  label="Etkinleştir"
                  loading={busy}
                  disabled={!qr || code.length !== 6}
                  onPress={async () => {
                    setBusy(true); setError(null);
                    try {
                      await verify2fa(code);
                      await onChanged();
                      setOpen(false); reset();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Kod hatalı");
                    } finally { setBusy(false); }
                  }}
                />
              )}
            </View>
          </View>
        </>
      )}
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Şifre değiştir</SectionTitle>
      <Field label="Mevcut şifre" value={current} onChangeText={setCurrent} secureTextEntry />
      <Field label="Yeni şifre" value={next} onChangeText={setNext} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label="Şifreyi güncelle"
        loading={saving}
        onPress={async () => {
          setSaving(true);
          setError(null);
          try {
            await changePassword(current, next);
            setCurrent("");
            setNext("");
            Alert.alert("Tamam", "Şifren güncellendi");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Şifre değiştirilemedi");
          } finally {
            setSaving(false);
          }
        }}
      />
    </Card>
  );
}

function EmailChangeSection({ currentEmail, onChanged }: { currentEmail: string; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>E-posta değiştir</SectionTitle>
      {!open ? (
        <PrimaryButton label="E-posta değiştir" variant="outline" onPress={() => setOpen(true)} />
      ) : !requested ? (
        <>
          <Text style={styles.desc}>Doğrulama kodu {currentEmail} adresine gönderilir.</Text>
          <Field label="Yeni e-posta" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setOpen(false)} /></View>
            <View style={styles.half}>
              <PrimaryButton
                label="Kod gönder"
                loading={busy}
                disabled={!newEmail.includes("@")}
                onPress={async () => {
                  setBusy(true); setError(null);
                  try {
                    await requestEmailChange(newEmail);
                    setRequested(true);
                    setInfo("Kod gönderildi.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Kod gönderilemedi");
                  } finally { setBusy(false); }
                }}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.desc}>{info}</Text>
          <Field label="Doğrulama kodu" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => { setOpen(false); setRequested(false); setCode(""); setInfo(null); setError(null); }} /></View>
            <View style={styles.half}>
              <PrimaryButton
                label="Onayla"
                loading={busy}
                disabled={code.length < 4}
                onPress={async () => {
                  setBusy(true); setError(null);
                  try {
                    await confirmEmailChange(code);
                    await onChanged();
                    setOpen(false); setRequested(false); setCode(""); setInfo(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Doğrulama başarısız");
                  } finally { setBusy(false); }
                }}
              />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}

function ForgotPasswordInline() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [stage, setStage] = useState<"idle" | "code-sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Şifremi unuttum</SectionTitle>
      {stage === "idle" ? (
        <>
          <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label="Sıfırlama kodu gönder"
            variant="outline"
            onPress={async () => {
              setError(null);
              try {
                await requestPasswordReset(email.trim());
                setStage("code-sent");
                setInfo("Kod e-postana gönderildi.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "İstek başarısız");
              }
            }}
          />
        </>
      ) : (
        <>
          <Text style={styles.desc}>{info}</Text>
          <Field label="Kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
          <Field label="Yeni şifre" value={newPass} onChangeText={setNewPass} secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label="Şifreyi sıfırla"
            onPress={async () => {
              setError(null);
              try {
                await resetPassword(email.trim(), code, newPass);
                Alert.alert("Tamam", "Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.");
                setStage("idle"); setCode(""); setNewPass(""); setInfo(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sıfırlama başarısız");
              }
            }}
          />
        </>
      )}
    </Card>
  );
}

/* ================= BİLDİRİM TERCİHLERİ ================= */

function NotificationsTab() {
  const rows = [
    { icon: "📥", label: "Yeni başvuru", desc: "İlanına bir işçi başvurduğunda" },
    { icon: "✅", label: "Başvuru sonucu", desc: "Kabul veya ret bildirimi" },
    { icon: "💬", label: "Yeni mesaj", desc: "Sohbetlerde okunmamış mesaj" },
    { icon: "⭐", label: "Puan & yorum", desc: "Tamamlanan iş sonrası değerlendirme" },
    { icon: "⏰", label: "İş hatırlatması", desc: "Yaklaşan iş günü öncesi hatırlatma" },
  ];
  return (
    <>
      <Card style={{ gap: 10 }}>
        <SectionTitle>Bildirim türleri</SectionTitle>
        <Text style={styles.desc}>
          Bu bildirimler platform tarafından otomatik oluşturulur ve Mesajlar sekmesindeki 🔔 Bildirimler
          bölümünde listelenir. Tab çubuğundaki rozet, okunmamış bildirim sayısını gösterir.
        </Text>
        {rows.map((r) => (
          <View key={r.label} style={styles.secRow}>
            <Text style={styles.secIcon}>{r.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.secLabel}>{r.label}</Text>
              <Text style={styles.secDesc}>{r.desc}</Text>
            </View>
            <Badge label="Açık" color={C.emerald} bg={C.emeraldBg} />
          </View>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <SectionTitle>Bildirimleri yönet</SectionTitle>
        <Text style={styles.desc}>
          Bildirim listesini açmak için alt çubuktaki 🔔 Bildirimler sekmesine dokun. Tek bildirime dokunmak
          onu okundu yapar; çöp ikonu siler; “Tümünü okundu işaretle” hepsini temizler.
        </Text>
        <View style={styles.divider} />
        <View style={styles.secRow}>
          <Text style={styles.secIcon}>🔕</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.secLabel}>İtiraz / şikayet bildirimleri</Text>
            <Text style={styles.secDesc}>Ödeme itirazı ve moderasyon uyarıları her zaman açık kalır.</Text>
          </View>
          <Badge label="Zorunlu" color={C.stone} bg={C.stoneBg} />
        </View>
      </Card>
    </>
  );
}

/* ================= POLİTİKALAR ================= */

function PoliciesTab() {
  const [openRule, setOpenRule] = useState<string | null>("moderation");
  const toggle = (k: string) => setOpenRule(openRule === k ? null : k);

  return (
    <>
      <Card style={{ gap: 10 }}>
        <SectionTitle>Otomatik Moderasyon Sistemi</SectionTitle>
        <Text style={styles.desc}>
          Mesajlarda içerik otomatik olarak filtrelenir. Aşağıdaki ihlaller sistemce yakalanır ve yaptırım uygulanır:
        </Text>
        {[
          { label: "Küfür & hakaret (TR + EN, leetspeak dahil)", sev: "HIGH", color: C.rose, bg: C.roseBg },
          { label: "Telefon numarası paylaşımı", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "E-posta adresi paylaşımı", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "URL / sosyal medya (wa.me, instagram, @handle)", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "IBAN paylaşımı", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "Açık adres (mahalle/cadde/sokak)", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "Tehdit içeren mesajlar (otomatik engelleme)", sev: "CRITICAL", color: C.rose, bg: C.roseBg },
        ].map((r) => (
          <View key={r.label} style={styles.ruleRow}>
            <Text style={styles.ruleText}>{r.label}</Text>
            <Badge label={r.sev} color={r.color} bg={r.bg} />
          </View>
        ))}
        <View style={styles.divider} />
        <Text style={styles.desc}>Otomatik yaptırım tablosu:</Text>
        {[
          { k: "5 LOW ihlali", v: "24 saat sessize alma" },
          { k: "3 MEDIUM ihlali", v: "24 saat sessize alma" },
          { k: "2 HIGH ihlali", v: "7 gün askıya alma" },
          { k: "1 CRITICAL ihlali", v: "30 gün ban incelemesi" },
          { k: "20+ toplam ihlal", v: "kalıcı ban incelemesi" },
        ].map((r) => (
          <View key={r.k} style={styles.ruleRow}>
            <Text style={styles.ruleText}>{r.k}</Text>
            <Text style={styles.ruleValue}>{r.v}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("payment")}>
          <View style={styles.accHeader}>
            <SectionTitle>Ödeme politikası</SectionTitle>
            <Text style={styles.accChevron}>{openRule === "payment" ? "▾" : "▸"}</Text>
          </View>
        </Pressable>
        {openRule === "payment" && (
          <Text style={styles.accBody}>
            Ücretler iş ilanında belirtilen tutar üzerinden anlaşılır. İş tamamlandığında ödeme kaydı oluşur;
            yönetim onayı sonrası işveren “ödendi”, işçi “aldım” onayı verir. Ödeme anlaşmazlığında iki tarafın
            da QR kayıtları ve mesaj geçmişi delil olarak incelenir. Nakit ödemede “Ödemeyi Al” QR'ını karşılıklı
            okutmak her iki taraf için kayıt oluşturur.
          </Text>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("job")}>
          <View style={styles.accHeader}>
            <SectionTitle>İlan onay politikası</SectionTitle>
            <Text style={styles.accChevron}>{openRule === "job" ? "▾" : "▸"}</Text>
          </View>
        </Pressable>
        {openRule === "job" && (
          <Text style={styles.accBody}>
            Doğrulanmış işverenler ilanlarını anında yayımlar. Doğrulanmamış hesapların ilanları yönetim onayı
            bekler (onaylanır veya reddedilir). Yanıltıcı ilanlar kaldırılır ve hesap uyarı alır.
          </Text>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("conduct")}>
          <View style={styles.accHeader}>
            <SectionTitle>Topluluk kuralları</SectionTitle>
            <Text style={styles.accChevron}>{openRule === "conduct" ? "▾" : "▸"}</Text>
          </View>
        </Pressable>
        {openRule === "conduct" && (
          <Text style={styles.accBody}>
            1) Karşılıklı saygı — hakaret, tehdit ve ayrımcılık yasaktır.{"\n"}
            2) Dış kanala yönlendirme yasaktır (telefon/e-posta/WhatsApp/sosyal medya) — güvenliğin için tüm
            konuşma platform içinde kalır.{"\n"}
            3) Sahte ilan ve sahte başvurular kalıcı ban sebebidir.{"\n"}
            4) İş sonrası karşılıklı puanlama zorunludur; adil puan ver.{"\n"}
            5) Ödeme anlaşmazlıklarını platform üzerinden çöz; itiraz hakkın saklıdır.
          </Text>
        )}
      </Card>
    </>
  );
}

/* ================= HAKKINDA ================= */

function AboutTab({ onLogout }: { onLogout: () => void }) {
  return (
    <>
      <Card style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 44 }}>💼</Text>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.text }}>Günübirlik</Text>
        <Text style={styles.desc}>Günlük iş bulma ve işçi bulma platformu</Text>
        <Badge label="Mobil v1.1.0" color={C.primary} bg={C.primarySoft} />
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Uygulama</SectionTitle>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>Sürüm</Text>
          <Text style={styles.ruleValue}>1.1.0 (build 6)</Text>
        </View>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>Sunucu</Text>
          <Text style={styles.ruleValue}>gunubirlik.space-z.ai</Text>
        </View>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>Teknoloji</Text>
          <Text style={styles.ruleValue}>Expo · React Native</Text>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Yardım & Destek</SectionTitle>
        <Text style={styles.desc}>
          Sorun yaşarsan web sitesindeki iletişim formunu kullanabilir veya işverenle mesajlaşma sekmesinden
          yazışabilirsin. Ödeme itirazları yönetim panelinde öncelikle incelenir.
        </Text>
      </Card>

      <PrimaryButton label="🚪 Çıkış yap" variant="danger" onPress={onLogout} />
    </>
  );
}

/* ================= Ortak parçalar ================= */

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
  autoCapitalize?: "none" | "sentences";
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.textArea]}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        multiline={props.multiline}
        maxLength={props.maxLength}
        placeholderTextColor={C.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  tabStrip: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  tabStripInner: { flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  tabBtn: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 2 },
  tabBtnActive: { backgroundColor: C.primarySoft },
  tabIcon: { fontSize: 18, opacity: 0.6 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, fontWeight: "700", color: C.muted },
  tabLabelActive: { color: C.primary },
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },
  idRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: 18, fontWeight: "800", color: C.primary },
  avatarEdit: { fontSize: 9, fontWeight: "700", color: C.primary, textAlign: "center", marginTop: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 17, fontWeight: "800", color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 2 },
  ratingBox: { alignItems: "center", backgroundColor: C.amberBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  ratingValue: { fontSize: 16, fontWeight: "800", color: C.amber },
  ratingCount: { fontSize: 10, color: C.amber },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  bio: { fontSize: 13, color: C.text, backgroundColor: "#f5f5f7", borderRadius: 10, padding: 10, marginTop: 10, lineHeight: 20 },
  memberSince: { fontSize: 11, color: C.muted, marginTop: 8 },
  desc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  backupTitle: { fontSize: 12, fontWeight: "700", color: C.amber },
  backupCodes: { fontSize: 12, color: C.amber, lineHeight: 20 },
  qrImage: { width: 180, height: 180, alignSelf: "center", borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border },
  secretText: { fontSize: 12, fontWeight: "700", color: C.text, textAlign: "center", letterSpacing: 1 },
  label: { fontSize: 13, fontWeight: "600", color: C.text },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: "#fff" },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  error: { color: C.danger, fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  statRow: { flexDirection: "row", gap: 10 },
  historyRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  historyTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  historyMeta: { fontSize: 12, color: C.muted },
  miniNote: { fontSize: 11, color: C.muted, lineHeight: 16, backgroundColor: "#f5f5f7", borderRadius: 8, padding: 8 },
  walletHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  walletTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  walletBalance: { fontSize: 34, fontWeight: "800", color: C.primary },
  walletSub: { fontSize: 12, color: C.muted, marginTop: -4 },
  divider: { height: 1, backgroundColor: "#f3f4f6" },
  infoRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 12, color: C.muted, width: 110 },
  infoValue: { fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  infoValueStrong: { fontSize: 13, fontWeight: "800", color: C.primary, flex: 1 },
  flowStep: { fontSize: 13, color: C.text, lineHeight: 20 },
  flowStrong: { fontWeight: "800" },
  ledgerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  ledgerAmount: { fontSize: 14, fontWeight: "800", color: C.text },
  secRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  secIcon: { fontSize: 16 },
  secLabel: { fontSize: 13, fontWeight: "700", color: C.text },
  secDesc: { fontSize: 12, color: C.muted, marginTop: 1 },
  secValue: { fontSize: 13, fontWeight: "700", color: C.emerald },
  secValueDanger: { color: C.danger },
  banBox: { backgroundColor: C.roseBg, borderRadius: 10, padding: 10 },
  banText: { fontSize: 13, color: C.rose, fontWeight: "700", lineHeight: 19 },
  ruleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingVertical: 4 },
  ruleText: { fontSize: 13, color: C.text, flex: 1, lineHeight: 18 },
  ruleValue: { fontSize: 12, fontWeight: "700", color: C.muted, textAlign: "right" },
  accHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accChevron: { fontSize: 14, color: C.muted },
  accBody: { fontSize: 13, color: C.text, lineHeight: 20 },
});
