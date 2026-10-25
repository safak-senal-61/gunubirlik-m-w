// Ayarlar > Bildirimler — modern, tema duyarlı ve sadeleştirilmiş bildirim tercihleri ekranı.
// Uç noktalar: GET/PUT /notifications/settings, POST /notifications/settings/reset
// Anahtar listesi tek kaynaktan gelir: @/lib/notification-prefs

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BrandRefreshScrollView } from "@/components/BrandPullToRefresh";
import { useTheme, lightColors, type ThemeColors } from "@/components/ui";
import {
  fetchNotificationSettingsCached,
  resetNotificationSettings,
  updateNotificationSettings,
} from "@/lib/api";
import {
  getPermissionCached,
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
  LockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  CheckCircleIcon,
} from "@/components/icons";

const ALL_ON: NotificationSettingsPatch = ALL_PREF_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: true }),
  {} as NotificationSettingsPatch,
);

type SaveState = "idle" | "saving" | "saved" | "error";

function PrefVectorIcon({
  name,
  size = 18,
  color,
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
      return <XIcon size={size} color={color} />;
    case "pin":
      return <MapPinIcon size={size} color={color} />;
    case "shield":
      return <ShieldIcon size={size} color={color} />;
    case "building":
      return <BuildingIcon size={size} color={color} />;
    case "gift":
      return <GiftIcon size={size} color={color} />;
    case "sparkles":
      return <SparklesIcon size={size} color={color} />;
    case "alert":
      return <AlertCircleIcon size={size} color={color} />;
    case "inbox":
      return <FilterIcon size={size} color={color} />;
    case "settings":
      return <LockIcon size={size} color={color} />;
    case "bell":
    default:
      return <BellIcon size={size} color={color} />;
  }
}

