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
import Svg, { Circle, Path } from "react-native-svg";
import { C } from "@/components/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TRIGGER_DISTANCE = 70;

// İkonik Kompakt Rota Eğrisi (64x20 viewBox)
const COMPACT_ROUTE = "M 6 15 C 20 6, 32 18, 44 8 S 56 12, 60 6";
const COMPACT_ROUTE_LENGTH = 66;

/**
 * t (0..1) boyunca hareketli konum pininin koordinatları
 */
function getCompactPinCoordinates(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const cx = 6 + 54 * clamped;
  const cy = 15 - 9 * clamped - Math.sin(clamped * Math.PI * 3) * 4;
  return { cx, cy };
}

interface RoutePullIndicatorProps {
  progress: number; // 0 to 1
  refreshing: boolean;
}

/**
 * İkonik Rota & Geriye Sarma (Rewind) Pull-to-Refresh Kapsülü
 * - Dairesel (circular) hiçbir spinner barındırmaz.
 * - Çekerken rotayı geriye sarar (Rewind: 100% -> 0%).
 * - Bırakılınca ileri sararak (Forward) 60 FPS hızla rotayı günceller.
 * - Kompakt, modern Dynamic-Island / HUD tarzı ikonik hap tasarımı.
 */
export function RoutePullIndicator({ progress, refreshing }: RoutePullIndicatorProps) {
  const [animProgress, setAnimProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const prevRefreshingRef = useRef(refreshing);

  // Yenileme esnasında ileri saran (0 -> 1) animasyon döngüsü
  useEffect(() => {
    let animFrameId: number;
    let startTime = 0;
    const duration = 1200; // ms per cycle

    if (refreshing) {
      setShowSuccess(false);
      setIsClosing(false);
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const p = (elapsed % duration) / duration;
        const easeT = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

        setAnimProgress(easeT);
        animFrameId = requestAnimationFrame(animate);
      };
      animFrameId = requestAnimationFrame(animate);
    } else {
      // Yenileme tamamlandığında başarı durumu
      if (prevRefreshingRef.current) {
        setShowSuccess(true);
        setAnimProgress(1);
        const timer = setTimeout(() => {
          setShowSuccess(false);
          setIsClosing(true);
          const closeTimer = setTimeout(() => {
            setIsClosing(false);
            setAnimProgress(0);
          }, 250);
          return () => clearTimeout(closeTimer);
        }, 750);
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

  // ÇEKERKEN GERİYE SARMA (Rewind):
  // Kullanıcı aşağı çektikçe rota sondan başa doğru (1.0 -> 0.0) geriye sarılır!
  // Refresh başladığında ise baştan sona (0.0 -> 1.0) ileri akar.
  const activeT = refreshing
    ? animProgress
    : showSuccess
    ? 1
    : Math.max(0, 1 - p * 0.95);

  const { cx: pinX, cy: pinY } = getCompactPinCoordinates(activeT);
  const dashOffset = COMPACT_ROUTE_LENGTH * (1 - activeT);

  // Kapsül animasyon değerleri (küçük, zarif ve ikonik)
  const pillScale = refreshing ? 1 : showSuccess ? 1 : Math.min(1, 0.8 + p * 0.2);
  const pillOpacity = refreshing ? 1 : showSuccess ? 1 : isClosing ? 0 : Math.min(1, p * 1.5);
  const translateY = refreshing ? 6 : showSuccess ? 6 : isClosing ? -35 : -24 + p * 30;

  // Durum yazısı ve ikon
  let statusIcon = "⏪";
  let statusText = `Geri sarılıyor %${Math.round(p * 100)}`;

  if (refreshing) {
    statusIcon = "⚡";
    statusText = "Yenileniyor…";
  } else if (showSuccess) {
    statusIcon = "✓";
    statusText = "Güncellendi!";
  } else if (p >= 1) {
    statusIcon = "⚡";
    statusText = "Bırakın!";
  }

  return (
    <View
      style={[
        styles.iconicPill,
        {
          opacity: pillOpacity,
          transform: [{ translateY }, { scale: pillScale }],
          borderColor: showSuccess
            ? "#22c55e"
            : refreshing
            ? "#19d9f2"
            : p >= 1
            ? "#38bdf8"
            : "#1e3a4f",
        },
      ]}
      pointerEvents="none"
    >
      {/* Sol Kısım: İkonik Geriye/İleriye Saran Mini Rota SVG */}
      <View style={styles.routeContainer}>
        <Svg viewBox="0 0 64 20" style={styles.svgRoute}>
          {/* Rota Arka Plan İzi */}
          <Path
            d={COMPACT_ROUTE}
            stroke="#0e3247"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Dinamik Saran Cyan Rota Çizgisi */}
          <Path
            d={COMPACT_ROUTE}
            stroke={showSuccess ? "#22c55e" : "#19d9f2"}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={COMPACT_ROUTE_LENGTH}
            strokeDashoffset={dashOffset}
          />

          {/* Başlangıç Noktası (Kullanıcı) */}
          <Circle cx="6" cy="15" r="2.2" fill="#38bdf8" />

          {/* Hedef Noktası (Saha / İlan) */}
          <Circle cx="60" cy="6" r="2.2" fill={showSuccess ? "#22c55e" : "#19d9f2"} />

          {/* Rota Üzerinde Saran Hareketli Pin */}
          <Circle
            cx={pinX}
            cy={pinY}
            r="3.2"
            fill={showSuccess ? "#22c55e" : "#20e5f4"}
            stroke="#ffffff"
            strokeWidth="1"
          />
        </Svg>
      </View>

      {/* Dikey İnce Ayırıcı */}
      <View style={styles.divider} />

      {/* Sağ Kısım: İkonik Durum ve Metin */}
      <View style={styles.statusSection}>
        <Text style={styles.statusIcon}>{statusIcon}</Text>
        <Text
          style={[
            styles.statusLabel,
            showSuccess && { color: "#4ade80" },
            refreshing && { color: "#38bdf8" },
          ]}
          numberOfLines={1}
        >
          {statusText}
        </Text>
      </View>
    </View>
  );
}

// Geriye dönük uyumluluk için alias
export const BrandPullIndicator = RoutePullIndicator;

/**
 * BrandRefreshScrollView:
 * - Aşağı çekerken rotayı geriye sarar (Rewind).
 * - Bırakıldığında rotayı ileri günceller.
 * - Android ve iOS'taki yerel circular spinner'ı tamamen gizler (-1000 offset).
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
      {/* Ekranın en üstünde kompakt ikonik geriye saran kapsül */}
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
            // Circular spinner'ı hem iOS hem Android'de 1000px ekran dışına iterek tamamen yok ediyoruz!
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            progressViewOffset={-1000}
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
 * - FlatList için İkonik Rota Geri Sarma Pull-to-Refresh bileşeni.
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
            progressViewOffset={-1000}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerAnchor: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  iconicPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: "#071c2b",
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "#17445a",
    shadowColor: "#030c14",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  routeContainer: {
    width: 64,
    height: 20,
    justifyContent: "center",
  },
  svgRoute: {
    width: 64,
    height: 20,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: "#163a4f",
    marginHorizontal: 9,
  },
  statusSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusIcon: {
    fontSize: 12,
    color: "#38bdf8",
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#d8eef7",
    letterSpacing: -0.2,
  },
});
