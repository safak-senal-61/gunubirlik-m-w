import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { C } from "@/components/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TRIGGER_DISTANCE = 75;

// Rota Eğrisi - 340x68 viewBox için optimize edilmiş akıcı harita rotası
const ROUTE_PATH = "M 30 52 C 65 24, 98 68, 145 42 S 210 14, 250 50 S 290 32, 310 20";
const ROUTE_LENGTH = 315;

/**
 * t (0..1) parametresi boyunca hareketli konum pininin bezier koordinatlarını hesaplar.
 * Haritadaki rota yolunu birebir takip eder.
 */
function getPinCoordinates(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const cx = 30 + 280 * clamped;
  const cy = 52 - 32 * clamped - Math.sin(clamped * Math.PI * 4) * 12;
  return { cx, cy };
}

interface RoutePullIndicatorProps {
  progress: number; // 0 to 1
  refreshing: boolean;
}

/**
 * Günübirlik Rota Pull-to-Refresh İndikatörü
 * - Harita rotası animasyonu
 * - Rota üzerinde ilerleyen hareketli konum pini
 * - Hedef noktada radar dalgası (pulsing destination beacon)
 * - Dinamik durum mesajı & Yenileme tamamlandı bildirimi (Success Toast)
 */
export function RoutePullIndicator({ progress, refreshing }: RoutePullIndicatorProps) {
  const [animProgress, setAnimProgress] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const prevRefreshingRef = useRef(refreshing);

  // Yenileme esnasında çalışan 60fps akıcı animasyon döngüsü
  useEffect(() => {
    let animFrameId: number;
    let startTime = 0;
    const duration = 1600; // ms per cycle

    if (refreshing) {
      setShowSuccess(false);
      setIsClosing(false);
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const p = (elapsed % duration) / duration;
        // Akıcı ease-in-out eğrisi
        const easeT =
          p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

        setAnimProgress(easeT);
        setPulsePhase((elapsed % 1100) / 1100);
        animFrameId = requestAnimationFrame(animate);
      };
      animFrameId = requestAnimationFrame(animate);
    } else {
      // Yenileme sona erdiğinde
      if (prevRefreshingRef.current) {
        setShowSuccess(true);
        setAnimProgress(1);
        const timer = setTimeout(() => {
          setShowSuccess(false);
          setIsClosing(true);
          const closeTimer = setTimeout(() => {
            setIsClosing(false);
            setAnimProgress(0);
          }, 300);
          return () => clearTimeout(closeTimer);
        }, 900);
        return () => clearTimeout(timer);
      }
    }

    prevRefreshingRef.current = refreshing;

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [refreshing]);

  const p = Math.max(0, Math.min(1, progress));
  const isVisible = refreshing || p > 0.05 || showSuccess || isClosing;
  if (!isVisible) return null;

  // Çekme esnasında rota çekilme oranına göre kısmen çizilir, refreshing esnasında döngü ilerler
  const activeT = refreshing ? animProgress : showSuccess ? 1 : p * 0.45;
  const { cx: pinX, cy: pinY } = getPinCoordinates(activeT);

  // Radar dalga boyutu ve şeffaflığı
  const radarR = 6 + pulsePhase * 14;
  const radarOpacity = Math.max(0, 0.55 * (1 - pulsePhase));

  // Çekme yüksekliği ve dönüşü
  const cardScale = refreshing ? 1 : showSuccess ? 1 : Math.min(1, 0.75 + p * 0.25);
  const cardOpacity = refreshing ? 1 : showSuccess ? 1 : isClosing ? 0 : Math.min(1, p * 1.6);
  const translateY = refreshing ? 6 : showSuccess ? 6 : isClosing ? -25 : -24 + p * 30;

  // Durum mesajı
  let statusMessage = "Yenilemek için aşağı çekin ↓";
  let hintText = `${Math.round(p * 100)}%`;

  if (refreshing) {
    statusMessage = "Rota & İlanlar güncelleniyor…";
    hintText = "Lütfen bekleyin";
  } else if (showSuccess) {
    statusMessage = "✓ Veriler yenilendi!";
    hintText = "Güncel";
  } else if (p >= 1) {
    statusMessage = "Bırakın, rota yenilensin!";
    hintText = "Bırakın";
  }

  // Rota çizgi ofseti
  const dashOffset = ROUTE_LENGTH * (1 - activeT);

  return (
    <View
      style={[
        styles.hudContainer,
        {
          opacity: cardOpacity,
          transform: [{ translateY }, { scale: cardScale }],
        },
      ]}
      pointerEvents="none"
    >
      {/* Üst Çekme Halkası */}
      <View style={styles.pullRingBadge}>
        <Text style={styles.pullRingIcon}>
          {refreshing ? "✦" : p >= 1 ? "✓" : "⌄"}
        </Text>
      </View>

      {/* Rota Haritası Kartı */}
      <View style={styles.mapCard}>
        {/* SVG Harita & Rota Katmanı */}
        <Svg viewBox="0 0 340 68" style={styles.svgMap}>
          {/* Koyu Harita Tabanı */}
          <Rect x="0" y="0" width="340" height="68" fill="#071d2b" />

          {/* Harita Şehir & Bölge Poligonları */}
          <Path d="M0 12 L65 0 95 24 75 50 10 68Z" fill="#0b2c3a" />
          <Path d="M125 0 L210 0 190 32 145 42 110 16Z" fill="#0a2938" />
          <Path d="M225 8 L340 0 340 45 285 60 235 32Z" fill="#0b3043" />
          <Path d="M0 50 L55 38 115 68 0 68Z" fill="#0a2a39" />

          {/* Izgara ve Topografik Yol Çizgileri */}
          <Path
            d="M-10 18 C50 8, 120 28, 200 12 S 300 24, 350 14"
            stroke="#17445a"
            strokeWidth="1.2"
            fill="none"
            opacity={0.6}
          />
          <Path
            d="M-10 46 C60 38, 140 56, 220 40 S 310 52, 350 42"
            stroke="#17445a"
            strokeWidth="1.2"
            fill="none"
            opacity={0.5}
          />
          <Path
            d="M70 -5 C80 25, 60 45, 75 75"
            stroke="#123b50"
            strokeWidth="1.2"
            fill="none"
            opacity={0.5}
          />
          <Path
            d="M180 -5 C190 25, 175 45, 185 75"
            stroke="#123b50"
            strokeWidth="1.2"
            fill="none"
            opacity={0.5}
          />
          <Path
            d="M275 -5 C285 20, 270 45, 280 75"
            stroke="#123b50"
            strokeWidth="1.2"
            fill="none"
            opacity={0.5}
          />

          {/* Rota Arka Plan İzi */}
          <Path
            d={ROUTE_PATH}
            stroke="#0b4763"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            opacity={0.65}
          />

          {/* Animasyonlu Canlı Cyan Rota Çizgisi */}
          <Path
            d={ROUTE_PATH}
            stroke="#19d9f2"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={ROUTE_LENGTH}
            strokeDashoffset={dashOffset}
          />

          {/* Başlangıç Noktası (Kullanıcı / İşçi Konumu) */}
          <Circle cx="30" cy="52" r="7.5" fill="#147bff" stroke="#a6f8ff" strokeWidth="1.8" />
          <Circle cx="30" cy="52" r="2.5" fill="#ffffff" />

          {/* Ara Rota Durakları (Waypoints) */}
          <Circle cx="145" cy="42" r="3" fill="#21dff2" opacity={0.65} />
          <Circle cx="250" cy="50" r="3" fill="#21dff2" opacity={0.65} />

          {/* Hedef Noktası - Pulsing Radar Dalgası */}
          {refreshing && (
            <Circle cx="310" cy="20" r={radarR} fill="#0a6b91" opacity={radarOpacity} />
          )}

          {/* Hedef Noktası (İş / Saha Lokasyonu) */}
          <Circle cx="310" cy="20" r="6" fill="#20e5f4" stroke="#b8ffff" strokeWidth="1.8" />
          <Circle cx="310" cy="20" r="2" fill="#061526" />

          {/* Rota Üzerinde Seyreden Hareketli Konum Pini */}
          <Circle cx={pinX} cy={pinY} r="10" fill="#20e5f4" opacity={0.28} />
          <Circle cx={pinX} cy={pinY} r="6.2" fill="#20e5f4" stroke="#ffffff" strokeWidth="2" />
          <Circle cx={pinX} cy={pinY} r="2" fill="#061526" />
        </Svg>

        {/* Harita Üstü Konum Etiketleri */}
        <View style={styles.mapLabelLeft}>
          <Text style={styles.mapLabelText}>📍 Konumun</Text>
        </View>
        <View style={styles.mapLabelRight}>
          <Text style={styles.mapLabelText}>🎯 İş Sahası</Text>
        </View>

        {/* Alt Durum Satırı */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: refreshing ? "#1ce3f4" : showSuccess ? "#22c55e" : "#398eff" },
            ]}
          />
          <Text style={styles.statusText} numberOfLines={1}>
            {statusMessage}
          </Text>
          <View style={styles.spacer} />
          <Text style={styles.hintText}>{hintText}</Text>
        </View>

        {/* Başarı Kutlaması (Success Toast Overlay) */}
        {showSuccess && (
          <View style={styles.successToast}>
            <View style={styles.successBadge}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successText}>Veriler yenilendi!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Geriye dönük uyumluluk için alias
export const BrandPullIndicator = RoutePullIndicator;

/**
 * BrandRefreshScrollView:
 * - Çekildikçe rota haritası ve hareketli konum pinini gösterir.
 * - Standart donuk OS dairesel spinner'ı gizler.
 */
export function BrandRefreshScrollView({
  refreshing,
  onRefresh,
  children,
  onScroll,
  contentContainerStyle,
  style,
  ...rest
}: ScrollViewProps & {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [dragProgress, setDragProgress] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < 0) {
      const p = Math.min(1, Math.abs(y) / TRIGGER_DISTANCE);
      setDragProgress(p);
    } else if (dragProgress > 0) {
      setDragProgress(0);
    }
    onScroll?.(e);
  };

  return (
    <View style={[styles.flex, style]}>
      {/* Ekranın en üstünde sabit, ipeksi rota animasyon alanı */}
      <View style={styles.headerAnchor} pointerEvents="none">
        <RoutePullIndicator
          progress={dragProgress}
          refreshing={refreshing}
        />
      </View>

      <ScrollView
        {...rest}
        style={styles.flex}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // Standart circular spinner'ı görünmez yapıyoruz, üstte bizim rota indikatörümüz oynar!
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
          />
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * BrandRefreshFlatList:
 * - FlatList için Rota Pull-to-Refresh bileşeni.
 */
export function BrandRefreshFlatList<T>({
  refreshing,
  onRefresh,
  onScroll,
  style,
  ...rest
}: FlatListProps<T> & {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [dragProgress, setDragProgress] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < 0) {
      const p = Math.min(1, Math.abs(y) / TRIGGER_DISTANCE);
      setDragProgress(p);
    } else if (dragProgress > 0) {
      setDragProgress(0);
    }
    onScroll?.(e);
  };

  return (
    <View style={[styles.flex, style]}>
      <View style={styles.headerAnchor} pointerEvents="none">
        <RoutePullIndicator
          progress={dragProgress}
          refreshing={refreshing}
        />
      </View>
      <FlatList<T>
        {...rest}
        style={styles.flex}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
          />
        }
      />
    </View>
  );
}

