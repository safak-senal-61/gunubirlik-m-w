import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { BellIcon, MoonIcon, SunIcon } from "./icons";
import { useTheme } from "./ui";

const BRAND_LOGO = require("../../assets/brand-logo.png");

interface AppHeaderProps {
  unreadCount?: number;
  onPressNotifications?: () => void;
  onRequestLogin?: () => void;
  title?: string;
  subtitle?: string;
}

export function AppHeader({
  unreadCount = 0,
  onPressNotifications,
  onRequestLogin,
  title,
  subtitle,
}: AppHeaderProps) {
  const { user } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const role = user?.role;
  const isEmployer = role === "EMPLOYER";
  const isAdmin = (role as string) === "ADMIN" || (role as string) === "SUPERADMIN";

  const roleLabel = isAdmin ? "Yönetici" : isEmployer ? "İşveren" : "İş Arayan";

  return (
    <View style={[styles.container, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
      <View style={styles.topRow}>
        {/* Brand Lockup — Aligned flush to the far left with User's Official Logo */}
        <View style={styles.brandBox}>
          <Image
            source={BRAND_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={[styles.brandTitle, { color: colors.text }]}>Günübirlik</Text>
        </View>

        {/* Right Actions: Role Pill / Login Button + Theme Toggle (Dark/Light) + Notification Bell */}
        <View style={styles.rightActions}>
          {user ? (
            <View style={[styles.roleBadge, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
              <Text style={[styles.roleText, { color: colors.primary }]}>{roleLabel}</Text>
            </View>
          ) : onRequestLogin ? (
            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                { backgroundColor: colors.primary, borderColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}
              onPress={onRequestLogin}
              hitSlop={6}
            >
              <Text style={styles.loginButtonText}>Giriş Yap</Text>
            </Pressable>
          ) : null}

          {/* Hızlı Tema Değiştirme Butonu (Karanlık / Aydınlık Mod) */}
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.75 },
            ]}
            onPress={toggleTheme}
            hitSlop={8}
            accessibilityLabel={isDark ? "Açık Temaya Geç" : "Karanlık Temaya Geç"}
            accessibilityRole="button"
          >
            {isDark ? (
              <SunIcon size={17} color="#F59E0B" />
            ) : (
              <MoonIcon size={17} color={colors.text} />
            )}
          </Pressable>

          {/* Bildirim zili sadece giriş yapmış kullanıcılar için görünür, misafir modunda gizlenir */}
          {user && onPressNotifications && (
            <Pressable
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}
              onPress={onPressNotifications}
              hitSlop={8}
              accessibilityLabel="Bildirimler"
              accessibilityRole="button"
            >
              <BellIcon size={18} color={colors.text} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <View style={styles.badgeDot}>
                  {unreadCount > 9 ? (
                    <Text style={styles.badgeText}>9+</Text>
                  ) : unreadCount > 1 ? (
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {(title || subtitle) && (
        <View style={styles.titleRow}>
          {title && <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>}
          {subtitle && <Text style={[styles.headerSubtitle, { color: colors.muted }]}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 38,
  },
  brandBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 9,
    marginLeft: 0,
    paddingLeft: 0,
  },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandTitle: {
    fontSize: 19,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  loginButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  loginButtonText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  badgeDot: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2.5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
  },
  titleRow: {
    marginTop: 6,
    paddingBottom: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    marginTop: 2,
  },
});
