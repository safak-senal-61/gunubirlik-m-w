import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { getIdTokenFromGoogle } from "@/lib/google-auth";

// src/screens/ → mobile/assets/ (EAS arşiv kökü repo kökü olduğundan tam iki seviye)
const LOGO = require("../../assets/app-icon.png");

type Mode = "login" | "register" | "twofactor" | "forgot" | "reset" | "verify";

// ---------------- Telefon: ülke kodları + maske ----------------
// Numara backend'e tam E.164 olarak gönderilir: +<dial><digits> (örn. +905321234567)
type Country = {
  code: string;
  name: string;
  flag: string;
  dial: string;
  digits: number;
  placeholder: string;
  fmt: (d: string) => string;
};

const COUNTRIES: Country[] = [
  {
    code: "TR", name: "Türkiye", flag: "🇹🇷", dial: "90", digits: 10, placeholder: "5XX XXX XX XX",
    fmt: (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" "),
  },
  {
    code: "US", name: "ABD", flag: "🇺🇸", dial: "1", digits: 10, placeholder: "XXX XXX XXXX",
    fmt: (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(" "),
  },
  {
    code: "DE", name: "Almanya", flag: "🇩🇪", dial: "49", digits: 11, placeholder: "XXX XXXX XXXX",
    fmt: (d) => [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)].filter(Boolean).join(" "),
  },
  {
    code: "GB", name: "Birleşik Krallık", flag: "🇬🇧", dial: "44", digits: 10, placeholder: "XXXX XXX XXX",
    fmt: (d) => [d.slice(0, 4), d.slice(4, 7), d.slice(7, 10)].filter(Boolean).join(" "),
  },
  {
    code: "FR", name: "Fransa", flag: "🇫🇷", dial: "33", digits: 9, placeholder: "X XX XX XX XX",
    fmt: (d) => [d.slice(0, 1), d.slice(1, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" "),
  },
  {
    code: "NL", name: "Hollanda", flag: "🇳🇱", dial: "31", digits: 9, placeholder: "XXX XXX XXX",
    fmt: (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(" "),
  },
  {
    code: "AZ", name: "Azerbaycan", flag: "🇦🇿", dial: "994", digits: 9, placeholder: "XX XXX XX XX",
    fmt: (d) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" "),
  },
];

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
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [phoneDigits, setPhoneDigits] = useState("");
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

  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);

  const handleNextStep = () => {
    setError(null);
    if (regStep === 1) {
      setRegStep(2);
    } else if (regStep === 2) {
      if (!fullName.trim()) {
        setError("Lütfen adını ve soyadını gir.");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setError("Lütfen geçerli bir e-posta adresi gir.");
        return;
      }
      if (!phoneDigits || phoneDigits.length < 7) {
        setError("Lütfen geçerli bir telefon numarası gir.");
        return;
      }
      if (role === "EMPLOYER" && !companyName.trim()) {
        setError("Lütfen şirket veya işletme adını gir.");
        return;
      }
      setRegStep(3);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (regStep === 3) setRegStep(2);
    else if (regStep === 2) setRegStep(1);
  };

  const submitRegister = async () => {
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (!city.trim() || !district.trim()) {
      setError("Lütfen il ve ilçe bilgilerini gir.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: `+${country.dial}${phoneDigits}`,
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

  // Google ile giriş/kayıt: ID token'ı backend'e gönderir; hesap yoksa otomatik oluşur.
  const submitGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const result = await getIdTokenFromGoogle();
      if (!result) return; // kullanıcı diyaloğu kapattı
      await loginWithGoogle(result.idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google ile giriş başarısız");
    } finally {
      setGoogleLoading(false);
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

              <View style={styles.googleContainer}>
                <Divider text="veya" />
                <GoogleButton
                  loading={googleLoading}
                  onPress={() => {
                    void submitGoogle();
                  }}
                />
              </View>

              <View style={styles.switchModeContainer}>
                <SwitchMode
                  text="Hesabın yok mu?"
                  action="Hesap Oluştur"
                  onPress={() => {
                    setMode("register");
                    setError(null);
                    setRegStep(1);
                  }}
                />
              </View>
            </>
          )}

          {mode === "register" && (
            <>
              {/* Gamified Level Progress Bar */}
              <View style={styles.wizardCard}>
                <View style={styles.wizardTopRow}>
                  <View style={styles.wizardBadgeRow}>
                    <View style={styles.wizardStepBadge}>
                      <Text style={styles.wizardStepBadgeText}>{regStep}</Text>
                    </View>
                    <Text style={styles.wizardTitleText}>
                      {regStep === 1 && "Level 1: Rolünü Seç 🎯"}
                      {regStep === 2 && "Level 2: Kimlik & İletişim 👤"}
                      {regStep === 3 && "Level 3: Güvenlik & Konum 🔐"}
                    </Text>
                  </View>
                  <View style={styles.xpPill}>
                    <Text style={styles.xpPillText}>
                      {regStep === 1 && "⚡ 33% XP"}
                      {regStep === 2 && "🔥 66% XP"}
                      {regStep === 3 && "🏆 Son Seviye"}
                    </Text>
                  </View>
                </View>

                {/* Progress track */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: regStep === 1 ? "33.3%" : regStep === 2 ? "66.6%" : "100%",
                      },
                    ]}
                  />
                </View>

                {/* Step Chips */}
                <View style={styles.stepChipsRow}>
                  <Pressable onPress={() => setRegStep(1)} style={styles.stepChipItem}>
                    <View style={[styles.stepDot, regStep >= 1 && styles.stepDotActive]}>
                      <Text style={[styles.stepDotText, regStep >= 1 && styles.stepDotTextActive]}>
                        {regStep > 1 ? "✓" : "1"}
                      </Text>
                    </View>
                    <Text style={[styles.stepLabel, regStep >= 1 && styles.stepLabelActive]}>Rol</Text>
                  </Pressable>

                  <View style={[styles.stepConnector, regStep >= 2 && styles.stepConnectorActive]} />

                  <Pressable
                    onPress={() => {
                      if (regStep > 2) setRegStep(2);
                      else if (regStep === 1) handleNextStep();
                    }}
                    style={styles.stepChipItem}
                  >
                    <View style={[styles.stepDot, regStep >= 2 && styles.stepDotActive]}>
                      <Text style={[styles.stepDotText, regStep >= 2 && styles.stepDotTextActive]}>
                        {regStep > 2 ? "✓" : "2"}
                      </Text>
                    </View>
                    <Text style={[styles.stepLabel, regStep >= 2 && styles.stepLabelActive]}>Bilgiler</Text>
                  </Pressable>

                  <View style={[styles.stepConnector, regStep >= 3 && styles.stepConnectorActive]} />

                  <Pressable
                    onPress={() => {
                      if (regStep === 2) handleNextStep();
                    }}
                    style={styles.stepChipItem}
                  >
                    <View style={[styles.stepDot, regStep >= 3 && styles.stepDotActive]}>
                      <Text style={[styles.stepDotText, regStep >= 3 && styles.stepDotTextActive]}>
                        3
                      </Text>
                    </View>
                    <Text style={[styles.stepLabel, regStep >= 3 && styles.stepLabelActive]}>Güvenlik</Text>
                  </Pressable>
                </View>
              </View>

              {/* LEVEL 1: ROL SEÇİMİ */}
              {regStep === 1 && (
                <View style={styles.stepContent}>
                  <Text style={styles.sectionLabel}>Nasıl katılmak istiyorsun?</Text>
                  <View style={styles.roleRow}>
                    <RoleCard
                      active={role === "WORKER"}
                      emoji="🔨"
                      label="İşçiyim"
                      hint="İş bul, hemen kazan"
                      onPress={() => setRole("WORKER")}
                    />
                    <RoleCard
                      active={role === "EMPLOYER"}
                      emoji="🏢"
                      label="İşverenim"
                      hint="İlan ver, eleman bul"
                      onPress={() => setRole("EMPLOYER")}
                    />
                  </View>

                  <PrimaryButton
                    label="Devam Et → (Level 2)"
                    onPress={handleNextStep}
                  />

                  <View style={styles.googleContainer}>
                    <Divider text="veya hızlı başla" />
                    <GoogleButton
                      loading={googleLoading}
                      onPress={() => {
                        void submitGoogle();
                      }}
                    />
                  </View>

                  <View style={styles.switchModeContainer}>
                    <SwitchMode
                      text="Zaten hesabın var mı?"
                      action="Giriş yap"
                      onPress={() => {
                        setMode("login");
                        setError(null);
                      }}
                    />
                  </View>
                </View>
              )}

              {/* LEVEL 2: KİMLİK & BİLGİLER */}
              {regStep === 2 && (
                <View style={styles.stepContent}>
                  <Field
                    icon="👤"
                    label="Ad Soyad *"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Adın ve soyadın"
                  />
                  <Field
                    icon="✉️"
                    label="E-posta *"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="ornek@eposta.com"
                  />
                  <PhoneField
                    country={country}
                    digits={phoneDigits}
                    onCountry={(c) => {
                      setCountry(c);
                      setPhoneDigits((d) => d.slice(0, c.digits));
                    }}
                    onDigits={setPhoneDigits}
                  />
                  {role === "EMPLOYER" && (
                    <Field
                      icon="🏢"
                      label="Şirket / İşletme Adı *"
                      value={companyName}
                      onChangeText={setCompanyName}
                      placeholder="Örn. Yılmaz İnşaat Ltd."
                    />
                  )}

                  {error ? <Banner tone="error" text={error} /> : null}

                  <View style={styles.stepNavRow}>
                    <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                      <Text style={styles.backBtnText}>← Geri</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Devam Et → (Level 3)"
                        onPress={handleNextStep}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* LEVEL 3: GÜVENLİK & KONUM */}
              {regStep === 3 && (
                <View style={styles.stepContent}>
                  <Field
                    icon="🔒"
                    label="Şifre * (En az 6 karakter)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                  />
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Field icon="📍" label="İl *" value={city} onChangeText={setCity} />
                    </View>
                    <View style={styles.half}>
                      <Field icon="🗺️" label="İlçe *" value={district} onChangeText={setDistrict} />
                    </View>
                  </View>

                  <Text style={styles.level3Hint}>
                    ✨ Son adım! Bilgilerin kaydedilecek ve hesabın oluşturulacak.
                  </Text>

                  {error ? <Banner tone="error" text={error} /> : null}

                  <View style={styles.stepNavRow}>
                    <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                      <Text style={styles.backBtnText}>← Geri</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="🎉 Hesap Oluştur"
                        onPress={submitRegister}
                        loading={loading}
                      />
                    </View>
                  </View>
                </View>
              )}
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

/** Ülke kodu seçici + maskeli telefon girişi (karakter sınırı ülkeye göre). */
function PhoneField(props: {
  country: Country;
  digits: string;
  onCountry: (c: Country) => void;
  onDigits: (d: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const c = props.country;
  const masked = c.fmt(props.digits);
  const complete = props.digits.length >= c.digits;
  // Maskenin tam dolu halinin uzunluğu = TextInput maxLength
  const maxLen = c.fmt("9".repeat(c.digits)).length;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Telefon numarası</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Pressable style={styles.countryBtn} onPress={() => setPickerOpen(true)} hitSlop={4}>
          <Text style={styles.countryFlag}>{c.flag}</Text>
          <Text style={styles.countryDial}>+{c.dial}</Text>
          <Text style={styles.countryChevron}>▾</Text>
        </Pressable>
        <View style={styles.phoneDivider} />
        <TextInput
          style={styles.input}
          value={masked}
          onChangeText={(raw) => props.onDigits(raw.replace(/\D/g, "").slice(0, c.digits))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          placeholder={c.placeholder}
          placeholderTextColor="#a1a1aa"
          maxLength={maxLen}
        />
        {props.digits.length > 0 ? (
          <Text style={[styles.phoneHint, complete ? styles.phoneHintOk : null]}>
            {props.digits.length}/{c.digits}
          </Text>
        ) : null}
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Ülke seç</Text>
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
              {COUNTRIES.map((item) => (
                <Pressable
                  key={item.code}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    item.code === c.code && styles.pickerRowActive,
                    pressed && styles.pickerRowPressed,
                  ]}
                  onPress={() => {
                    props.onCountry(item);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerFlag}>{item.flag}</Text>
                  <View style={styles.pickerNameBox}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerSample}>{item.placeholder}</Text>
                  </View>
                  <Text style={styles.pickerDial}>+{item.dial}</Text>
                  {item.code === c.code ? <Text style={styles.pickerCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.pickerCancel} onPress={() => setPickerOpen(false)}>
              <Text style={styles.pickerCancelText}>Vazgeç</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

function GoogleButton(props: { onPress: () => void; loading?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.loading}
      style={({ pressed }) => [
        styles.googleBtn,
        pressed && styles.pressed,
        props.loading && styles.primaryBtnDisabled,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={C.text} />
      ) : (
        <>
          <Text style={styles.googleG}>G</Text>
          <Text style={styles.googleBtnText}>Google ile devam et</Text>
        </>
      )}
    </Pressable>
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
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#000833",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00e5ff",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: "hidden",
  },
  logoImage: { width: 68, height: 68, borderRadius: 20 },
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
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, color: C.muted, fontWeight: "600" },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4, shadowColor: C.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  googleContainer: {
    marginTop: 10,
    marginBottom: 6,
  },
  switchModeContainer: {
    marginTop: 14,
    marginBottom: 4,
  },
  // Level Up Wizard Styles
  wizardCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  wizardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  wizardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  wizardStepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  wizardStepBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#ffffff",
  },
  wizardTitleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065f46",
    flex: 1,
  },
  xpPill: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    overflow: "hidden",
    marginVertical: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 999,
  },
  stepChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  stepChipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: "#059669",
  },
  stepDotText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
  },
  stepDotTextActive: {
    color: "#ffffff",
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  stepLabelActive: {
    color: "#065f46",
    fontWeight: "800",
  },
  stepConnector: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 8,
  },
  stepConnectorActive: {
    backgroundColor: "#34d399",
  },
  stepContent: {
    gap: 2,
  },
  stepNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  level3Hint: {
    fontSize: 12,
    color: "#059669",
    backgroundColor: "#ecfdf5",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    marginBottom: 10,
    lineHeight: 17,
  },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: C.text },
  googleG: { fontSize: 19, fontWeight: "800", color: "#4285F4", lineHeight: 22 },
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
  countryBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 13 },
  countryFlag: { fontSize: 17 },
  countryDial: { fontSize: 14, fontWeight: "800", color: C.text },
  countryChevron: { fontSize: 10, color: C.muted },
  phoneDivider: { width: 1, height: 22, backgroundColor: C.border },
  phoneHint: { fontSize: 10, fontWeight: "700", color: C.muted },
  phoneHintOk: { color: C.success },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  pickerSheet: { backgroundColor: "#fff", borderRadius: 20, padding: 16, width: "100%", maxWidth: 360 },
  pickerTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 10, textAlign: "center" },
  pickerList: { maxHeight: 320 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 12 },
  pickerRowActive: { backgroundColor: C.primarySoft },
  pickerRowPressed: { backgroundColor: "#f4f4f8" },
  pickerFlag: { fontSize: 22 },
  pickerNameBox: { flex: 1 },
  pickerName: { fontSize: 14, fontWeight: "700", color: C.text },
  pickerSample: { fontSize: 11, color: C.muted, marginTop: 1 },
  pickerDial: { fontSize: 13, fontWeight: "800", color: C.muted },
  pickerCheck: { fontSize: 14, fontWeight: "900", color: C.primary },
  pickerCancel: { marginTop: 10, paddingVertical: 12, alignItems: "center", borderRadius: 12, backgroundColor: "#f4f4f8" },
  pickerCancelText: { fontSize: 13, fontWeight: "700", color: C.muted },
  footNote: { fontSize: 11, color: C.muted, textAlign: "center", marginTop: 18, lineHeight: 16 },
});
