import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { C, PrimaryButton } from "@/components/ui";
import { scanQr } from "@/lib/api";

/**
 * İşçi QR tarama ekranı: işverenin ürettiği CHECK_IN / CHECK_OUT QR'ını okur
 * ve token'ı POST /qr/scan'e gönderir. CHECK_IN → IN_PROGRESS, CHECK_OUT →
 * COMPLETED + otomatik ödeme talebi.
 *
 * Kamera bozuk / izin verilmediği durumlar için MANUEL TOKEN DOĞRULAMA alanı da vardır:
 * ekrandaki "Token ile doğrula" bölümüne token'ı (veya QR içeriğini) yapıştırmak yeterli.
 */
export default function QrScannerScreen({ onClose, onScanned }: { onClose: () => void; onScanned?: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualToken, setManualToken] = useState("");

  const submitToken = async (rawToken: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await scanQr(rawToken);
      Alert.alert("Başarılı 🎉", result?.message ?? "İşlem kaydedildi.", [
        {
          text: "Tamam",
          onPress: () => {
            onScanned?.();
            onClose();
          },
        },
      ]);
    } catch (err) {
      Alert.alert(
        "Doğrulanamadı",
        err instanceof Error
          ? `${err.message}\n\nKodun geçerliliği bitmiş olabilir; işverenden yeni QR isteyin.`
          : "Token geçersiz. İşverenin ekranındaki token'ı veya QR içeriğini yapıştırmayı dene.",
        [{ text: "Tamam" }],
      );
    } finally {
      setBusy(false);
    }
  };

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || busy) return;
    setScanned(true);
    // QR içeriği ya JSON ({ token: "..." }) ya da ham token olabilir.
    let token = data;
    try {
      const payload = JSON.parse(data) as { token?: string };
      if (payload?.token) token = payload.token;
    } catch {
      // JSON değil → ham token olarak kullan
    }
    await submitToken(token);
  };

  const handleManualSubmit = async () => {
    const raw = manualToken.trim();
    if (!raw || busy) return;
    let token = raw;
    // Yapıştırılan metin JSON olabilir ("{"token": "..."}")
    if (raw.startsWith("{")) {
      try {
        const payload = JSON.parse(raw) as { token?: string };
        if (payload?.token) token = payload.token;
      } catch {
        // JSON değilse ham metni dene
      }
    }
    setScanned(true);
    await submitToken(token);
    setScanned(false);
    setManualToken("");
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.headerTitle}>QR Tara</Text>
          <View style={{ width: 24 }} />
        </View>

        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.permEmoji}>📷</Text>
            <Text style={styles.permTitle}>Kamera izni gerekli</Text>
            <Text style={styles.permDesc}>
              İşverenin ekranındaki QR'ı okutmak için kamera erişimi ver. Kamerası bozuk cihazlarda
              aşağıdaki manuel token doğrulamayı kullanabilirsin.
            </Text>
            <PrimaryButton label="İzin ver" onPress={requestPermission} />
            <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
          </View>
        ) : (
          <>
            <View style={styles.cameraBox}>
              <CameraView
                style={styles.camera}
                onBarcodeScanned={scanned ? undefined : handleScan}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              />
              <View style={styles.frame} pointerEvents="none">
                <Text style={styles.frameHint}>QR'ı çerçeveye sığdır</Text>
              </View>
            </View>
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {busy
                  ? "Doğrulanıyor…"
                  : scanned
                    ? "Kod okundu, işleniyor…"
                    : "İşverenin ürettiği QR'ı okut. Check-in işe başlama, check-out iş bitişi kaydeder."}
              </Text>

              {/* Manuel token doğrulama: kamera bozuksa QR yerine token yapıştır */}
              <View style={styles.manualBox}>
                <Text style={styles.manualTitle}>📲 Kameran çalışmıyor mu?</Text>
                <Text style={styles.manualDesc}>
                  İşveren ekranındaki token'ı veya QR içeriğini buraya yapıştır, manuel doğrula.
                </Text>
                <TextInput
                  style={styles.manualInput}
                  value={manualToken}
                  onChangeText={setManualToken}
                  placeholder='Token veya {"token":"..."} içeriği'
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
                <PrimaryButton
                  label={busy ? "Doğrulanıyor…" : "Token ile doğrula"}
                  disabled={!manualToken.trim() || busy}
                  onPress={handleManualSubmit}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#111",
  },
  close: { fontSize: 18, color: "#fff", width: 24 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  cameraBox: { flex: 1 },
  camera: { flex: 1 },
  frame: {
    position: "absolute",
    top: "20%",
    left: "12%",
    right: "12%",
    height: 240,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: -30,
  },
  frameHint: {
    position: "absolute",
    bottom: -34,
    alignSelf: "center",
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  footer: { padding: 16, backgroundColor: "#111", gap: 10 },
  footerText: { color: "#fff", fontSize: 12, textAlign: "center", lineHeight: 18, opacity: 0.85 },
  manualBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 14,
    gap: 8,
  },
  manualTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  manualDesc: { color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 17 },
  manualInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 10,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 44,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.bg, padding: 24 },
  permEmoji: { fontSize: 44 },
  permTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  permDesc: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19, marginBottom: 8 },
});
