// Ayarlar > Bildirimler — backend'e bağlı GENİŞ bildirim tercihi ekranı.
// Uç noktalar: GET/PUT /notifications/settings, POST /notifications/settings/reset
// (bkz. api-doc → "Bildirimler & Ayarlar"). Anahtar listesi tek kaynaktan gelir:
// @/lib/notification-prefs

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Card, C, PrimaryButton, SectionTitle } from "@/components/ui";
import {
  fetchNotificationSettings,
  resetNotificationSettings,
  updateNotificationSettings,
} from "@/lib/api";
import {
  getPermissionCached,
  getPushDiagnostics,
  ONESIGNAL_APP_ID,
  refreshPermission,
  requestPermission,
  syncPreferenceTags,
} from "@/lib/onesignal";
import {
  ALL_PREF_KEYS,
  PREF_GROUPS,
  prefMeta,
  type NotificationPrefKey,
} from "@/lib/notification-prefs";
import type { NotificationSettings, NotificationSettingsPatch } from "@/lib/types";

const ALL_ON: NotificationSettingsPatch = ALL_PREF_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: true }),
  {} as NotificationSettingsPatch,
);

type SaveState = "idle" | "saving" | "saved" | "error";

export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busyKey, setBusyKey] = useState<NotificationPrefKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<boolean | null>(getPermissionCached());
  const [diag, setDiag] = useState<{ subscriptionId: string | null; optedIn: boolean } | null>(null);
  const saveFlash = useRef(new Animated.Value(0)).current;

  const flash = useCallback(() => {
    saveFlash.setValue(0);
    Animated.timing(saveFlash, {
      toValue: 1,
      duration: 1400,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [saveFlash]);

  const load = useCallback(
    async (asRefresh = false) => {
      if (asRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const s = await fetchNotificationSettings();
        setSettings(s);
        setError(null);
        syncPreferenceTags(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ayarlar alınamadı.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void refreshPermission().then(setPermission);
    void getPushDiagnostics().then((d) =>
      setDiag({ subscriptionId: d.subscriptionId, optedIn: d.optedIn }),
    );
  }, []);

  /** Tek bir alanı backend'e yazar (optimistic UI + hata durumunda geri al). */
  const toggle = useCallback(
    async (key: NotificationPrefKey, value: boolean) => {
      const prev = settings;
      if (!prev) return;
      setSettings({ ...prev, [key]: value });
      setBusyKey(key);
      setSaveState("saving");
      try {
        if (key === "pushEnabled") {
          // Ana anahtar: OneSignal abonelik durumunu da senkronla.
          if (value) await requestPermission(true);
          else await requestPermission(false);
          setPermission(await refreshPermission());
        }
        const updated = await updateNotificationSettings({ [key]: value } as NotificationSettingsPatch);
        setSettings(updated);
        syncPreferenceTags(updated);
        setSaveState("saved");
        flash();
      } catch (err) {
        setSettings(prev);
        setSaveState("error");
        setError(err instanceof Error ? err.message : "Ayar kaydedilemedi.");
      } finally {
        setBusyKey(null);
      }
    },
    [settings, flash],
  );

  /** Tüm kategorileri tek seferde açar (hepsi açık = varsayılan). */
  const enableAll = useCallback(async () => {
    const prev = settings;
    if (!prev) return;
    setSettings({ ...prev, ...ALL_ON });
    setSaveState("saving");
    try {
      await requestPermission(true);
      setPermission(await refreshPermission());
      const updated = await updateNotificationSettings(ALL_ON);
      setSettings(updated);
      syncPreferenceTags(updated);
      setSaveState("saved");
      flash();
    } catch (err) {
      setSettings(prev);
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Ayarlar güncellenemedi.");
    }
  }, [settings, flash]);

  const resetAll = useCallback(() => {
    Alert.alert(
      "Varsayılanlara sıfırla",
      "Tüm bildirim kategorileri açık olacak ve OneSignal abonelik durumun sıfırlanacak. Devam edilsin mi?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sıfırla",
          onPress: async () => {
            try {
              const updated = await resetNotificationSettings();
              setSettings(updated);
              syncPreferenceTags(updated);
              setSaveState("saved");
              flash();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sıfırlanamadı.");
            }
          },
        },
      ],
    );
  }, [flash]);

  const askPermission = useCallback(async () => {
    const granted = await requestPermission(true);
    setPermission(granted);
    if (!granted) {
      Alert.alert(
        "Bildirim izni kapalı",
        "Sistem ayarlarından Günübirlik → Bildirimler bölümünden izni açabilirsin.",
        [
          { text: "Vazgeç", style: "cancel" },
          { text: "Ayarları aç", onPress: () => void Linking.openSettings() },
        ],
      );
    }
  }, []);

  const pushOff = settings ? !settings.pushEnabled : false;
  const activeCount = settings
    ? ALL_PREF_KEYS.filter((k) => settings[k] === false).length
    : 0;

  if (loading && !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.primary} />
        <Text style={styles.loadingText}>Bildirim ayarları yükleniyor…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={C.primary}
          colors={[C.primary]}
          progressBackgroundColor="#fff"
        />
      }
    >
      {/* ---------- Durum başlığı ---------- */}
      <View style={styles.hero}>
        <View style={styles.heroBlobA} />
        <View style={styles.heroBlobB} />
        <Text style={styles.heroIcon}>🔔</Text>
        <Text style={styles.heroTitle}>Bildirim tercihlerin</Text>
        <Text style={styles.heroSub}>
          {settings?.pushEnabled
            ? `${ALL_PREF_KEYS.length - activeCount} / ${ALL_PREF_KEYS.length} kategori açık`
            : "Tüm push bildirimleri kapalı"}
        </Text>
        <View style={styles.heroChips}>
          <View style={[styles.heroChip, permission === true ? styles.heroChipOk : styles.heroChipOff]}>
            <Text style={styles.heroChipText}>
              {permission === true ? "✅ Sistem izni var" : "🔕 Sistem izni yok"}
            </Text>
          </View>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>⚡ OneSignal bağlı</Text>
          </View>
        </View>
        <Animated.View
          style={{
            opacity: saveFlash.interpolate({
              inputRange: [0, 0.15, 0.75, 1],
              outputRange: [1, 0, 0, 1],
            }),
          }}
        >
          {saveState === "saved" && (
            <Text style={styles.savedFlash}>✓ Kaydedildi</Text>
          )}
        </Animated.View>
      </View>

      {error && (
        <Pressable onPress={() => setError(null)}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <Text style={styles.errorHint}>Kapatmak için dokun.</Text>
          </View>
        </Pressable>
      )}

      {/* ---------- Sistem izni ---------- */}
      <Card style={{ gap: 10 }}>
        <SectionTitle>Cihaz izni</SectionTitle>
        <Text style={styles.desc}>
          Android 13 ve üzeri, bildirim gönderilmeden önce uygulama iznini ister. İzin
          kapalıyken uygulama içi bildirimlerin çalışır, cihaz dışı push gelmez.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Sistem bildirim izni</Text>
          <Text
            style={[
              styles.statusValue,
              { color: permission ? C.emerald : C.danger },
            ]}
          >
            {permission ? "Verildi" : "Yok"}
          </Text>
        </View>
        {permission === false && (
          <PrimaryButton
            label="Bildirimlere izin ver"
            onPress={askPermission}
            variant="primary"
          />
        )}
        {permission === false && (
          <Pressable onPress={() => void Linking.openSettings()}>
            <Text style={styles.link}>Cihaz ayarlarını aç →</Text>
          </Pressable>
        )}
        {diag && (
          <View style={styles.diagBox}>
            <Text style={styles.diagText} numberOfLines={1}>
              OneSignal App ID: {ONESIGNAL_APP_ID}
            </Text>
            <Text style={styles.diagText} numberOfLines={1}>
              Abonelik: {diag.subscriptionId ?? "bekleniyor"}
            </Text>
          </View>
        )}
      </Card>

      {/* ---------- Ana anahtar ---------- */}
      <Card style={{ gap: 4 }}>
        <PrefSwitch
          icon="📲"
          label="Push bildirimleri"
          desc="Ana anahtar. Kapatırsan aşağıdaki tüm kategoriler de susar."
          value={!!settings?.pushEnabled}
          disabled={busyKey === "pushEnabled"}
          onChange={(v) => toggle("pushEnabled", v)}
          master
        />
        <Text style={styles.footNote}>
          Kategoriler ayrı ayrı da kapatılabilir; bu anahtar tümünü tek hamlede susturur.
        </Text>
      </Card>

      {/* ---------- Kategoriler ---------- */}
      {PREF_GROUPS.map((g) => (
        <Card key={g.title} style={{ gap: 2 }}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupIcon}>{g.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              <Text style={styles.groupHint}>{g.hint}</Text>
            </View>
            <Text style={styles.groupCount}>
              {g.keys.filter((k) => settings?.[k] === false).length}/{g.keys.length} kapalı
            </Text>
          </View>
          <View style={styles.divider} />
          {g.keys.map((key, idx) => {
            const meta = prefMeta(key as Exclude<NotificationPrefKey, "pushEnabled">);
            return (
              <View key={key} style={{ opacity: pushOff ? 0.45 : 1 }}>
                {idx > 0 && <View style={styles.rowDivider} />}
                <PrefSwitch
                  icon={meta.icon}
                  label={meta.label}
                  desc={meta.desc}
                  value={settings?.[key] !== false}
                  disabled={pushOff || busyKey === key}
                  onChange={(v) => toggle(key, v)}
                />
              </View>
            );
          })}
        </Card>
      ))}

      {/* ---------- Toplu işlemler ---------- */}
      <Card style={{ gap: 10 }}>
        <SectionTitle>Toplu işlemler</SectionTitle>
        <View style={styles.actionRow}>
          <View style={styles.actionCol}>
            <PrimaryButton label="Tümünü aç" onPress={enableAll} variant="primary" />
          </View>
          <View style={styles.actionCol}>
            <PrimaryButton label="Varsayılana sıfırla" onPress={resetAll} variant="outline" />
          </View>
        </View>
        <Text style={styles.footNote}>
          “Varsayılana sıfırla” sunucudaki tüm bildirim ayarlarını varsayılan değerlere
          (hepsi açık) döndürür. Aşağı çekerek de ayarları yenileyebilirsin.
        </Text>
      </Card>

      {/* ---------- Bilgi ---------- */}
      <Card style={{ gap: 8 }}>
        <SectionTitle>Bildirimler nasıl çalışıyor?</SectionTitle>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>1️⃣</Text>
          <Text style={styles.infoText}>
            Ayarın anında kaydedilir. Kapattığın kategori için sunucu hiçbir bildirim
            oluşturmaz — sadece telefonda gizlemez, tamamen engellenir.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>2️⃣</Text>
          <Text style={styles.infoText}>
            Ayarların OneSignal etiketlerine de yansıtılır; böylece kampanya gönderirken
            sadece istersen belirli kategorileri açık olan kullanıcılar hedeflenir.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>3️⃣</Text>
          <Text style={styles.infoText}>
            Bildirim listesi alt çubuktaki 🔔 Bildirimler sekmesinde; altındaki rozet
            okunmamış sayısını gösterir. Bildirime dokunmak onu okundu yapar.
          </Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.footNote}>
          Ödeme itirazı, güvenlik ve bakım uyarıları gibi kritik bildirimler cihaz
          izni kapalıyken de uygulama içinde görünür.
        </Text>
      </Card>
    </ScrollView>
  );
}

