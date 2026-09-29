// OneSignal SDK için MERKEZİ SARLAYICI.
// Uygulama genelinde doğrudan `react-native-onesignal` çağrısı YAPILMAZ; tüm çağrılar
// bu modül üzerinden geçer (SDK güncellemelerinde tek noktada değişiklik, test kolaylığı).
//
// Not: push bildirimleri Expo Go'da ÇALIŞMAZ. Yalnızca EAS Build / development build ile
// üretilmiş APK/IPA içinde aktiftir.

import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LogLevel, OneSignal } from "react-native-onesignal";
import type { NotificationClickEvent, NotificationWillDisplayEvent, PushSubscriptionChangedState } from "react-native-onesignal";
import type { ApiUser, NotificationSettings } from "./types";
import { ALL_PREF_KEYS, type NotificationPrefKey } from "./notification-prefs";

/** OneSignal Uygulama ID (OneSignal Dashboard → Apps & Platforms). */
export const ONESIGNAL_APP_ID = "6bddc78e-79e7-4701-9e46-6fca772e402a";

/** Bildirim tıklaması / ön plan bildirimi sonrası uygulamanın yapacağı yönlendirme. */
export type PushNavigateIntent = {
  /** Hangi alt sekme açılsın. */
  tab: "notifications" | "messages" | "jobs" | "applications" | "profile";
  /** Varsa doğrudan açılacak ilan. */
  jobId?: string;
  /** gunubirlik://messages/{id} → doğrudan açılacak konuşma. */
  conversationId?: string;
  /** gunubirlik://applications/{id} → doğrudan açılacak başvuru (şimdilik sekme). */
  applicationId?: string;
  /** tab=profile iken: wallet → Cüzdan sekmesi, verification/profile → Hesap. */
  profileSub?: "wallet" | "verification" | "profile";
};

/**
 * gunubirlik:// derin bağlantısını uygulama hedefine çevirir.
 * Backend api-doc push bölümündeki app_url şeması:
 *   notifications, messages, messages/{id}, applications, applications/{id},
 *   jobs/{id}, wallet, verification, profile
 */
export function parseGunubirlikUrl(url: string): PushNavigateIntent | null {
  if (!url || !url.startsWith("gunubirlik://")) return null;
  const path = url.slice("gunubirlik://".length).replace(/\/+$/, "");
  const [head, id] = path.split("/");
  switch (head) {
    case "":
    case "notifications":
      return { tab: "notifications" };
    case "messages":
      return id ? { tab: "messages", conversationId: id } : { tab: "messages" };
    case "applications":
      return id ? { tab: "applications", applicationId: id } : { tab: "applications" };
    case "jobs":
      return id ? { tab: "jobs", jobId: id } : { tab: "jobs" };
    case "wallet":
      return { tab: "profile", profileSub: "wallet" };
    case "verification":
      return { tab: "profile", profileSub: "verification" };
    case "profile":
      return { tab: "profile", profileSub: "profile" };
    default:
      return { tab: "notifications" };
  }
}

type NavigateListener = (intent: PushNavigateIntent) => void;
type ArrivedListener = () => void;

/**
 * "İzin istendi" kalıcı bayrağı — AsyncStorage'da tutulur (in-memory DEĞİL).
 * v1.1.4'teki hata buradan kaynaklanıyordu: in-memory flag her uygulama açılışında
 * sıfırlanıyor ve "Push bildirimleri hazır!" diyaloğu her cold-start'te tekrar çıkıyordu.
 */
const PERMISSION_ASKED_KEY = "gb_onesignal_asked_v1";

/** Aynı oturumda diyaloğun üst üste açılmasını engeller (UI seviyesi koruma). */
let dialogVisible = false;
/** Login/register BAŞARISINDA true olur; diyalog yalnız "armed" durumda gösterilir. */
let armedForPrompt = false;
let permissionState: boolean | null = null;
let permissionListeners: ((granted: boolean) => void)[] = [];
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
 *
 * AYRICA `user_id` tag'i eklenir: backend push gönderirken ÖNCE external_id,
 * sonra fallback olarak `filters: [{ tag: 'user_id', ... }]` yöntemini dener
 * (api-doc push bölümü). Tag eksikse fallback sessizce boşa düşer ve
 * "Push alıcı yok" hatası oluşur — bu yüzden her ikisi de set edilir.
 */
export function identifyUser(user: ApiUser): void {
  if (!user?.id) return;
  safe(() => OneSignal.login(user.id), undefined);
  safe(() => OneSignal.User.addAlias("gbUserId", user.id), undefined);
  if (user.email) safe(() => OneSignal.User.addEmail(user.email), undefined);
  safe(() => OneSignal.User.addTag("user_id", user.id), undefined);
  safe(() => OneSignal.User.addTag("role", user.role ?? "UNKNOWN"), undefined);
  safe(() => OneSignal.User.addTag("name", (user.fullName ?? "").slice(0, 60)), undefined);
}

