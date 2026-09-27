import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth, TwoFactorRequiredError } from "@/hooks/use-auth";
import {
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyEmail,
  resendActivation,
} from "@/lib/api";

const LOGO = require("../../../assets/splash-icon.png");

type Mode = "login" | "register" | "twofactor" | "forgot" | "reset" | "verify";

const C = {
  primary: "#4f46e5",
  primarySoft: "#eef2ff",
  text: "#1e1b33",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f4f4f8",
  card: "#ffffff",
  danger: "#dc2626",
  success: "#047857",
};

export default function AuthScreen({ onDone }: { onDone: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"WORKER" | "EMPLOYER">("WORKER");
  const [city, setCity] = useState("İstanbul");
  const [district, setDistrict] = useState("Kadıköy");
  const [companyName, setCompanyName] = useState("");
  const [otp, setOtp] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // E-posta doğrulama: kayıt sonrası aktivasyon kodu ekranı.
  const [verifyEmailAddr, setVerifyEmailAddr] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [resending, setResending] = useState(false);

  const submitLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      onDone();
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setMode("twofactor");
      } else {
        setError(err instanceof Error ? err.message : "Giriş başarısız");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitTwoFactor = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password, otp);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod hatalı");
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        city: city.trim(),
        district: district.trim(),
        ...(role === "EMPLOYER" && companyName.trim() ? { companyName: companyName.trim() } : {}),
      });
      // Kayıt başarılı → hesap doğrulanmadan tam aktif olmaz; aktivasyon kodu ekranına geç.
      // (Kod kayıt anında backend tarafından e-postaya gönderilir; kullanıcı burada girer.)
      setVerifyEmailAddr(email.trim());
      setVerifyCode("");
      setMode("verify");
      setError(null);
      setInfo("Aktivasyon kodu e-postana gönderildi (10 dk geçerli).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      await verifyEmail(verifyEmailAddr, verifyCode);
      setInfo("E-posta doğrulandı! Hesabın aktif. 🎉");
      onDone();
    } catch (err) {
      // Kod hatalı/süresi geçmiş olabilir — kullanıcı yine de uygulamaya girer,
      // doğrulamayı sonra Ayarlar > Güvenlik'ten tamamlayabilir.
      setError(err instanceof Error ? err.message : "Doğrulama başarısız");
    } finally {
      setLoading(false);
    }
  };

  const submitResend = async () => {
    setResending(true);
    setError(null);
    try {
      await resendActivation(verifyEmailAddr);
      setInfo("Aktivasyon kodu tekrar gönderildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gönderilemedi");
    } finally {
      setResending(false);
    }
  };

  const submitForgot = async () => {
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setInfo("Sıfırlama kodu e-postana gönderildi.");
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İstek başarısız");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async () => {
    setLoading(true);
    setError(null);
    try {
      await resetPassword(resetCode, newPassword);
      setInfo("Şifren güncellendi. Yeni şifrenle giriş yap.");
      setMode("login");
      setResetCode("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıfırlama başarısız");
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "login"
      ? "Tekrar hoş geldin"
      : mode === "register"
        ? "Aramıza katıl"
        : mode === "twofactor"
          ? "Doğrulama kodu"
          : mode === "forgot"
            ? "Şifremi unuttum"
            : mode === "verify"
              ? "E-postanı doğrula"
              : "Yeni şifre belirle";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Marka başlığı */}
        <View style={styles.hero}>
          <View style={styles.heroBlob1} pointerEvents="none" />
          <View style={styles.heroBlob2} pointerEvents="none" />
          <View style={styles.logoBox} pointerEvents="none">
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.logoText}>Günübirlik</Text>
          <Text style={styles.tagline}>
            {mode === "login"
              ? "Yakınındaki günlük işleri gör, aynı gün işe başla."
              : mode === "register"
                ? "Ücretsiz hesap aç, ilanlara saniyeler içinde başvur."
                : "Günübirlik hesabın"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {mode === "verify" && (
            <>
              <Text style={styles.desc}>
                {verifyEmailAddr} adresine gönderilen 6 haneli aktivasyon kodunu gir.
              </Text>
              {info ? <Banner tone="success" text={info} /> : null}
              <Field icon="🛡️" label="Aktivasyon kodu" value={verifyCode} onChangeText={(v) => setVerifyCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} placeholder="000000" />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="E-postamı doğrula" onPress={submitVerify} loading={loading} disabled={verifyCode.length !== 6} />
              <Pressable onPress={submitResend} style={styles.linkBtn} disabled={resending}>
                <Text style={styles.link}>{resending ? "Gönderiliyor…" : "Kodu tekrar gönder"}</Text>
              </Pressable>
              <Pressable onPress={onDone} style={styles.linkBtn}>
                <Text style={styles.link}>Şimdilik atla, sonra doğrula →</Text>
              </Pressable>
            </>
          )}

          {mode === "login" && (
            <>
              <Field icon="✉️" label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="ornek@eposta.com" />
              <Field icon="🔒" label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Giriş yap" onPress={submitLogin} loading={loading} />
              <Pressable onPress={() => { setMode("forgot"); setError(null); }} style={styles.linkBtn}>
                <Text style={styles.link}>Şifremi unuttum</Text>
              </Pressable>
              <Divider text="veya" />
              <SwitchMode text="Hesabın yok mu?" action="Ücretsiz kayıt ol" onPress={() => { setMode("register"); setError(null); }} />
            </>
          )}

          {mode === "register" && (
            <>
              <Text style={styles.sectionLabel}>Nasıl kullanacaksın?</Text>
              <View style={styles.roleRow}>
                <RoleCard active={role === "WORKER"} emoji="🔨" label="İşçiyim" hint="İş arıyorum" onPress={() => setRole("WORKER")} />
                <RoleCard active={role === "EMPLOYER"} emoji="🏢" label="İşverenim" hint="İlan vereceğim" onPress={() => setRole("EMPLOYER")} />
              </View>
              <Field icon="👤" label="Ad Soyad" value={fullName} onChangeText={setFullName} placeholder="Adın ve soyadın" />
              <Field icon="✉️" label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="ornek@eposta.com" />
              <Field icon="📞" label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+90 532 123 45 67" />
              <Field icon="🔒" label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="En az 6 karakter" />
              {role === "EMPLOYER" && (
                <Field icon="🏢" label="Şirket adı" value={companyName} onChangeText={setCompanyName} placeholder="Örn. Yılmaz İnşaat" />
              )}
              <View style={styles.row}>
                <View style={styles.half}>
                  <Field icon="📍" label="İl" value={city} onChangeText={setCity} />
                </View>
                <View style={styles.half}>
                  <Field icon="🗺️" label="İlçe" value={district} onChangeText={setDistrict} />
                </View>
              </View>
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Hesap oluştur" onPress={submitRegister} loading={loading} />
              <Divider text="veya" />
              <SwitchMode text="Zaten hesabın var mı?" action="Giriş yap" onPress={() => { setMode("login"); setError(null); }} />
            </>
          )}

          {mode === "twofactor" && (
            <>
              <Text style={styles.desc}>Authenticator uygulamandaki 6 haneli kodu gir.</Text>
              <Field icon="🛡️" label="Kod" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} placeholder="000000" />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Doğrula" onPress={submitTwoFactor} loading={loading} disabled={otp.length !== 6} />
              <Pressable onPress={() => { setMode("login"); setError(null); }} style={styles.linkBtn}>
                <Text style={styles.link}>← Geri dön</Text>
              </Pressable>
            </>
          )}

          {mode === "forgot" && (
            <>
              <Text style={styles.desc}>E-postana sıfırlama kodu göndereceğiz.</Text>
              <Field icon="✉️" label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="ornek@eposta.com" />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Kod gönder" onPress={submitForgot} loading={loading} />
              <Pressable onPress={() => { setMode("login"); setError(null); setInfo(null); }} style={styles.linkBtn}>
                <Text style={styles.link}>← Girişe dön</Text>
              </Pressable>
            </>
          )}

          {mode === "reset" && (
            <>
              <Text style={styles.desc}>{info ?? "E-postana gelen kodu ve yeni şifreni gir."}</Text>
              <Field icon="🛡️" label="Doğrulama kodu" value={resetCode} onChangeText={(v) => setResetCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} placeholder="000000" />
              <Field icon="🔒" label="Yeni şifre" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="En az 6 karakter" />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Şifreyi sıfırla" onPress={submitReset} loading={loading} disabled={resetCode.length !== 6} />
              <Pressable onPress={() => { setMode("forgot"); setError(null); setInfo(null); }} style={styles.linkBtn}>
                <Text style={styles.link}>← Kodu tekrar gönder</Text>
              </Pressable>
            </>
          )}

          {info && mode !== "reset" ? <Banner tone="success" text={info} /> : null}
        </View>

        <Text style={styles.footNote}>Devam ederek kullanım koşullarını kabul etmiş olursun.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  icon?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  placeholder?: string;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        {props.icon ? <Text style={styles.inputIcon}>{props.icon}</Text> : null}
        <TextInput
          style={styles.input}
          value={props.value}
          onChangeText={props.onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize ?? "sentences"}
          placeholder={props.placeholder}
          placeholderTextColor="#a1a1aa"
          maxLength={props.maxLength}
        />
      </View>
    </View>
  );
}

