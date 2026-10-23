import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export const C = {
  primary: "#0D6847",
  primaryDark: "#095237",
  primarySoft: "#EAF3EE",
  accent: "#5CD6A5",
  text: "#141615",
  muted: "#5C615E",
  border: "#E2E0D8",
  borderLight: "#ECEAE4",
  bg: "#F6F5F2",
  card: "#FFFFFF",
  danger: "#C84B31",
  dangerSoft: "#FCEBE8",
  success: "#0D6847",
  successSoft: "#EAF3EE",
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
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <View style={styles.statEmojiWrap}>
          <Text style={styles.statEmoji}>{emoji}</Text>
        </View>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  statEmojiWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { fontSize: 12, fontWeight: "600", color: C.muted, flex: 1 },
  statEmoji: { fontSize: 14 },
  statValue: { fontSize: 24, fontWeight: "800", color: C.text, marginTop: 8, fontVariant: ["tabular-nums"] },
});
