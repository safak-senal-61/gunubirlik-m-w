import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "@/components/QRCode";
import { Badge, Card, C, PrimaryButton, SectionTitle } from "@/components/ui";
import { formatWage } from "@/lib/format";

export type QRMode = "start" | "finish" | "payment";

const MODES: { key: QRMode; icon: string; label: string; title: string; desc: string }[] = [
  {
    key: "start",
    icon: "▶️",
    label: "İşe Başla",
    title: "İş Başlangıç Kaydı",
    desc: "İşveren bu QR'ı okuttuğunda işin aynı gün, aynı saatte başladığı kayıt altına alınır.",
  },
  {
    key: "finish",
    icon: "🏁",
    label: "İşi Bitir",
    title: "İş Bitiş Kaydı",
    desc: "Gün sonunda işverenle birlikte okutun; çalışılan süre ve bitiş saati doğrulanır.",
  },
  {
    key: "payment",
    icon: "💵",
    label: "Ödemeyi Al",
    title: "Ödeme Teslim Kaydı",
    desc: "Ödeme yapıldığında okutun; tutar, alıcı ve iş bilgisi kayıt altına alınır.",
  },
];

export function buildQrPayload(mode: QRMode, kind: "APPLICATION" | "JOB", id: string, extra: Record<string, unknown>) {
  return JSON.stringify({ t: "GB", m: mode, k: kind, id, ...extra });
}

/**
 * QR gösterim ekranı. Backend'de QR başlat/bitir/ödeme endpoint'i bulunmadığı için
 * bu QR'lar eşleşme/kayıt kanıtıdır: içindeki bilgiler (iş, kişi, ücret, saat)
 * karşı tarafın kamerayla okutup doğrulayabileceği dijital bir fişttir.
 */
export default function QRScreen({
  initialMode,
  kind,
  refId,
  title,
  subtitle,
  wage,
  wageType,
  workerName,
  employerName,
  onClose,
}: {
  initialMode: QRMode;
  kind: "APPLICATION" | "JOB";
  refId: string;
  title: string;
  subtitle: string;
  wage: number;
  wageType: string;
  workerName?: string;
  employerName?: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<QRMode>(initialMode);
  const [showCode, setShowCode] = useState(true);

  const meta = MODES.find((m) => m.key === mode) ?? MODES[0];

  const payload = buildQrPayload(mode, kind, refId, {
    title,
    wage,
    wageType,
    date: new Date().toISOString(),
    worker: workerName,
    employer: employerName,
  });

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{meta.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Card style={styles.qrCard}>
            <View style={styles.modeRow}>
              {MODES.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  style={[styles.modeChip, m.key === mode && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, m.key === mode && styles.modeChipTextActive]}>
                    {m.icon} {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {showCode ? (
              <View style={[styles.qrWrap, styles.qrCenter]}>
                <QRCode value={payload} size={230} />
              </View>
            ) : (
              <View style={[styles.qrWrap, styles.qrHidden, styles.qrCenter]}>
                <Text style={styles.qrHiddenIcon}>🙈</Text>
                <Text style={styles.qrHiddenText}>Kod gizli — göstermek için dokun</Text>
              </View>
            )}
            <Pressable onPress={() => setShowCode(!showCode)} style={styles.toggle}>
              <Text style={styles.toggleText}>{showCode ? "Kodu gizle" : "Kodu göster"}</Text>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>İş</Text>
              <Text style={styles.infoValue}>{title}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Kişiler</Text>
              <Text style={styles.infoValue}>
                {workerName ?? "İşçi"} ⇄ {employerName ?? "İşveren"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tutar</Text>
              <Text style={styles.infoValueStrong}>{formatWage(wage, wageType)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tarih</Text>
              <Text style={styles.infoValue}>{new Date().toLocaleString("tr-TR")}</Text>
            </View>
          </Card>

          <Card style={styles.flowCard}>
            <SectionTitle>Ödeme güvenliği akışı</SectionTitle>
            <Text style={styles.flowStep}>1️⃣ İş başında → “İşe Başla” QR'ını karşılıklı okutun.</Text>
            <Text style={styles.flowStep}>2️⃣ Gün sonunda → “İşi Bitir” QR'ını okutun, işveren işi tamamlar.</Text>
            <Text style={styles.flowStep}>3️⃣ Ödeme sonrası → “Ödemeyi Al” QR'ını okutun; tutar kayıt altına alınır.</Text>
            <Text style={styles.flowNote}>
              ℹ️ Backend'e özel QR başlat/bitir/ödeme endpoint'i şu an yok. Bu QR'lar phone kamerayla okutulabilir
              dijital bir fiş/eşleşme kanıtıdır; süreci yazılı delille güçlendirir. Asıl ödeme akışı: işveren işi
              “Tamamlandı” yapar → sistem ödeme kaydı oluşturur → yönetim onaylar → işveren ödemeyi işaretler →
              işçi alımını onaylar.
            </Text>
          </Card>

          <PrimaryButton label="Kapat" variant="outline" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  close: { fontSize: 18, color: C.muted, width: 24 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  qrCard: { gap: 12 },
  qrCenter: { alignSelf: "center" },
  modeRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 6 },
  modeChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#fff" },
  modeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  modeChipText: { fontSize: 12, fontWeight: "700", color: C.muted },
  modeChipTextActive: { color: "#fff" },
  qrWrap: { backgroundColor: "#fff", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border },
  qrHidden: { alignItems: "center", justifyContent: "center", height: 254, backgroundColor: "#f5f5f7" },
  qrHiddenIcon: { fontSize: 34 },
  qrHiddenText: { fontSize: 12, color: C.muted, marginTop: 6 },
  toggle: { alignSelf: "center", paddingVertical: 4 },
  toggleText: { fontSize: 12, fontWeight: "700", color: C.primary },
  divider: { height: 1, backgroundColor: "#f3f4f6" },
  infoRow: { flexDirection: "row", gap: 10, paddingVertical: 6 },
  infoLabel: { fontSize: 12, color: C.muted, width: 64 },
  infoValue: { fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  infoValueStrong: { fontSize: 13, fontWeight: "800", color: C.primary, flex: 1 },
  flowCard: { gap: 8 },
  flowStep: { fontSize: 13, color: C.text, lineHeight: 20 },
  flowNote: { fontSize: 12, color: C.muted, lineHeight: 18, backgroundColor: "#f5f5f7", borderRadius: 10, padding: 10 },
});
