import React, { useState } from "react";
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
  verifyEmail,
  resendActivation,
} from "@/lib/api";
import { getIdTokenFromGoogle } from "@/lib/google-auth";
import { BriefcaseIcon, UsersIcon } from "@/components/icons";

const LOGO = require("../../assets/app-icon.png");

type Mode = "login" | "register" | "twofactor" | "forgot" | "reset" | "verify";

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
  primary: "#0D6847",
  primarySoft: "#E8F5EE",
  text: "#141615",
  muted: "#5C615E",
  border: "#E2E0D8",
  bg: "#F6F5F2",
  card: "#FFFFFF",
  danger: "#DC2626",
  success: "#0D6847",
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
        setError(err instanceof Error ? err.message : "Giriş başarısız oldu.");
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
      setError(err instanceof Error ? err.message : "Doğrulama kodu hatalı.");
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
        setError("Lütfen ad ve soyadınızı giriniz.");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setError("Lütfen geçerli bir e-posta adresi giriniz.");
        return;
      }
      if (!phoneDigits || phoneDigits.length < 7) {
        setError("Lütfen geçerli bir telefon numarası giriniz.");
        return;
      }
      if (role === "EMPLOYER" && !companyName.trim()) {
        setError("Lütfen şirket veya işletme unvanınızı giriniz.");
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
      setError("Şifreniz en az 6 karakter olmalıdır.");
      return;
    }
    if (!city.trim() || !district.trim()) {
      setError("Lütfen il ve ilçe bilgilerini belirtiniz.");
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
      setVerifyEmailAddr(email.trim());
      setVerifyCode("");
      setMode("verify");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt işlemi tamamlanamadı.");
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async () => {
    if (verifyCode.length !== 6) {
      setError("6 haneli aktivasyon kodunu eksiksiz giriniz.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyEmail(verifyEmailAddr, verifyCode);
      setInfo("E-posta adresiniz doğrulandı. Hesabınız aktif.");
      await login(verifyEmailAddr, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktivasyon kodu geçersiz.");
    } finally {
      setLoading(false);
    }
  };

  const submitResend = async () => {
    if (!verifyEmailAddr) return;
    setResending(true);
    setError(null);
    try {
      await resendActivation(verifyEmailAddr);
      setInfo("Yeni aktivasyon kodu e-posta adresinize gönderildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktivasyon kodu gönderilemedi.");
    } finally {
      setResending(false);
    }
  };

  const submitForgot = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Lütfen geçerli bir e-posta adresi giriniz.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setInfo("Sıfırlama kodu e-posta adresinize iletildi.");
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Talep gönderilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async () => {
    if (resetCode.length !== 6) {
      setError("6 haneli doğrulama kodunu giriniz.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Yeni şifreniz en az 6 karakter olmalıdır.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(resetCode, newPassword);
      setInfo("Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
      setPassword(newPassword);
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const submitGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await getIdTokenFromGoogle();
      if (!res?.idToken) return;
      await loginWithGoogle(res.idToken);
      onDone();
    } catch (err) {
      if (err instanceof Error && err.message.includes("iptal")) {
        // İptal
      } else {
        setError(err instanceof Error ? err.message : "Google ile oturum açılamadı.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const title =
    mode === "login"
      ? "Giriş Yap"
      : mode === "register"
        ? "Hesap Oluştur"
        : mode === "twofactor"
          ? "İki Adımlı Doğrulama"
          : mode === "forgot"
            ? "Şifre Sıfırlama"
            : mode === "verify"
              ? "E-posta Aktivasyonu"
              : "Yeni Şifre Belirle";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.logoText}>Günübirlik</Text>
          <Text style={styles.tagline}>
            {mode === "register"
              ? "Güvenilir günlük iş ve istihdam platformu"
              : "Hızlı, şeffaf ve güvenli günübirlik çalışma"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {mode === "verify" && (
            <>
              <Text style={styles.desc}>
                {verifyEmailAddr} adresine gönderilen 6 haneli aktivasyon kodunu giriniz.
              </Text>
              {info ? <Banner tone="success" text={info} /> : null}
              <Field
                label="Aktivasyon Kodu"
                value={verifyCode}
                onChangeText={(v) => setVerifyCode(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
              />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton
                label="E-postamı Doğrula"
                onPress={submitVerify}
                loading={loading}
                disabled={verifyCode.length !== 6}
              />
              <Pressable onPress={submitResend} style={styles.linkBtn} disabled={resending}>
                <Text style={styles.link}>{resending ? "Gönderiliyor…" : "Kodu Tekrar Gönder"}</Text>
              </Pressable>
              <Pressable onPress={onDone} style={styles.linkBtn}>
                <Text style={styles.link}>Daha sonra doğrula →</Text>
              </Pressable>
            </>
          )}

          {mode === "login" && (
            <>
              <Field
                label="E-posta Adresi"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="ornek@eposta.com"
              />
              <Field
                label="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
              />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Giriş Yap" onPress={submitLogin} loading={loading} />
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
                  text="Hesabınız yok mu?"
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
              {/* Modern Step Wizard Header */}
              <View style={styles.wizardCard}>
                <View style={styles.wizardTopRow}>
                  <View style={styles.wizardBadgeRow}>
                    <View style={styles.wizardStepBadge}>
                      <Text style={styles.wizardStepBadgeText}>{regStep}</Text>
                    </View>
                    <Text style={styles.wizardTitleText}>
                      {regStep === 1 && "1. Adım: Hesap Türü"}
                      {regStep === 2 && "2. Adım: Kimlik & İletişim"}
                      {regStep === 3 && "3. Adım: Konum & Güvenlik"}
                    </Text>
                  </View>
                  <View style={styles.xpPill}>
                    <Text style={styles.xpPillText}>Adım {regStep} / 3</Text>
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

              {/* 1. ADIM: ROL SEÇİMİ */}
              {regStep === 1 && (
                <View style={styles.stepContent}>
                  <Text style={styles.sectionLabel}>Hesap Türünüzü Seçiniz</Text>
                  <View style={styles.roleRow}>
                    <RoleCard
                      active={role === "WORKER"}
                      iconNode={<BriefcaseIcon size={22} color={role === "WORKER" ? "#0D6847" : "#5C615E"} />}
                      label="İş Arayan / İşçi"
                      hint="Günübirlik iş ilanlarına anında başvurun"
                      onPress={() => setRole("WORKER")}
                    />
                    <RoleCard
                      active={role === "EMPLOYER"}
                      iconNode={<UsersIcon size={22} color={role === "EMPLOYER" ? "#0D6847" : "#5C615E"} />}
                      label="İşveren / İşletme"
                      hint="İlan yayınlayın, hızlıca aday bulun"
                      onPress={() => setRole("EMPLOYER")}
                    />
                  </View>

                  <PrimaryButton label="İleri →" onPress={handleNextStep} />

                  <View style={styles.switchModeContainer}>
                    <SwitchMode
                      text="Zaten bir hesabınız var mı?"
                      action="Giriş Yap"
                      onPress={() => {
                        setMode("login");
                        setError(null);
                      }}
                    />
                  </View>
                </View>
              )}

              {/* 2. ADIM: KİMLİK & BİLGİLER */}
              {regStep === 2 && (
                <View style={styles.stepContent}>
                  <Field
                    label="Ad Soyad *"
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Adınız ve soyadınız"
                  />
                  <Field
                    label="E-posta Adresi *"
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
                      label="Şirket / İşletme Unvanı *"
                      value={companyName}
                      onChangeText={setCompanyName}
                      placeholder="Örn. Yılmaz İnşaat Ltd. Şti."
                    />
                  )}

                  {error ? <Banner tone="error" text={error} /> : null}

                  <View style={styles.stepNavRow}>
                    <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                      <Text style={styles.backBtnText}>← Geri</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Devam Et"
                        onPress={handleNextStep}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* 3. ADIM: GÜVENLİK & KONUM */}
              {regStep === 3 && (
                <View style={styles.stepContent}>
                  <Field
                    label="Şifre * (En az 6 karakter)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                  />
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Field label="Şehir *" value={city} onChangeText={setCity} placeholder="İstanbul" />
                    </View>
                    <View style={styles.half}>
                      <Field label="İlçe *" value={district} onChangeText={setDistrict} placeholder="Kadıköy" />
                    </View>
                  </View>

                  <Text style={styles.level3Hint}>
                    Tüm bilgilerinizi kontrol ediniz. Hesabınız oluşturulduktan sonra hemen iş ilanlarını incelemeye başlayabilirsiniz.
                  </Text>

                  {error ? <Banner tone="error" text={error} /> : null}

                  <View style={styles.stepNavRow}>
                    <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                      <Text style={styles.backBtnText}>← Geri</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Hesap Oluştur"
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
              <Text style={styles.desc}>Authenticator uygulamanızdaki 6 haneli doğrulama kodunu giriniz.</Text>
              <Field
                label="Doğrulama Kodu"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
              />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Doğrula" onPress={submitTwoFactor} loading={loading} disabled={otp.length !== 6} />
              <Pressable onPress={() => { setMode("login"); setError(null); }} style={styles.linkBtn}>
                <Text style={styles.link}>← Girişe Dön</Text>
              </Pressable>
            </>
          )}

          {mode === "forgot" && (
            <>
              <Text style={styles.desc}>E-posta adresinize şifre sıfırlama kodu iletilecektir.</Text>
              <Field
                label="E-posta Adresi"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="ornek@eposta.com"
              />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Sıfırlama Kodu Gönder" onPress={submitForgot} loading={loading} />
              <Pressable onPress={() => { setMode("login"); setError(null); setInfo(null); }} style={styles.linkBtn}>
                <Text style={styles.link}>← Girişe Dön</Text>
              </Pressable>
            </>
          )}

          {mode === "reset" && (
            <>
              <Text style={styles.desc}>{info ?? "E-postanıza gelen kodu ve yeni şifrenizi giriniz."}</Text>
              <Field
                label="Doğrulama Kodu"
                value={resetCode}
                onChangeText={(v) => setResetCode(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
              />
              <Field
                label="Yeni Şifre"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="En az 6 karakter"
              />
              {error ? <Banner tone="error" text={error} /> : null}
              <PrimaryButton label="Şifreyi Güncelle" onPress={submitReset} loading={loading} disabled={resetCode.length !== 6} />
              <Pressable onPress={() => { setMode("forgot"); setError(null); setInfo(null); }} style={styles.linkBtn}>
                <Text style={styles.link}>← Yeni Kod İste</Text>
              </Pressable>
            </>
          )}

          {info && mode !== "reset" ? <Banner tone="success" text={info} /> : null}
        </View>

        <Text style={styles.footNote}>Devam ederek platform kullanım koşullarını kabul etmiş olursunuz.</Text>
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
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
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
  const maxLen = c.fmt("9".repeat(c.digits)).length;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Telefon Numarası</Text>
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
            <Text style={styles.pickerTitle}>Ülke Seçimi</Text>
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
        {text}
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

function RoleCard(props: { active: boolean; iconNode: React.ReactNode; label: string; hint: string; onPress: () => void }) {
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
        {props.iconNode}
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
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: { width: 64, height: 64, borderRadius: 16 },
  logoText: { fontSize: 26, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19, maxWidth: 300, paddingHorizontal: 10 },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E0D8",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: "800", color: C.text, marginBottom: 14, letterSpacing: -0.3 },
  desc: { fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 19 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 10 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", color: C.text, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#FAFAFA",
  },
  inputWrapFocused: { borderColor: C.primary, backgroundColor: "#FFFFFF" },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: C.text, backgroundColor: "transparent" },
  banner: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1 },
  bannerError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  bannerSuccess: { backgroundColor: "#E8F5EE", borderColor: "#A7F3D0" },
  bannerText: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bannerTextError: { color: C.danger },
  bannerTextSuccess: { color: C.success },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, color: C.muted, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
    shadowColor: C.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 2,
  },
  googleContainer: {
    marginTop: 10,
    marginBottom: 6,
  },
  switchModeContainer: {
    marginTop: 14,
    marginBottom: 4,
  },
  wizardCard: {
    backgroundColor: "#F6F5F2",
    borderWidth: 1,
    borderColor: "#E2E0D8",
    borderRadius: 14,
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
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  wizardStepBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  wizardTitleText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.primary,
    flex: 1,
  },
  xpPill: {
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.2)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  xpPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.primary,
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: "#E2E0D8",
    borderRadius: 999,
    overflow: "hidden",
    marginVertical: 4,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: C.primary,
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
    backgroundColor: "#E2E0D8",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: C.primary,
  },
  stepDotText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
  },
  stepDotTextActive: {
    color: "#FFFFFF",
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.muted,
  },
  stepLabelActive: {
    color: C.primary,
    fontWeight: "800",
  },
  stepConnector: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E0D8",
    marginHorizontal: 8,
  },
  stepConnectorActive: {
    backgroundColor: C.primary,
  },
  stepContent: {
    gap: 4,
  },
  stepNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  backBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F6F5F2",
    borderWidth: 1,
    borderColor: "#E2E0D8",
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.muted,
  },
  level3Hint: {
    fontSize: 12,
    color: C.primary,
    backgroundColor: C.primarySoft,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.2)",
    marginBottom: 10,
    lineHeight: 17,
  },
  googleBtnText: { fontSize: 14, fontWeight: "600", color: C.text },
  googleG: { fontSize: 18, fontWeight: "800", color: "#4285F4", lineHeight: 22 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.2 },
  pressed: { opacity: 0.9 },
  linkBtn: { paddingVertical: 10, alignItems: "center" },
  link: { color: C.primary, fontSize: 13, fontWeight: "700", textAlign: "center" },
  linkBold: { color: C.primary, fontWeight: "800" },
  switchText: { textAlign: "center", color: C.muted, fontSize: 13 },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  roleCard: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", gap: 3, backgroundColor: "#FFFFFF" },
  roleCardActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
  roleIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#F6F5F2", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  roleIconBoxActive: { backgroundColor: "#FFFFFF" },
  roleLabel: { fontSize: 13, fontWeight: "700", color: C.text, textAlign: "center" },
  roleLabelActive: { color: C.primary },
  roleHint: { fontSize: 10, color: C.muted, textAlign: "center", marginTop: 2 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  countryBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 12 },
  countryFlag: { fontSize: 16 },
  countryDial: { fontSize: 14, fontWeight: "700", color: C.text },
  countryChevron: { fontSize: 10, color: C.muted },
  phoneDivider: { width: 1, height: 20, backgroundColor: C.border, marginHorizontal: 8 },
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
