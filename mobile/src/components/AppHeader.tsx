import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { BellIcon, MapPinIcon } from "./icons";
import { C } from "./ui";

const LOGO = require("../../assets/logo-wordmark.png");

interface AppHeaderProps {
  unreadCount?: number;
  onPressNotifications?: () => void;
  onPressProfile?: () => void;
  title?: string;
  subtitle?: string;
}

export function AppHeader({
  unreadCount = 0,
  onPressNotifications,
  onPressProfile,
  title,
  subtitle,
}: AppHeaderProps) {
  const { user } = useAuth();
  const isEmployer = user?.role === "EMPLOYER";

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandBox}>
          <Image
            source={LOGO}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.rightActions}>
          {user && (
            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.roleText}>
                {isEmployer ? "İŞVEREN" : "İŞ ARAYAN"}
              </Text>
            </View>
          )}

          {onPressNotifications && (
            <Pressable
              style={styles.iconButton}
              onPress={onPressNotifications}
              hitSlop={8}
              accessibilityLabel="Bildirimler"
            >
              <BellIcon size={20} color={C.text} />
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
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 10,
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
  },
  logoImage: {
    height: 30,
    width: 140,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C5DDD0",
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.primary,
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    position: "relative",
  },
  badgeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  titleRow: {
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
});
