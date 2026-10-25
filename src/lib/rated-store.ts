import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@gunubirlik_rated_apps";

let ratedMap: Record<string, number> = {};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  ratedMap = { ...ratedMap };
  listeners.forEach((l) => l());
}

async function init() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        ratedMap = { ...parsed };
      }
    }
  } catch {
    // sessiz
  } finally {
    loaded = true;
    emit();
  }
}

// Hemen başlat
void init();

export async function markApplicationRated(applicationId: string, rating: number): Promise<void> {
  ratedMap[applicationId] = rating;
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ratedMap));
  } catch {
    // sessiz
  }
}

export function isApplicationRated(applicationId: string): boolean {
  return applicationId in ratedMap;
}

export function getApplicationRating(applicationId: string): number | null {
  return ratedMap[applicationId] ?? null;
}

export function useRatedMap(): Record<string, number> {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    void init();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return ratedMap;
}
