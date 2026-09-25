import { useState } from "react";
import {
  ActivityIndicator,
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
} from "@/lib/api";

type Mode = "login" | "register" | "twofactor" | "forgot" | "reset";

const C = {
  primary: "#4f46e5",
  primarySoft: "#eef2ff",
  text: "#1e1b33",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#fafafa",
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
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setLoading(false);
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
      await resetPassword(email.trim(), resetCode, newPassword);
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
      >
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoEmoji}>🔨</Text>
          </View>
          <Text style={styles.logoText}>Günübirlik</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {mode === "login" && (
            <>
              <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Giriş yap" onPress={submitLogin} loading={loading} />
              <Pressable onPress={() => { setMode("forgot"); setError(null); }}>
                <Text style={styles.link}>Şifremi unuttum</Text>
              </Pressable>
              <SwitchMode text="Hesabın yok mu?" action="Ücretsiz kayıt ol" onPress={() => { setMode("register"); setError(null); }} />
            </>
          )}

          {mode === "register" && (
            <>
              <View style={styles.roleRow}>
                <RoleCard active={role === "WORKER"} emoji="🔨" label="İşçiyim" onPress={() => setRole("WORKER")} />
                <RoleCard active={role === "EMPLOYER"} emoji="🏢" label="İşverenim" onPress={() => setRole("EMPLOYER")} />
              </View>
              <Field label="Ad Soyad" value={fullName} onChangeText={setFullName} />
              <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+905321234567" />
              <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="En az 6 karakter" />
              {role === "EMPLOYER" && (
                <Field label="Şirket adı" value={companyName} onChangeText={setCompanyName} placeholder="Örn. Yılmaz İnşaat" />
              )}
              <View style={styles.row}>
                <View style={styles.half}>
                  <Field label="İl" value={city} onChangeText={setCity} />
                </View>
                <View style={styles.half}>
                  <Field label="İlçe" value={district} onChangeText={setDistrict} />
                </View>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Hesap oluştur" onPress={submitRegister} loading={loading} />
              <SwitchMode text="Zaten hesabın var mı?" action="Giriş yap" onPress={() => { setMode("login"); setError(null); }} />
            </>
          )}

          {mode === "twofactor" && (
            <>
              <Text style={styles.desc}>Authenticator uygulamandaki 6 haneli kodu gir.</Text>
              <Field label="Kod" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Doğrula" onPress={submitTwoFactor} loading={loading} disabled={otp.length !== 6} />
              <Pressable onPress={() => { setMode("login"); setError(null); }}>
                <Text style={styles.link}>← Geri dön</Text>
              </Pressable>
            </>
          )}

          {mode === "forgot" && (
            <>
              <Text style={styles.desc}>E-postana sıfırlama kodu göndereceğiz.</Text>
              <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Kod gönder" onPress={submitForgot} loading={loading} />
              <Pressable onPress={() => { setMode("login"); setError(null); setInfo(null); }}>
                <Text style={styles.link}>← Girişe dön</Text>
              </Pressable>
            </>
          )}

          {mode === "reset" && (
            <>
              <Text style={styles.desc}>{info ?? "E-postana gelen kodu ve yeni şifreni gir."}</Text>
              <Field label="Doğrulama kodu" value={resetCode} onChangeText={(v) => setResetCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
              <Field label="Yeni şifre" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="En az 6 karakter" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Şifreyi sıfırla" onPress={submitReset} loading={loading} disabled={resetCode.length !== 6} />
              <Pressable onPress={() => { setMode("forgot"); setError(null); setInfo(null); }}>
                <Text style={styles.link}>← Kodu tekrar gönder</Text>
              </Pressable>
            </>
          )}

          {info && mode !== "reset" ? <Text style={styles.success}>{info}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        placeholder={props.placeholder}
        placeholderTextColor={C.muted}
        maxLength={props.maxLength}
      />
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

function RoleCard(props: { active: boolean; emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.roleCard, props.active && styles.roleCardActive]}
    >
      <Text style={styles.roleEmoji}>{props.emoji}</Text>
      <Text style={[styles.roleLabel, props.active && styles.roleLabelActive]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: C.bg },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 8 },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  logoEmoji: { fontSize: 20 },
  logoText: { fontSize: 20, fontWeight: "800", color: C.text },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  title: { fontSize: 20, fontWeight: "800", color: C.text, marginBottom: 14, textAlign: "center" },
  desc: { fontSize: 13, color: C.muted, marginBottom: 12, textAlign: "center", lineHeight: 19 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text, backgroundColor: "#fff" },
  error: { color: C.danger, fontSize: 13, marginBottom: 10 },
  success: { color: C.success, fontSize: 13, marginBottom: 10, textAlign: "center" },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  pressed: { opacity: 0.9 },
  link: { color: C.primary, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 12 },
  linkBold: { color: C.primary, fontWeight: "700" },
  switchText: { textAlign: "center", color: C.muted, fontSize: 13, marginTop: 16 },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  roleCard: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 4 },
  roleCardActive: { borderWidth: 2, borderColor: C.primary, backgroundColor: C.primarySoft },
  roleEmoji: { fontSize: 20 },
  roleLabel: { fontSize: 13, fontWeight: "600", color: C.muted },
  roleLabelActive: { color: C.primary },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
});
