import { useCallback, useState } from "react";
import { reverseGeocode } from "@/lib/api";
import type { GeocodeAddress } from "@/lib/api-types";

export interface Coords {
  lat: number;
  lng: number;
}

/** Promise tabanlı tarayıcı GPS okuma. */
export function getCurrentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Tarayıcın konum servisini desteklemiyor."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages: Record<number, string> = {
          1: "Konum izni reddedildi. Tarayıcı ayarlarından izin ver.",
          2: "Konum şu anda alınamıyor.",
          3: "Konum isteği zaman aşımına uğradı.",
        };
        reject(new Error(messages[err.code] ?? err.message));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** İki nokta arası kuş uçuşu mesafe (km). */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 0.42 → "420 m", 3.5 → "3,5 km", 13 → "13 km" */
export function formatDistance(km: number | null | undefined): string | null {
  if (km == null || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

/** GPS al + backend reverse geocoding ile adresi çöz. */
export async function locateAndReverse(): Promise<{
  coords: Coords;
  address: GeocodeAddress;
}> {
  const coords = await getCurrentPosition();
  const address = await reverseGeocode(coords.lat, coords.lng);
  return { coords, address };
}

/**
 * Reverse geocoding çıktısından form değerleri üret.
 * Backend `city` alanını ilçe (Kadıköy), `district` alanını mahalle döndürüyor;
 * il (İstanbul) displayName'den çıkarılır.
 */
export function addressToFormFields(address: GeocodeAddress): {
  city: string;
  district: string;
  addressText: string;
} {
  const parts = (address.displayName ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const skip = new Set(["Marmara Bölgesi", "Türkiye", "Türkiye Cumhuriyeti"]);
  let province = "";
  const cityIdx = address.city ? parts.indexOf(address.city) : -1;
  if (cityIdx >= 0 && parts[cityIdx + 1] && !skip.has(parts[cityIdx + 1]) && !/^\d+$/.test(parts[cityIdx + 1])) {
    province = parts[cityIdx + 1];
  }

  const street = address.street ?? "";
  const hood = address.neighbourhood ?? address.district ?? "";
  const addressText = [street, hood].filter(Boolean).join(", ");

  return {
    // İl bulunamadıysa mevcut backend `city` değerini bırak (kullanıcı düzeltir).
    city: province || address.city || "",
    district: address.city ?? "",
    addressText,
  };
}

/** Sayfa genelinde GPS konumu paylaşmak için küçük hook. */
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(async (): Promise<Coords | null> => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCurrentPosition();
      setCoords(c);
      return c;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konum alınamadı");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { coords, loading, error, locate, setError };
}
