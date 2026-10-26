import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  type AlertButton,
  type AlertOptions,
} from "react-native";
import Modal from "react-native-modal";
import { useTheme, type ThemeColors } from "./ui";
import {
  LockIcon,
  TrashIcon,
  VerifiedCheckIcon,
  XCircleIcon,
  InfoIcon,
} from "./icons";

const { width } = Dimensions.get("window");

export type DialogType = "info" | "success" | "warning" | "danger" | "auth";

export interface AppDialogConfig {
  title: string;
  message?: string;
  type?: DialogType;
  icon?: React.ReactNode;
  buttons?: AlertButton[];
  cancelable?: boolean;
}

let dialogHandler: ((config: AppDialogConfig | null) => void) | null = null;
let queuedConfig: AppDialogConfig | null = null;

/**
 * Modern popup diyalog penceresini açar.
 */
export function showAppDialog(config: AppDialogConfig) {
  if (dialogHandler) {
    dialogHandler(config);
  } else {
    queuedConfig = config;
  }
}

/**
 * Açık olan popup diyalog penceresini kapatır.
 */
export function hideAppDialog() {
  if (dialogHandler) {
    dialogHandler(null);
  }
}

/**
 * Başlık ve metne göre en uygun diyalog tipini ve ikonu otomatik belirler.
 */
function detectDialogType(title: string, message?: string, buttons?: AlertButton[]): DialogType {
  const combined = `${title} ${message ?? ""}`.toLowerCase();
  const hasDestructive = buttons?.some((b) => b.style === "destructive");

  if (
    hasDestructive ||
    combined.includes("sil") ||
    combined.includes("kaldır") ||
    combined.includes("hata") ||
    combined.includes("başarısız")
  ) {
    return "danger";
  }

  if (
    combined.includes("başarılı") ||
    combined.includes("tamam") ||
    combined.includes("kopyalandı") ||
    combined.includes("güncellendi") ||
    combined.includes("doğrulandı") ||
    combined.includes("alındı")
  ) {
    return "success";
  }

  if (
    combined.includes("giriş") ||
    combined.includes("izin") ||
    combined.includes("gerekli") ||
    combined.includes("uyarı") ||
    combined.includes("dikkat")
  ) {
    return "auth";
  }

  return "info";
}

let isAlertInstalled = false;
const originalAlert = Alert.alert;

/**
 * React Native'in standart Alert.alert çağrılarını yakalar ve modern popup diyalog kütüphanesine yönlendirir.
 */
export function installAppDialog() {
  if (isAlertInstalled) return;
  isAlertInstalled = true;

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) => {
    const dialogButtons: AlertButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: "Tamam", style: "default" }];

    const type = detectDialogType(title, message, dialogButtons);

    showAppDialog({
      title,
      message,
      type,
      buttons: dialogButtons,
      cancelable: options?.cancelable ?? true,
    });
  };
}

export function restoreNativeAlert() {
  if (!isAlertInstalled) return;
  Alert.alert = originalAlert;
  isAlertInstalled = false;
}

/**
 * Uygulamanın en üst seviyesine (ThemeProvider içine) eklenen şık Modal Diyalog Sağlayıcısı.
 */
