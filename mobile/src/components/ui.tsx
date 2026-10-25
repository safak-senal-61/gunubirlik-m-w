import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  activeThemeColors,
  darkColors,
  lightColors,
  useTheme,
  ThemeProvider,
  type ThemeColors,
  type ThemeMode,
} from "@/lib/theme";

export { useTheme, ThemeProvider, type ThemeColors, type ThemeMode };

/**
 * Dinamik Renk Paleti Proxy'si
 * - Hem aydınlık hem karanlık temada anlık olarak aktif tema renklerini döner.
 */
export const C: ThemeColors = new Proxy(lightColors, {
  get(target, prop: keyof ThemeColors) {
    return activeThemeColors[prop] ?? target[prop];
  },
});

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost" | "danger";
}) {
  const { colors } = useTheme();
  const variant = props.variant ?? "primary";
  const bg =
    variant === "primary" ? colors.primary
    : variant === "danger" ? colors.danger
    : "transparent";
  const fg =
    variant === "primary" || variant === "danger" ? "#fff"
    : variant === "outline" ? colors.primary
    : colors.muted;

  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        variant === "outline" && { borderWidth: 1, borderColor: colors.primary },
        (props.disabled || props.loading) && styles.btnDisabled,
        pressed && styles.pressed,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{props.label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.chipActiveBg : colors.chipBg,
          borderColor: active ? colors.chipActiveBg : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.chipActiveText : colors.muted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({
  emoji,
  icon,
  title,
  subtitle,
}: {
  emoji?: string;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={[styles.emptyIconBox, { backgroundColor: colors.primarySoft }]}>{icon}</View>
      ) : emoji ? (
        <Text style={styles.emptyEmoji}>{emoji}</Text>
      ) : null}
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySub, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>;
}

export function StatCard({
  emoji,
  icon,
  label,
  value,
}: {
  emoji?: string;
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.statTop}>
        {icon ? (
          <View style={[styles.statIconBox, { backgroundColor: colors.primarySoft }]}>{icon}</View>
        ) : emoji ? (
          <View style={[styles.statEmojiWrap, { backgroundColor: colors.cardSecondary }]}>
            <Text style={styles.statEmoji}>{emoji}</Text>
          </View>
        ) : null}
        <Text style={[styles.statLabel, { color: colors.muted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function Avatar({ name, size = 40 }: { name?: string; size?: number; url?: string | null }) {
  const { colors } = useTheme();
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.cardSecondary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: "700", color: colors.text }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", paddingHorizontal: 14 },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.85 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: "center", lineHeight: 19 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  stat: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statEmojiWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { fontSize: 12, fontWeight: "600", flex: 1 },
  statEmoji: { fontSize: 14 },
  statValue: { fontSize: 24, fontWeight: "800", marginTop: 8, fontVariant: ["tabular-nums"] },
});
