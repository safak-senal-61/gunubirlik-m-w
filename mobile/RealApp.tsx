// EN ÖNEMLİ IMPORT: crash reporter tüm modül kodundan ÖNCE kurulmalı.
import "@/lib/crash-reporter";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import {
  fetchApplicationsByJob,
  fetchMaintenanceStatus,
  fetchNotifications,
  fetchSavedJobs,
  sendMessage,
  type MaintenanceStatus,
} from "@/lib/api";
import { toggleSaved, useSavedIds } from "@/lib/saved-store";
import { consumeColdStartIntent, initOneSignal, onPushArrived, onPushNavigate } from "@/lib/onesignal";
import type { ApiApplication, ApiJob } from "@/lib/types";
import AuthScreen from "@/screens/AuthScreen";
import MaintenanceScreen from "@/screens/MaintenanceScreen";
import JobsScreen, { JobCard } from "@/screens/JobsScreen";
import JobDetailScreen from "@/screens/JobDetailScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import ApplicationsScreen from "@/screens/ApplicationsScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import QRScreen from "@/screens/QRScreen";
import QrScannerScreen from "@/screens/QrScannerScreen";
import { Card, C, EmptyState, PrimaryButton } from "@/components/ui";
import { BookmarkIcon, QrScanIcon } from "@/components/icons";
import { useCachedList } from "@/hooks/use-cached-list";
import AnimatedSplashScreen from "@/components/AnimatedSplashScreen";
import { AnimatedTabBar } from "@/components/AnimatedTabBar";
import { AppHeader } from "@/components/AppHeader";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

type Tab = "jobs" | "saved" | "applications" | "messages" | "notifications" | "profile";

type QrTarget = { app: ApiApplication };

