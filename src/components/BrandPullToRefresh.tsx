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
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
import Svg, { Circle, Path, Polyline } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TRIGGER_DISTANCE = 70;

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
// Özel Vektör İkonlar (Yapay zeka emojisi içermez, saf SVG)
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
 * - Dairesel hiçbir spinner içermez.
 * - Çekerken parmakla eş zamanlı olarak rotayı ve pini geriye sarar (Rewind: 100% -> 0%).
 * - Bırakılınca 60 FPS hızla rotayı ileri günceller (0% -> 100%).
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

  // ÇEKERKEN GERİYE SARMA (Rewind):
  // Kullanıcı parmağıyla aşağı çektikçe rota sondan başa doğru (1.0 -> 0.0) geriye sarılır!
  // Refresh başladığında ise döngüsel olarak baştan sona (0.0 -> 1.0) ileri akar.
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
            ? "Bırakın, Yenilensin!"
            : `Geri Sar: %${Math.round(p * 100)}`}
        </Text>
      </View>
    </View>
  );
}

export const BrandPullIndicator = RoutePullIndicator;

/**
 * BrandRefreshScrollView:
 * - Aşağı çekerken rotayı ve konumu parmak hareketiyle birebir geriye sarar (Rewind).
 * - Native Android SwipeRefreshLayout dairesel spinner'ı -9999 offset ile gizlenir.
 * - Native scroll mekanizması bozulmaz, takılma ve bug yaşanmaz.
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
  const touchStartY = useRef<number | null>(null);
  const scrollYRef = useRef(0);

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (scrollYRef.current <= 2) {
      touchStartY.current = e.nativeEvent.pageY;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (touchStartY.current !== null && !refreshing) {
      const diff = e.nativeEvent.pageY - touchStartY.current;
      if (diff > 2 && scrollYRef.current <= 2) {
        const p = Math.min(1, Math.max(0, diff / TRIGGER_DISTANCE));
        setDragProgress(p);
      } else if (diff <= 0 && dragProgress > 0) {
        setDragProgress(0);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
    if (!refreshing) {
      setDragProgress(0);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollYRef.current = y;
    if (y < 0) {
      const p = Math.min(1, Math.abs(y) / TRIGGER_DISTANCE);
      setDragProgress(p);
    } else if (dragProgress > 0 && touchStartY.current === null) {
      setDragProgress(0);
    }
    onScroll?.(e);
  };

  return (
    <View
      style={[styles.flex, style]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
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
 * - FlatList için İkonik Rota Geriye Sarma (Rewind) Pull-to-Refresh bileşeni.
 * - Çekerken parmakla eş zamanlı rotayı geriye sarar.
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
  const touchStartY = useRef<number | null>(null);
  const scrollYRef = useRef(0);

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (scrollYRef.current <= 2) {
      touchStartY.current = e.nativeEvent.pageY;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (touchStartY.current !== null && !refreshing) {
      const diff = e.nativeEvent.pageY - touchStartY.current;
      if (diff > 2 && scrollYRef.current <= 2) {
        const p = Math.min(1, Math.max(0, diff / TRIGGER_DISTANCE));
        setDragProgress(p);
      } else if (diff <= 0 && dragProgress > 0) {
        setDragProgress(0);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
    if (!refreshing) {
      setDragProgress(0);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollYRef.current = y;
    if (y < 0) {
      const p = Math.min(1, Math.abs(y) / TRIGGER_DISTANCE);
      setDragProgress(p);
    } else if (dragProgress > 0 && touchStartY.current === null) {
      setDragProgress(0);
    }
    onScroll?.(e);
  };

  return (
    <View
      style={[styles.flex, style]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
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
