import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, C, EmptyState, Loading, PrimaryButton } from "@/components/ui";
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

const TYPE_ICONS: Record<string, string> = {
  APPLICATION_ACCEPTED: "✅",
  APPLICATION_REJECTED: "❌",
  NEW_APPLICATION: "📥",
  NEW_MESSAGE: "💬",
  JOB_REMINDER: "⏰",
  RATING_RECEIVED: "⭐",
};

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
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);
  // null = henüz bilinmiyor (yanlışlıkla bant göstermemek için izin doğrulanana kadar bekle).
  const [pushPermission, setPushPermission] = useState<boolean | null>(getPermissionCached());

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
    }
  }, [notifData]);

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
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Bildirimler</Text>
          <Text style={styles.sub}>
            {unread > 0 ? `${unread} okunmamış bildirimin var` : "Tüm bildirimler okundu"}
          </Text>
        </View>
        {unread > 0 && (
          <PrimaryButton
            label="Tümünü okundu işaretle"
            variant="outline"
            onPress={async () => {
              try {
                await markAllNotificationsRead();
                await reload();
                onChanged?.();
              } catch {
                // sessiz
              }
            }}
          />
        )}
      </View>

      {/* İzin kapalıyken KAYBOLMAYAN sabit uyarı bandı — dokunulduğunda Bildirim Ayarları'na götürür. */}
      {pushPermission === false && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bildirimler kapalı — ayarlara git"
          onPress={onOpenNotificationSettings}
          style={({ pressed }) => [styles.permBanner, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.permBannerIcon}>🔔</Text>
          <View style={styles.permBannerTextWrap}>
            <Text style={styles.permBannerTitle}>Bildirimler kapalı, lütfen açın</Text>
            <Text style={styles.permBannerSub}>Dokun → Bildirim Ayarları</Text>
          </View>
          <Text style={styles.permBannerChevron}>›</Text>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              await refreshNotifs();
              onChanged?.();
            }}
            tintColor={C.primary}
            colors={[C.primary]}
            progressBackgroundColor="#fff"
          />
        }
      >
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState emoji="🔔" title="Bildirim yok" subtitle="Başvuru durumu, yeni mesaj ve iş hatırlatmaları burada görünür." />
        ) : (
          items.map((n) => (
            <Card key={n.id} style={[styles.item, !n.isRead && styles.itemUnread]}>
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
                <Text style={styles.icon}>{TYPE_ICONS[n.type] ?? "🔔"}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{n.title}</Text>
                    {!n.isRead && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.bodyText}>{n.body}</Text>
                  <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                </View>
                <Pressable onPress={() => remove(n.id)} hitSlop={8}>
                  <Text style={styles.delete}>🗑</Text>
                </Pressable>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16, paddingBottom: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: 2 },
  list: { padding: 16, gap: 8, paddingBottom: 40 },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
  },
  permBannerIcon: { fontSize: 20 },
  permBannerTextWrap: { flex: 1, gap: 1 },
  permBannerTitle: { fontSize: 14, fontWeight: "800", color: "#9a3412" },
  permBannerSub: { fontSize: 12, color: "#c2410c" },
  permBannerChevron: { fontSize: 20, color: "#f97316", fontWeight: "800" },
  item: { padding: 12 },
  itemUnread: { borderColor: C.primary, backgroundColor: "#f5f6ff" },
  itemBody: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  icon: { fontSize: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 14, fontWeight: "800", color: C.text, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e11d48" },
  bodyText: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 19 },
  time: { fontSize: 11, color: C.muted, marginTop: 4 },
  delete: { fontSize: 14, opacity: 0.7, paddingHorizontal: 4 },
});
