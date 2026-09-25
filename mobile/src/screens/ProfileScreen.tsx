import { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Card, C, PrimaryButton, SectionTitle } from "@/components/ui";
import {
  changePassword,
  confirmEmailChange,
  disable2fa,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
  setup2fa,
  updateMe,
  uploadAvatar,
  verify2fa,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export default function ProfileScreen({ refreshKey }: { refreshKey: number }) {
  const { user, refreshUser, logout } = useAuth();

  if (!user) return null;
  const isEmployer = user.role === "EMPLOYER";

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Profilim</Text>
      <Text style={styles.sub}>Hesap bilgilerin ve ayarların.</Text>

      {/* Kimlik kartı */}
      <Card>
        <View style={styles.idRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.fullName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.fullName}</Text>
              {user.isVerified && <Badge label="✓ Doğrulanmış" color={C.emerald} bg={C.emeraldBg} />}
            </View>
            <Text style={styles.meta}>{user.email}</Text>
            {user.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
            {user.city || user.district ? (
              <Text style={styles.meta}>📍 {user.district}, {user.city}</Text>
            ) : null}
            {isEmployer && user.companyName ? (
              <Text style={styles.meta}>🏢 {user.companyName}</Text>
            ) : null}
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

      {/* Profil düzenle */}
      <EditProfileSection user={user} onSaved={refreshUser} />

      {/* Güvenlik: şifre */}
      <PasswordSection />

      {/* 2FA */}
      <TwoFactorSection enabled={!!user.twoFactorEnabled} onChanged={refreshUser} />

      {/* E-posta değiştir */}
      <EmailChangeSection currentEmail={user.email} onChanged={refreshUser} />

      {/* Şifremi unuttum / sıfırlama (girişte unutanlar için referans) */}
      <ForgotPasswordInline />

      <PrimaryButton label="Çıkış yap" variant="danger" onPress={() => logout()} />
    </ScrollView>
  );
}

function EditProfileSection({ user, onSaved }: { user: NonNullable<ReturnType<typeof useAuth>["user"]>; onSaved: () => Promise<void> }) {
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
                  <Image
                    source={{ uri: qr }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
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
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: -6 },
  idRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800", color: C.primary },
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
});
