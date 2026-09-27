// OneSignal SDK için MERKEZİ SARLAYICI.
// Uygulama genelinde doğrudan `react-native-onesignal` çağrısı YAPILMAZ; tüm çağrılar
// bu modül üzerinden geçer (SDK güncellemelerinde tek noktada değişiklik, test kolaylığı).
//
// Not: push bildirimleri Expo Go'da ÇALIŞMAZ. Yalnızca EAS Build / development build ile
// üretilmiş APK/IPA içinde aktiftir.

import { Alert, Platform } from "react-native";
import { LogLevel, OneSignal } from "react-native-onesignal";
import type { NotificationClickEvent, NotificationWillDisplayEvent, PushSubscriptionChangedState } from "react-native-onesignal";
import type { ApiUser, NotificationSettings } from "./types";
import { ALL_PREF_KEYS, type NotificationPrefKey } from "./notification-prefs";

/** OneSignal Uygulama ID (OneSignal Dashboard → Apps & Platforms). */
export const ONESIGNAL_APP_ID = "6bddc78e-79e7-4701-9e46-6fca772e402a";

/** Bildirim tıklaması / ön plan bildirimi sonrası uygulamanın yapacağı yönlendirme. */
export type PushNavigateIntent = {
  /** Hangi alt sekme açılsın. */
  tab: "notifications" | "messages" | "jobs" | "applications";
  /** Varsa doğrudan açılacak ilan. */
  jobId?: string;
};

type NavigateListener = (intent: PushNavigateIntent) => void;
type ArrivedListener = () => void;

let dialogShown = false;
let permissionState: boolean | null = null;
let navigateListeners: NavigateListener[] = [];
let arrivedListeners: ArrivedListener[] = [];

/** Uygulama kapalıyken bildirime dokunulduysa burada saklanır; JS hazır olunca tüketilir. */
let pendingColdStartIntent: PushNavigateIntent | null = null;

/** "local-" öneki, sunucu tarafından atanmamış geçici kimliktir; kayıt sayılmaz. */
function isServerAssignedId(id: string | null | undefined): boolean {
  return !!id && !id.startsWith("local-");
}

/** SDK çağrılarını güvenli sarmalar: native modül yoksa (Expo Go) uygulama çökmez. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    if (__DEV__) console.warn("[OneSignal]", err);
    return fallback;
  }
}

function safeAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return fn().catch((err) => {
      if (__DEV__) console.warn("[OneSignal]", err);
      return fallback;
    });
  } catch (err) {
    if (__DEV__) console.warn("[OneSignal]", err);
    return Promise.resolve(fallback);
  }
}

/* ------------------------------------------------------------------ */
/* Soğuk başlatma: bildirime dokunularak açılan uygulamayı yönlendir       */
/* ------------------------------------------------------------------ */

/**
 * MainTabs monte olduğunda çağırır. Uygulama KAPALIYKEN bildirime dokunulduysa
 * buradaki bekleyen hedef döndürülür ve temizlenir (bir kez tüketilir).
 */
export function consumeColdStartIntent(): PushNavigateIntent | null {
  const intent = pendingColdStartIntent;
  pendingColdStartIntent = null;
  return intent;
}

export function onPushNavigate(listener: NavigateListener): () => void {
  navigateListeners = [...navigateListeners, listener];
  return () => {
    navigateListeners = navigateListeners.filter((l) => l !== listener);
  };
}

function emitNavigate(intent: PushNavigateIntent) {
  navigateListeners.forEach((l) => {
    try {
      l(intent);
    } catch (err) {
      if (__DEV__) console.warn("[OneSignal] navigate listener", err);
    }
  });
}

/** Ön planda (uygulama açıkken) bir bildirim gösterildiğinde: rozeti tazelemek için. */
export function onPushArrived(listener: ArrivedListener): () => void {
  arrivedListeners = [...arrivedListeners, listener];
  return () => {
    arrivedListeners = arrivedListeners.filter((l) => l !== listener);
  };
}

function emitArrived() {
  arrivedListeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      if (__DEV__) console.warn("[OneSignal] arrived listener", err);
    }
  });
}

