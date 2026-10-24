import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
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
import Svg, { Circle, Path } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TRIGGER_DISTANCE = 65;

// Kompakt & İkonik Rota Eğrisi (54x16 viewBox)
const COMPACT_ROUTE = "M 5 12 C 16 4, 26 14, 36 6 S 46 10, 50 4";
const COMPACT_ROUTE_LENGTH = 54;

function getCompactPinCoordinates(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const cx = 5 + 45 * clamped;
  const cy = 12 - 8 * clamped - Math.sin(clamped * Math.PI * 3) * 3;
  return { cx, cy };
}

interface RoutePullIndicatorProps {
  progress: number;
  refreshing: boolean;
}

/**
 * Ultra-Sleek & İkonik Rota Geriye Sarma (Rewind) Kapsülü
 * - Dairesel (circular) hiçbir spinner ve halka içermez.
 * - Çekerken rotayı geriye sarar (1.0 -> 0.0).
 * - Bırakılınca 60 FPS hızla rotayı ileri günceller.
 * - Sadece 34px yüksekliğinde, Dynamic-Island tarzı lüks kapsül.
 */
export function RoutePullIndicator({ progress, refreshing }: RoutePullIndicatorProps) {
  const [animProgress, setAnimProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const prevRefreshingRef = useRef(refreshing);

  useEffect(() => {
    let animFrameId: number;
    let startTime = 0;
    const duration = 1100;

    if (refreshing) {
      setShowSuccess(false);
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
  }, [refreshing]);

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

  // Kapsül animasyon değerleri
  const pillScale = refreshing ? 1 : showSuccess ? 1 : Math.min(1, 0.85 + p * 0.15);
  const pillOpacity = refreshing ? 1 : showSuccess ? 1 : Math.min(1, p * 1.6);

  let statusIcon = "⏪";
  let statusText = p >= 1 ? "Bırakın!" : `Geri Sar: %${Math.round(p * 100)}`;

  if (refreshing) {
    statusIcon = "⚡";
    statusText = "Güncelleniyor…";
  } else if (showSuccess) {
    statusIcon = "✓";
    statusText = "Güncellendi!";
  }

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
            : "rgba(25, 217, 242, 0.35)",
        },
      ]}
      pointerEvents="none"
    >
      {/* Mini Rota İzi */}
      <View style={styles.routeContainer}>
        <Svg viewBox="0 0 54 16" style={styles.svgRoute}>
          <Path
            d={COMPACT_ROUTE}
            stroke="#0d2b3e"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={COMPACT_ROUTE}
            stroke={showSuccess ? "#22c55e" : "#19d9f2"}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={COMPACT_ROUTE_LENGTH}
            strokeDashoffset={dashOffset}
          />
          <Circle cx="5" cy="12" r="2" fill="#38bdf8" />
          <Circle cx="50" cy="4" r="2" fill={showSuccess ? "#22c55e" : "#19d9f2"} />
          <Circle
            cx={pinX}
            cy={pinY}
            r="2.8"
            fill={showSuccess ? "#22c55e" : "#20e5f4"}
            stroke="#ffffff"
            strokeWidth="1"
          />
        </Svg>
      </View>

      <View style={styles.divider} />

      {/* Durum İkon & Metin */}
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

export const BrandPullIndicator = RoutePullIndicator;

