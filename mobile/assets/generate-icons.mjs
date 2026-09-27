// Günübirlik ikon üretici — kullanıcı tarafından sağlanan logoyu SVG olarak yeniden
// çizer ve Expo'nun istediği tüm PNG'leri üretir. Çalıştır: bun assets/generate-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Logo: beyaz yuvarlak-köşeli zemin üstünde koyu mavi "C" harfi + turuncu konum pini.
 * Kaynak görsel referans alınarak path'lerle yeniden çizildi (dış bağımlılık yok).
 */
function brandSvg(size, { rounded = true, padRatio = 0 } = {}) {
  const pad = size * padRatio;
  const inner = size - pad * 2;
  const rx = rounded ? inner * 0.225 : 0;
  // İç koordinat sistemi 0..100 (görseldeki orana birebir yakın)
  const s = inner / 100;
  const g = (v) => (pad + v * s).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${g(0)}" y="${g(0)}" width="${g(100)}" height="${g(100)}" rx="${rx.toFixed(2)}" fill="#ffffff"/>
  <g transform="translate(${g(0)},${g(0)}) scale(${s.toFixed(5)})">
    <!-- Koyu mavi C gövdesi -->
    <path fill="#1e50a2" d="M72.5 7.5 A45.5 45.5 0 1 0 72.6 92.5 L60.5 74.5 A24.5 24.5 0 1 1 60.6 25.5 Z"/>
    <!-- Turuncu konum pini (damla) -->
    <path fill="#f7941d" d="M56 8 C40.5 8 28 20.5 28 36 C28 55.5 51 79 54.4 82.4 C55.1 83.1 56.9 83.1 57.6 82.4 C61 79 84 55.5 84 36 C84 20.5 71.5 8 56 8 Z M56 46 A10 10 0 1 1 56 26 A10 10 0 0 1 56 46 Z"/>
    <!-- Pin altı kıvrımı -->
    <path fill="#f7941d" d="M30 86 C38 78 44 74 47 71 L58 84 C50 88 38 90 30 86 Z"/>
  </g>
</svg>`;
}

function renderPng(svg, px, outPath) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: px } });
  const png = resvg.render().asPng();
  writeFileSync(outPath, png);
  console.log(`✓ ${outPath} (${px}x${px}, ${png.length} bytes)`);
}

mkdirSync(join(here), { recursive: true });

// Launcher ikonu: TAM KARE beyaz zemin (köşe yuvarlatmayı iOS/Android kendi uygular;
// şeffaf köşeli PNG iOS'ta köşelerde siyah görünebilir).
renderPng(brandSvg(1024, { rounded: false, padRatio: 0 }), 1024, join(here, "icon.png"));
// Android adaptive icon: sistem maskelemesi için güvenli bölge payı (%8 pad).
renderPng(brandSvg(1024, { rounded: false, padRatio: 0.08 }), 1024, join(here, "adaptive-icon.png"));
// Splash ikonu: splash beyaz zeminde ortalanır, logo kenar boşluklu
renderPng(brandSvg(512, { rounded: true, padRatio: 0.06 }), 512, join(here, "splash-icon.png"));
// Monokrom (Android 13+ themed icon, opsiyonel) — mevcut logoyu aynen kullanıyoruz
renderPng(brandSvg(1024, { rounded: false, padRatio: 0 }), 1024, join(here, "android-icon-foreground.png"));

console.log("Bitti.");
