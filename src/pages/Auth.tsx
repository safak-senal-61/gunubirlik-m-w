import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { useApiAuth, requestPasswordReset, resetPassword } from "@/hooks/use-api-auth";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Hammer,
  Loader2,
  Mail,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

type Mode = "login" | "register" | "twofactor" | "forgot" | "reset";

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/jobs") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: { redirectAfterAuth?: string }) {
  const { login, register, loginWithGoogle, isAuthenticated, isLoading: authLoading } = useApiAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [mode, setMode] = useState<Mode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // register fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"WORKER" | "EMPLOYER">("WORKER");
  const [city, setCity] = useState("İstanbul");
  const [district, setDistrict] = useState("Kadıköy");
  const [companyName, setCompanyName] = useState("");
  // 2FA / forgot / reset
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate(redirect, { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message === "requiresTwoFactor") {
        setTwoFactorEmail(email);
        setTwoFactorPassword(password);
        setMode("twofactor");
      } else {
        setError(err instanceof Error ? err.message : "Giriş başarısız");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(twoFactorEmail, twoFactorPassword, otpCode);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod hatalı");
    } finally {
      setIsLoading(false);
    }
  };

  const [otpCode, setOtpCode] = useState("");

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await register({
        email,
        password,
        fullName,
        phone,
        role,
        city,
        district,
        ...(role === "EMPLOYER" ? { companyName } : {}),
      });
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    } finally {
      setIsLoading(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setInfo("Sıfırlama kodu e-postana gönderildi. Gelen kutunu kontrol et.");
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İstek başarısız");
    } finally {
      setIsLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(email, resetCode, newPassword);
      setInfo("Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.");
      setMode("login");
      setResetCode("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıfırlama başarısız");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="surface-grid mask-fade-b pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Hammer className="size-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Günübirlik</span>
          </div>

          <Card className="shadow-lift">
            {mode === "login" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Tekrar hoş geldin</CardTitle>
                  <CardDescription>
                    Hesabına giriş yap; işe ya da adaylara bir adım daha yaklaş.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={submitLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">E-posta</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="ad@ornek.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Şifre</Label>
                        <button
                          type="button"
                          onClick={() => setMode("forgot")}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Şifremi unuttum
                        </button>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full gap-1.5" disabled={isLoading}>
                      {isLoading && <Loader2 className="size-4 animate-spin" />}
                      Giriş yap
                      <ArrowRight className="size-4" />
                    </Button>

                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">veya</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    <GoogleSignInButton
                      onCredential={async (credential) => {
                        setIsLoading(true);
                        setError(null);
                        try {
                          await loginWithGoogle(credential);
                          navigate(redirect, { replace: true });
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Google ile giriş başarısız");
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      onError={(msg) => setError(msg)}
                    />

                    <p className="text-center text-sm text-muted-foreground">
                      Hesabın yok mu?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("register");
                          setError(null);
                        }}
                        className="font-semibold text-primary hover:underline"
                      >
                        Ücretsiz kayıt ol
                      </button>
                    </p>
                  </CardContent>
                </form>
              </>
            )}

            {mode === "register" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Aramıza katıl</CardTitle>
                  <CardDescription>
                    Günübirlik iş mi arıyorsun, işçi mi çalıştırıyorsun?
                  </CardDescription>
                </CardHeader>
                <form onSubmit={submitRegister}>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole("WORKER")}
                        className={
                          role === "WORKER"
                            ? "flex flex-col items-center gap-1.5 rounded-xl border-2 border-primary bg-primary/5 p-4 transition-colors"
                            : "flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                        }
                      >
                        <Hammer className="size-5 text-primary" />
                        <span className="text-sm font-semibold">İşçiyim</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("EMPLOYER")}
                        className={
                          role === "EMPLOYER"
                            ? "flex flex-col items-center gap-1.5 rounded-xl border-2 border-primary bg-primary/5 p-4 transition-colors"
                            : "flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                        }
                      >
                        <Building2 className="size-5 text-primary" />
                        <span className="text-sm font-semibold">İşverenim</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reg-name">Ad Soyad</Label>
                      <Input
                        id="reg-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ad Soyad"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-email">E-posta</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ad@ornek.com"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-phone">Telefon</Label>
                      <Input
                        id="reg-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+905321234567"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-pass">Şifre</Label>
                      <Input
                        id="reg-pass"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        minLength={6}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    {role === "EMPLOYER" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-company">Şirket adı</Label>
                        <Input
                          id="reg-company"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Örn. Yılmaz İnşaat Ltd. Şti."
                          required
                          disabled={isLoading}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-city">İl</Label>
                        <Input
                          id="reg-city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-district">İlçe</Label>
                        <Input
                          id="reg-district"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full gap-1.5" disabled={isLoading}>
                      {isLoading && <Loader2 className="size-4 animate-spin" />}
                      Hesap oluştur
                      <ArrowRight className="size-4" />
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      Zaten hesabın var mı?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("login");
                          setError(null);
                        }}
                        className="font-semibold text-primary hover:underline"
                      >
                        Giriş yap
                      </button>
                    </p>
                  </CardContent>
                </form>
              </>
            )}

            {mode === "twofactor" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Doğrulama kodu</CardTitle>
                  <CardDescription>
                    Authenticator uygulamandaki 6 haneli kodu gir.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={submitTwoFactor}>
                  <CardContent className="space-y-4">
                    <input type="hidden" value={twoFactorEmail} />
                    <div className="flex justify-center">
                      <InputOTP
                        value={otpCode}
                        onChange={setOtpCode}
                        maxLength={6}
                        disabled={isLoading}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && <p className="text-center text-sm text-red-500">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || otpCode.length !== 6}
                    >
                      {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Doğrula
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                      }}
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Geri dön
                    </Button>
                  </CardContent>
                </form>
              </>
            )}

            {mode === "forgot" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Şifremi unuttum</CardTitle>
                  <CardDescription>
                    E-postana sıfırlama kodu göndereceğiz.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={submitForgot}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-email">E-posta</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ad@ornek.com"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    {info && <p className="text-sm text-emerald-600">{info}</p>}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Kod gönder
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                        setInfo(null);
                      }}
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Girişe dön
                    </Button>
                  </CardContent>
                </form>
              </>
            )}

            {mode === "reset" && (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">Yeni şifre belirle</CardTitle>
                  <CardDescription>
                    E-postana gelen kodu ve yeni şifreni gir.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={submitReset}>
                  <CardContent className="space-y-4">
                    <div className="flex justify-center">
                      <InputOTP
                        value={resetCode}
                        onChange={setResetCode}
                        maxLength={6}
                        disabled={isLoading}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-pass">Yeni şifre</Label>
                      <Input
                        id="reset-pass"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        minLength={6}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || resetCode.length !== 6}
                    >
                      {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Şifreyi sıfırla
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setInfo(null);
                      }}
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Kodu tekrar gönder
                    </Button>
                  </CardContent>
                </form>
              </>
            )}
          </Card>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Mail className="size-3" />
            Soruların için destek@gunubirlik.space-z.ai
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: { redirectAfterAuth?: string }) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
