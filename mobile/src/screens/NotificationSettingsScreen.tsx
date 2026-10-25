// Ayarlar > Bildirimler — backend'e bağlı GENİŞ bildirim tercihi ekranı.
// Uç noktalar: GET/PUT /notifications/settings, POST /notifications/settings/reset
// (bkz. api-doc → "Bildirimler & Ayarlar"). Anahtar listesi tek kaynaktan gelir:
// @/lib/notification-prefs

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BrandRefreshScrollView } from "@/components/BrandPullToRefresh";
import { Card, C, PrimaryButton, SectionTitle, useTheme } from "@/components/ui";
import {
  fetchNotificationSettingsCached,
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
import {
  BellIcon,
  BriefcaseIcon,
  MessageIcon,
  WalletIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  ShieldIcon,
  GiftIcon,
  SparklesIcon,
  BuildingIcon,
  AlertCircleIcon,
  MapPinIcon,
  FilterIcon,
} from "@/components/icons";

const ALL_ON: NotificationSettingsPatch = ALL_PREF_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: true }),
  {} as NotificationSettingsPatch,
);

type SaveState = "idle" | "saving" | "saved" | "error";

function PrefVectorIcon({
  name,
  size = 18,
  color = "#0D6847",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  switch (name) {
    case "briefcase":
      return <BriefcaseIcon size={size} color={color} />;
    case "message":
      return <MessageIcon size={size} color={color} />;
    case "wallet":
      return <WalletIcon size={size} color={color} />;
    case "clock":
      return <ClockIcon size={size} color={color} />;
    case "check":
      return <CheckIcon size={size} color={color} />;
    case "x":
      return <XIcon size={size} color="#DC2626" />;
    case "pin":
      return <MapPinIcon size={size} color={color} />;
    case "shield":
      return <ShieldIcon size={size} color={color} />;
    case "building":
      return <BuildingIcon size={size} color={color} />;
    case "gift":
      return <GiftIcon size={size} color={color} />;
    case "sparkles":
      return <SparklesIcon size={size} color="#D97706" />;
    case "alert":
      return <AlertCircleIcon size={size} color="#DC2626" />;
    case "inbox":
      return <FilterIcon size={size} color={color} />;
    case "bell":
    default:
      return <BellIcon size={size} color={color} />;
  }
}

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
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

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    try {
      const { settings: s, fromCache } = await fetchNotificationSettingsCached({
        force: asRefresh,
        onUpdate: (fresh) => {
          setSettings(fresh);
          syncPreferenceTags(fresh);
        },
      });
      setSettings(s);
      setError(null);
      if (!fromCache) syncPreferenceTags(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ayarlar alınamadı.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void refreshPermission().then(setPermission);
    void getPushDiagnostics().then((d) =>
      setDiag({ subscriptionId: d.subscriptionId, optedIn: d.optedIn }),
    );
  }, []);

  const toggle = useCallback(
    async (key: NotificationPrefKey, next: boolean) => {
      if (!settings || busyKey) return;
      const prev = settings[key];
      setSettings((s) => (s ? { ...s, [key]: next } : s));
      setBusyKey(key);
      setSaveState("saving");
      try {
        const patch: NotificationSettingsPatch = { [key]: next };
        const saved = await updateNotificationSettings(patch);
        setSettings(saved);
        syncPreferenceTags(saved);
        setSaveState("saved");
        flash();
      } catch (err) {
        setSettings((s) => (s ? { ...s, [key]: prev } : s));
        setSaveState("error");
        setError(err instanceof Error ? err.message : "Kaydedilemedi.");
      } finally {
        setBusyKey(null);
      }
    },
    [settings, busyKey, flash],
  );

  const enableAll = useCallback(async () => {
    setSaveState("saving");
    try {
      const saved = await updateNotificationSettings(ALL_ON);
      setSettings(saved);
      syncPreferenceTags(saved);
      setSaveState("saved");
      flash();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tümü açılamadı.");
      setSaveState("error");
    }
  }, [flash]);

  const resetAll = useCallback(async () => {
    setSaveState("saving");
    try {
      const saved = await resetNotificationSettings();
      setSettings(saved);
      syncPreferenceTags(saved);
      setSaveState("saved");
      flash();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sıfırlanamadı.");
      setSaveState("error");
    }
  }, [flash]);

  const askPermission = useCallback(async () => {
    const granted = await requestPermission();
    setPermission(granted);
    void refreshPermission().then(setPermission);
    const d = await getPushDiagnostics();
    setDiag({ subscriptionId: d.subscriptionId, optedIn: d.optedIn });
  }, []);

  const pushOff = settings ? !settings.pushEnabled : false;
  const activeCount = settings
    ? ALL_PREF_KEYS.filter((k) => settings[k] === false).length
    : 0;

  return (
    <BrandRefreshScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { backgroundColor: colors.bg }]}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {/* ---------- Durum başlığı ---------- */}
      <View style={styles.hero}>
        <View style={styles.heroBlobA} />
        <View style={styles.heroBlobB} />
        <View style={styles.heroIconBox}>
          <BellIcon size={22} color="#FFFFFF" strokeWidth={2} />
        </View>
        <Text style={styles.heroTitle}>Bildirim Tercihleri</Text>
        <Text style={styles.heroSub}>
          {settings?.pushEnabled
            ? `${ALL_PREF_KEYS.length - activeCount} / ${ALL_PREF_KEYS.length} kategori aktif`
            : "Tüm push bildirimleri kapalı"}
        </Text>
        <View style={styles.heroChips}>
          <View style={[styles.heroChip, permission === true ? styles.heroChipOk : styles.heroChipOff]}>
            <View style={styles.chipRow}>
              {permission === true ? (
                <CheckIcon size={12} color="#FFFFFF" strokeWidth={2.5} />
              ) : (
                <XIcon size={12} color="#FFFFFF" strokeWidth={2.5} />
              )}
              <Text style={styles.heroChipText}>
                {permission === true ? "Sistem İzni Var" : "Sistem İzni Yok"}
              </Text>
            </View>
          </View>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>OneSignal Aktif</Text>
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
            <Text style={styles.savedFlash}>✓ Tercihler kaydedildi</Text>
          )}
        </Animated.View>
      </View>

      {error && (
        <Pressable onPress={() => setError(null)}>
          <View style={styles.errorBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <AlertCircleIcon size={16} color={C.rose} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <Text style={styles.errorHint}>Kapatmak için dokunun.</Text>
          </View>
        </Pressable>
      )}

      {/* ---------- Sistem izni ---------- */}
      <Card style={{ gap: 10 }}>
        <SectionTitle>Cihaz İzni</SectionTitle>
        <Text style={styles.desc}>
          Android ve iOS, bildirim gönderilmeden önce sistem düzeyinde izin ister. İzin
          kapalıyken uygulama içi bildirimler çalışır, kilit ekranına bildirim düşmez.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Sistem Bildirim İzni</Text>
          <Text
            style={[
              styles.statusValue,
              { color: permission ? C.emerald : C.danger },
            ]}
          >
            {permission ? "Açık" : "Kapalı"}
          </Text>
        </View>
        {permission === false && (
          <PrimaryButton
            label="Bildirim İznini Aç"
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
              Abonelik: {diag.subscriptionId ?? "Bağlanıyor..."}
            </Text>
          </View>
        )}
      </Card>

      {/* ---------- Ana anahtar ---------- */}
      <Card style={{ gap: 4 }}>
        <PrefSwitch
          iconName="bell"
          label="Push Bildirimleri"
          desc="Ana bildirim anahtarı. Kapatırsanız tüm kategoriler devre dışı kalır."
          value={!!settings?.pushEnabled}
          disabled={busyKey === "pushEnabled"}
          onChange={(v) => toggle("pushEnabled", v)}
          master
        />
        <Text style={styles.footNote}>
          Kategorileri ayrı ayrı seçebilir veya bu anahtarla hepsini tek seferde susturabilirsiniz.
        </Text>
      </Card>

      {/* ---------- Kategoriler ---------- */}
      {PREF_GROUPS.map((g) => (
        <Card key={g.title} style={{ gap: 4 }}>
          <View style={styles.groupHeader}>
            <View style={styles.groupIconBox}>
              <PrefVectorIcon name={g.iconName} size={18} color="#0D6847" />
            </View>
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
                  iconName={meta.iconName}
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
        <SectionTitle>Toplu İşlemler</SectionTitle>
        <View style={styles.actionRow}>
          <View style={styles.actionCol}>
            <PrimaryButton label="Tümünü Aç" onPress={enableAll} variant="primary" />
          </View>
          <View style={styles.actionCol}>
            <PrimaryButton label="Varsayılana Dön" onPress={resetAll} variant="outline" />
          </View>
        </View>
      </Card>

      {/* ---------- Bilgi ---------- */}
      <Card style={{ gap: 8 }}>
        <SectionTitle>Bildirim Güvencesi</SectionTitle>
        <View style={styles.infoRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>1</Text>
          </View>
          <Text style={styles.infoText}>
            Tercihleriniz anında sunucuya kaydedilir. Kapattığınız kategori için sunucu bildirim üretmez.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>2</Text>
          </View>
          <Text style={styles.infoText}>
            OneSignal etiketleri senkronize edilerek sadece ilgilendiğiniz kategoriler hedeflenir.
          </Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>3</Text>
          </View>
          <Text style={styles.infoText}>
            Güvenlik ve ödeme itirazı gibi kritik işlem bildirimleri cihaz izni kapalı olsa da uygulama içinde korunur.
          </Text>
        </View>
      </Card>
    </BrandRefreshScrollView>
  );
}

/** Etiket + açıklama + Switch satırı. */
function PrefSwitch({
  iconName,
  label,
  desc,
  value,
  disabled,
  onChange,
  master,
}: {
  iconName: string;
  label: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  master?: boolean;
}) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
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
      <View
        style={[
          styles.prefIconBox,
          { backgroundColor: colors.cardSecondary },
          master && [styles.prefIconBoxMaster, { backgroundColor: colors.primarySoft }],
        ]}
      >
        <PrefVectorIcon name={iconName} size={18} color={master ? colors.primary : colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.prefLabel, { color: colors.text }, master && [styles.prefLabelMaster, { color: colors.primary }]]}>
          {label}
        </Text>
        <Text style={[styles.prefDesc, { color: colors.muted }]}>{desc}</Text>
      </View>
      <Animated.View style={[styles.trackFake, { backgroundColor: trackColor }]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 48, gap: 12 },
  hero: {
    backgroundColor: "#0D6847",
    borderRadius: 20,
    padding: 18,
    gap: 6,
    overflow: "hidden",
    shadowColor: "#0D6847",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroBlobA: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroBlobB: {
    position: "absolute",
    bottom: -90,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "rgba(255,255,255,0.85)",
  },
  heroChips: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  heroChip: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroChipOk: { backgroundColor: "rgba(16,185,129,0.35)" },
  heroChipOff: { backgroundColor: "rgba(255,255,255,0.15)" },
  heroChipText: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
    color: "#FFFFFF",
  },
  savedFlash: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    color: "#A7F3D0",
    marginTop: 4,
  },

  errorBox: { backgroundColor: "#FEE2E2", borderRadius: 12, padding: 12, gap: 4 },
  errorText: { fontSize: 13, color: "#DC2626", fontWeight: "700" },
  errorHint: { fontSize: 11, color: "#DC2626" },

  desc: { fontSize: 13, color: "#5C615E", lineHeight: 19 },
  link: { fontSize: 12, fontWeight: "700", color: "#0D6847", textAlign: "center", marginTop: 4 },
  footNote: { fontSize: 11, color: "#717673", lineHeight: 16, marginTop: 4 },
  divider: { height: 1, backgroundColor: "#EAE8E2", marginVertical: 4 },
  rowDivider: { height: 1, backgroundColor: "#F3F1EC", marginLeft: 44 },

  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  statusLabel: { fontSize: 13, fontWeight: "600", color: "#141615" },
  statusValue: { fontSize: 13, fontWeight: "800" },
  diagBox: {
    backgroundColor: "#F6F5F2",
    borderRadius: 8,
    padding: 8,
    gap: 2,
    borderWidth: 1,
    borderColor: "#E2E0D8",
  },
  diagText: { fontSize: 10, color: "#717673", fontFamily: "monospace" },

  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  groupIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EAF3EE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C5DDD0",
  },
  groupTitle: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    color: "#141615",
  },
  groupHint: { fontSize: 11, color: "#717673" },
  groupCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#717673",
    backgroundColor: "#F0EFEA",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  prefRowPressed: { opacity: 0.75 },
  prefIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F4F3F0",
    alignItems: "center",
    justifyContent: "center",
  },
  prefIconBoxMaster: {
    backgroundColor: "#EAF3EE",
  },
  prefLabel: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
    color: "#141615",
  },
  prefLabelMaster: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    color: "#0D6847",
  },
  prefDesc: { fontSize: 11, color: "#717673", marginTop: 2, lineHeight: 15 },
  trackFake: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  knobOn: {
    alignSelf: "flex-end",
  },

  actionRow: { flexDirection: "row", gap: 10 },
  actionCol: { flex: 1 },

  infoRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 2 },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EAF3EE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C5DDD0",
    marginTop: 2,
  },
  stepNum: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    color: "#0D6847",
  },
  infoText: { flex: 1, fontSize: 12, color: "#5C615E", lineHeight: 18 },
});
