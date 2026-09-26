import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { C, PrimaryButton } from "@/components/ui";
import type { MaintenanceStatus } from "@/lib/api";

/**
 * Bakım modu ekranı — admin bakıma aldığında uygulamanın TAMAMINI kapatır.
 * İçerik tamamen API'den gelir: başlık, açıklama, tahmini bitiş + geri sayım,
 * iletişim kanalları. "Yeniden dene" ile durum anında tekrar kontrol edilir.
 */
export default function MaintenanceScreen({
  status,
  onRetry,
}: {
  status: MaintenanceStatus;
  onRetry: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Yumuşak nabız animasyonu
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const endTime = status.maintenanceEndTime ? new Date(status.maintenanceEndTime).getTime() : null;

  // Geri sayım
  useEffect(() => {
    if (!endTime) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endTime]);

  const remaining = endTime ? Math.max(0, endTime - now) : null;
  const hh = remaining != null ? Math.floor(remaining / 3600000) : null;
  const mm = remaining != null ? Math.floor((remaining % 3600000) / 60000) : null;
  const ss = remaining != null ? Math.floor((remaining % 60000) / 1000) : null;

  const contacts: { icon: string; label: string; url: string }[] = [];
  if (status.contactWhatsapp) contacts.push({ icon: "💬", label: "WhatsApp", url: status.contactWhatsapp });
  if (status.contactPhone) contacts.push({ icon: "☎️", label: "Ara", url: `tel:${status.contactPhone.replace(/\s/g, "")}` });
  if (status.contactEmail) contacts.push({ icon: "📧", label: "E-posta", url: `mailto:${status.contactEmail}` });
  if (status.contactInstagram) contacts.push({ icon: "📸", label: "Instagram", url: status.contactInstagram });
  if (status.contactTwitter) contacts.push({ icon: "🐦", label: "X", url: status.contactTwitter });
  if (status.contactWebsite) contacts.push({ icon: "🌐", label: "Web", url: status.contactWebsite });

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
      <View style={styles.badgeRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>BAKIM MODU</Text>
        </View>
      </View>

      <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.icon}>🛠️</Text>
      </Animated.View>

      <Text style={styles.title}>{status.maintenanceTitle || "Bakımdayız 🔧"}</Text>
      <Text style={styles.message}>
        {status.maintenanceMessage ||
          "Uygulama şu anda bakım aşamasındadır. Kısa süre içinde daha güzellikle döneceğiz."}
      </Text>

      {endTime != null && (
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>⏳ Tahmini bitiş</Text>
          {remaining != null && remaining > 0 ? (
            <>
              <Text style={styles.countdownValue}>
                {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
              </Text>
              <Text style={styles.countdownHint}>
                {new Date(endTime).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </>
          ) : (
            <Text style={styles.countdownSoon}>Bitiş saati geldi — çok yakında geri döneceğiz!</Text>
          )}
        </View>
      )}

      <PrimaryButton label="🔄 Yeniden dene" onPress={onRetry} />

      {contacts.length > 0 && (
        <View style={styles.contactsCard}>
          <Text style={styles.contactsTitle}>Soruların için bize ulaş</Text>
          <View style={styles.contactsRow}>
            {contacts.map((c) => (
              <Pressable
                key={c.label}
                style={styles.contactChip}
                onPress={() => {
                  Linking.openURL(c.url).catch(() => {});
                }}
              >
                <Text style={styles.contactIcon}>{c.icon}</Text>
                <Text style={styles.contactLabel}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          {status.contactPhone ? <Text style={styles.contactPhone}>{status.contactPhone}</Text> : null}
          {status.contactEmail ? <Text style={styles.contactPhone}>{status.contactEmail}</Text> : null}
        </View>
      )}

      <Text style={styles.footer}>{status.siteName ?? "Günübirlik İş Bul"} · Bakım sırasında tüm işlemler geçici olarak durduruldu</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.primary },
  wrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  badgeRow: { alignSelf: "stretch", alignItems: "center" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fbbf24" },
  liveText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  iconWrap: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  icon: { fontSize: 52 },
  title: { fontSize: 24, fontWeight: "800", color: "#fff", textAlign: "center", lineHeight: 32 },
  message: { fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },
  countdownCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 4,
    marginTop: 4,
  },
  countdownLabel: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  countdownValue: { fontSize: 34, fontWeight: "800", color: "#fff", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  countdownHint: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  countdownSoon: { fontSize: 14, fontWeight: "700", color: "#fff" },
  contactsCard: {
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  contactsTitle: { fontSize: 13, fontWeight: "800", color: "#fff", textAlign: "center" },
  contactsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contactIcon: { fontSize: 14 },
  contactLabel: { fontSize: 12, fontWeight: "700", color: "#fff" },
  contactPhone: { fontSize: 12, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  footer: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 16, marginTop: 8 },
});