// Runtime hatasında beyaz ekran yerine hatayı ekranda göster ve tekrar deneme şansı ver.
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("App crash:", error);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <View style={[styles.flex, styles.center, { padding: 24, backgroundColor: "#fff" }]}>
          <Text style={styles.h1}>Bir şeyler ters gitti</Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center", marginTop: 8, lineHeight: 18 }}>
            {String(error?.message ?? error)}
          </Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{
              marginTop: 18,
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: C.primary,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Tekrar Dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  initOneSignal();
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  return (
    <AppErrorBoundary>
      <SafeAreaProvider style={styles.flex}>
        <StatusBar style="dark" />
        <MaintenanceGate>
          <AuthProvider>
            <Root fontsReady={fontsLoaded} />
          </AuthProvider>
        </MaintenanceGate>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const MAINT_POLL_MS = 60_000; // 1 dakikada bir bakım durumu kontrolü
const MAINT_CACHE_KEY = "gb_maint_cache";

/**
 * Bakım modu kapısı: admin panelden bakıma aldığında (60 sn içinde) uygulamanın
 * TAMAMI — giriş ekranı dahil — bakım ekranına döner, hiçbir şeye erişilemez.
 * Durum AsyncStorage'a da yazılır: bakım kapalıysa uygulama bekletilmeden açılır.
 */
function MaintenanceGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [gateReady, setGateReady] = useState(true);

  const applyStatus = useCallback(async (s: MaintenanceStatus) => {
    setStatus(s);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorageMod = require("@react-native-async-storage/async-storage");
      const AS = (AsyncStorageMod.default ?? AsyncStorageMod) as {
        setItem: (k: string, v: string) => Promise<void>;
      };
      await AS.setItem(MAINT_CACHE_KEY, JSON.stringify(s));
    } catch {
      // yok say
    }
  }, []);

  const check = useCallback(async () => {
    try {
      const s = await fetchMaintenanceStatus();
      await applyStatus(s);
    } catch {
      // Ağ hatası veya offline: uygulamayı kilitleme
    } finally {
      setGateReady(true);
    }
  }, [applyStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Hızlı yol: önbellekte "bakım kapalı" yazıyorsa uygulamayı hemen aç,
      // doğrulamayı arka planda yap.
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorageMod = require("@react-native-async-storage/async-storage");
        const AS = (AsyncStorageMod.default ?? AsyncStorageMod) as {
          getItem: (k: string) => Promise<string | null>;
        };
        const raw = await AS.getItem(MAINT_CACHE_KEY);
        if (raw && !cancelled) {
          const cached = JSON.parse(raw) as MaintenanceStatus;
          if (!cached.maintenanceMode) {
            setStatus(cached);
            setGateReady(true);
          }
        }
      } catch {
        // yok say
      }
      await check();
    })();
    const t = setInterval(() => {
      if (!cancelled) void check();
    }, MAINT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [check]);

  if (!gateReady) {
    return <AnimatedSplashScreen isReady={false} statusText="Bağlantı kuruluyor…" />;
  }

  if (status?.maintenanceMode) {
    return (
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <MaintenanceScreen status={status} onRetry={check} />
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

function Root({ fontsReady }: { fontsReady: boolean }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashFinished(true), []);

  return (
    <View style={styles.flex}>
      {!isAuthenticated || !user ? (
        <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          <AuthScreen onDone={() => { /* user state değişince Root yeniden render olur */ }} />
        </SafeAreaView>
      ) : (
        <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          <MainTabs />
        </SafeAreaView>
      )}

      {/* Animasyonlu Marka Splash Ekranı */}
      {!splashFinished && (
        <AnimatedSplashScreen
          isReady={!isLoading && fontsReady}
          onFinish={handleSplashFinish}
          statusText={isLoading ? "Hesap doğrulanıyor…" : "Hoş geldiniz!"}
        />
      )}
    </View>
  );
}

function MainTabs() {
  const { user } = useAuth();
  const isEmployer = user?.role === "EMPLOYER";
  const [tab, setTab] = useState<Tab>(isEmployer ? "jobs" : "jobs");
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chatBusy, setChatBusy] = useState(false);
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Bildirimler ekranındaki "Bildirimler kapalı" bandına dokununca Ayarlar > Bildirim açılır.
  const [profileOpenTab, setProfileOpenTab] = useState<"notifications" | null>(null);
  // Push deep link: gunubirlik://wallet → Cüzdan, verification/profile → Hesap.
  const [profileSub, setProfileSub] = useState<"wallet" | "verification" | "profile" | null>(null);
  // Push deep link: gunubirlik://messages/{id} → doğrudan açılacak konuşma.
  const [openConversationId, setOpenConversationId] = useState<string | null>(null);
  // Sohbet içindeyken alt navigasyon çubuğu gizlenir (tam ekran odak).
  const [isInsideChat, setIsInsideChat] = useState(false);

  // Bildirim sayacı (30 sn'de bir)
  useEffect(() => {
    let active = true;
    const load = () => {
      fetchNotifications()
        .then((r) => {
          if (active) setUnread(r.unreadCount);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [refreshKey]);

  const openJob = useCallback((job: ApiJob) => setOpenJobId(job.id), []);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // OneSignal push bildirimi tıklandığında ilgili ekrana yönlendir.
  // gunubirlik:// launchURL (backend app_url) parse edilmiş halde gelir:
  // messages/{id} → doğrudan konuşma, wallet/verification/profile → profil,
  // jobs/{id} → ilan detayı, applications → başvurular.
  useEffect(
    () =>
      onPushNavigate((intent) => {
        setOpenJobId(intent.jobId ?? null);
        setOpenConversationId(intent.conversationId ?? null);
        if (intent.tab === "profile") {
          // wallet → Cüzdan; verification/profile → Hesap (Bildirim → Ayarlar açar).
          setProfileSub(intent.profileSub ?? null);
          setProfileOpenTab(intent.profileSub ? null : "notifications");
          setTab("profile");
        } else {
          setTab(intent.tab);
        }
        bumpRefresh();
      }),
    [bumpRefresh],
  );

  // Uygulama ön plandayken bildirim gelirse okunmamış rozetini tazele.
  useEffect(() => onPushArrived(() => setUnread((u) => u + 1)), []);

  // Soğuk başlatma: uygulama kapalıyken bildirime dokunulduysa doğru ekrana aç.
  // (JS dinleyicileri geç bağlandığı için hedef initOneSignal içinde saklanır.)
  const coldIntent = consumeColdStartIntent();
  useEffect(() => {
    if (!coldIntent) return;
    const t = setTimeout(() => {
      setOpenJobId(coldIntent.jobId ?? null);
      setOpenConversationId(coldIntent.conversationId ?? null);
      if (coldIntent.tab === "profile") {
        setProfileSub(coldIntent.profileSub ?? null);
        setProfileOpenTab(coldIntent.profileSub ? null : "notifications");
        setTab("profile");
      } else {
        setTab(coldIntent.tab);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alt menüye her basışta açık detay kartı KAPANIR + veriler sessizce tazelenir.
  // (Önceden sadece sekme değişiyor, detay kartı ekranda kalıyordu.)
  const handleTabPress = useCallback(
    (t: Tab) => {
      setOpenJobId(null);
      setIsInsideChat(false);
      setTab(t);
      bumpRefresh();
    },
    [bumpRefresh],
  );

  // Sohbete başlama: nötr karşılama mesajı.
  // "İlanınız" kelimesi backend spam filtresine takıldığı için (v1.2.0'da başvuru
  // mesajında da aynı sorun yaşandı) karşılama bu kelimeyi İÇERMEZ; ayrıca
  // doc-exact payload kullanır: { recipientId, content, type: "TEXT" }.
  const startChat = useCallback(
    async (participantId: string, jobId: string | null) => {
      if (!participantId || chatBusy) return;
      setChatBusy(true);
      try {
        await sendMessage({
          recipientId: participantId,
          ...(jobId ? { jobId } : {}),
          content: "Merhaba! Bu iş hakkında konuşmak istiyorum. 👋",
          type: "TEXT",
        });
        setOpenJobId(null);
        setTab("messages");
        bumpRefresh();
      } catch (err) {
        Alert.alert(
          "Mesaj gönderilemedi",
          err instanceof Error ? err.message : "Tekrar deneyin.",
        );
      } finally {
        setChatBusy(false);
      }
    },
    [chatBusy, bumpRefresh],
  );

  // İşveren ilan detayından QR açarsa: kabul edilmiş (veya tamamlanmış) başvuruyu bul.
  const showJobQR = useCallback(async (job: ApiJob) => {
    try {
      const apps = await fetchApplicationsByJob(job.id);
      const target =
        apps.find((a) => a.status === "ACCEPTED") ?? apps.find((a) => a.status === "COMPLETED");
      if (!target) {
        Alert.alert(
          "QR için işçi gerekli",
          "Bu ilan için kabul edilmiş bir işçi yok. QR, başvuruyu kabul ettikten sonra kullanılabilir.",
        );
        return;
      }
      setQrTarget({ app: target });
    } catch (err) {
      Alert.alert("Başvurular alınamadı", err instanceof Error ? err.message : "Tekrar dene.");
    }
  }, []);

  const showAppQR = useCallback((app: ApiApplication) => {
    setQrTarget({ app });
  }, []);

  if (openJobId) {
    return (
      <View style={styles.flex}>
        <JobDetailScreen
          jobId={openJobId}
          onBack={() => { setOpenJobId(null); bumpRefresh(); }}
          onStartChat={(participantId, jobId) => {
            setOpenJobId(null);
            startChat(participantId, jobId);
          }}
          onShowQR={(job) => {
            void showJobQR(job);
          }}
          onScanQR={() => {
            setScannerOpen(true);
          }}
        />
        <AnimatedTabBar
          currentTab={tab}
          onPressTab={handleTabPress}
          isEmployer={!!isEmployer}
          unreadCount={unread}
        />
        {qrTarget && (
          <QRScreen
            applicationId={qrTarget.app.id}
            jobTitle={qrTarget.app.job?.title ?? "İş"}
            wage={qrTarget.app.job?.wageAmount ?? qrTarget.app.proposedWage ?? 0}
            wageType={qrTarget.app.job?.wageType ?? "DAILY"}
            workerName={qrTarget.app.worker?.fullName}
            employerName={qrTarget.app.job?.employer?.companyName ?? qrTarget.app.job?.employer?.fullName}
            isEmployer={!!isEmployer}
            onClose={() => setQrTarget(null)}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {!isInsideChat && (
        <AppHeader
          unreadCount={unread}
          onPressNotifications={() => handleTabPress("notifications")}
        />
      )}
      <View style={styles.content}>
        {tab === "jobs" &&
          (isEmployer ? (
            <DashboardScreen
              onOpenJob={openJob}
              refreshKey={refreshKey}
              onNavigateApplications={() => handleTabPress("applications")}
            />
          ) : (
            <JobsScreen userCoords={user ? null : null} onOpenJob={openJob} refreshKey={refreshKey} />
          ))}
        {tab === "saved" && <SavedScreen onOpenJob={openJob} refreshKey={refreshKey} />}
        {tab === "applications" && (
          <ApplicationsScreen
            refreshKey={refreshKey}
            onStartChat={startChat}
            onShowQR={showAppQR}
            onScanQR={() => setScannerOpen(true)}
          />
        )}
        {tab === "messages" && (
          <MessagesScreen
            refreshKey={refreshKey}
            openConversationId={openConversationId}
            onOpenConversationHandled={() => setOpenConversationId(null)}
            onActiveThreadChange={setIsInsideChat}
          />
        )}
        {tab === "notifications" && (
          <NotificationsScreen
            refreshKey={refreshKey}
            onChanged={bumpRefresh}
            onOpenJob={(jobId) => setOpenJobId(jobId)}
            onOpenNotificationSettings={() => {
              setProfileOpenTab("notifications");
              setTab("profile");
            }}
          />
        )}
        {tab === "profile" && (
          <ProfileScreen
            refreshKey={refreshKey}
            openTab={profileOpenTab}
            openSub={profileSub}
            onOpenTabHandled={() => {
              setProfileOpenTab(null);
              setProfileSub(null);
            }}
          />
        )}
      </View>
      {!isInsideChat && (
        <AnimatedTabBar
          currentTab={tab}
          onPressTab={handleTabPress}
          isEmployer={!!isEmployer}
          unreadCount={unread}
        />
      )}

      {/* QR tarama FAB'ı sadece İşler ve Başvuru sekmelerinde görünür;
          Mesajlar ekranında mesaj yazma/gönderme alanının üstüne biniyordu. */}
      {!isEmployer && (tab === "jobs" || tab === "applications") && (
        <Pressable style={styles.scanFab} onPress={() => setScannerOpen(true)}>
          <QrScanIcon size={18} color="#FFFFFF" />
          <Text style={styles.scanFabText}>QR Tara</Text>
        </Pressable>
      )}
      {scannerOpen && (
        <QrScannerScreen
          onClose={() => setScannerOpen(false)}
          onScanned={() => {
            bumpRefresh();
            setTab("applications");
          }}
        />
      )}

      {qrTarget && (
        <QRScreen
          applicationId={qrTarget.app.id}
          jobTitle={qrTarget.app.job?.title ?? "İş"}
          wage={qrTarget.app.job?.wageAmount ?? qrTarget.app.proposedWage ?? 0}
          wageType={qrTarget.app.job?.wageType ?? "DAILY"}
          workerName={qrTarget.app.worker?.fullName}
          employerName={qrTarget.app.job?.employer?.companyName ?? qrTarget.app.job?.employer?.fullName}
          isEmployer={!!isEmployer}
          onClose={() => setQrTarget(null)}
        />
      )}
    </View>
  );
}

function SavedScreen({ onOpenJob, refreshKey }: { onOpenJob: (job: ApiJob) => void; refreshKey: number }) {
  const savedFetcher = useCallback(() => fetchSavedJobs(), []);
  const {
    data: jobsData,
    loading,
    refreshing,
    refresh: refreshSaved,
    reload,
  } = useCachedList("jobs:saved", savedFetcher, []);
  const [jobs, setJobs] = useState<ApiJob[]>([]);

  useEffect(() => {
    if (jobsData) setJobs(jobsData);
  }, [jobsData]);

  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);

  return (
    <View style={styles.savedScreenContainer}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.savedWrap}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshSaved}
            tintColor={C.primary}
            colors={[C.primary]}
            progressBackgroundColor="#ffffff"
          />
        }
      >
        <Text style={styles.h1}>Kaydedilenler</Text>
        <Text style={styles.sub}>Daha sonra başvurmak için kaydettiğin ilanlar. ↓ Aşağı çekerek yenile.</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={C.primary} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<BookmarkIcon size={24} color={C.muted} />}
            title="Kayıtlı İlan Yok"
            subtitle="İlan kartlarındaki kaydet butonuna dokunarak ilanları buraya ekleyebilirsiniz."
          />
        ) : (
          jobs.map((job) => (
            <JobCardInline key={job.id} job={job} onOpen={() => onOpenJob(job)} onUnsave={reload} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function JobCardInline({ job, onOpen, onUnsave }: { job: ApiJob; onOpen: () => void; onUnsave: () => void }) {
  const [busy, setBusy] = useState(false);
  const savedIds = useSavedIds();
  return (
    <JobCard
      job={job}
      isSaved={savedIds.includes(job.id)}
      saving={busy}
      onPress={onOpen}
      onSave={async () => {
        setBusy(true);
        try {
          await toggleSaved(job.id);
          onUnsave();
        } catch {
          // sessiz
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  content: { flex: 1, backgroundColor: C.bg },
  savedScreenContainer: { flex: 1, backgroundColor: C.bg },
  chatTargetCard: { position: "absolute", left: 16, right: 16, bottom: 80, padding: 14, gap: 10 },
  scanFab: {
    position: "absolute",
    right: 16,
    bottom: 84,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  scanFabText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  savedWrap: { padding: 16, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: -6 },
  savedTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  savedMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
});