/** Modern, yumuşak yay animasyonlu Switch anahtarı */
function SwitchToggle({
  value,
  disabled,
  onToggle,
  colors,
}: {
  value: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  colors: ThemeColors;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      tension: 280,
      friction: 20,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  const knobTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  return (
    <Pressable
      onPress={() => !disabled && onToggle(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={[styles.switchTrack, { backgroundColor: trackBg }]}>
        <Animated.View
          style={[
            styles.switchKnob,
            { transform: [{ translateX: knobTranslate }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busyKey, setBusyKey] = useState<NotificationPrefKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<boolean | null>(getPermissionCached());

  // Akordeon açık/kapalı durumu — varsayılan olarak ana kategoriler açık
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "İş İlanları & Başvurular": true,
    "Mesajlaşma & Sohbet": true,
    "Ödeme & Cüzdan": true,
    "İş Süreci & Takip": false,
    "Sistem & Güvenlik": false,
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const saveFlash = useRef(new Animated.Value(0)).current;

  const flash = useCallback(() => {
    saveFlash.setValue(1);
    Animated.timing(saveFlash, {
      toValue: 0,
      duration: 2400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => setSaveState("idle"));
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
      setError(err instanceof Error ? err.message : "Bildirim tercihleri alınamadı.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void refreshPermission().then(setPermission);
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
        setError(err instanceof Error ? err.message : "Tercih kaydedilemedi.");
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
      setError(err instanceof Error ? err.message : "Varsayılana dönülemedi.");
      setSaveState("error");
    }
  }, [flash]);

  const askPermission = useCallback(async () => {
    const granted = await requestPermission();
    setPermission(granted);
    void refreshPermission().then(setPermission);
  }, []);

  const pushOff = settings ? !settings.pushEnabled : false;
  const activeCount = settings
    ? ALL_PREF_KEYS.filter((k) => settings[k] !== false).length
    : 0;

  return (
    <BrandRefreshScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { backgroundColor: colors.bg }]}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {/* ---------- 1. Ana Kontrol Kartı (Master Hero) ---------- */}
      <View style={styles.masterCard}>
        <View style={styles.masterTop}>
          <View style={styles.masterIconBox}>
            <BellIcon size={22} color={settings?.pushEnabled ? colors.primary : colors.muted} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={styles.masterTitle}>Push Bildirimleri</Text>
              <View style={[styles.statusBadge, { backgroundColor: settings?.pushEnabled ? colors.primarySoft : colors.cardSecondary }]}>
                <Text style={[styles.statusBadgeText, { color: settings?.pushEnabled ? colors.primary : colors.muted }]}>
                  {settings?.pushEnabled ? "Açık" : "Kapalı"}
                </Text>
              </View>
            </View>
            <Text style={styles.masterSub}>
              {settings?.pushEnabled
                ? `${activeCount} / ${ALL_PREF_KEYS.length} kategori bildirim gönderiyor`
                : "Tüm bildirimler ana anahtar üzerinden susturuldu"}
            </Text>
          </View>
          <SwitchToggle
            value={!!settings?.pushEnabled}
            disabled={busyKey === "pushEnabled"}
            onToggle={(v) => toggle("pushEnabled", v)}
            colors={colors}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.masterBottom}>
          <View style={[styles.permPill, permission === true ? styles.permPillOk : styles.permPillWarn]}>
            {permission === true ? (
              <CheckCircleIcon size={14} color={colors.emerald} />
            ) : (
              <AlertCircleIcon size={14} color={colors.rose} />
            )}
            <Text style={[styles.permPillText, { color: permission === true ? colors.emerald : colors.rose }]}>
              {permission === true ? "Cihaz Bildirim İzni Verildi" : "Cihaz İzni Kapalı"}
            </Text>
          </View>
          {permission === false && (
            <Pressable onPress={askPermission} style={styles.permActionBtn}>
              <Text style={styles.permActionText}>İzni Aç</Text>
            </Pressable>
          )}
        </View>

        {saveState === "saved" && (
          <Animated.View style={[styles.savedBanner, { opacity: saveFlash }]}>
            <CheckIcon size={14} color={colors.emerald} strokeWidth={2.5} />
            <Text style={styles.savedBannerText}>Ayarlarınız anında güncellendi</Text>
          </Animated.View>
        )}
      </View>

      {/* ---------- 2. İzin Eksikse Aksiyon Kartı ---------- */}
      {permission === false && (
        <View style={styles.permAlertCard}>
          <View style={styles.permAlertIconBox}>
            <AlertCircleIcon size={22} color={colors.rose} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.permAlertTitle}>Cihaz Bildirim İzni Gerekli</Text>
            <Text style={styles.permAlertDesc}>
              Telefon sistem bildirim izni kapalıyken yeni iş teklifleri ve sohbet mesajları kilit ekranına düşmez.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable onPress={askPermission} style={styles.alertPrimaryBtn}>
                <Text style={styles.alertPrimaryBtnText}>İzni Aç</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openSettings()} style={styles.alertOutlineBtn}>
                <Text style={styles.alertOutlineBtnText}>Ayarlara Git</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ---------- Hata Mesajı ---------- */}
      {error && (
        <Pressable onPress={() => setError(null)} style={styles.errorBanner}>
          <AlertCircleIcon size={16} color={colors.rose} />
          <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
        </Pressable>
      )}

      {/* ---------- 3. Kategorilere Göre Bildirim Tercihleri (Akordeon) ---------- */}
      {PREF_GROUPS.map((g) => {
        const isOpen = openGroups[g.title] !== false;
        const activeGroupCount = g.keys.filter((k) => settings?.[k] !== false).length;
        return (
          <View key={g.title} style={styles.groupCard}>
            <Pressable
              onPress={() => toggleGroup(g.title)}
              style={({ pressed }) => [styles.groupHead, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.groupIconBox}>
                <PrefVectorIcon name={g.iconName} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.groupTitle}>{g.title}</Text>
                <Text style={styles.groupHint}>{g.hint}</Text>
              </View>
              <View style={styles.groupMeta}>
                <View style={[styles.countBadge, activeGroupCount === g.keys.length && styles.countBadgeFull]}>
                  <Text style={[styles.countBadgeText, activeGroupCount === g.keys.length && styles.countBadgeTextFull]}>
                    {activeGroupCount}/{g.keys.length}
                  </Text>
                </View>
                {isOpen ? (
                  <ChevronDownIcon size={16} color={colors.muted} />
                ) : (
                  <ChevronRightIcon size={16} color={colors.muted} />
                )}
              </View>
            </Pressable>

            {isOpen && (
              <View style={styles.groupBody}>
                {g.keys.map((key, idx) => {
                  const meta = prefMeta(key as Exclude<NotificationPrefKey, "pushEnabled">);
                  const isChecked = settings?.[key] !== false;
                  return (
                    <View key={key}>
                      {idx > 0 && <View style={styles.rowDivider} />}
                      <View style={[styles.prefRow, pushOff && { opacity: 0.45 }]}>
                        <View style={styles.prefIconBox}>
                          <PrefVectorIcon
                            name={meta.iconName}
                            size={16}
                            color={isChecked && !pushOff ? colors.primary : colors.muted}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.prefLabel}>{meta.label}</Text>
                          <Text style={styles.prefDesc}>{meta.desc}</Text>
                        </View>
                        <SwitchToggle
                          value={isChecked}
                          disabled={pushOff || busyKey === key}
                          onToggle={(v) => toggle(key, v)}
                          colors={colors}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* ---------- 4. Toplu İşlemler ---------- */}
      <View style={styles.batchCard}>
        <View style={{ gap: 2 }}>
          <Text style={styles.batchTitle}>Toplu İşlemler</Text>
          <Text style={styles.batchSub}>Tüm kategorileri tek dokunuşla yönetin</Text>
        </View>
        <View style={styles.batchRow}>
          <Pressable
            onPress={enableAll}
            style={({ pressed }) => [styles.batchBtn, styles.batchBtnPrimary, pressed && { opacity: 0.85 }]}
          >
            <CheckIcon size={15} color="#fff" strokeWidth={2.5} />
            <Text style={styles.batchBtnTextPrimary}>Tümünü Aç</Text>
          </Pressable>
          <Pressable
            onPress={resetAll}
            style={({ pressed }) => [styles.batchBtn, styles.batchBtnOutline, pressed && { opacity: 0.85 }]}
          >
            <RotateCcwIcon size={14} color={colors.text} />
            <Text style={styles.batchBtnTextOutline}>Varsayılana Dön</Text>
          </Pressable>
        </View>
      </View>

      {/* ---------- 5. Güvence Notu ---------- */}
      <View style={styles.securityNote}>
        <ShieldIcon size={16} color={colors.emerald} />
        <Text style={styles.securityNoteText}>
          Güvenlik, karekodla iş onayı ve ödeme itirazı gibi kritik işlem bildirimleri tercihiniz ne olursa olsun hesap güvenliğiniz için uygulama içinde her zaman iletilir.
        </Text>
      </View>
    </BrandRefreshScrollView>
  );
}

// ---------------- STYLES ----------------
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      padding: 16,
      paddingBottom: 44,
      gap: 12,
    },

    // --- Master Hero Kartı ---
    masterCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
      shadowColor: "#0f172a",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    masterTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    masterIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    masterTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.2,
    },
    masterSub: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 16,
    },
    statusBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    statusBadgeText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
    },
    masterBottom: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    permPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    permPillOk: {
      backgroundColor: colors.emeraldBg,
    },
    permPillWarn: {
      backgroundColor: colors.roseBg,
    },
    permPillText: {
      fontSize: 11.5,
      fontWeight: "700",
    },
    permActionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    permActionText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
    },
    savedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.emeraldBg,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    savedBannerText: {
      fontSize: 11.5,
      fontWeight: "700",
      color: colors.emerald,
    },

    // --- İzin Uyarısı ---
    permAlertCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: colors.roseBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.rose + "35",
      padding: 14,
    },
    permAlertIconBox: {
      marginTop: 2,
    },
    permAlertTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.rose,
    },
    permAlertDesc: {
      fontSize: 12,
      color: colors.text,
      lineHeight: 17,
      opacity: 0.9,
    },
    alertPrimaryBtn: {
      backgroundColor: colors.rose,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
    },
    alertPrimaryBtnText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#fff",
    },
    alertOutlineBtn: {
      borderWidth: 1,
      borderColor: colors.rose + "50",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
    },
    alertOutlineBtnText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.rose,
    },

    // --- Hata Banner ---
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.roseBg,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.rose + "30",
    },
    errorText: {
      flex: 1,
      fontSize: 12.5,
      color: colors.rose,
      fontWeight: "600",
    },

    // --- Kategori Kartı (Akordeon) ---
    groupCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      shadowColor: "#0f172a",
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    groupHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    groupIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    groupTitle: {
      fontSize: 14.5,
      fontWeight: "800",
      color: colors.text,
    },
    groupHint: {
      fontSize: 11,
      color: colors.muted,
      lineHeight: 14,
    },
    groupMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    countBadge: {
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countBadgeFull: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary + "40",
    },
    countBadgeText: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.muted,
    },
    countBadgeTextFull: {
      color: colors.primary,
      fontWeight: "800",
    },
    groupBody: {
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingHorizontal: 14,
      paddingBottom: 4,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginLeft: 44,
    },
    prefRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 11,
    },
    prefIconBox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    prefLabel: {
      fontSize: 13.5,
      fontWeight: "700",
      color: colors.text,
    },
    prefDesc: {
      fontSize: 11,
      color: colors.muted,
      lineHeight: 15,
    },

    // --- Switch ---
    switchTrack: {
      width: 46,
      height: 26,
      borderRadius: 13,
      justifyContent: "center",
    },
    switchKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "#FFFFFF",
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 2.5,
      shadowOffset: { width: 0, height: 1.5 },
      elevation: 2,
    },

    // --- Toplu İşlemler ---
    batchCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    batchTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    batchSub: {
      fontSize: 11.5,
      color: colors.muted,
    },
    batchRow: {
      flexDirection: "row",
      gap: 10,
    },
    batchBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
    },
    batchBtnPrimary: {
      backgroundColor: colors.primary,
    },
    batchBtnTextPrimary: {
      fontSize: 12.5,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    batchBtnOutline: {
      backgroundColor: colors.cardSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    batchBtnTextOutline: {
      fontSize: 12.5,
      fontWeight: "700",
      color: colors.text,
    },

    // --- Güvenlik Notu ---
    securityNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    securityNoteText: {
      flex: 1,
      fontSize: 11.5,
      color: colors.muted,
      lineHeight: 17,
    },
  });

let styles = createStyles(lightColors);
