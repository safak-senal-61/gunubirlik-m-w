import { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";

// Native'de react-native-svg + react-native-qrcode-svg gerçek QR üretir.
// Web'de (veya modül yoksa) saf RN ile deterministik görsel bir temsil çizilir.
let QRCodeSvg: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RNQR = require("react-native-qrcode-svg");
    QRCodeSvg = RNQR.default ?? RNQR;
  } catch {
    QRCodeSvg = null;
  }
}

/** Fallback: deterministik pseudo-matrix (görsel temsil; okunabilir QR değildir). */
function textToMatrix(text: string): boolean[][] {
  const size = 25;
  const cells: boolean[][] = [];
  let h = 2166136261;
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      h ^= text.charCodeAt((y * size + x) % text.length);
      h = Math.imul(h, 16777619) >>> 0;
      const isFinder =
        (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      if (isFinder) {
        const fx = x >= size - 7 ? x - (size - 7) : x;
        const fy = y >= size - 7 ? y - (size - 7) : y;
        const border = fx === 0 || fy === 0 || fx === 6 || fy === 6;
        const core = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
        row.push(border || core);
      } else {
        row.push(((h >>> (x % 8)) & 1) === 1);
      }
    }
    cells.push(row);
  }
  return cells;
}

export default function QRCode({
  value,
  size = 220,
  color = "#111827",
  backgroundColor = "#ffffff",
}: {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}) {
  const matrix = useMemo(() => textToMatrix(value), [value]);

  if (Platform.OS !== "web" && QRCodeSvg) {
    return <QRCodeSvg value={value} size={size} color={color} backgroundColor={backgroundColor} />;
  }

  const cell = size / matrix.length;
  return (
    <View style={[styles.matrix, { width: size, height: size, backgroundColor }]}>
      {matrix.map((row, y) => (
        <View key={y} style={styles.row}>
          {row.map((on, x) => (
            <View
              key={x}
              style={{ width: cell, height: cell, backgroundColor: on ? color : backgroundColor }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  matrix: { alignItems: "center", justifyContent: "center", borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row" },
});
