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
  icon: string;
  label: string;
  desc: string;
}

/** Ekran grupları (alt başlık + ikon). */
export const PREF_GROUPS: { title: string; icon: string; hint: string; keys: NotificationPrefKey[] }[] = [
  {
    title: "İş ilanları & başvurular",
    icon: "💼",
    hint: "İlan ve başvuru akışındaki değişiklikler",
    keys: ["jobApplied", "applicationAccepted", "applicationRejected", "jobReminder", "jobNearby"],
  },
  {
    title: "Sohbet",
    icon: "💬",
    hint: "Mesajlaşma bildirimleri (chat)",
    keys: ["newMessage"],
  },
  {
    title: "Ödeme & cüzdan",
    icon: "💰",
    hint: "Ücret, onay ve cüzdan hareketleri",
    keys: ["paymentReceived", "paymentApproved", "paymentRejected", "walletDeposit", "walletWithdraw"],
  },
  {
    title: "İş süreci",
    icon: "⏱️",
    hint: "İş başlangıcı, tamamlanma ve itirazlar",
    keys: ["workStarted", "workCompleted", "escrowDisputed"],
  },
  {
    title: "Sistem",
    icon: "🛠️",
    hint: "Bakım, güncelleme ve kampanya duyuruları",
    keys: ["systemUpdate", "maintenance", "promotional"],
  },
];

/** key → { icon, label, desc }. pushEnabled burada YOK; ana anahtar kendi ekranında. */
const META: Record<Exclude<NotificationPrefKey, "pushEnabled">, Omit<NotificationPrefMeta, "key">> = {
  jobApplied: { icon: "📥", label: "Yeni başvuru", desc: "İlanıma bir işçi başvurduğunda" },
  applicationAccepted: { icon: "✅", label: "Başvuru kabul edildi", desc: "Başvurun onaylandığında" },
  applicationRejected: { icon: "❌", label: "Başvuru reddedildi", desc: "Başvurun olumsuz sonuçlandığında" },
  jobReminder: { icon: "⏰", label: "İş hatırlatması", desc: "Yaklaşan iş günü öncesi hatırlatma" },
  jobNearby: { icon: "📍", label: "Yakınımdaki yeni iş", desc: "Konumuna yakın yeni ilan yayınlandığında" },
  newMessage: { icon: "💬", label: "Yeni mesaj", desc: "Sohbetlerde okunmamış mesaj geldiğinde" },
  paymentReceived: { icon: "💸", label: "Ödeme alındı", desc: "Bir ödeme hesabına geçtiğinde" },
  paymentApproved: { icon: "✅", label: "Ödeme onaylandı", desc: "Ödeme talebin onaylandığında" },
  paymentRejected: { icon: "⚠️", label: "Ödeme reddedildi", desc: "Ödeme talebin reddedildiğinde" },
  walletDeposit: { icon: "📥", label: "Cüzdan yükleme", desc: "Bakiyene para yüklendiğinde" },
  walletWithdraw: { icon: "🏦", label: "Para çekme talebi", desc: "Para çekme talebinin durumu değiştiğinde" },
  workStarted: { icon: "🚧", label: "İş başlangıcı", desc: "Bir iş başladığında" },
  workCompleted: { icon: "🎉", label: "İş tamamlandı", desc: "Bir iş tamamlandığında" },
  escrowDisputed: { icon: "⚖️", label: "Ödeme itirazı", desc: "Bir iş için itiraz açıldığında" },
  systemUpdate: { icon: "🛠️", label: "Sistem güncellemesi", desc: "Uygulama ve platform duyuruları" },
  maintenance: { icon: "🚧", label: "Bakım bildirimi", desc: "Planlı bakım ve kesinti uyarıları" },
  promotional: { icon: "🎁", label: "Kampanya & duyuru", desc: "İndirim, kampanya ve genel duyurular" },
};

export function prefMeta(key: Exclude<NotificationPrefKey, "pushEnabled">): Omit<NotificationPrefMeta, "key"> {
  return META[key];
}

/** Tüm kategori anahtarları (pushEnabled hariç) — sıra korunur. */
export const ALL_PREF_KEYS: NotificationPrefKey[] = PREF_GROUPS.flatMap((g) => g.keys);
