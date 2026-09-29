// Google Sign-In köprüsü.
//
// Backend akışı (api-doc): POST /auth/google { idToken } — frontend Google Sign-In
// ID token'ını gönderir; backend doğrular, yoksa kullanıcıyı oluşturur (kayıt),
// varsa giriş yaptırır ve kendi JWT'sini döner.
//
// Not: ID token'ın aud (audience) alanı buradaki webClientId olur. Backend bu
// client ID ile yapılandırılmalıdır; aksi halde "Geçersiz Google token" hatası döner.

import { GoogleSignin, statusCodes, isErrorWithCode } from "@react-native-google-signin/google-signin";

/**
 * Web istemci kimliği — Google Cloud Console → APIs & Services → Credentials.
 * ANDROID istemci kimliği DEĞİL; ID token'ın aud alanı budur.
 * Android client'ı da aynı Google projesinde kayıtlı (package: com.gunubirlik.app
 * + EAS keystore SHA-1 — safak61s-team hesabının YENİ keystore'u:
 * AA:21:35:47:0B:E3:55:85:FF:B7:AB:54:26:B1:A7:AB:63:82:DB:9D).
 */
const GOOGLE_WEB_CLIENT_ID = "411578437442-gs1rck2124rgr516fe9dn9tuu15ge9ig.apps.googleusercontent.com";

/** Client ID gerçek değerle değiştirilmemişse true. */
export function isGoogleConfigured(): boolean {
  return !GOOGLE_WEB_CLIENT_ID.startsWith("TODO_");
}

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export type GoogleIdTokenResult = {
  idToken: string;
  /** Google tarafındaki e-posta (bilgi amaçlı; hesap backend'de oluşturulur). */
  email?: string;
  fullName?: string;
};

/**
 * Google hesap seçme diyaloğunu açar ve ID token döner.
 * Kullanıcı diyaloğu kapatırsa null döner (hata DEĞİL — sessizce iptal).
 */
export async function getIdTokenFromGoogle(): Promise<GoogleIdTokenResult | null> {
  if (!isGoogleConfigured()) {
    throw new Error(
      "Google girişi henüz etkinleştirilmedi. Lütfen e-posta ve şifrenle giriş yap.",
    );
  }
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();

    // RN google-signin v13+: başarılı girişte { data: {...} }, iptalde { type: "cancelled" }
    const data = (userInfo as { data?: { idToken?: string; user?: { email?: string; name?: string } } } & { type?: string })
      .data ?? (userInfo as { idToken?: string; user?: { email?: string; name?: string } });
    const idToken = data?.idToken;
    if (!idToken) return null;

    return {
      idToken,
      email: data?.user?.email,
      fullName: data?.user?.name,
    };
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.IN_PROGRESS) return null; // zaten açık diyaloğu beklet
      if (err.code === statusCodes.SIGN_IN_CANCELLED) return null; // kullanıcı iptal etti
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error("Google Play Services bulunamadı. Lütfen cihazınızı güncelleyin.");
      }
    }
    throw new Error("Google ile giriş başlatılamadı. Tekrar deneyin.");
  }
}

/** Çıkışta Google oturumunu da temizler (hataları yutar). */
export async function signOutGoogle(): Promise<void> {
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // non-critical
  }
}