const ROUTE_FULL = "M 44 300 C 72 270, 95 285, 105 245 S 82 190, 118 165 S 170 145, 162 105 S 182 72, 198 48";
const ROUTE_FULL_LENGTH = 430;

function getFullPinCoordinates(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    cx: 44 + 154 * clamped,
    cy: 300 - 252 * clamped + Math.sin(clamped * Math.PI * 3) * 18,
  };
}

/**
 * RouteMapCard:
 * Demo projesindeki harita kartı mimarisi (viewBox 0 0 240 340).
 * İlanlar veya Dashboard üzerinde doğrudan sergilenebilir veya dokunarak rota yenilenebilir.
 */
export function RouteMapCard({
  onRefresh,
  loading: externalLoading,
  style,
}: {
  onRefresh?: () => void | Promise<void>;
  loading?: boolean;
  style?: any;
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [animProgress, setAnimProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const isLoading = externalLoading ?? internalLoading;

  const handlePress = () => {
    if (isLoading) return;
    setInternalLoading(true);
    setShowSuccess(false);
    onRefresh?.();
  };

  useEffect(() => {
    let animFrameId: number;
    let startTime = 0;
    const duration = 1600;

    if (isLoading) {
      setShowSuccess(false);
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const p = Math.min(1, (elapsed % duration) / duration);
        const easeT = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        setAnimProgress(easeT);
        animFrameId = requestAnimationFrame(animate);
      };
      animFrameId = requestAnimationFrame(animate);
    } else if (animProgress > 0) {
      setShowSuccess(true);
      setAnimProgress(1);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setInternalLoading(false);
        setAnimProgress(0);
      }, 1100);
      return () => clearTimeout(timer);
    }

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [isLoading]);

  const { cx: pinX, cy: pinY } = getFullPinCoordinates(animProgress);
  const dashOffset = ROUTE_FULL_LENGTH * (1 - animProgress);

  return (
    <View style={[styles.fullCardContainer, style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.fullMapCard}
      >
        <Svg viewBox="0 0 240 340" style={StyleSheet.absoluteFill}>
          <Rect x="0" y="0" width="240" height="340" fill="#071d2b" />
          <Path d="M0 30 L80 0 122 44 90 94 12 120Z" fill="#0b2c3a" />
          <Path d="M150 0 L240 0 240 105 194 126 162 86Z" fill="#0a2938" />
          <Path d="M0 175 L53 143 93 175 74 222 0 248Z" fill="#0a2a39" />
          <Path d="M146 190 L197 164 240 195 240 340 170 340 151 286 184 245Z" fill="#0b3043" />
          {Array.from({ length: 9 }).map((_, i) => (
            <Path
              key={`h${i}`}
              d={`M-20 ${25 + i * 35} C60 ${i * 28}, 120 ${55 + i * 31}, 260 ${20 + i * 36}`}
              stroke="#17445a"
              strokeWidth="1.4"
              fill="none"
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <Path
              key={`v${i}`}
              d={`M${8 + i * 34} -10 C${35 + i * 25} 95, ${-8 + i * 38} 210, ${20 + i * 30} 360`}
              stroke="#123b50"
              strokeWidth="1.5"
              fill="none"
            />
          ))}
          <Path
            d={ROUTE_FULL}
            stroke="#0b4763"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
          <Path
            d={ROUTE_FULL}
            stroke="#19d9f2"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={ROUTE_FULL_LENGTH}
            strokeDashoffset={dashOffset}
          />
          <Circle cx="44" cy="300" r="8" fill="#147bff" stroke="#a6f8ff" strokeWidth="2" />
          <Circle cx={pinX} cy={pinY} r="7" fill="#20e5f4" stroke="#e4ffff" strokeWidth="2" />
          <Circle cx="198" cy="48" r="12" fill="#0a6b91" opacity="0.28" />
          <Circle cx="198" cy="48" r="5" fill="#20e5f4" stroke="#b8ffff" strokeWidth="2" />
          <Circle cx="128" cy="205" r="4" fill="#21dff2" />
          <Circle cx="76" cy="104" r="4" fill="#21dff2" />
          <Circle cx="205" cy="235" r="4" fill="#21dff2" />
        </Svg>
        <View style={styles.fullMapLabelOne}>
          <Text style={styles.fullMapLabelIcon}>⌁</Text>
          <Text style={styles.fullMapLabel}>Günübirlik{"\n"}Saha Merkezi</Text>
        </View>
        <View style={styles.fullMapLabelTwo}>
          <Text style={styles.fullMapLabelIcon}>♧</Text>
          <Text style={styles.fullMapLabel}>İş Toplanma{"\n"}Noktası</Text>
        </View>
        <View style={styles.fullMapLabelThree}>
          <Text style={styles.fullMapLabelIcon}>≈</Text>
          <Text style={styles.fullMapLabel}>Aktif İlanlar</Text>
        </View>

        {showSuccess && (
          <View style={styles.successToast}>
            <View style={styles.successBadge}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successText}>Veriler yenilendi!</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.fullStatusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isLoading ? "#1ce3f4" : "#398eff" },
          ]}
        />
        <Text style={styles.fullStatusText}>
          {isLoading
            ? "Rota güncelleniyor…"
            : showSuccess
            ? "✓ Veriler yenilendi!"
            : "Rotanı yenilemek için dokun"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerAnchor: {
    position: "absolute",
    top: 4,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  hudContainer: {
    width: Math.min(SCREEN_WIDTH - 28, 380),
    alignItems: "center",
  },
  pullRingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#21dff2",
    backgroundColor: "#0d344b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -12,
    zIndex: 10,
    shadowColor: "#05131f",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  pullRingIcon: {
    color: "#42f0ff",
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "900",
  },
  mapCard: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#17445a",
    backgroundColor: "#071d2b",
    shadowColor: "#05131f",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  svgMap: {
    width: "100%",
    height: 72,
  },
  mapLabelLeft: {
    position: "absolute",
    top: 6,
    left: 10,
    backgroundColor: "rgba(6, 25, 41, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#17445a",
  },
  mapLabelRight: {
    position: "absolute",
    top: 6,
    right: 10,
    backgroundColor: "rgba(6, 25, 41, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#17445a",
  },
  mapLabelText: {
    color: "#6ce4f5",
    fontSize: 9,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#092437",
    borderTopWidth: 1,
    borderTopColor: "#13384f",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: "#d8eef7",
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  hintText: {
    color: "#7da2b6",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 6,
  },
  successToast: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6, 26, 42, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    zIndex: 20,
  },
  successBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0d5368",
    borderWidth: 1,
    borderColor: "#18dbe8",
    alignItems: "center",
    justifyContent: "center",
  },
  successCheck: {
    color: "#48f4ff",
    fontSize: 15,
    fontWeight: "900",
  },
  successText: {
    color: "#e8fdff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  fullCardContainer: {
    marginVertical: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  fullMapCard: {
    height: 320,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#17415a",
    backgroundColor: "#071d2b",
  },
  fullMapLabelOne: {
    position: "absolute",
    left: "8%",
    top: "26%",
  },
  fullMapLabelTwo: {
    position: "absolute",
    right: "8%",
    top: "17%",
  },
  fullMapLabelThree: {
    position: "absolute",
    right: "12%",
    bottom: "22%",
  },
  fullMapLabelIcon: {
    color: "#16d7ee",
    fontSize: 14,
    fontWeight: "700",
  },
  fullMapLabel: {
    color: "#45dcec",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
  },
  fullStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#092437",
    borderTopWidth: 1,
    borderTopColor: "#13384f",
  },
  fullStatusText: {
    color: "#d8eef7",
    fontSize: 12,
    fontWeight: "700",
  },
});