/** Bildirim verisinden hedef sekmeyi çıkarır (backend `data` alanı OneSignal `additionalData` içine girer). */
function intentFromPayload(additional: unknown): PushNavigateIntent {
  const data = (additional ?? {}) as { jobId?: string; conversationId?: string; applicationId?: string; type?: string };
  if (data.conversationId || data.type === "NEW_MESSAGE") return { tab: "messages", ...(data.jobId ? { jobId: data.jobId } : {}) };
  if (data.jobId) return { tab: "jobs", jobId: data.jobId };
  if (data.applicationId) return { tab: "applications" };
  return { tab: "notifications" };
}

/* ------------------------------------------------------------------ */
/* Bildirim tercihlerini OneSignal tag'lerine yansıt                    */
/* ------------------------------------------------------------------ */

/**
 * Backend'deki tercihleri OneSignal tag'lerine yazar. Böylece OneSignal dashboard'undan
 * hedefleme yaparken "şu kategoriyi kapatan kullanıcılar" filtresi kullanılabilir.
 * Kapatılan kategori → "1", açık olan → silinir.
 */
export function syncPreferenceTags(settings: NotificationSettings | null): void {
  if (!settings) return;
  const disabled: Record<string, string> = {};
  for (const key of ALL_PREF_KEYS) {
    if (settings[key] === false) disabled[`gb_off_${key}`] = "1";
  }
  // pushEnabled kapalıysa tüm kategori anahtarları da kapalı sayılır.
  if (settings.pushEnabled === false) disabled["gb_off_pushEnabled"] = "1";
  const allOffKeys = [...ALL_PREF_KEYS, "pushEnabled" as NotificationPrefKey].map((k) => `gb_off_${k}`);
  const stale = allOffKeys.filter((k) => !(k in disabled));
  if (Object.keys(disabled).length === 0 && stale.length === 0) return;
  safe(() => OneSignal.User.addTags(disabled), undefined);
  if (stale.length) safe(() => OneSignal.User.removeTags(stale), undefined);
}

/* ------------------------------------------------------------------ */
/* Kullanıcı kimliği                                                     */
/* ------------------------------------------------------------------ */

/**
 * Giriş sonrası OneSignal kullanıcısını backend kullanıcısıyla eşleştirir.
 * externalId = backend user id → backend, bildirim gönderirken
 * include_aliases/external_id üzerinden bu cihazı hedefleyebilir.
 */
export function identifyUser(user: ApiUser): void {
  if (!user?.id) return;
  safe(() => OneSignal.login(user.id), undefined);
  safe(() => OneSignal.User.addAlias("gbUserId", user.id), undefined);
  if (user.email) safe(() => OneSignal.User.addEmail(user.email), undefined);
  safe(() => OneSignal.User.addTag("role", user.role ?? "UNKNOWN"), undefined);
  safe(() => OneSignal.User.addTag("name", (user.fullName ?? "").slice(0, 60)), undefined);
}

/** Çıkışta OneSignal oturumunu kapatır (cihaz anonim abone olur). */
export function clearUser(): void {
  safe(() => OneSignal.logout(), undefined);
}

/* ------------------------------------------------------------------ */
/* Push izni                                                            */
/* ------------------------------------------------------------------ */

export function getPermissionCached(): boolean | null {
  return permissionState;
}

export function refreshPermission(): Promise<boolean> {
  return safeAsync(() => OneSignal.Notifications.getPermissionAsync(), permissionState ?? false).then((v) => {
    permissionState = v;
    return v;
  });
}

/**
 * Push aboneliğini açar/kapatır. Uygulama içi push ana anahtarı
 * (pushEnabled) bunu kullanır; sistem iznini SORGULAMAZ.
 */
export function setPushOptedIn(optIn: boolean): void {
  if (optIn) safe(() => OneSignal.User.pushSubscription.optIn(), undefined);
  else safe(() => OneSignal.User.pushSubscription.optOut(), undefined);
}

/** Sistem izni diyaloğunu açar (izin zaten verilmişse sormaz). */
export function requestPermission(fallbackToSettings = true): Promise<boolean> {
  return safeAsync(() => OneSignal.Notifications.requestPermission(fallbackToSettings), false).then((granted) => {
    permissionState = granted;
    setPushOptedIn(granted);
    return granted;
  });
}

