import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Linking,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useTheme, type ThemeColors } from "./ui";
import { ArrowLeftIcon, ExternalLinkIcon, RotateCcwIcon, XIcon } from "./icons";

interface BlogWebViewModalProps {
  visible: boolean;
  url: string;
  title?: string;
  onClose: () => void;
}

export function BlogWebViewModal({
  visible,
  url,
  title = "Günübirlik Rehber & Blog",
  onClose,
}: BlogWebViewModalProps) {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [navTitle, setNavTitle] = useState(title);

  const handleOpenExternal = () => {
    void Linking.openURL(url);
  };

  const handleReload = () => {
    webViewRef.current?.reload();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.headerBg }]}>
        {/* Üst Navigasyon Çubuğu */}
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Geri Dön"
          >
            <ArrowLeftIcon size={20} color={colors.text} strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {navTitle}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]} numberOfLines={1}>
              gunubirlik.qrders.com.tr
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleReload}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Yenile"
            >
              <RotateCcwIcon size={17} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleOpenExternal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Tarayıcıda Aç"
            >
              <ExternalLinkIcon size={17} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Kapat"
            >
              <XIcon size={19} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* WebView İçeriği */}
        <View style={[styles.webviewContainer, { backgroundColor: colors.bg }]}>
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={(navState) => {
              if (navState.title && !navState.title.includes("404")) {
                setNavTitle(navState.title);
              }
            }}
            domStorageEnabled
            javaScriptEnabled
            allowsBackForwardNavigationGestures
            style={{ backgroundColor: colors.bg }}
          />

          {loading && (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.bg }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.muted }]}>
                Yazı yükleniyor…
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerButton: {
    padding: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: "PlusJakartaSans_500Medium",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  webviewContainer: {
    flex: 1,
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
  },
});
