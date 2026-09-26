import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { C, PrimaryButton } from "@/components/ui";
import { scanQr } from "@/lib/api";

/**
 * İşçi QR tarama ekranı: işverenin ürettiği CHECK_IN / CHECK_OUT QR'ını okur
 * ve token'ı POST /qr/scan'e gönderir. CHECK_IN → IN_PROGRESS, CHECK_OUT →
 * COMPLETED + otomatik ödeme talebi.
 */
export default function QrScannerScreen({ onClose, onScanned }: { onClose: () => void; onScanned?: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || busy) return;
    setScanned(true);
    setBusy(true);
    try {
      const payload = JSON.parse(data) as { token?: string; type?: string };
      if (!payload?.token) throw new Error("token yok");
      const result = await scanQr(payload.token);
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
        "QR okunamadı",
        err instanceof Error && err.message !== "token yok"
          ? `${err.message}\n\nKodun geçerliliği bitmiş olabilir; işverenden yeni QR isteyin.`
          : "Geçersiz QR kodu. Lütfen işverenin ekranındaki Günübirlik QR'ını okutun.",
        [{ text: "Tekrar dene", onPress: () => setScanned(false) }],
      );
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
          <Text style={styles.headerTitle}>QR Tara</Text>
          <View style={{ width: 24 }} />
        </View>

        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.permEmoji}>📷</Text>
            <Text style={styles.permTitle}>Kamera izni gerekli</Text>
            <Text style={styles.permDesc}>
              İşverenin ekranındaki QR'ı okutmak için kamera erişimi ver.
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
  footer: { padding: 20, backgroundColor: "#111" },
  footerText: { color: "#fff", fontSize: 13, textAlign: "center", lineHeight: 19 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.bg, padding: 24 },
  permEmoji: { fontSize: 44 },
  permTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  permDesc: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19, marginBottom: 8 },
});