/**
 * Sunucu kayıtlı push aboneliği doğrulandığında (tek seferlik) kullanıcıyı bilgilendirir
 * ve izin istemeyi O DİYALOGUN "Tamam" butonuna bağlar — uygulama açılışında
 * otomatik izin istemi oluşmaz.
 */
function showIntegrationCompleteDialog(): void {
  Alert.alert(
    "Push bildirimleri hazır! 🔔",
    "Günübirlik artık OneSignal üzerinden push bildirimleri ve uygulama içi mesaj gönderebiliyor. Bildirim almaya başlamak için aşağıya dokun.",
    [{ text: "Tamam", onPress: () => { void requestPermission(true); } }],
    { cancelable: false },
  );
}

function maybeShowDialog(subscriptionId: string | null | undefined): void {
  if (dialogShown) return;
  if (!isServerAssignedId(subscriptionId)) return;
  dialogShown = true;
  showIntegrationCompleteDialog();
}

function setupPushSubscriptionObserver(): void {
  const onChange = (s: PushSubscriptionChangedState) => maybeShowDialog(s?.current?.id);
  safe(() => OneSignal.User.pushSubscription.addEventListener("change", onChange), undefined);
  // ID dinleyici bağlanmadan önce atanmış olabilir → anında da bir kez değerlendir.
  void safeAsync(() => OneSignal.User.pushSubscription.getIdAsync(), null).then((id) => maybeShowDialog(id));
}

/* ------------------------------------------------------------------ */
/* Başlatma                                                             */
/* ------------------------------------------------------------------ */

let started = false;

/**
 * Uygulama açılışında çağrılır. Ağır iş yapmaz; asıl kurulum (native modül) Expo Go'da
 * bulunmadığı için sessizce atlanır.
 */
export function initOneSignal(): void {
  if (started) return;
  started = true;

  safe(() => OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Verbose : LogLevel.None), undefined);
  // Onlar uçtan uca bildirim gönderiyor; SDK kendi kendine bildirim üretmez.
  safe(() => OneSignal.setConsentRequired(false), undefined);
  safe(() => OneSignal.initialize(ONESIGNAL_APP_ID), undefined);

  // Ön planda gelen bildirim: varsayılan davranışı koru (sistem bildirimi göster),
  // sadece uygulama içi listeyi tazelemek için olay yayınla.
  const onForeground = (e: NotificationWillDisplayEvent) => {
    if (__DEV__) console.log("[OneSignal] foregroundWillDisplay", e?.notification?.title);
    // Sistem bildirimi normal şekilde gösterilir; sadece rozet tazelenir.
    emitArrived();
  };
  const onClick = (e: NotificationClickEvent) => {
    const intent = intentFromPayload((e?.notification as { additionalData?: unknown } | undefined)?.additionalData);
    pendingColdStartIntent = intent; // JS dinleyici henüz yoksa sonradan tüketilir
    emitNavigate(intent);
  };
  safe(() => OneSignal.Notifications.addEventListener("foregroundWillDisplay", onForeground), undefined);
  safe(() => OneSignal.Notifications.addEventListener("click", onClick), undefined);
  safe(
    () => OneSignal.Notifications.addEventListener("permissionChange", (granted: boolean) => {
      permissionState = granted;
    }),
    undefined,
  );

  setupPushSubscriptionObserver();
  void refreshPermission();
}

/** Test/diagnostic: cihazın OneSignal abonelik durumu. */
export async function getPushDiagnostics(): Promise<{
  platform: string;
  subscriptionId: string | null;
  permission: boolean;
  optedIn: boolean;
}> {
  return safeAsync(
    async () => ({
      platform: Platform.OS,
      subscriptionId: await OneSignal.User.pushSubscription.getIdAsync(),
      permission: await OneSignal.Notifications.getPermissionAsync(),
      optedIn: await OneSignal.User.pushSubscription.getOptedInAsync(),
    }),
    { platform: Platform.OS, subscriptionId: null, permission: false, optedIn: false },
  );
}
