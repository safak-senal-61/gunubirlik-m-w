import { useCallback, useState } from "react";
import * as Location from "expo-location";
import { reverseGeocode } from "@/lib/api";
import type { GeocodeAddress } from "@/lib/types";

export interface Coords {
  lat: number;
  lng: number;
}

export async function getCurrentCoords(): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Konum izni reddedildi. Ayarlardan izin ver.");
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export async function locateAndReverse(): Promise<{ coords: Coords; address: GeocodeAddress }> {
  const coords = await getCurrentCoords();
  const address = await reverseGeocode(coords.lat, coords.lng);
  return { coords, address };
}

/**
 * Reverse geocoding çıktısından form değerleri üretir.
 * Backend `city` alanına ilçe (ör. Kadıköy), `district` alanına mahalle yazar;
 * il (ör. İstanbul) displayName'den çıkarılır.
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
  if (
    cityIdx >= 0 &&
    parts[cityIdx + 1] &&
    !skip.has(parts[cityIdx + 1]) &&
    !/^\d+$/.test(parts[cityIdx + 1])
  ) {
    province = parts[cityIdx + 1];
  }

  const street = address.street ?? "";
  const hood = address.neighbourhood ?? address.district ?? "";
  const addressText = [street, hood].filter(Boolean).join(", ");

  return {
    city: province || address.city || "",
    district: address.city ?? "",
    addressText,
  };
}

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(async (): Promise<Coords | null> => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCurrentCoords();
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
