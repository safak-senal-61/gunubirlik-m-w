// Release build'de fatal JS hataları sessizce uygulamayı kapatır (beyaz ekran /
// direkt çıkış). Bu modül en başta import edilerek global handler'ı devralır:
// hata olursa gerçek hata mesajını ekranda Alert olarak gösterir ve çökme
// kaydını AsyncStorage'a yazar. Varsayılan handler ÇAĞRILMAZ — böylece release
// build bile fatal hatada anında kapanmaz, hata ekranda görülür.

import { Alert } from "react-native";

const CRASH_KEY = "gb_last_crash";

export function getLastCrash(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    return AsyncStorage.getItem(CRASH_KEY);
  } catch {
    return Promise.resolve(null);
  }
}

export function clearLastCrash(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.removeItem(CRASH_KEY).catch(() => {});
  } catch {
    // storage yoksa sessiz geç
  }
}

function formatError(error: unknown, isFatal: boolean): string {
  const err = error as { name?: string; message?: string; stack?: string } | null;
  const name = err?.name ?? "Error";
  const message = err?.message ?? String(error ?? "bilinmeyen hata");
  const stack = (err?.stack ?? "")
    .split("\n")
    .filter(Boolean)
    .slice(0, 8)
    .join("\n");
  return `${isFatal ? "FATAL" : "HATA"} — ${name}\n\n${message}\n\n${stack}`;
}

// Modül import edilir edilmez kurulur (App.tsx ilk import olarak çeker).
const errorUtils = (globalThis as unknown as {
  ErrorUtils?: {
    getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
    setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  };
}).ErrorUtils;

if (errorUtils?.setGlobalHandler) {
  errorUtils.setGlobalHandler((error, isFatal) => {
    const text = formatError(error, !!isFatal);
    // Kalıcı kayıt (bir sonraki açılışta da bakılabilir)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      AsyncStorage.setItem(CRASH_KEY, text).catch(() => {});
    } catch {
      // storage yoksa sessiz geç
    }
    // Ekranda göster — React tree çökmüş olsa bile Alert native olduğu için çalışır.
    try {
      Alert.alert(
        isFatal ? "Uygulama hatası" : "Hata oluştu",
        text.slice(0, 1800),
        [{ text: "Kapat" }],
        { cancelable: true },
      );
    } catch {
      // alert bile patladıysa yapacak bir şey yok
    }
    // Varsayılan handler çağrılmaz: release'te uygulama fatal hatada anında
    // kapanmak yerine açık kalır ve hata görünür olur.
  });
}