/**
 * BrandRefreshScrollView:
 * - Native Android SwipeRefreshLayout (ve onun beyaz circular balonu) tamamen kaldırılmıştır.
 * - Çekerken FlatList/ScrollView aşağı doğru kayarak yer açar.
 * - Ekranın üstünde 34px yüksekliğinde şık ve ikonik rota kapsülü oynar.
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
  const pullAnim = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  useEffect(() => {
    if (refreshing) {
      Animated.spring(pullAnim, {
        toValue: 44,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(pullAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      setDragProgress(0);
    }
  }, [refreshing, pullAnim]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollYRef.current = y;
    if (y < 0) {
      // iOS overscroll desteği
      const p = Math.min(1, Math.abs(y) / TRIGGER_DISTANCE);
      setDragProgress(p);
      pullAnim.setValue(Math.min(44, Math.abs(y) * 0.6));
    }
    onScroll?.(e);
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < -TRIGGER_DISTANCE && !refreshing) {
      onRefresh();
    }
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (scrollYRef.current <= 2) {
      touchStartYRef.current = e.nativeEvent.pageY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (touchStartYRef.current === null || refreshing) return;
    const currentY = e.nativeEvent.pageY;
    const diff = currentY - touchStartYRef.current;

    if (diff > 0 && scrollYRef.current <= 2) {
      isPullingRef.current = true;
      const distance = Math.min(80, diff * 0.45);
      const p = Math.min(1, distance / TRIGGER_DISTANCE);
      setDragProgress(p);
      pullAnim.setValue(distance * 0.65);
    } else if (isPullingRef.current && diff <= 0) {
      isPullingRef.current = false;
      setDragProgress(0);
      pullAnim.setValue(0);
    }
  };

  const handleTouchEnd = () => {
    if (isPullingRef.current) {
      isPullingRef.current = false;
      if (dragProgress >= 0.9 && !refreshing) {
        onRefresh();
      } else if (!refreshing) {
        Animated.spring(pullAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
        setDragProgress(0);
      }
    }
    touchStartYRef.current = null;
  };

  return (
    <View
      style={[styles.flex, style]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Üstte sabit ikonik rota kapsülü */}
      <View style={styles.headerAnchor} pointerEvents="none">
        <RoutePullIndicator progress={dragProgress} refreshing={refreshing} />
      </View>

      <Animated.View
        style={[styles.flex, { transform: [{ translateY: pullAnim }] }]}
      >
        <ScrollView
          {...rest}
          style={styles.flex}
          contentContainerStyle={contentContainerStyle}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEndDrag}
          scrollEventThrottle={16}
          bounces={true}
          overScrollMode="never"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/**
 * BrandRefreshFlatList:
 * - FlatList için İkonik Rota Geriye Sarma Pull-to-Refresh bileşeni.
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
  const pullAnim = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  useEffect(() => {
    if (refreshing) {
      Animated.spring(pullAnim, {
        toValue: 44,
        tension: 80,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(pullAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      setDragProgress(0);
    }
  }, [refreshing, pullAnim]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollYRef.current = y;
    if (y < 0) {
      const p = Math.min(1, Math.abs(y) / TRIGGER_DISTANCE);
      setDragProgress(p);
      pullAnim.setValue(Math.min(44, Math.abs(y) * 0.6));
    }
    onScroll?.(e);
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < -TRIGGER_DISTANCE && !refreshing) {
      onRefresh();
    }
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (scrollYRef.current <= 2) {
      touchStartYRef.current = e.nativeEvent.pageY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (touchStartYRef.current === null || refreshing) return;
    const currentY = e.nativeEvent.pageY;
    const diff = currentY - touchStartYRef.current;

    if (diff > 0 && scrollYRef.current <= 2) {
      isPullingRef.current = true;
      const distance = Math.min(80, diff * 0.45);
      const p = Math.min(1, distance / TRIGGER_DISTANCE);
      setDragProgress(p);
      pullAnim.setValue(distance * 0.65);
    } else if (isPullingRef.current && diff <= 0) {
      isPullingRef.current = false;
      setDragProgress(0);
      pullAnim.setValue(0);
    }
  };

  const handleTouchEnd = () => {
    if (isPullingRef.current) {
      isPullingRef.current = false;
      if (dragProgress >= 0.9 && !refreshing) {
        onRefresh();
      } else if (!refreshing) {
        Animated.spring(pullAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
        setDragProgress(0);
      }
    }
    touchStartYRef.current = null;
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

      <Animated.View
        style={[styles.flex, { transform: [{ translateY: pullAnim }] }]}
      >
        <FlatList<T>
          {...rest}
          style={styles.flex}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEndDrag}
          scrollEventThrottle={16}
          bounces={true}
          overScrollMode="never"
        >
        </FlatList>
      </Animated.View>
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
    height: 34,
    paddingHorizontal: 12,
    backgroundColor: "rgba(8, 26, 41, 0.96)",
    borderRadius: 17,
    borderWidth: 1.2,
    shadowColor: "#020910",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  routeContainer: {
    width: 54,
    height: 16,
    justifyContent: "center",
  },
  svgRoute: {
    width: 54,
    height: 16,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    marginHorizontal: 8,
  },
  statusSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusIcon: {
    fontSize: 11,
    color: "#38bdf8",
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dbeafe",
    letterSpacing: -0.2,
  },
});
