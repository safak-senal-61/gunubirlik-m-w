import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BriefcaseIcon,
  BookmarkIcon,
  ApplicationsIcon,
  MessageIcon,
  UserIcon,
} from "./icons";

export type TabKey = "jobs" | "saved" | "applications" | "messages" | "notifications" | "profile";

interface TabItemConfig {
  key: TabKey;
  label: string;
  renderIcon: (isActive: boolean) => React.ReactNode;
}

interface AnimatedTabBarProps {
  currentTab: TabKey;
  onPressTab: (tab: TabKey) => void;
  isEmployer: boolean;
  unreadCount?: number;
}

function TabButton({
  item,
  isActive,
  onPress,
  badgeCount,
}: {
  item: TabItemConfig;
  isActive: boolean;
  onPress: () => void;
  badgeCount?: number;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.9,
      speed: 60,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      style={styles.tabButton}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale: pressScale }] }]}>
        {/* Sadece İkon ve İsim — Etrafında KARE ÇİZGİ VEYA KUTU YOK */}
        <View style={styles.iconContainer}>
          {item.renderIcon(isActive)}

          {badgeCount && badgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 9 ? "9+" : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={[
            styles.tabLabel,
            isActive ? styles.tabLabelActive : styles.tabLabelInactive,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function AnimatedTabBar({
  currentTab,
  onPressTab,
  isEmployer,
  unreadCount,
}: AnimatedTabBarProps) {
  const tabs: TabItemConfig[] = isEmployer
    ? [
        {
          key: "jobs",
          label: "Panel",
          renderIcon: (active) => (
            <BriefcaseIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "applications",
          label: "Başvurular",
          renderIcon: (active) => (
            <ApplicationsIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "messages",
          label: "Mesajlar",
          renderIcon: (active) => (
            <MessageIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "profile",
          label: "Hesap",
          renderIcon: (active) => (
            <UserIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
      ]
    : [
        {
          key: "jobs",
          label: "İşler",
          renderIcon: (active) => (
            <BriefcaseIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "saved",
          label: "Kayıtlı",
          renderIcon: (active) => (
            <BookmarkIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "applications",
          label: "Başvurular",
          renderIcon: (active) => (
            <ApplicationsIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "messages",
          label: "Mesajlar",
          renderIcon: (active) => (
            <MessageIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "profile",
          label: "Hesap",
          renderIcon: (active) => (
            <UserIcon size={22} color={active ? "#0D6847" : "#8C928E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
      ];

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBarInner}>
        {tabs.map((item) => (
          <TabButton
            key={item.key}
            item={item}
            isActive={currentTab === item.key}
            onPress={() => onPressTab(item.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EAE8E2",
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  iconContainer: {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: "#0D6847",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  tabLabelInactive: {
    color: "#8C928E",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#DC2626",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
  },
});
