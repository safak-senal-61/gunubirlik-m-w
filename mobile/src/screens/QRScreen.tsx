import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge, Card, C, PrimaryButton, SectionTitle } from "@/components/ui";
import { formatWage } from "@/lib/format";
import {
  fetchQrStatus,
  generateApplicationQr,
  type QrCodeData,
  type QrStatusData,
  type QrType,
} from "@/lib/api";

const MODES: { key: QrType; icon: string; label: string; title: string; desc: string }[] = [
  {
    key: "CHECK_IN",
    icon: "▶️",
    label: "İşe Başla",
    title: "İşe Başlama (Check-in)",
    desc: "İşveren bu QR'ı üretir, işçi telefon kamerasıyla tarar → application IN_PROGRESS olur.",
  },
  {
    key: "CHECK_OUT",
    icon: "🏁",
    label: "İşi Bitir",
    title: "İş Bitirme (Check-out)",
    desc: "İşveren CHECK_OUT QR'ı üretir, işçi tarar → application COMPLETED olur + otomatik PENDING ödeme talebi oluşur.",
  },
];

/**
 * Gerçek backend QR akışı (POST /applications/{id}/qr-code + POST /qr/scan):
 * - İşveren CHECK_IN / CHECK_OUT QR'ı üretir (5 dk geçerli, tek kullanımlık, gerçek QR görseli döner).
 * - İşçi kendi telefonunda QR tarayıcı ile okutur (Tarayıcıyı Aç butonu → expo-camera).
 * - Sadece ilgili işçi/işveren tarayabilir; yeni QR eskisini expire eder.
 */
