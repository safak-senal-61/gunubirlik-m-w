import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { BellIcon } from "./icons";
import { C } from "./ui";

const LOGO = require("../../assets/logo-wordmark.png");

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
                {isEmployer ? "İşveren" : "İş Arayan"}
              </Text>
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
              <BellIcon size={18} color={C.text} strokeWidth={2} />
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
    backgroundColor: C.bg, // Seamless integration with #F6F5F2
    borderBottomWidth: 1,
    borderBottomColor: "#E2E0D8",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
  },
  brandBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  logoImage: {
    height: 30,
    width: 132,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EAF3EE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C5DDD0",
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0D6847",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0D6847",
    letterSpacing: -0.2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E0D8",
    position: "relative",
  },
  iconButtonPressed: {
    backgroundColor: "#F0EFEA",
  },
  badgeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#DC2626",
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
    marginTop: 6,
    paddingBottom: 4,
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
