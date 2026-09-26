import { useCallback, useEffect, useRef, useState } from "react";
import { cachedFetch } from "@/lib/api";

/**
 * stale-while-revalidate list verisi:
 * - İlk render'da önbellek varsa ANINDA gösterilir ("Yükleniyor" ekranı çıkmaz),
 *   arka planda tazelenir (onUpdate ile görünüm güncellenir).
 * - İlk yüklemede (önbellek boşsa) loading=true olur.
 * - refresh() pull-to-refresh içindir (force: ağdan taze çeker).
 */
export function useCachedList<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: d, fromCache } = await cachedFetch(cacheKey, fetcher, {
        onUpdate: (fresh) => {
          if (mounted.current) setData(fresh);
        },
      });
      if (mounted.current) {
        setData(d);
        setLoading(false);
      }
      if (!fromCache) setLoading(false);
    } catch {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: d } = await cachedFetch(cacheKey, fetcher, { force: true });
      if (mounted.current) setData(d);
    } catch {
      // sessiz
    } finally {
      if (mounted.current) setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...deps]);

  return { data, loading, refreshing, refresh, reload: load };
}