export function AppDialogProvider() {
  const { colors, isDark } = useTheme();
  const [config, setConfig] = useState<AppDialogConfig | null>(null);

  useEffect(() => {
    dialogHandler = (cfg) => setConfig(cfg);
    if (queuedConfig) {
      setConfig(queuedConfig);
      queuedConfig = null;
    }
    return () => {
      dialogHandler = null;
    };
  }, []);

  const handleClose = useCallback(() => {
    if (config?.cancelable !== false) {
      const cancelBtn = config?.buttons?.find((b) => b.style === "cancel");
      setConfig(null);
      if (cancelBtn?.onPress) {
        setTimeout(() => cancelBtn.onPress?.(), 120);
      }
    }
  }, [config]);

  const handleButtonPress = useCallback((btn: AlertButton) => {
    setConfig(null);
    if (btn.onPress) {
      setTimeout(() => btn.onPress?.(), 120);
    }
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!config) return null;

  const type = config.type ?? detectDialogType(config.title, config.message, config.buttons);

  const getIconBadge = () => {
    if (config.icon) return config.icon;

    switch (type) {
      case "danger":
        return <TrashIcon size={26} color={colors.danger} strokeWidth={2.2} />;
      case "success":
        return <VerifiedCheckIcon size={28} color={colors.primary} />;
      case "auth":
      case "warning":
        return <LockIcon size={26} color={colors.amber} strokeWidth={2.2} />;
      case "info":
      default:
        return <InfoIcon size={26} color={colors.primary} strokeWidth={2.2} />;
    }
  };

  const getBadgeColors = () => {
    switch (type) {
      case "danger":
        return {
          bg: isDark ? "rgba(239, 68, 68, 0.16)" : "#FEE2E2",
          border: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
        };
      case "success":
        return {
          bg: isDark ? "rgba(16, 185, 129, 0.16)" : "#DCFCE7",
          border: isDark ? "rgba(16, 185, 129, 0.3)" : "#BBF7D0",
        };
      case "auth":
      case "warning":
        return {
          bg: isDark ? "rgba(245, 158, 11, 0.16)" : "#FEF3C7",
          border: isDark ? "rgba(245, 158, 11, 0.3)" : "#FDE68A",
        };
      case "info":
      default:
        return {
          bg: colors.primarySoft,
          border: colors.border,
        };
    }
  };

  const badgeColors = getBadgeColors();
  const buttons = config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: "Tamam" }];
  const isMultiStacked = buttons.length > 2;

  return (
    <Modal
      isVisible={!!config}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      animationIn="zoomIn"
      animationOut="zoomOut"
      animationInTiming={220}
      animationOutTiming={180}
      backdropTransitionInTiming={220}
      backdropTransitionOutTiming={180}
      backdropOpacity={isDark ? 0.65 : 0.45}
      useNativeDriver
      avoidKeyboard
      style={styles.modalRoot}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Yuvarlak Durum İkon Rozeti */}
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: badgeColors.bg,
              borderColor: badgeColors.border,
            },
          ]}
        >
          {getIconBadge()}
        </View>

        {/* Başlık */}
        <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>

        {/* Mesaj İçeriği */}
        {config.message ? (
          <Text style={[styles.message, { color: colors.muted }]}>{config.message}</Text>
        ) : null}

        {/* Butonlar */}
        <View style={isMultiStacked ? styles.buttonStack : styles.buttonRow}>
          {buttons.map((btn, index) => {
            const isCancel = btn.style === "cancel";
            const isDestructive = btn.style === "destructive";
            const isPrimary = !isCancel;

            let btnBg = colors.primary;
            let btnTextColor = "#FFFFFF";
            let btnBorder = "transparent";

            if (isCancel) {
              btnBg = colors.cardSecondary;
              btnTextColor = colors.text;
              btnBorder = colors.border;
            } else if (isDestructive) {
              btnBg = colors.danger;
              btnTextColor = "#FFFFFF";
            }

            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => handleButtonPress(btn)}
                style={[
                  styles.button,
                  !isMultiStacked && { flex: 1 },
                  {
                    backgroundColor: btnBg,
                    borderColor: btnBorder,
                    borderWidth: isCancel ? 1 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: btnTextColor,
                      fontFamily: isPrimary
                        ? "PlusJakartaSans_700Bold"
                        : "PlusJakartaSans_600SemiBold",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {btn.text ?? "Tamam"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalRoot: {
      margin: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: Math.min(width - 44, 380),
      borderRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 20,
      alignItems: "center",
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 10,
    },
    iconCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      borderWidth: 1,
    },
    title: {
      fontSize: 18,
      fontFamily: "PlusJakartaSans_700Bold",
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    message: {
      fontSize: 13.5,
      fontFamily: "PlusJakartaSans_500Medium",
      textAlign: "center",
      lineHeight: 19,
      marginBottom: 20,
      paddingHorizontal: 6,
    },
    buttonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      width: "100%",
    },
    buttonStack: {
      flexDirection: "column",
      gap: 8,
      width: "100%",
    },
    button: {
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: "600",
    },
  });