function Banner({ tone, text }: { tone: "error" | "success"; text: string }) {
  return (
    <View style={[styles.banner, tone === "error" ? styles.bannerError : styles.bannerSuccess]}>
      <Text style={[styles.bannerText, tone === "error" ? styles.bannerTextError : styles.bannerTextSuccess]}>
        {tone === "error" ? "⚠️" : "✅"} {text}
      </Text>
    </View>
  );
}

function Divider({ text }: { text: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{text}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function PrimaryButton(props: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        (props.disabled || props.loading) && styles.primaryBtnDisabled,
        pressed && styles.pressed,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryBtnText}>{props.label}</Text>
      )}
    </Pressable>
  );
}

function SwitchMode(props: { text: string; action: string; onPress: () => void }) {
  return (
    <Text style={styles.switchText}>
      {props.text}{" "}
      <Text onPress={props.onPress} style={styles.linkBold}>
        {props.action}
      </Text>
    </Text>
  );
}

function RoleCard(props: { active: boolean; emoji: string; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.roleCard,
        props.active && styles.roleCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.roleIconBox, props.active && styles.roleIconBoxActive]}>
        <Text style={styles.roleEmoji}>{props.emoji}</Text>
      </View>
      <Text style={[styles.roleLabel, props.active && styles.roleLabelActive]}>{props.label}</Text>
      <Text style={styles.roleHint}>{props.hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: 20, paddingTop: 28, paddingBottom: 40, backgroundColor: C.bg },
  hero: { alignItems: "center", marginBottom: 22, gap: 6 },
  heroBlob1: { position: "absolute", top: -40, left: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(79,70,229,0.10)" },
  heroBlob2: { position: "absolute", top: 20, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(79,70,229,0.07)" },
  logoBox: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1e50a2",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    overflow: "hidden",
  },
  logoImage: { width: 62, height: 62, borderRadius: 20 },
  logoText: { fontSize: 26, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19, maxWidth: 300, paddingHorizontal: 10 },
  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 22,
    shadowColor: "#312e81",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  title: { fontSize: 21, fontWeight: "800", color: C.text, marginBottom: 16, textAlign: "center" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  desc: { fontSize: 13, color: C.muted, marginBottom: 14, textAlign: "center", lineHeight: 19 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", color: C.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fafafa",
  },
  inputWrapFocused: { borderColor: C.primary, backgroundColor: "#fff" },
  inputIcon: { fontSize: 14 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.text, backgroundColor: "transparent" },
  banner: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1 },
  bannerError: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  bannerSuccess: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  bannerText: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bannerTextError: { color: C.danger },
  bannerTextSuccess: { color: C.success },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, color: C.muted, fontWeight: "600" },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4, shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },
  pressed: { opacity: 0.9 },
  linkBtn: { paddingVertical: 10, alignItems: "center" },
  link: { color: C.primary, fontSize: 13, fontWeight: "700", textAlign: "center" },
  linkBold: { color: C.primary, fontWeight: "800" },
  switchText: { textAlign: "center", color: C.muted, fontSize: 13 },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  roleCard: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 18, paddingVertical: 14, alignItems: "center", gap: 3, backgroundColor: "#fafafa" },
  roleCardActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
  roleIconBox: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  roleIconBoxActive: { backgroundColor: "#fff" },
  roleEmoji: { fontSize: 20 },
  roleLabel: { fontSize: 13, fontWeight: "700", color: C.muted },
  roleLabelActive: { color: C.primary },
  roleHint: { fontSize: 10, color: C.muted, opacity: 0.8 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  footNote: { fontSize: 11, color: C.muted, textAlign: "center", marginTop: 18, lineHeight: 16 },
});
