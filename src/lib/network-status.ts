import { useEffect, useState } from "react";

type NetworkListener = (isOnline: boolean) => void;

let onlineState = true;
const listeners = new Set<NetworkListener>();

export function isDeviceOnline(): boolean {
  return onlineState;
}

export function setNetworkStatus(isOnline: boolean) {
  if (onlineState !== isOnline) {
    onlineState = isOnline;
    listeners.forEach((fn) => fn(isOnline));
  }
}

/**
 * Sunucuya veya ping uç noktasına hızlı bir istek atarak gerçek internet erişimini doğrular.
 */
export async function checkNetworkConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch("https://gunubirlik.qrders.com.tr/manifest.webmanifest", {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const ok = res.status >= 200 && res.status < 400;
    setNetworkStatus(ok);
    return ok;
  } catch {
    setNetworkStatus(false);
    return false;
  }
}

/**
 * Bileşenlerin okuyabileceği çevrimdışı / çevrimiçi durum hook'u
 */
export function useNetworkStatus(): {
  isOnline: boolean;
  isOffline: boolean;
  checkConnection: () => Promise<boolean>;
} {
  const [online, setOnline] = useState<boolean>(onlineState);

  useEffect(() => {
    const handler: NetworkListener = (val) => setOnline(val);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    isOnline: online,
    isOffline: !online,
    checkConnection: checkNetworkConnection,
  };
}
