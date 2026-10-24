import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BriefcaseIcon,
  BookmarkIcon,
  ApplicationsIcon,
  MessageIcon,
  BellIcon,
  UserIcon,
} from "./icons";
import { C } from "./ui";

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
  unreadCount: number;
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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(pillOpacity, {
      toValue: isActive ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isActive, pillOpacity]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
      tension: 60,
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
      <Animated.View style={[styles.tabContent, { transform: [{ scale: scaleAnim }] }]}>
        {/* Aktif Pill Arka Planı (Web sitesi EAF3EE zümrüt yumuşaklığı) */}
        <Animated.View
          style={[
            styles.activePill,
            {
              opacity: pillOpacity,
            },
          ]}
        />

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
            <BriefcaseIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "applications",
          label: "Başvuru",
          renderIcon: (active) => (
            <ApplicationsIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "messages",
          label: "Mesajlar",
          renderIcon: (active) => (
            <MessageIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "profile",
          label: "Hesap",
          renderIcon: (active) => (
            <UserIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
      ]
    : [
        {
          key: "jobs",
          label: "İşler",
          renderIcon: (active) => (
            <BriefcaseIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "saved",
          label: "Kayıtlı",
          renderIcon: (active) => (
            <BookmarkIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "applications",
          label: "Başvuru",
          renderIcon: (active) => (
            <ApplicationsIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "messages",
          label: "Mesajlar",
          renderIcon: (active) => (
            <MessageIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "profile",
          label: "Hesap",
          renderIcon: (active) => (
            <UserIcon size={20} color={active ? C.primary : "#5C615E"} strokeWidth={active ? 2.2 : 1.8} />
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
            badgeCount={item.key === "notifications" ? unreadCount : undefined}
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
    borderTopColor: C.border,
    paddingTop: 4,
    paddingBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 8,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    top: 2,
    left: 4,
    right: 4,
    bottom: 2,
    backgroundColor: C.primarySoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C5DDD0",
  },
  iconContainer: {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: C.primary,
    fontWeight: "700",
  },
  tabLabelInactive: {
    color: "#5C615E",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: C.danger,
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