export default function QRScreen({
  applicationId,
  jobTitle,
  wage,
  wageType,
  workerName,
  employerName,
  isEmployer,
  onClose,
}: {
  applicationId: string;
  jobTitle: string;
  wage: number;
  wageType: string;
  workerName?: string;
  employerName?: string;
  isEmployer: boolean;
  onClose: () => void;
}) {
  const [type, setType] = useState<QrType>("CHECK_IN");
  const [qr, setQr] = useState<QrCodeData | null>(null);
  const [status, setStatus] = useState<QrStatusData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  const meta = MODES.find((m) => m.key === type) ?? MODES[0];

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await fetchQrStatus(applicationId));
    } catch {
      // sessiz
    }
  }, [applicationId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Geri sayım
  useEffect(() => {
    if (!qr?.expiresAt) return;
    const tick = () => {
      const ms = new Date(qr.expiresAt).getTime() - Date.now();
      setExpiresIn(Math.max(0, Math.floor(ms / 1000)));
      if (ms <= 0) setQr(null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qr?.expiresAt]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await generateApplicationQr(applicationId, type);
      setQr(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR üretilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.headerTitle}>QR ile İşe Başla / Bitir</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Card style={styles.qrCard}>
            <View style={styles.modeRow}>
              {MODES.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    setType(m.key);
                    setQr(null);
                    setError(null);
                  }}
                  style={[styles.modeChip, m.key === type && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, m.key === type && styles.modeChipTextActive]}>
                    {m.icon} {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modeDesc}>{meta.desc}</Text>

            {isEmployer ? (
              <>
                {!qr ? (
                  <PrimaryButton label={`${meta.icon} ${meta.label} QR'ı Üret`} loading={busy} onPress={generate} />
                ) : (
                  <>
                    <Image source={{ uri: qr.qrImageDataUrl }} style={styles.qrImage} resizeMode="contain" />
                    <Text style={styles.countdown}>
                      ⏱ Geçerlilik: {Math.floor((expiresIn ?? 0) / 60)}:{String((expiresIn ?? 0) % 60).padStart(2, "0")}
                    </Text>
                    <Text style={styles.qrNote}>
                      Bu QR 5 dakika geçerlidir ve tek kullanımlıktır. İşçi telefonundaki “QR Tara” ile okutur.
                      Yeni QR üretirsen eskisi otomatik geçersiz olur.
                    </Text>
                    <PrimaryButton label="Yeniden üret" variant="outline" loading={busy} onPress={generate} />
                  </>
                )}
              </>
            ) : (
              <View style={styles.workerNoteBox}>
                <Text style={styles.workerNoteTitle}>👷 İşçi akışı</Text>
                <Text style={styles.workerNote}>
                  İşveren ekranında ürettiği QR'ı senin telefonunda “QR Tara” ekranıyla okut.{"\n"}
                  • Check-in okut → işe başladın kaydı düşer (IN_PROGRESS).{"\n"}
                  • Check-out okut → iş tamamlandı (COMPLETED) + ödeme talebi otomatik oluşur.
                </Text>
                <Text style={styles.workerNoteHint}>
                  (QR tarama ekranı Mesajlar → bildirimler üzerinden veya işveren ekranı paylaşımından ulaşır.)
                </Text>
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>İş</Text>
              <Text style={styles.infoValue}>{jobTitle}</Text>
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
            {status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>QR durumu</Text>
                <View style={{ flex: 1 }}>
                  {status.hasActiveQr ? (
                    <Badge
                      label={`Aktif ${status.type === "CHECK_IN" ? "Check-in" : "Check-out"} QR`}
                      color={C.emerald}
                      bg={C.emeraldBg}
                    />
                  ) : (
                    <Badge label="Aktif QR yok" color={C.muted} bg={C.stoneBg} />
                  )}
                  {status.scannedAt ? (
                    <Text style={styles.scannedAt}>
                      Son okutma: {new Date(status.scannedAt).toLocaleString("tr-TR")}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
          </Card>

          <Card style={styles.flowCard}>
            <SectionTitle>Nasıl çalışır?</SectionTitle>
            <Text style={styles.flowStep}>1️⃣ İşveren işçiyi kabul eder (ACCEPTED).</Text>
            <Text style={styles.flowStep}>2️⃣ İş günü işveren CHECK_IN QR'ı üretir ve gösterir; işçi tarar → IN_PROGRESS.</Text>
            <Text style={styles.flowStep}>3️⃣ İş bitiminde CHECK_OUT QR'ı üretilir ve taranır → COMPLETED + otomatik PENDING ödeme.</Text>
            <Text style={styles.flowStep}>4️⃣ Yönetim ödemeyi onaylar → işveren öder → işçi “aldım” onayı verir.</Text>
            <Text style={styles.flowNote}>
              🔒 Güvenlik: Her QR 5 dakika geçerli, tek kullanımlıktır. Sadece ilgili işçi/işveren tarayabilir.
              QR sahteciliğini önler — fiziksel olarak iş başında olmayan tarayamaz.
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
  modeRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 6 },
  modeChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#fff" },
  modeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  modeChipText: { fontSize: 12, fontWeight: "700", color: C.muted },
  modeChipTextActive: { color: "#fff" },
  modeDesc: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19 },
  qrImage: { width: 240, height: 240, alignSelf: "center", borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border },
  countdown: { fontSize: 14, fontWeight: "800", color: C.primary, textAlign: "center" },
  qrNote: { fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 18 },
  workerNoteBox: { backgroundColor: C.primarySoft, borderRadius: 14, padding: 14, gap: 8 },
  workerNoteTitle: { fontSize: 14, fontWeight: "800", color: C.primary },
  workerNote: { fontSize: 13, color: C.text, lineHeight: 20 },
  workerNoteHint: { fontSize: 11, color: C.muted, lineHeight: 16 },
  error: { color: C.danger, fontSize: 13, textAlign: "center" },
  divider: { height: 1, backgroundColor: "#f3f4f6" },
  infoRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 12, color: C.muted, width: 80 },
  infoValue: { fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  infoValueStrong: { fontSize: 13, fontWeight: "800", color: C.primary, flex: 1 },
  scannedAt: { fontSize: 11, color: C.muted, marginTop: 4 },
  flowCard: { gap: 8 },
  flowStep: { fontSize: 13, color: C.text, lineHeight: 20 },
  flowNote: { fontSize: 12, color: C.muted, lineHeight: 18, backgroundColor: "#f5f5f7", borderRadius: 10, padding: 10 },
});
