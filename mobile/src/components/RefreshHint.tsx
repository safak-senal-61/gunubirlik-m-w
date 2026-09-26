import { StyleSheet, Text, View } from "react-native";
import { C } from "@/components/ui";

/** Pull-to-refresh sırasında listenin üstünde çıkan zarif bilgi şeridi. */
export function RefreshHint({ refreshing, fromCache }: { refreshing: boolean; fromCache?: boolean }) {
  if (!refreshing) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.dotWrap}>
        <Text style={styles.dot}>•</Text>
        <Text style={[styles.dot, styles.dot2]}>•</Text>
        <Text style={[styles.dot, styles.dot3]}>•</Text>
      </View>
      <Text style={styles.text}>{fromCache ? "Önbellekten gösteriliyor…" : "Güncelleniyor…"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primarySoft,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  dotWrap: { flexDirection: "row", gap: 3 },
  dot: { color: C.primary, fontSize: 16, fontWeight: "800" },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.3 },
  text: { fontSize: 12, fontWeight: "700", color: C.primary },
});
