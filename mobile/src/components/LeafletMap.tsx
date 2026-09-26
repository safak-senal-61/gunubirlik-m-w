import { useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { C } from "@/components/ui";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/format";
import type { JobCategory } from "@/lib/types";

/**
 * Leaflet + OpenStreetMap haritası (WebView embed).
 * - İş konumunda kategoriye uygun emoji ikonlu pin,
 * - tıklayınca iş yeri başlığı gösteren popup,
 * - iş yerinin çevresini gösteren yarıçap çemberi (yaklaşık 400 m).
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
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
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
  var map = L.map("map", { zoomControl: true, attributionControl: true }).setView([${latitude}, ${longitude}], 16);
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
    [latitude, longitude, title, category, icon, label, address],
  );

  // Web'de (Expo Go tarayıcı önizleme) iframe/WebView farklı davranabildiği için
  // yine WebView kullanılır; native'de aynı HTML leaflet'i yükler.
  if (Platform.OS === "web") {
    return (
      <View style={[styles.box, styles.center]}>
        <Text style={styles.webNote}>🗺️ Harita mobil uygulamada gösterilir.</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        style={styles.web}
        scrollEnabled={false}
        androidLayerType="hardware"
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.primarySoft,
  },
  web: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  webNote: { fontSize: 13, color: C.muted, fontWeight: "600" },
});
