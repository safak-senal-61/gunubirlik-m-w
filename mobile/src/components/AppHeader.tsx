import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { BellIcon } from "./icons";
import { C } from "./ui";

const BRAND_LOGO = require("../../assets/brand-logo.png");

interface AppHeaderProps {
  unreadCount?: number;
  onPressNotifications?: () => void;
  title?: string;
  subtitle?: string;
}

export function AppHeader({
  unreadCount = 0,
  onPressNotifications,
  title,
  subtitle,
}: AppHeaderProps) {
  const { user } = useAuth();
  const role = user?.role;
  const isEmployer = role === "EMPLOYER";
  const isAdmin = (role as string) === "ADMIN" || (role as string) === "SUPERADMIN";

  const roleLabel = isAdmin ? "Yönetici" : isEmployer ? "İşveren" : "İş Arayan";

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Brand Lockup — Aligned flush to the far left with User's Official Logo */}
        <View style={styles.brandBox}>
          <Image
            source={BRAND_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>Günübirlik</Text>
        </View>

        {/* Right Actions: Clean Role Pill (No dot at the beginning) & Notification Bell */}
        <View style={styles.rightActions}>
          {user && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          )}

          {onPressNotifications && (
            <Pressable
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
              onPress={onPressNotifications}
              hitSlop={8}
              accessibilityLabel="Bildirimler"
              accessibilityRole="button"
            >
              <BellIcon size={18} color="#141615" strokeWidth={1.8} />
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
          {title && <Text style={styles.headerTitle}>{title}</Text>}
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F6F5F2",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E6DF",
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
    color: "#141615",
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
    backgroundColor: "#EAF3EE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#C5DDD0",
  },
  roleText: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
    color: "#0D6847",
    letterSpacing: 0.1,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E0D8",
    position: "relative",
  },
  iconButtonPressed: {
    backgroundColor: "#ECEAE4",
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
    color: "#141615",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "#5C615E",
    marginTop: 2,
  },
});
