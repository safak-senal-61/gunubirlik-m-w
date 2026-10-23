import { useEffect, useRef, useState } from "react";
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
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const glowScale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0.2)).current;
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
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 700,
        delay: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
    ]).start();

    // 2. Forest Emerald / Mint Nefes Alan Aura
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.12,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.5,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 0.88,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.2,
            duration: 1600,
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
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();

    // Minimum 1.1 sn deneyim
    const minTimer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, 1100);

    // Emniyet Zamanlayıcısı: 3.5 sn sonra ağ gecikse bile kesinlikle aç
    const safetyTimer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, 3500);

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
          duration: 380,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setHidden(true);
          onFinishRef.current?.();
        });
      }, isReady ? 0 : 1500);

      return () => clearTimeout(exitTimer);
    }
  }, [minimumTimePassed, isReady]);

  if (hidden) return null;

  const logoWidth = Math.min(SCREEN_WIDTH * 0.74, 300);
  const logoHeight = logoWidth * (275 / 1024);

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

      {/* Arka Plan Ambient Zümrüt & Nane Işıkları (Web Kimliği) */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.glowBlob,
            styles.glowEmerald,
            {
              transform: [{ scale: glowScale }],
              opacity: glowOpacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.glowBlob,
            styles.glowMint,
            {
              transform: [{ scale: glowScale }],
              opacity: Animated.multiply(glowOpacity, 0.75),
            },
          ]}
        />
      </View>

      {/* Merkez Logo ve Animasyon Alanı */}
      <View style={styles.centerBox}>
        <Animated.View
          style={[
            styles.logoAura,
            {
              width: logoWidth * 1.2,
              height: logoHeight * 2.2,
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
            style={{ width: logoWidth, height: logoHeight }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Architectural Slogan & Alt Başlık */}
        <Animated.View style={[styles.taglineBox, { opacity: textOpacity }]}>
          <Text style={styles.taglineText}>SAHA İLETİŞİM & GÜNLÜK İŞ HATTI</Text>
          <View style={styles.dotSeparator} />
          <Text style={styles.subTagline}>Hızlı · Güvenli · Doğrudan İletişim</Text>
        </Animated.View>

        {/* Zümrüt İlerleme Göstergesi */}
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

      {/* Alt Rozet */}
      <View style={styles.footer}>
        <View style={styles.secureBadge}>
          <View style={styles.secureBadgeDot} />
          <Text style={styles.secureBadgeText}>CANLI SAHA BAĞLANTISI</Text>
        </View>
        <Text style={styles.versionText}>Günübirlik v1.4.3</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0C0E0D",
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
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: (SCREEN_WIDTH * 0.9) / 2,
  },
  glowEmerald: {
    backgroundColor: "#0D6847",
    top: SCREEN_HEIGHT * 0.22,
    left: SCREEN_WIDTH * 0.05,
    opacity: 0.35,
  },
  glowMint: {
    backgroundColor: "#5CD6A5",
    bottom: SCREEN_HEIGHT * 0.25,
    right: SCREEN_WIDTH * 0.05,
    opacity: 0.15,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoAura: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(13, 104, 71, 0.28)",
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  taglineBox: {
    marginTop: 22,
    alignItems: "center",
    gap: 6,
  },
  taglineText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#5CD6A5",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  dotSeparator: {
    width: 24,
    height: 1.5,
    backgroundColor: "rgba(226, 224, 216, 0.25)",
    marginVertical: 2,
  },
  subTagline: {
    fontSize: 12,
    fontWeight: "500",
    color: "#949B97",
    letterSpacing: 0.4,
  },
  progressSection: {
    marginTop: 36,
    alignItems: "center",
    gap: 10,
  },
  progressTrack: {
    width: 140,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#0D6847",
    borderRadius: 2,
    position: "relative",
    overflow: "hidden",
  },
  shimmerEffect: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 50,
    backgroundColor: "rgba(92, 214, 165, 0.55)",
    transform: [{ skewX: "-25deg" }],
  },
  statusText: {
    fontSize: 11,
    color: "#949B97",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  footer: {
    position: "absolute",
    bottom: 36,
    alignItems: "center",
    gap: 6,
  },
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  secureBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#5CD6A5",
  },
  secureBadgeText: {
    fontSize: 10,
    color: "#D8D5CC",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  versionText: {
    fontSize: 10,
    color: "#5C615E",
    fontWeight: "500",
  },
});