/** Etiket + açıklama + Switch satırı. Tüm sekme animasyonları useNativeDriver:false. */
function PrefSwitch({
  icon,
  label,
  desc,
  value,
  disabled,
  onChange,
  master,
}: {
  icon: string;
  label: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  master?: boolean;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // backgroundColor native driver desteklemez
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#d1d5db", C.primary],
  });

  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={label}
      accessibilityHint={desc}
      style={({ pressed }) => [styles.prefRow, pressed && !disabled && styles.prefRowPressed]}
    >
      <View style={[styles.prefIconBox, master && styles.prefIconBoxMaster]}>
        <Text style={styles.prefIcon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.prefLabel, master && styles.prefLabelMaster]}>{label}</Text>
        <Text style={styles.prefDesc}>{desc}</Text>
      </View>
      <Animated.View style={[styles.trackFake, { backgroundColor: trackColor }]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48, gap: 12 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  loadingText: { fontSize: 13, color: C.muted },

  hero: {
    backgroundColor: C.primary,
    borderRadius: 22,
    padding: 18,
    gap: 6,
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroBlobA: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroBlobB: {
    position: "absolute",
    bottom: -90,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  heroIcon: { fontSize: 26 },
  heroTitle: { fontSize: 19, fontWeight: "800", color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  heroChips: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  heroChip: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroChipOk: { backgroundColor: "rgba(16,185,129,0.32)" },
  heroChipOff: { backgroundColor: "rgba(255,255,255,0.14)" },
  heroChipText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  savedFlash: { fontSize: 11, fontWeight: "800", color: "#a7f3d0", marginTop: 4 },

  errorBox: { backgroundColor: C.roseBg, borderRadius: 12, padding: 12, gap: 2 },
  errorText: { fontSize: 13, color: C.rose, fontWeight: "700" },
  errorHint: { fontSize: 11, color: C.rose },

  desc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  link: { fontSize: 12, fontWeight: "700", color: C.primary, textAlign: "center" },
  footNote: { fontSize: 11, color: C.muted, lineHeight: 16 },
  divider: { height: 1, backgroundColor: "#f3f4f6" },
  rowDivider: { height: 1, backgroundColor: "#f9fafb", marginLeft: 46 },

  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusLabel: { fontSize: 13, fontWeight: "600", color: C.text },
  statusValue: { fontSize: 13, fontWeight: "800" },
  diagBox: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 10, gap: 3 },
  diagText: { fontSize: 10, color: C.muted },

  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  groupIcon: { fontSize: 18 },
  groupTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  groupHint: { fontSize: 11, color: C.muted, marginTop: 1 },
  groupCount: { fontSize: 11, fontWeight: "700", color: C.muted },

  prefRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10 },
  prefRowPressed: { backgroundColor: "#f8fafc", borderRadius: 12 },
  prefIconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  prefIconBoxMaster: { backgroundColor: C.indigoBg },
  prefIcon: { fontSize: 16 },
  prefLabel: { fontSize: 13, fontWeight: "700", color: C.text },
  prefLabelMaster: { fontSize: 15, fontWeight: "800" },
  prefDesc: { fontSize: 11, color: C.muted, marginTop: 1, lineHeight: 15 },
  // Özel anahtar (native Switch görünmez ama erişilebilir/semantik olarak kullanılır)
  trackFake: { width: 44, height: 26, borderRadius: 999, justifyContent: "center" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", marginLeft: 3 },
  knobOn: { marginLeft: 21 },

  actionRow: { flexDirection: "row", gap: 10 },
  actionCol: { flex: 1 },

  infoRow: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  infoIcon: { fontSize: 13 },
  infoText: { flex: 1, fontSize: 12, color: C.muted, lineHeight: 18 },
});
