import { useMemo, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { C } from "@/components/ui";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/format";
import type { JobCategory } from "@/lib/types";

/**
 * Leaflet + OpenStreetMap haritası (WebView embed).
 * - İş konumunda kategoriye uygun emoji ikonlu pin,
 * - tıklayınca iş yeri başlığı gösteren popup,
 * - iş yerinin çevresini gösteren yarıçap çemberi (yaklaşık 400 m),
 * - "Yol tarifi al" (Haritalar/Google Maps uygulamasına gider),
 * - "Büyüt" → tam ekran harita (cihaz genel ekranı, gesture'lar açık).
 * Not: Native build gerektirir (react-native-webview).
 */
export default function LeafletMap({
  latitude,
  longitude,
  title,
  category,
  address,
}: {
  latitude: number;
  longitude: number;
  title: string;
  category?: JobCategory | null;
  address?: string | null;
}) {
  const [full, setFull] = useState(false);
  const icon = CATEGORY_ICONS[category ?? "DIGER"] ?? "📍";
  const label = CATEGORY_LABELS[category ?? "DIGER"] ?? "İş yeri";
  // HTML + gömülü JS string güvenliği: yeni satır Kirilir, tırnaklar kaçışlanır.
  const esc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/[\n\r]/g, " ")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;")
      .replace(/"/g, "\\u0022");

  const html = useMemo(
    () => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1${full ? ", maximum-scale=6, user-scalable=yes" : ", user-scalable=no"}" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #eef2ff; }
  .pin {
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; line-height: 46px; text-align: center;
    width: 46px; height: 46px; background: #ffffff; border-radius: 50%;
    border: 3px solid ${C.primary}; box-shadow: 0 3px 10px rgba(0,0,0,0.3);
  }
  .pin::after {
    content: ""; position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
    width: 12px; height: 12px; background: ${C.primary};
    border-radius: 2px; transform: translateX(-50%) rotate(45deg);
  }
  .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, Roboto, sans-serif; }
  .leaflet-popup-content b { font-size: 13px; color: #1e1b33; display: block; }
  .leaflet-popup-content span { font-size: 11px; color: #6b7280; }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map("map", { zoomControl: true, attributionControl: true, dragging: true, tap: true }).setView([${latitude}, ${longitude}], ${full ? 17 : 16});
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap katkıcıları",
  }).addTo(map);
  var icon = L.divIcon({ className: "", html: '<div class="pin">${esc(icon)}</div>', iconSize: [46, 46], iconAnchor: [23, 46], popupAnchor: [0, -44] });
  L.marker([${latitude}, ${longitude}], { icon: icon })
    .addTo(map)
    .bindPopup("<b>${esc(title)}</b><span>${esc(label)}${address ? " · " + esc(address) : ""}</span>")
    .openPopup();
  L.circle([${latitude}, ${longitude}], { radius: 400, color: "${C.primary}", weight: 1.5, fillColor: "${C.primary}", fillOpacity: 0.10 }).addTo(map);
</script>
</body>
</html>`,
    [latitude, longitude, title, category, icon, label, address, full],
  );

  // Yol tarifi: Google Maps uygulaması yüklüyse uygulamada, değilse tarayıcıda açılır.
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;

  const mapNode = (
    <View style={full ? styles.fullBox : styles.box}>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        style={styles.web}
        androidLayerType="hardware"
        javaScriptEnabled
        domStorageEnabled
        // Tam ekranda harita kendi içinde kayar (dış scroll yok); küçük görünümde
        // de pan/zoom WebView içinde kalır, dış ScrollView'a çakışmaz.
        scrollEnabled={false}
      />
    </View>
  );

  const actions = (
    <View style={full ? styles.fullActions : styles.actionRow}>
      <Pressable style={styles.actionBtn} onPress={() => setFull(true)}>
        <Text style={styles.actionIcon}>🔍</Text>
        <Text style={styles.actionText}>Büyüt</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => void Linking.openURL(directionsUrl)}>
        <Text style={styles.actionIcon}>🧭</Text>
        <Text style={[styles.actionText, styles.actionTextPrimary]}>Yol tarifi</Text>
      </Pressable>
    </View>
  );

  // Web'de (Expo Go tarayıcı önizleme) iframe/WebView farklı davranabildiği için
  // yine WebView kullanılır; native'de aynı HTML leaflet'i yükler.
  if (globalThis.navigator?.product === "ReactNative" && false) {
    // unreachable — Platform check below instead
  }
  const isWeb = typeof document !== "undefined";
  if (isWeb) {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={styles.webNote}>🗺️ Harita mobil uygulamada gösterilir.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {mapNode}
      {actions}
      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
        <View style={styles.fullWrap}>
          <View style={styles.fullHeader}>
            <Pressable onPress={() => setFull(false)} hitSlop={8}>
              <Text style={styles.fullClose}>✕</Text>
            </Pressable>
            <Text style={styles.fullTitle} numberOfLines={1}>{title}</Text>
            <View style={{ width: 26 }} />
          </View>
          {mapNode}
          <View style={styles.fullFooter}>{actions}</View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  box: {
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.primarySoft,
  },
  fullBox: { flex: 1, backgroundColor: C.primarySoft },
  web: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  webNote: { fontSize: 13, color: C.muted, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 8 },
  fullActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: "#fff",
    paddingVertical: 11,
  },
  actionBtnPrimary: { backgroundColor: C.primary },
  actionIcon: { fontSize: 14 },
  actionText: { fontSize: 13, fontWeight: "800", color: C.primary },
  actionTextPrimary: { color: "#fff" },
  fullWrap: { flex: 1, backgroundColor: "#fff" },
  fullHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  fullClose: { fontSize: 17, color: C.muted, fontWeight: "700" },
  fullTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: C.text, textAlign: "center" },
  fullFooter: { padding: 14, paddingBottom: 22, borderTopWidth: 1, borderTopColor: C.border },
});
