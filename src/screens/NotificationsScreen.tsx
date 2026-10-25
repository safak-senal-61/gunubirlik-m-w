import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BrandRefreshScrollView } from "@/components/BrandPullToRefresh";
import { Card, C, EmptyState, Loading, useTheme, lightColors, type ThemeColors } from "@/components/ui";
import { useCachedList } from "@/hooks/use-cached-list";
import {
  getPermissionCached,
  onPermissionChanged,
  refreshPermission,
} from "@/lib/onesignal";
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import type { ApiNotification } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ApplicationsIcon,
  MessageIcon,
  ClockIcon,
  StarIcon,
  TrashIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  WalletIcon,
} from "@/components/icons";

/**
 * Bildirim başlık ve gövdesindeki yapay zeka tarafından eklenmiş
 * dekoratif emoji öneklerini ve sembollerini temizler.
 */
function cleanNotificationText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^[\p{Extended_Pictographic}\s\u200d\uFE0F\u20E3]+/u, "")
    .replace(/[\p{Extended_Pictographic}\u200d\uFE0F\u20E3]+$/u, "")
    .trim();
}

function getNotificationIcon(type: string, colors: ThemeColors) {
  switch (type) {
    case "APPLICATION_ACCEPTED":
      return <CheckCircleIcon size={18} color={colors.primary} />;
    case "APPLICATION_REJECTED":
      return <XCircleIcon size={18} color={colors.danger} />;
    case "NEW_APPLICATION":
      return <ApplicationsIcon size={18} color={colors.primary} />;
    case "NEW_MESSAGE":
      return <MessageIcon size={18} color={colors.primary} />;
    case "JOB_REMINDER":
      return <ClockIcon size={18} color={colors.amber} />;
    case "RATING_RECEIVED":
      return <StarIcon size={18} color={colors.amber} />;
    case "PAYMENT_RECEIVED":
    case "WALLET_DEPOSIT":
      return <ArrowDownLeftIcon size={18} color={colors.primary} />;
    case "PAYMENT_APPROVED":
    case "WALLET_WITHDRAW":
      return <ArrowUpRightIcon size={18} color={colors.amber} />;
    default:
      return <BellIcon size={18} color={colors.primary} />;
  }
}