/** Çıkışta OneSignal oturumunu kapatır ve kullanıcıya özel tag/alias'ları temizler. */
export function clearUser(): void {
  safe(() => OneSignal.logout(), undefined);
  safe(() => OneSignal.User.removeTags(["user_id", "role", "name"]), undefined);
}

/* ------------------------------------------------------------------ */
/* Push izni                                                            */
/* ------------------------------------------------------------------ */

export function getPermissionCached(): boolean | null {
  return permissionState;
}

export function refreshPermission(): Promise<boolean> {
  return safeAsync(() => OneSignal.Notifications.getPermissionAsync(), permissionState ?? false).then((v) => {
    emitPermission(v);
    return v;
  });
}

function emitPermission(granted: boolean): void {
  permissionState = granted;
  permissionListeners.forEach((l) => {
    try {
      l(granted);
    } catch (err) {
      if (__DEV__) console.warn("[OneSignal] permission listener", err);
    }
  });
}

/** Sistem izin durumu değiştiğinde haber verir (ör. Bildirimler ekranındaki sabit uyarı bandı). */
export function onPermissionChanged(listener: (granted: boolean) => void): () => void {
  permissionListeners = [...permissionListeners, listener];
  return () => {
    permissionListeners = permissionListeners.filter((l) => l !== listener);
  };
}

/**
 * Login/register BAŞARISINDA çağrılır: sonraki abonelik doğrulamasında izin
 * diyaloğunun gösterilmesine izin verir. Oturum önbellekten geri yüklenirken
 * ÇAĞRILMAZ — aksi halde uygulama her açılışında diyalog tekrar eder.
 */
export function armPermissionPrompt(): void {
  armedForPrompt = true;
}

async function isPermissionAsked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PERMISSION_ASKED_KEY)) === "1";
  } catch {
    return false;
  }
}

async function markPermissionAsked(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, "1");
  } catch {
    // Depoya yazılamazsa en kötü ihtimalle diyalog bir sonraki girişte bir kez daha gösterilir.
  }
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
 * Sunucu kayıtlı push aboneliği doğrulandığında kullanıcıyı BİR KEZ bilgilendirir ve
 * izin istemeyi diyaloğun "Tamam" butonuna bağlar. Diyalog SADECE:
 *  - login/register hemen ardındanysa ("armed"),
 *  - daha önce hiç sorulmadıysa (kalıcı AsyncStorage bayrağı),
 *  - sistem izni hâlâ yoksa gösterilir. İzin verildiyse bir daha ASLA çıkmaz.
 */
function showIntegrationCompleteDialog(): void {
  Alert.alert(
    "Push bildirimleri hazır! 🔔",
    "Günübirlik artık OneSignal üzerinden push bildirimleri ve uygulama içi mesaj gönderebiliyor. Bildirim almaya başlamak için aşağıya dokun.",
    [{ text: "Tamam", onPress: () => { void requestPermission(true); } }],
    { cancelable: false },
  );
}

async function maybeShowDialog(subscriptionId: string | null | undefined): Promise<void> {
  if (dialogVisible) return;
  if (!armedForPrompt) return; // uygulama her açılışında DEĞİL — yalnız giriş/kayıt sonrası
  if (!isServerAssignedId(subscriptionId)) return;
  if (await refreshPermission()) return; // izin zaten verilmişse asla gösterme
  if (await isPermissionAsked()) return; // bir kez sorulduysa bir daha ASLA gösterme
  dialogVisible = true;
  armedForPrompt = false;
  void markPermissionAsked();
  showIntegrationCompleteDialog();
}

function setupPushSubscriptionObserver(): void {
  const onChange = (s: PushSubscriptionChangedState) => void maybeShowDialog(s?.current?.id);
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
    // 1) Backend app_url (launchURL) gönderdiyse ÖNCE onu dene: gunubirlik://... → uygulama içi hedef.
    //    (Kullanıcı web sitesine yönlenmez; doğru ekrana açılır.)
    const launchUrl = (e?.notification as { launchURL?: string } | undefined)?.launchURL;
    let intent = parseGunubirlikUrl(launchUrl ?? "");
    // 2) Yoksa additionalData'dan tip bazlı hedef çıkar (fallback).
    if (!intent) {
      intent = intentFromPayload((e?.notification as { additionalData?: unknown } | undefined)?.additionalData);
    }
    pendingColdStartIntent = intent; // JS dinleyici henüz yoksa sonradan tüketilir
    emitNavigate(intent);
  };
  safe(() => OneSignal.Notifications.addEventListener("foregroundWillDisplay", onForeground), undefined);
  safe(() => OneSignal.Notifications.addEventListener("click", onClick), undefined);
  safe(
    () => OneSignal.Notifications.addEventListener("permissionChange", (granted: boolean) => {
      emitPermission(granted);
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
