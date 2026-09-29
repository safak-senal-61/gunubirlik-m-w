import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { C } from "@/components/ui";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/format";
import { getCurrentCoords } from "@/hooks/use-location";
import type { JobCategory } from "@/lib/types";

/**
 * Leaflet + OpenStreetMap haritası (WebView embed).
 * - İş konumunda kategoriye uygun emoji ikonlu pin,
 * - tıklayınca iş yeri başlığı gösteren popup,
 * - "Yol tarifi" → UYGULAMA İÇİ rota: cihaz konumu alınır, OSRM public API ile
 *   gerçek yol rotası hesaplanır ve harita ÜZERİNE çizilir (Google Maps AÇILMAZ).
 * - "Büyüt" → tam ekran harita (gesture'lar açık).
 * Not: Native build gerektirir (react-native-webview).
 */

type RouteState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "routing" }
  | { kind: "ready"; distKm: number; durMin: number }
  | { kind: "error"; message: string };

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

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
  const [route, setRoute] = useState<RouteState>({ kind: "idle" });
  // Çizilen rotanın koordinatları [ [lat,lng], ... ] — HTML'e enjekte edilir.
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
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
      .replace(/"/g, "\u0022");

  const html = useMemo(() => {
    // Rota polyline'ı (varsa) haritaya gömülür: mor yol çizgisi + başlangıç pini.
    const routeScript = routeCoords
      ? `
  var routeLine = L.polyline(${JSON.stringify(routeCoords)}, { color: "#4f46e5", weight: 5, opacity: 0.9, lineJoin: "round" }).addTo(map);
  var meIcon = L.divIcon({ className: "", html: '<div class="pin me">🧍</div>', iconSize: [40, 40], iconAnchor: [20, 40] });
  L.marker(${JSON.stringify(routeCoords[0])}, { icon: meIcon }).addTo(map).bindPopup("<b>Başlangıç</b><span>Konumun</span>");
  L.marker(${JSON.stringify(routeCoords[routeCoords.length - 1])}, { icon: icon }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [36, 36] });`
      : `
  map.setView([${latitude}, ${longitude}], ${full ? 17 : 16});
  L.marker([${latitude}, ${longitude}], { icon: icon })
    .addTo(map)
    .bindPopup("<b>${esc(title)}</b><span>${esc(label)}${address ? " · " + esc(address) : ""}</span>")
    .openPopup();`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1${full ? ", maximum-scale=6, user-scalable=yes" : ", user-scalable=no"}" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #eef2ff; }
  .pin {
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; line-height: 44px; text-align: center;
    width: 44px; height: 44px; background: #ffffff; border-radius: 50%;
    border: 3px solid ${C.primary}; box-shadow: 0 3px 10px rgba(0,0,0,0.3);
  }
  .pin.me { border-color: #059669; }
  .pin::after {
    content: ""; position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
    width: 12px; height: 12px; background: ${C.primary};
    border-radius: 2px; transform: translateX(-50%) rotate(45deg);
  }
  .pin.me::after { background: #059669; }
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
  var map = L.map("map", { zoomControl: true, attributionControl: true, dragging: true, tap: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap katkıcıları",
  }).addTo(map);
  var icon = L.divIcon({ className: "", html: '<div class="pin">${esc(icon)}</div>', iconSize: [46, 46], iconAnchor: [23, 46], popupAnchor: [0, -44] });
${routeScript}
</script>
</body>
</html>`;
  }, [latitude, longitude, title, category, icon, label, address, full, routeCoords]);

  /** Uygulama içi rota: cihaz konumu → OSRM → polyline. Google Maps hiç açılmaz. */
  const showRoute = useCallback(async () => {
    try {
      setRoute({ kind: "locating" });
      setRouteCoords(null);
      const me = await getCurrentCoords();
      setRoute({ kind: "routing" });
      const url = `${OSRM_BASE}/${me.lng},${me.lat};${longitude},${latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Rota servisi yanıt vermedi.");
      const json = (await res.json()) as {
        code?: string;
        routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
      };
      const r = json.routes?.[0];
      if (!r || json.code !== "Ok") throw new Error("Rota hesaplanamadı.");
      // GeoJSON [lng,lat] → Leaflet [lat,lng]
      const coords: [number, number][] = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      setRouteCoords(coords);
      setRoute({
        kind: "ready",
        distKm: r.distance / 1000,
        durMin: Math.round(r.duration / 60),
      });
    } catch (err) {
      setRoute({ kind: "error", message: err instanceof Error ? err.message : "Rota alınamadı." });
    }
  }, [latitude, longitude]);

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
      {route.kind === "ready" && !full && (
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>
            🧭 {route.distKm.toFixed(1)} km · ~{route.durMin} dk
          </Text>
        </View>
      )}
    </View>
  );

  const routeHint =
    route.kind === "ready" ? `🧭 ${route.distKm.toFixed(1)} km · ~${route.durMin} dk (araba)` : null;

  const actions = (
    <View style={full ? styles.fullActions : styles.actionRow}>
      <Pressable style={styles.actionBtn} onPress={() => setFull(true)}>
        <Text style={styles.actionIcon}>🔍</Text>
        <Text style={styles.actionText}>Büyüt</Text>
      </Pressable>
      <Pressable
        style={[styles.actionBtn, styles.actionBtnPrimary]}
        disabled={route.kind === "locating" || route.kind === "routing"}
        onPress={() => void showRoute()}
      >
        {route.kind === "locating" || route.kind === "routing" ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.actionIcon}>🧭</Text>
        )}
        <Text style={[styles.actionText, styles.actionTextPrimary]}>
          {route.kind === "ready" ? "Rotayı güncelle" : "Yol tarifi"}
        </Text>
      </Pressable>
    </View>
  );

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
      {routeHint && !full ? <Text style={styles.routeHint}>{routeHint}</Text> : null}
      {route.kind === "error" ? (
        <Text style={styles.routeError}>
          ⚠️ {route.message} Konum iznini kontrol et.{" "}
          <Text style={styles.routeErrLink} onPress={() => void Linking.openSettings()}>
            Ayarları aç
          </Text>
        </Text>
      ) : null}
      {route.kind === "ready" && !full ? (
        <Pressable style={styles.openFullHint} onPress={() => setFull(true)}>
          <Text style={styles.openFullHintText}>Rota haritada çizildi — büyütmek için dokun ↗</Text>
        </Pressable>
      ) : null}
      {actions}
      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
        <View style={styles.fullWrap}>
          <View style={styles.fullHeader}>
            <Pressable onPress={() => setFull(false)} hitSlop={8}>
              <Text style={styles.fullClose}>✕</Text>
            </Pressable>
            <Text style={styles.fullTitle} numberOfLines={1}>
              {route.kind === "ready" ? `${title} · ${route.distKm.toFixed(1)} km` : title}
            </Text>
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
  routeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  routeBadgeText: { fontSize: 11, fontWeight: "800", color: C.primary },
  routeHint: { fontSize: 12, fontWeight: "800", color: C.primary, marginTop: -2 },
  routeError: { fontSize: 11, color: C.danger, lineHeight: 16 },
  routeErrLink: { fontWeight: "800", textDecorationLine: "underline" },
  openFullHint: { alignSelf: "flex-start", backgroundColor: C.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  openFullHintText: { fontSize: 11, fontWeight: "800", color: C.primary },
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
