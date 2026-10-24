import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BriefcaseIcon,
  BookmarkIcon,
  ApplicationsIcon,
  MessageIcon,
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
  const activeAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: isActive ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [isActive, activeAnim]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.88,
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

  const iconScale = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const iconTranslateY = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

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
        {/* Animated Active Soft Pill Background */}
        <Animated.View
          style={[
            styles.activePill,
            {
              opacity: activeAnim,
              transform: [{ scale: activeAnim }],
            },
          ]}
        />

        {/* Animated Icon with Spring Bounce */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: iconScale }, { translateY: iconTranslateY }],
            },
          ]}
        >
          {item.renderIcon(isActive)}

          {badgeCount && badgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 9 ? "9+" : badgeCount}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Tab Label */}
        <Text
          style={[
            styles.tabLabel,
            isActive ? styles.tabLabelActive : styles.tabLabelInactive,
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>

        {/* Active Dot Indicator */}
        <Animated.View
          style={[
            styles.activeDot,
            {
              opacity: activeAnim,
              transform: [{ scale: activeAnim }],
            },
          ]}
        />
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
            <BriefcaseIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "applications",
          label: "Başvurular",
          renderIcon: (active) => (
            <ApplicationsIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "messages",
          label: "Mesajlar",
          renderIcon: (active) => (
            <MessageIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "profile",
          label: "Hesap",
          renderIcon: (active) => (
            <UserIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
      ]
    : [
        {
          key: "jobs",
          label: "İşler",
          renderIcon: (active) => (
            <BriefcaseIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "saved",
          label: "Kayıtlı",
          renderIcon: (active) => (
            <BookmarkIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "applications",
          label: "Başvurular",
          renderIcon: (active) => (
            <ApplicationsIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "messages",
          label: "Mesajlar",
          renderIcon: (active) => (
            <MessageIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
          ),
        },
        {
          key: "profile",
          label: "Hesap",
          renderIcon: (active) => (
            <UserIcon size={20} color={active ? "#0D6847" : "#717673"} strokeWidth={active ? 2.2 : 1.8} />
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
    borderTopColor: "#E8E6DF",
    paddingTop: 5,
    paddingBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    position: "relative",
    minWidth: 54,
  },
  activePill: {
    position: "absolute",
    top: 0,
    left: 2,
    right: 2,
    bottom: 2,
    backgroundColor: "#EAF3EE",
    borderRadius: 12,
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
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: "#0D6847",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  tabLabelInactive: {
    color: "#717673",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
  },
  activeDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "#0D6847",
    marginTop: 2,
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
