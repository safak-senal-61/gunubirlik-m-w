import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton, useTheme } from "@/components/ui";
import { LockIcon } from "@/components/icons";

interface GuestGateProps {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  description?: string;
  benefits?: string[];
  onRequestLogin?: () => void;
  onLogin?: () => void;
}

export function GuestGate({
  icon,
  title,
  desc,
  description,
  benefits = [
    "İşverenlerle anlık ve güvenli iletişim",
    "Başvuru süreçlerinizi canlı takip",
    "Hakediş ve cüzdan hareketlerinizi yönetme",
  ],
  onRequestLogin,
  onLogin,
}: GuestGateProps) {
  const { colors } = useTheme();
  const handleLogin = onRequestLogin ?? onLogin;
  const descriptionText = description ?? desc ?? "";

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
          {icon ?? <LockIcon size={26} color={colors.primary} />}
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.desc, { color: colors.muted }]}>{descriptionText}</Text>

        {benefits.length > 0 && (
          <View style={[styles.benefitsBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            {benefits.map((b, idx) => (
              <View key={idx} style={styles.benefitRow}>
                <View style={[styles.checkCircle, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.checkText, { color: colors.primary }]}>✓</Text>
                </View>
                <Text style={[styles.benefitText, { color: colors.text }]}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionWrap}>
          <PrimaryButton
            label="Giriş Yap veya Kayıt Ol"
            onPress={() => handleLogin?.()}
            variant="primary"
          />
        </View>

        <Text style={[styles.subHint, { color: colors.muted }]}>
          Hesabınız yoksa Google veya e-posta ile saniyeler içinde ücretsiz oluşturabilirsiniz.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 19,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  benefitsBox: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    fontSize: 11,
    fontWeight: "800",
  },
  benefitText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
  actionWrap: {
    width: "100%",
    marginTop: 4,
  },
  subHint: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_500Medium",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
