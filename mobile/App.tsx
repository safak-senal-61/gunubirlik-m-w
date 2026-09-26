// TEŞHİS GİRİŞ NOKTASI (v1.0.3)
// Gerçek uygulama RealApp.tsx'te. Bu dosya, modülleri TEK TEK yükleyip
// sonucunu ekranda canlı gösterir. Hangi adımda kalırsa / hata yazarsa,
// çökmeye neden olan modül o olur — tahmin yerine kesin teşhis.

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { registerRootComponent } from "expo";

import "@/lib/crash-reporter";

type Step = { name: string; status: "pending" | "running" | "ok" | "fail"; detail?: string };

const MODULES: { name: string; load: () => unknown }[] = [
  { name: "react-native (core)", load: () => require("react-native") },
  { name: "expo-status-bar", load: () => require("expo-status-bar") },
  { name: "react-native-safe-area-context", load: () => require("react-native-safe-area-context") },
  { name: "@react-native-async-storage/async-storage", load: () => require("@react-native-async-storage/async-storage") },
  { name: "axios", load: () => require("axios") },
  { name: "expo-location", load: () => require("expo-location") },
  { name: "src/lib/types", load: () => require("./src/lib/types") },
  { name: "src/lib/api", load: () => require("./src/lib/api") },
  { name: "src/components/ui", load: () => require("./src/components/ui") },
  { name: "src/hooks/use-auth", load: () => require("./src/hooks/use-auth") },
  { name: "src/hooks/use-location", load: () => require("./src/hooks/use-location") },
  { name: "src/screens/AuthScreen", load: () => require("./src/screens/AuthScreen") },
  { name: "src/screens/JobsScreen", load: () => require("./src/screens/JobsScreen") },
  { name: "src/screens/JobDetailScreen", load: () => require("./src/screens/JobDetailScreen") },
  { name: "src/screens/DashboardScreen", load: () => require("./src/screens/DashboardScreen") },
  { name: "src/screens/ApplicationsScreen", load: () => require("./src/screens/ApplicationsScreen") },
  { name: "src/screens/MessagesScreen", load: () => require("./src/screens/MessagesScreen") },
  { name: "src/screens/NotificationsScreen", load: () => require("./src/screens/NotificationsScreen") },
  { name: "src/screens/ProfileScreen", load: () => require("./src/screens/ProfileScreen") },
  { name: "RealApp (gerçek uygulama)", load: () => require("./RealApp") },
];

function DiagApp() {
  const [steps, setSteps] = useState<Step[]>(MODULES.map((m) => ({ name: m.name, status: "pending" })));
  const [done, setDone] = useState(false);
  const running = useRef(false);

  const runAll = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    for (let i = 0; i < MODULES.length; i++) {
      setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s)));
      // Ekrana "running" durumunu çizme şansı ver
      await new Promise((r) => setTimeout(r, 60));
      try {
        MODULES[i].load();
        setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: "ok" } : s)));
      } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        setSteps((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "fail", detail: msg } : s)),
        );
        setDone(true);
        running.current = false;
        return;
      }
    }
    setDone(true);
    running.current = false;
  }, []);

  useEffect(() => {
    const t = setTimeout(runAll, 300);
    return () => clearTimeout(t);
  }, [runAll]);

  const allOk = done && steps.every((s) => s.status === "ok");

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Günübirlik — Teşhis v1.0.3</Text>
      {!done && <ActivityIndicator color="#4f46e5" style={{ marginTop: 8 }} />}
      {allOk && (
        <Text style={styles.allOk}>
          TÜM MODÜLLER YÜKLENDİ ✓ — Sorun modül yüklemede değil, çalışma zamanında.
        </Text>
      )}
      <ScrollView style={styles.list}>
        {steps.map((s) => (
          <View key={s.name} style={styles.row}>
            <Text style={styles.icon}>
              {s.status === "ok" ? "✓" : s.status === "fail" ? "✗" : s.status === "running" ? "…" : "·"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, s.status === "ok" && styles.ok, s.status === "fail" && styles.fail]}>
                {s.name}
              </Text>
              {!!s.detail && <Text style={styles.detail}>{s.detail}</Text>}
            </View>
          </View>
        ))}
        <Text style={styles.hint}>
          Bu ekranı ekran görüntüsü alıp geliştiriciye gönderin. ✓ işareti görmeyen ilk satır sorunun kaynağıdır.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 60, paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "center" },
  allOk: { color: "#059669", fontWeight: "700", textAlign: "center", marginTop: 8, fontSize: 13 },
  list: { marginTop: 16 },
  row: { flexDirection: "row", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", alignItems: "flex-start" },
  icon: { fontSize: 14, width: 16, color: "#6b7280" },
  name: { fontSize: 13, color: "#374151", fontWeight: "600" },
  ok: { color: "#059669" },
  fail: { color: "#dc2626" },
  detail: { fontSize: 11, color: "#dc2626", marginTop: 2 },
  hint: { fontSize: 11, color: "#9ca3af", paddingVertical: 16, textAlign: "center" },
});

registerRootComponent(DiagApp);
