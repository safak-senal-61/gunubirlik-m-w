import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
import { C } from "@/components/ui";

const BRAND_COLORS = [
  "#4f46e5", // Indigo (Ana Renk)
  "#059669", // Emerald (İşçi / Kazanç)
  "#d97706", // Amber (Yıldız / Güven)
  "#e11d48", // Rose (Günübirlik Canlı Aksiyon)
];

const TRIGGER_DISTANCE = 75;

interface BrandPullIndicatorProps {
  progress: number; // 0 to 1
  refreshing: boolean;
}

/**
 * Thirds-style Dinamik Circular Pull-to-Refresh İndikatörü
 * - Çekildikçe 4 logo rengi dairesel yörüngede döner ve merkeze doğru birleşir.
 * - Bırakılınca 360° akıcı rotasyon + harmonik nefes (converge/pulse) animasyonu.
 * - Bitince küçülerek ve solarak pürüzsüz kaybolur.
 */
export function BrandPullIndicator({ progress, refreshing }: BrandPullIndicatorProps) {
  // Sürekli dönüş animasyonu (refreshing esnasında)
  const spinAnim = useRef(new Animated.Value(0)).current;
  // Merkeze toparlanma / nabız animasyonu
  const pulseAnim = useRef(new Animated.Value(0)).current;
  // Bitiş kaybolma animasyonu (scale + opacity)
  const exitScale = useRef(new Animated.Value(1)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (refreshing) {
      exitScale.setValue(1);
      exitOpacity.setValue(1);

      spinLoopRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 450,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

      spinLoopRef.current.start();
      pulseLoopRef.current.start();
    } else {
      spinLoopRef.current?.stop();
      pulseLoopRef.current?.stop();
      spinAnim.setValue(0);
      pulseAnim.setValue(0);

      Animated.parallel([
        Animated.timing(exitScale, {
          toValue: 0.2,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      spinLoopRef.current?.stop();
      pulseLoopRef.current?.stop();
    };
  }, [refreshing, spinAnim, pulseAnim, exitScale, exitOpacity]);

  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.05 && !refreshing) return null;

  // Çekme esnasındaki rotasyon: 0 -> 240 derece
  const dragRotateDeg = `${p * 240}deg`;
  const continuousSpin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Çekildikçe dairenin yarıçapı 22px'den 11px'e toparlanır (renkler merkeze yaklaşır)
  const currentRadius = refreshing
    ? pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [11, 15],
      })
    : 24 - p * 13; // 24px -> 11px

  return (
    <Animated.View
      style={[
        styles.indicatorContainer,
        {
          transform: [
            { scale: refreshing ? exitScale : Math.min(1, 0.4 + p * 0.6) },
          ],
          opacity: refreshing ? exitOpacity : Math.min(1, p * 1.4),
        },
      ]}
      pointerEvents="none"
    >
      {/* Yumuşak gölgeli yuvarlak zemin */}
      <View style={styles.indicatorBadge}>
        {/* Dönen yörünge grubu */}
        <Animated.View
          style={[
            styles.orbitLayer,
            {
              transform: [
                { rotate: refreshing ? continuousSpin : dragRotateDeg },
              ],
            },
          ]}
        >
          {BRAND_COLORS.map((color, index) => {
            const angleDeg = index * 90; // 4 renk 90'ar derece arayla
            const angleRad = (angleDeg * Math.PI) / 180;
            return (
              <AnimatedOrbitDot
                key={color}
                color={color}
                angleRad={angleRad}
                radius={currentRadius}
                isRefreshing={refreshing}
              />
            );
          })}
        </Animated.View>

        {/* Merkezde toparlanan Günübirlik pırıltı/logo sembolü */}
        <View style={styles.centerPill}>
          <Text style={styles.centerSymbol}>✦</Text>
        </View>
      </View>
    </Animated.View>
  );
}

/** 4 logo renginin her bir orbital noktası */
function AnimatedOrbitDot({
  color,
  angleRad,
  radius,
  isRefreshing,
}: {
  color: string;
  angleRad: number;
  radius: number | Animated.AnimatedInterpolation<number>;
  isRefreshing: boolean;
}) {
  const sin = Math.sin(angleRad);
  const cos = Math.cos(angleRad);

  if (typeof radius === "number") {
    const x = cos * radius;
    const y = sin * radius;
    return (
      <View
        style={[
          styles.orbitDot,
          {
            backgroundColor: color,
            transform: [{ translateX: x }, { translateY: y }],
          },
        ]}
      />
    );
  }

  // Animated radius (pulse during refreshing)
  const transX = radius.interpolate({
    inputRange: [10, 20],
    outputRange: [cos * 10, cos * 20],
  });
  const transY = radius.interpolate({
    inputRange: [10, 20],
    outputRange: [sin * 10, sin * 20],
  });

  return (
    <Animated.View
      style={[
        styles.orbitDot,
        {
          backgroundColor: color,
          transform: [{ translateX: transX }, { translateY: transY }],
        },
      ]}
    />
  );
}

/**
 * BrandRefreshScrollView:
 * - Çekildikçe progressive oluşan Thirds-tarzı Günübirlik indikatörünü gösterir.
 * - Standart donuk OS spinner'ı gizler.
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
      {/* Ekranın en üstünde sabit, ipeksi animasyon alanı */}
      <View style={styles.headerAnchor} pointerEvents="none">
        <BrandPullIndicator
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
            // Standart spinner'ı görünmez yapıyoruz, üstte bizim custom indikatörümüz oynar!
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
 * - FlatList için Thirds-tarzı Günübirlik pull-to-refresh bileşeni.
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
        <BrandPullIndicator
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerAnchor: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  indicatorContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1e1b33",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  orbitLayer: {
    position: "absolute",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitDot: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  centerPill: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  centerSymbol: {
    fontSize: 9,
    fontWeight: "900",
    color: C.primary,
  },
});
