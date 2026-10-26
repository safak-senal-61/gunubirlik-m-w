import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTheme, type ThemeColors } from "./ui";
import { useNetworkStatus } from "@/lib/network-status";
import {
  BookmarkIcon,
  MessageIcon,
  BriefcaseIcon,
  RotateCcwIcon,
  XIcon,
  ClockIcon,
  CheckIcon,
} from "./icons";

interface OfflineHubProps {
  onNavigateTab?: (tab: "jobs" | "saved" | "applications" | "messages" | "notifications" | "profile") => void;
  onOpenBlog?: () => void;
}

export function OfflineHub({ onNavigateTab, onOpenBlog }: OfflineHubProps) {
  const { colors, isDark } = useTheme();
  const { isOffline, checkConnection } = useNetworkStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRetry = async () => {
    setChecking(true);
    setFeedback(null);
    const ok = await checkConnection();
    setChecking(false);
    if (ok) {
      setFeedback("İnternet bağlantısı sağlandı!");
      setTimeout(() => setModalOpen(false), 900);
    } else {
      setFeedback("Halen internet bağlantısı bulunamadı.");
    }
  };

  // Çevrimdışı değilse en üst bant görünmez
  if (!isOffline && !modalOpen) return null;

  return (
    <>
      {/* En Üst Katman: Çevrimdışı Uyarı Çubuğu */}
      {isOffline && (
        <View
          style={[
            styles.topBanner,
            {
              backgroundColor: isDark ? "#2A1D07" : "#FEF3C7",
              borderColor: isDark ? "#78350F" : "#FDE68A",
            },
          ]}
        >
          <View style={styles.topBannerContent}>
            <View style={styles.dotIndicator} />
            <Text style={[styles.topBannerText, { color: isDark ? "#FDE68A" : "#92400E" }]}>
              Çevrimdışı Mod · İnternetsiz özellikler aktif
            </Text>
          </View>

          <View style={styles.bannerActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setModalOpen(true)}
              style={[styles.bannerPill, { backgroundColor: isDark ? "#451A03" : "#FDE68A" }]}
            >
              <Text style={[styles.bannerPillText, { color: isDark ? "#FCD34D" : "#78350F" }]}>
                Neler Yapılabilir? ▼
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleRetry}
              style={[styles.retryIconBtn, { backgroundColor: isDark ? "#451A03" : "#FDE68A" }]}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : (
                <RotateCcwIcon size={14} color="#D97706" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* İnternetsiz Yapabileceklerimiz: Detaylı Bilgi & Hızlı Erişim Modalı */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  İnternetsiz Neler Yapabilirsiniz?
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                  Bağlantınız olmasa dahi cihazınızda saklanan verilerle çalışmaya devam edin.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={10}>
                <XIcon size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.featuresList}>
                {/* 1. Kayıtlı İlanlar */}
                <TouchableOpacity
                  style={[styles.featureCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setModalOpen(false);
                    onNavigateTab?.("saved");
                  }}
                >
                  <View style={[styles.featureIconBox, { backgroundColor: colors.primarySoft }]}>
                    <BookmarkIcon size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>Kaydedilen İlanlarım</Text>
                    <Text style={[styles.featureDesc, { color: colors.muted }]}>
                      Daha önce kaydettiğiniz tüm iş ilanlarını, ücretlerini ve detaylarını internetsiz inceleyin.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Kayıtlı Mesajlar & Sohbetler */}
                <TouchableOpacity
                  style={[styles.featureCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setModalOpen(false);
                    onNavigateTab?.("messages");
                  }}
                >
                  <View style={[styles.featureIconBox, { backgroundColor: colors.primarySoft }]}>
                    <MessageIcon size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>Sohbet ve Mesaj Geçmişi</Text>
                    <Text style={[styles.featureDesc, { color: colors.muted }]}>
                      İşverenlerle yaptığınız önceki konuşmaları, adresleri ve paylaşılan ilan kartlarını okuyun.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Günübirlik Saha Rehberi */}
                <TouchableOpacity
                  style={[styles.featureCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setModalOpen(false);
                    onOpenBlog?.();
                  }}
                >
                  <View style={[styles.featureIconBox, { backgroundColor: colors.primarySoft }]}>
                    <BriefcaseIcon size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>Günübirlik Saha Rehberi</Text>
                    <Text style={[styles.featureDesc, { color: colors.muted }]}>
                      2026 günlük yevmiye tarifeleri ve çalışan hakları rehber yazılarını çevrimdışı okuyun.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 4. Başvuru ve QR Durumu */}
                <TouchableOpacity
                  style={[styles.featureCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setModalOpen(false);
                    onNavigateTab?.("applications");
                  }}
                >
                  <View style={[styles.featureIconBox, { backgroundColor: colors.primarySoft }]}>
                    <CheckIcon size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>Başvurular & Kabul Edilen İşler</Text>
                    <Text style={[styles.featureDesc, { color: colors.muted }]}>
                      Onaylanmış iş başvurularınızın mesai başlatma QR kodunu şantiyede çevrimdışı gösterin.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {feedback && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "PlusJakartaSans_600SemiBold",
                  color: feedback.includes("sağlandı") ? colors.primary : colors.amber,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                {feedback}
              </Text>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <RotateCcwIcon size={16} color="#FFFFFF" />
                  <Text style={styles.retryButtonText}>Bağlantıyı Yeniden Kontrol Et</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  topBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  topBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  dotIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#D97706",
  },
  topBannerText: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  bannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bannerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bannerPillText: {
    fontSize: 10.5,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  retryIconBtn: {
    padding: 4,
    borderRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 26,
    borderTopWidth: 1,
    gap: 12,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_400Regular",
    marginTop: 2,
  },
  featuresList: {
    gap: 8,
    paddingVertical: 6,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  featureDesc: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 15,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
  },
});
