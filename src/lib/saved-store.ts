import { useEffect, useState } from "react";
import { fetchSavedJobIds, invalidateCacheKey, toggleSaveJob } from "@/lib/api";

/**
 * Kaydedilen işler için TEK kaynak.
 * Önceden liste ekranı (JobsScreen) ve detay ekranı (JobDetailScreen) kendi
 * state'ini tutuyordu; bu yüzden birinde kaydedilen iş diğerinde "kaydedilmemiş"
 * görünüyordu. Artık ikisi de bu store'u okuyor.
 */

let ids: string[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  ids = [...ids];
  listeners.forEach((l) => l());
}

/** Kayıtlı ID listesini (ağdan) yükler. İlk çağrıdan sonra önbellekten gelir. */
export function loadSavedIds(force = false): Promise<void> {
  if (inflight) return inflight;
  if (loaded && !force) return Promise.resolve();
  invalidateCacheKey("jobs:saved-ids");
  inflight = fetchSavedJobIds()
    .then((list) => {
      ids = Array.isArray(list) ? list : [];
      loaded = true;
      emit();
    })
    .catch(() => {
      // Ağ hatası: mevcut liste korunur.
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Optimistic kaydet/kaydı kaldır. Hata halinde geri alır ve `saved` sonucunu döner. */
export async function toggleSaved(id: string): Promise<boolean> {
  const wasSaved = ids.includes(id);
  if (wasSaved) ids = ids.filter((x) => x !== id);
  else ids = [...ids, id];
  emit();
  try {
    const res = await toggleSaveJob(id);
    const saved = res?.saved ?? !wasSaved;
    // Sunucu cevabı farklıysa onu esas al.
    ids = saved ? Array.from(new Set([...ids, id])) : ids.filter((x) => x !== id);
    // Liste ekranı "Kaydedilenler" sekmesinin önbelleğini de bayatlat.
    invalidateCacheKey("jobs:saved");
    invalidateCacheKey("jobs:saved-ids");
    emit();
    return saved;
  } catch (err) {
    ids = wasSaved ? Array.from(new Set([...ids, id])) : ids.filter((x) => x !== id);
    emit();
    throw err;
  }
}

/** Bileşenlerin okuduğu hook: anlık kayıtlı ID listesi. */
export function useSavedIds(): string[] {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    void loadSavedIds();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return ids;
}

export function resetSavedIds() {
  ids = [];
  loaded = false;
  emit();
}
