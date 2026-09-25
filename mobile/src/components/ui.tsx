import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export const C = {
  primary: "#4f46e5",
  primarySoft: "#eef2ff",
  text: "#1e1b33",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#fafafa",
  card: "#ffffff",
  danger: "#dc2626",
  success: "#047857",
  amber: "#b45309",
  amberBg: "#fef3c7",
  indigo: "#4338ca",
  indigoBg: "#e0e7ff",
  emerald: "#047857",
  emeraldBg: "#d1fae5",
  rose: "#be123c",
  roseBg: "#ffe4e6",
  stone: "#57534e",
  stoneBg: "#e7e5e4",
};

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[styles.card, style]}>
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
  const variant = props.variant ?? "primary";
  const bg =
    variant === "primary" ? C.primary
    : variant === "danger" ? C.danger
    : "transparent";
  const fg =
    variant === "primary" || variant === "danger" ? "#fff"
    : variant === "outline" ? C.primary
    : C.muted;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        variant === "outline" && styles.btnOutline,
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", paddingHorizontal: 14 },
  btnOutline: { borderWidth: 1, borderColor: C.primary },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.85 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: C.muted },
  chipTextActive: { color: "#fff" },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 6, textAlign: "center", lineHeight: 19 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  stat: { flex: 1 },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { fontSize: 12, color: C.muted },
  statEmoji: { fontSize: 16 },
  statValue: { fontSize: 26, fontWeight: "800", color: C.text, marginTop: 6 },
});
