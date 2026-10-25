import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  isDark: boolean;
  bg: string;
  card: string;
  cardSecondary: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  inputBg: string;
  headerBg: string;
  tabBarBg: string;
  chipBg: string;
  chipActiveBg: string;
  chipActiveText: string;
  badgeBg: string;
  badgeText: string;
  amber: string;
  amberBg: string;
  indigo: string;
  indigoBg: string;
  emerald: string;
  emeraldBg: string;
  rose: string;
  roseBg: string;
  stone: string;
  stoneBg: string;
}

export const lightColors: ThemeColors = {
  isDark: false,
  bg: "#F6F5F2",
  card: "#FFFFFF",
  cardSecondary: "#F0EFEB",
  text: "#141615",
  textSecondary: "#4A4E4B",
  muted: "#5C615E",
  border: "#E2E0D8",
  borderLight: "#ECEAE4",
  primary: "#0D6847",
  primaryDark: "#095237",
  primarySoft: "#EAF3EE",
  accent: "#5CD6A5",
  danger: "#C84B31",
  dangerSoft: "#FCEBE8",
  success: "#0D6847",
  successSoft: "#EAF3EE",
  inputBg: "#FFFFFF",
  headerBg: "#F6F5F2",
  tabBarBg: "#FFFFFF",
  chipBg: "#FFFFFF",
  chipActiveBg: "#0D6847",
  chipActiveText: "#FFFFFF",
  badgeBg: "#EAF3EE",
  badgeText: "#0D6847",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  indigo: "#0D6847",
  indigoBg: "#EAF3EE",
  emerald: "#0D6847",
  emeraldBg: "#EAF3EE",
  rose: "#C84B31",
  roseBg: "#FCEBE8",
  stone: "#5C615E",
  stoneBg: "#ECEAE4",
};

export const darkColors: ThemeColors = {
  isDark: true,
  bg: "#0B1118",
  card: "#131C26",
  cardSecondary: "#1A2533",
  text: "#F1F5F9",
  textSecondary: "#CBD5E1",
  muted: "#8899A6",
  border: "#202E3D",
  borderLight: "#18232E",
  primary: "#10B981",
  primaryDark: "#059669",
  primarySoft: "#063D2E",
  accent: "#34D399",
  danger: "#EF4444",
  dangerSoft: "#3B1818",
  success: "#10B981",
  successSoft: "#063D2E",
  inputBg: "#172330",
  headerBg: "#0B1118",
  tabBarBg: "#0F1722",
  chipBg: "#172330",
  chipActiveBg: "#10B981",
  chipActiveText: "#FFFFFF",
  badgeBg: "#063D2E",
  badgeText: "#34D399",
  amber: "#F59E0B",
  amberBg: "#3A2805",
  indigo: "#10B981",
  indigoBg: "#063D2E",
  emerald: "#10B981",
  emeraldBg: "#063D2E",
  rose: "#EF4444",
  roseBg: "#3B1818",
  stone: "#8899A6",
  stoneBg: "#1A2533",
};

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "@theme_mode";

// Global active colors reference for static C fallback
export let activeThemeColors: ThemeColors = lightColors;

const ThemeContext = createContext<ThemeContextType>({
  themeMode: "system",
  isDark: false,
  colors: lightColors,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setThemeModeState(saved);
      }
    });
  }, []);

  const isDark =
    themeMode === "dark" || (themeMode === "system" && systemScheme === "dark");

  const colors = isDark ? darkColors : lightColors;
  activeThemeColors = colors;

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setThemeMode(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
