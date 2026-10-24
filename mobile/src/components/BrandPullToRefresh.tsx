import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import Svg, { Circle, Path, Polyline } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TRIGGER_DISTANCE = 65;

// Kompakt & İkonik Rota Eğrisi (46x14 viewBox)
const COMPACT_ROUTE = "M 4 10 C 14 3, 22 12, 32 5 S 38 9, 42 4";
const COMPACT_ROUTE_LENGTH = 46;

function getCompactPinCoordinates(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const cx = 4 + 38 * clamped;
  const cy = 10 - 6 * clamped - Math.sin(clamped * Math.PI * 3) * 2.5;
  return { cx, cy };
}

// -------------------------------------------------------------
// Özel Vektör İkonlar (Yapay zeka emojileri içermez, saf SVG'dir)
// -------------------------------------------------------------
function RewindRouteIcon({ size = 12, color = "#38bdf8" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="11 19 4 12 11 5" />
      <Polyline points="19 19 12 12 19 5" />
    </Svg>
  );
}

function SpinningUpdateIcon({ size = 12, color = "#38bdf8" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Polyline points="3 3 3 8 8 8" />
      <Path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <Polyline points="16 21 21 21 21 16" />
    </Svg>
  );
}

function SuccessCheckIcon({ size = 12, color = "#4ade80" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

interface RoutePullIndicatorProps {
  progress: number;
  refreshing: boolean;
}

/**
 * Ultra-Sleek & İkonik Rota Geriye Sarma (Rewind) Kapsülü
 * - Dairesel (circular) hiçbir spinner veya yapay emoji içermez.
 * - Saf SVG vektör ikonları ve mikro rota yolu kullanır.
 * - Sadece 32px yüksekliğinde, Dynamic-Island / HUD tarzı cam kapsül.
 */
export function RoutePullIndicator({ progress, refreshing }: RoutePullIndicatorProps) {
  const [animProgress, setAnimProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const prevRefreshingRef = useRef(refreshing);

  useEffect(() => {
    let animFrameId: number;
    let startTime = 0;
    const duration = 1100;

    if (refreshing) {
      setShowSuccess(false);

      // İkon dönüş animasyonu
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      ).start();

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
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
      if (prevRefreshingRef.current) {
        setShowSuccess(true);
        setAnimProgress(1);
        const timer = setTimeout(() => {
          setShowSuccess(false);
          setAnimProgress(0);
        }, 700);
        return () => clearTimeout(timer);
      }
    }

    prevRefreshingRef.current = refreshing;

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [refreshing, spinAnim]);

  const p = Math.max(0, Math.min(1, progress));
  const isVisible = refreshing || p > 0.05 || showSuccess;
  if (!isVisible) return null;

  // Çekerken Geriye Sarma: Rota hedeften başa geriye sarılır
  const activeT = refreshing
    ? animProgress
    : showSuccess
    ? 1
    : Math.max(0, 1 - p * 0.95);

  const { cx: pinX, cy: pinY } = getCompactPinCoordinates(activeT);
  const dashOffset = COMPACT_ROUTE_LENGTH * (1 - activeT);

  const pillScale = refreshing ? 1 : showSuccess ? 1 : Math.min(1, 0.88 + p * 0.12);
  const pillOpacity = refreshing ? 1 : showSuccess ? 1 : Math.min(1, p * 1.6);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={[
        styles.iconicPill,
        {
          opacity: pillOpacity,
          transform: [{ scale: pillScale }],
          borderColor: showSuccess
            ? "#22c55e"
            : refreshing
            ? "#19d9f2"
            : p >= 1
            ? "#38bdf8"
            : "rgba(56, 189, 248, 0.25)",
        },
      ]}
      pointerEvents="none"
    >
      {/* Mikro Rota İzi */}
      <View style={styles.routeContainer}>
        <Svg viewBox="0 0 46 14" style={styles.svgRoute}>
          <Path
            d={COMPACT_ROUTE}
            stroke="#133045"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={COMPACT_ROUTE}
            stroke={showSuccess ? "#22c55e" : "#38bdf8"}
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={COMPACT_ROUTE_LENGTH}
            strokeDashoffset={dashOffset}
          />
          <Circle cx="4" cy="10" r="1.6" fill="#38bdf8" />
          <Circle cx="42" cy="4" r="1.6" fill={showSuccess ? "#22c55e" : "#38bdf8"} />
          <Circle
            cx={pinX}
            cy={pinY}
            r="2.2"
            fill={showSuccess ? "#22c55e" : "#38bdf8"}
            stroke="#ffffff"
            strokeWidth="0.8"
          />
        </Svg>
      </View>

      <View style={styles.divider} />

      {/* Vektör İkon ve Profesyonel Metin */}
      <View style={styles.statusSection}>
        {showSuccess ? (
          <SuccessCheckIcon size={12} color="#4ade80" />
        ) : refreshing ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <SpinningUpdateIcon size={12} color="#38bdf8" />
          </Animated.View>
        ) : (
          <RewindRouteIcon size={12} color={p >= 1 ? "#38bdf8" : "#94a3b8"} />
        )}
        <Text
          style={[
            styles.statusLabel,
            showSuccess && { color: "#4ade80" },
            refreshing && { color: "#38bdf8" },
          ]}
          numberOfLines={1}
        >
          {showSuccess
            ? "Veriler Güncel"
            : refreshing
            ? "Güncelleniyor…"
            : p >= 1
            ? "Bırakın"
            : "Rotayı Yenile"}
        </Text>
      </View>
    </View>
  );
}

export const BrandPullIndicator = RoutePullIndicator;

/**
 * BrandRefreshScrollView:
 * - Native Android SwipeRefreshLayout ve dairesel spinner -9999 offset ile ekran dışına atılarak tamamen gizlenir.
 * - Native scroll mekanizması bozulmaz, takılma ve bug yaşanmaz.
 * - Üstte 32px şık rota kapsülü oynar.
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
      {/* Üstte sabit ikonik rota kapsülü */}
      <View style={styles.headerAnchor} pointerEvents="none">
        <RoutePullIndicator progress={dragProgress} refreshing={refreshing} />
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
            tintColor="transparent"
            colors={["#00000000"]}
            progressBackgroundColor="#00000000"
            progressViewOffset={-9999}
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
 * - FlatList için İkonik Rota Pull-to-Refresh bileşeni.
 * - Native gesture korunur, TextInput ve butonlar asla kilitlenmez.
 * - Circular spinner sıfırlanmıştır.
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
        <RoutePullIndicator progress={dragProgress} refreshing={refreshing} />
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
            colors={["#00000000"]}
            progressBackgroundColor="#00000000"
            progressViewOffset={-9999}
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
    height: 32,
    paddingHorizontal: 11,
    backgroundColor: "rgba(7, 22, 34, 0.94)",
    borderRadius: 16,
    borderWidth: 1.2,
    shadowColor: "#020811",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  routeContainer: {
    width: 46,
    height: 14,
    justifyContent: "center",
  },
  svgRoute: {
    width: 46,
    height: 14,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginHorizontal: 8,
  },
  statusSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e2f8ff",
    letterSpacing: -0.2,
  },
});
