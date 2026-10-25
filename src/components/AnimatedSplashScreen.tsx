import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

const BRAND_LOGO = require("../../assets/brand-logo.png");
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("screen");

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onFinish?: () => void;
  statusText?: string;
}

export default function AnimatedSplashScreen({
  isReady,
  onFinish,
  statusText = "Günübirlik hazırlanıyor…",
}: AnimatedSplashScreenProps) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const glowScale = useRef(new Animated.Value(0.95)).current;
  const glowOpacity = useRef(new Animated.Value(0.25)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(-120)).current;

  const [minimumTimePassed, setMinimumTimePassed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    // 1. Logo Açılış
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
    ]).start();

    // 2. Işıma / Glow Döngüsü
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.15,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.55,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 0.95,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.25,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    glowLoop.start();

    // 3. Shimmer Loop
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 140,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();

    // Minimum 0.8 sn deneyim
    const minTimer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, 800);

    // Emniyet Zamanlayıcısı: 2.5 sn sonra kesinlikle aç
    const safetyTimer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, 2500);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(safetyTimer);
      glowLoop.stop();
      shimmerLoop.stop();
    };
  }, []);

  // Çıkış Fade Animasyonu
  useEffect(() => {
    if (minimumTimePassed && (isReady || true)) {
      const exitTimer = setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setHidden(true);
          onFinishRef.current?.();
        });
      }, isReady ? 0 : 1200);

      return () => clearTimeout(exitTimer);
    }
  }, [minimumTimePassed, isReady]);

  if (hidden) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: containerOpacity,
        },
      ]}
      pointerEvents={minimumTimePassed && isReady ? "none" : "auto"}
    >
      <StatusBar style="light" />

      {/* Arka Plan Ambient Glow */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.glowBlob,
            styles.glowPrimary,
            {
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}
        />
      </View>

      {/* Merkez Logo ve Marka */}
      <View style={styles.centerBox}>
        <Animated.View
          style={[
            styles.logoAura,
            {
              width: 140,
              height: 140,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={BRAND_LOGO}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Marka Adı ve Slogan */}
        <Animated.View style={[styles.brandHeaderBox, { opacity: textOpacity }]}>
          <Text style={styles.brandTitleText}>Günübirlik</Text>
          <Text style={styles.brandSubText}>Konum Bazlı Günlük İş Platformu</Text>
        </Animated.View>

        {/* İlerleme Çubuğu */}
        <Animated.View style={[styles.progressSection, { opacity: textOpacity }]}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.shimmerEffect,
                  {
                    transform: [{ translateX: shimmerTranslate }],
                  },
                ]}
              />
            </Animated.View>
          </View>
          <Text style={styles.statusText}>{statusText}</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0B0E0D",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  },
  ambientContainer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  glowBlob: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: (SCREEN_WIDTH * 0.85) / 2,
  },
  glowPrimary: {
    backgroundColor: "#0D6847",
    top: SCREEN_HEIGHT * 0.28,
    left: SCREEN_WIDTH * 0.08,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoAura: {
    position: "absolute",
    borderRadius: 70,
    backgroundColor: "rgba(13, 104, 71, 0.35)",
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D6847",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 104,
    height: 104,
    borderRadius: 24,
  },
  brandHeaderBox: {
    marginTop: 20,
    alignItems: "center",
    gap: 4,
  },
  brandTitleText: {
    fontSize: 26,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  brandSubText: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "rgba(255, 255, 255, 0.7)",
  },
  progressSection: {
    marginTop: 28,
    alignItems: "center",
    gap: 10,
    width: 180,
  },
  progressTrack: {
    width: 160,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 2,
    position: "relative",
    overflow: "hidden",
  },
  shimmerEffect: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  statusText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
    color: "rgba(255, 255, 255, 0.55)",
    letterSpacing: 0.2,
  },
});
