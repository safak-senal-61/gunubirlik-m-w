// Bildirim tercihleri — TEK KAYNAK.
// Backend'deki /notifications/settings kaydındaki 18 boolean alan burada tanımlanır.
// Hem Ayarlar > Bildirimler ekranı hem de OneSignal tag senkronizasyonu bu listeyi kullanır.
// Alan adı backend ile birebir aynı olmalıdır (bkz. api-doc → "Bildirimler & Ayarlar").

export type NotificationPrefKey =
  | "pushEnabled"
  | "jobApplied"
  | "applicationAccepted"
  | "applicationRejected"
  | "jobReminder"
  | "jobNearby"
  | "newMessage"
  | "paymentReceived"
  | "paymentApproved"
  | "paymentRejected"
  | "walletDeposit"
  | "walletWithdraw"
  | "workStarted"
  | "workCompleted"
  | "escrowDisputed"
  | "systemUpdate"
  | "maintenance"
  | "promotional";

export interface NotificationPrefMeta {
  key: NotificationPrefKey;
  iconName: string;
  label: string;
  desc: string;
}

/** Ekran grupları (alt başlık + vektör ikon adı). */
export const PREF_GROUPS: { title: string; iconName: string; hint: string; keys: NotificationPrefKey[] }[] = [
  {
    title: "İş İlanları & Başvurular",
    iconName: "briefcase",
    hint: "İlan ve başvuru akışındaki değişiklikler",
    keys: ["jobApplied", "applicationAccepted", "applicationRejected", "jobReminder", "jobNearby"],
  },
  {
    title: "Mesajlaşma & Sohbet",
    iconName: "message",
    hint: "İşveren ve işçi arasındaki sohbet bildirimleri",
    keys: ["newMessage"],
  },
  {
    title: "Ödeme & Cüzdan",
    iconName: "wallet",
    hint: "Ücret hakedişi, transfer ve cüzdan hareketleri",
    keys: ["paymentReceived", "paymentApproved", "paymentRejected", "walletDeposit", "walletWithdraw"],
  },
  {
    title: "İş Süreci & Takip",
    iconName: "clock",
    hint: "İş başlangıcı, karekod onayı ve tamamlanma",
    keys: ["workStarted", "workCompleted", "escrowDisputed"],
  },
  {
    title: "Sistem & Güvenlik",
    iconName: "settings",
    hint: "Bakım, güvenlik güncellemeleri ve duyurular",
    keys: ["systemUpdate", "maintenance", "promotional"],
  },
];

/** key → { iconName, label, desc }. pushEnabled burada YOK; ana anahtar kendi ekranında. */
const META: Record<Exclude<NotificationPrefKey, "pushEnabled">, Omit<NotificationPrefMeta, "key">> = {
  jobApplied: { iconName: "inbox", label: "Yeni Başvuru", desc: "İlanınıza bir iş arayan başvurduğunda" },
  applicationAccepted: { iconName: "check", label: "Başvuru Kabul Edildi", desc: "İş başvurunuz onaylandığında" },
  applicationRejected: { iconName: "x", label: "Başvuru Reddedildi", desc: "Başvurunuz olumsuz sonuçlandığında" },
  jobReminder: { iconName: "clock", label: "İş Hatırlatması", desc: "Yaklaşan iş günü öncesi hatırlatma" },
  jobNearby: { iconName: "pin", label: "Yakındaki Yeni İşler", desc: "Konumunuza yakın yeni ilan yayınlandığında" },
  newMessage: { iconName: "message", label: "Yeni Mesaj", desc: "Sohbetlerde okunmamış mesaj geldiğinde" },
  paymentReceived: { iconName: "wallet", label: "Ödeme Alındı", desc: "Hakediş tutarı cüzdanınıza aktarıldığında" },
  paymentApproved: { iconName: "check", label: "Ödeme Onaylandı", desc: "Ödeme talebiniz onaylandığında" },
  paymentRejected: { iconName: "alert", label: "Ödeme Reddedildi", desc: "Ödeme talebiniz reddedildiğinde" },
  walletDeposit: { iconName: "inbox", label: "Cüzdan Yükleme", desc: "Bakiyenize para yüklendiğinde" },
  walletWithdraw: { iconName: "building", label: "Para Çekme Talebi", desc: "Para çekme talebinin durumu değiştiğinde" },
  workStarted: { iconName: "clock", label: "İş Başlangıcı", desc: "Karekod okutulup iş başlatıldığında" },
  workCompleted: { iconName: "sparkles", label: "İş Tamamlandı", desc: "İşçi ve işveren işi onayladığında" },
  escrowDisputed: { iconName: "shield", label: "Ödeme İtirazı", desc: "Bir iş için güvence itirazı açıldığında" },
  systemUpdate: { iconName: "settings", label: "Sistem Güncellemesi", desc: "Platform duyuruları ve yenilikler" },
  maintenance: { iconName: "alert", label: "Bakım Bildirimi", desc: "Planlı bakım ve kesinti uyarıları" },
  promotional: { iconName: "gift", label: "Kampanya & Fırsatlar", desc: "İndirimler ve platform fırsatları" },
};

export function prefMeta(key: Exclude<NotificationPrefKey, "pushEnabled">): Omit<NotificationPrefMeta, "key"> {
  return META[key];
}

/** Tüm kategori anahtarları (pushEnabled hariç) — sıra korunur. */
export const ALL_PREF_KEYS: NotificationPrefKey[] = PREF_GROUPS.flatMap((g) => g.keys);