export default function NotificationsScreen({
  refreshKey,
  onChanged,
  onOpenJob,
  onOpenNotificationSettings,
}: {
  refreshKey: number;
  onChanged?: () => void;
  onOpenJob?: (jobId: string) => void;
  onOpenNotificationSettings?: () => void;
}) {
  const { colors } = useTheme();
  styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);
  // null = henüz bilinmiyor (yanlışlıkla bant göstermemek için izin doğrulanana kadar bekle).
  const [pushPermission, setPushPermission] = useState<boolean | null>(getPermissionCached());
  // Ekran AÇILIR AÇILMAZ okundu işaretleme tek seferde tetiklenir (her mount'ta bir kez).
  // Buton YOK — kullanıcı hiçbir şey yapmadan bildirimler okunmuş olur.
  const autoReadDone = useRef(false);

  const notifFetcher = useCallback(() => fetchNotifications(), []);
  const {
    data: notifData,
    loading,
    refreshing,
    refresh: refreshNotifs,
    reload,
  } = useCachedList("notifications:all", notifFetcher, []);

  useEffect(() => {
    if (notifData) {
      setItems(notifData.items);
      setUnread(notifData.unreadCount);
      // Cache'den bile gelse: ekrana girildi → hepsini okundu işaretle (sessiz, arka planda).
      if (!autoReadDone.current && notifData.unreadCount > 0) {
        autoReadDone.current = true;
        markAllNotificationsRead()
          .then(reload)
          .then(() => onChanged?.())
          .catch(() => {});
      }
    }
  }, [notifData, reload, onChanged]);

  // Sekme değişiminde sessiz tazele. DİKKAT: onChanged BURADA ÇAĞRILMAZ —
  // onChanged refreshKey'i artırdığı için sonsuz reload döngüsüne giriyordu
  // (bildirim ekranı sürekli yükleniyor hatasının kök nedeni).
  useEffect(() => {
    if (refreshKey > 0) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Sistem bildirim iznini doğrula + değişimlerini dinle: izin yoksa sabit uyarı bandı göster.
  useEffect(() => {
    let active = true;
    void refreshPermission().then((granted) => {
      if (active) setPushPermission(granted);
    });
    const unsubscribe = onPermissionChanged((granted) => {
      if (active) setPushPermission(granted);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const remove = (id: string) => {
    Alert.alert("Bildirimi sil", "Bu bildirim silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteNotification(id);
            await reload();
            onChanged?.();
          } catch {
            // sessiz
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.h1, { color: colors.text }]}>Bildirimler</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {unread > 0 ? `${unread} okunmamış bildirimin var` : "Tüm bildirimler okundu"}
          </Text>
        </View>
      </View>

      {/* İzin kapalıyken KAYBOLMAYAN sabit uyarı bandı — dokunulduğunda Bildirim Ayarları'na götürür. */}
      {pushPermission === false && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bildirimler kapalı — ayarlara git"
          onPress={onOpenNotificationSettings}
          style={({ pressed }) => [styles.permBanner, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.permIconBox, { backgroundColor: colors.primarySoft }]}>
            <BellIcon size={18} color={colors.primary} />
          </View>
          <View style={styles.permBannerTextWrap}>
            <Text style={[styles.permBannerTitle, { color: colors.text }]}>Bildirimler kapalı, lütfen açın</Text>
            <Text style={[styles.permBannerSub, { color: colors.muted }]}>Dokun → Bildirim Ayarları</Text>
          </View>
          <Text style={styles.permBannerChevron}>›</Text>
        </Pressable>
      )}

      <BrandRefreshScrollView
        style={[styles.flex, { backgroundColor: colors.bg }]}
        contentContainerStyle={[styles.list, { backgroundColor: colors.bg }]}
        refreshing={refreshing}
        onRefresh={async () => {
          await refreshNotifs();
          onChanged?.();
        }}
      >
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellIcon size={32} color={colors.muted} />}
            title="Bildirim yok"
            subtitle="Başvuru durumu, yeni mesaj ve iş hatırlatmaları burada görünür."
          />
        ) : (
          items.map((n) => (
            <Card
              key={n.id}
              style={[
                styles.item,
                !n.isRead && { borderColor: colors.primary, borderLeftWidth: 3 },
              ]}
            >
              <Pressable
                style={styles.itemBody}
                onPress={() => {
                  if (!n.isRead) {
                    markNotificationRead(n.id)
                      .then(reload)
                      .then(() => onChanged?.())
                      .catch(() => {});
                  }
                  const jobId = n.data?.jobId;
                  if (jobId && onOpenJob) onOpenJob(jobId);
                }}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
                  {getNotificationIcon(n.type, colors)}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.text }]}>{cleanNotificationText(n.title)}</Text>
                    {!n.isRead && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.bodyText, { color: colors.muted }]}>{cleanNotificationText(n.body)}</Text>
                  <Text style={[styles.time, { color: colors.muted }]}>{timeAgo(n.createdAt)}</Text>
                </View>
                <Pressable onPress={() => remove(n.id)} hitSlop={8} style={styles.deleteHit}>
                  <TrashIcon size={16} color={colors.muted} />
                </Pressable>
              </Pressable>
            </Card>
          ))
        )}
      </BrandRefreshScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16, paddingBottom: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  list: { padding: 16, gap: 8, paddingBottom: 40 },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  permIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.amberBg,
    alignItems: "center",
    justifyContent: "center",
  },
  permBannerTextWrap: { flex: 1, gap: 1 },
  permBannerTitle: { fontSize: 14, fontWeight: "800", color: colors.amber },
  permBannerSub: { fontSize: 12, color: colors.muted },
  permBannerChevron: { fontSize: 20, color: colors.amber, fontWeight: "800" },
  item: { padding: 12 },
  itemUnread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  itemBody: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteHit: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 14, fontWeight: "800", color: colors.text, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e11d48" },
  bodyText: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 19 },
  time: { fontSize: 11, color: colors.muted, marginTop: 4 },
  delete: { fontSize: 14, opacity: 0.7, paddingHorizontal: 4 },
});
let styles = createStyles(lightColors);
