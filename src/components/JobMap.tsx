import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ApiJob } from "@/lib/api-types";
import type { Coords } from "@/hooks/use-geolocation";
import { CATEGORY_ICONS } from "@/lib/format";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function pinIcon(emoji: string) {
  return L.divIcon({
    className: "gb-pin",
    html: `<div class="gb-pin-inner"><span>${emoji}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

const userIcon = L.divIcon({
  className: "gb-pin-user",
  html: `<div class="gb-user-dot"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function JobMap({
  jobs,
  userCoords,
  radiusKm,
  className,
  onSelectJob,
}: {
  jobs: ApiJob[];
  userCoords?: Coords | null;
  /** Kilometre cinsinden yarıçap çemberi çizer. */
  radiusKm?: number | null;
  className?: string;
  onSelectJob?: (jobId: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Haritayı bir kez oluştur
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      center: [41.015137, 28.97953],
      zoom: 11,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pinleri güncelle
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const points: L.LatLngExpression[] = [];

    for (const job of jobs) {
      if (job.latitude == null || job.longitude == null) continue;
      const latlng: L.LatLngExpression = [job.latitude, job.longitude];
      points.push(latlng);
      const emoji = CATEGORY_ICONS[job.category] ?? "💼";
      const marker = L.marker(latlng, { icon: pinIcon(emoji) });
      marker.bindPopup(
        `<div class="gb-popup">
          <div class="gb-popup-title">${esc(job.title)}</div>
          <div class="gb-popup-meta">${esc(job.district)}, ${esc(job.city)} · 📅 ${new Date(job.workDate).toLocaleDateString("tr-TR")}</div>
          <div class="gb-popup-wage">${job.wageAmount.toLocaleString("tr-TR")} ₺${job.wageType === "HOURLY" ? "/saat" : "/gün"}</div>
          <a href="/jobs/${esc(job.id)}" class="gb-popup-link">Detayı gör →</a>
        </div>`,
      );
      marker.on("click", () => onSelectJob?.(job.id));
      marker.addTo(layer);
    }

    if (userCoords) {
      L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
        .addTo(layer)
        .bindPopup("<div class='gb-popup'><div class='gb-popup-title'>Konumun</div></div>");
      points.push([userCoords.lat, userCoords.lng]);
    }

    // Yarıçap çemberi
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }
    if (userCoords && radiusKm) {
      circleRef.current = L.circle([userCoords.lat, userCoords.lng], {
        radius: radiusKm * 1000,
        color: "oklch(0.51 0.211 277)",
        weight: 1.5,
        fillColor: "oklch(0.51 0.211 277)",
        fillOpacity: 0.06,
      }).addTo(map);
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 14 });
    }
  }, [jobs, userCoords, radiusKm, onSelectJob]);

  return (
    <div className={className}>
      <div ref={elRef} className="size-full" />
    </div>
  );
}
