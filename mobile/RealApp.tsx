// EN ÖNEMLİ IMPORT: crash reporter tüm modül kodundan ÖNCE kurulmalı.
import "@/lib/crash-reporter";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { fetchApplicationsByJob, fetchNotifications, fetchSavedJobs, sendMessage, toggleSaveJob } from "@/lib/api";
import type { ApiApplication, ApiJob } from "@/lib/types";
import AuthScreen from "@/screens/AuthScreen";
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
import { RefreshHint } from "@/components/RefreshHint";
import { useCachedList } from "@/hooks/use-cached-list";

type Tab = "jobs" | "saved" | "applications" | "messages" | "notifications" | "profile";

type QrTarget = { app: ApiApplication };

// Runtime hatasında beyaz ekran yerine hatayı ekranda göster.
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
          <Text style={styles.h1}>Beklenmeyen bir hata oluştu</Text>
          <Text style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 8 }}>
            {String(error?.message ?? error)}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

function Root() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={[styles.flex, styles.center]}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: C.primary, marginBottom: 6 }}>Günübirlik</Text>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Yükleniyor…</Text>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <AuthScreen onDone={() => { /* user state değişince Root yeniden render olur */ }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={["top"]}>
      <StatusBar style="dark" />
      <MainTabs />
    </SafeAreaView>
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

  // "Sohbet Et": karşı tarafa nezaket mesajı gönderip konuşmayı açar (POST /conversations).
  const startChat = useCallback(
    async (participantId: string, jobId: string | null) => {
      if (!participantId || chatBusy) return;
      setChatBusy(true);
      try {
        await sendMessage({
          recipientId: participantId,
          ...(jobId ? { jobId } : {}),
          content: "Merhaba! İlanınız hakkında konuşmak istiyorum. 👋",
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
        />
        <TabBar tab={tab} setTab={setTab} isEmployer={!!isEmployer} unread={unread} />
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
      <View style={styles.content}>
        {tab === "jobs" &&
          (isEmployer ? (
            <DashboardScreen onOpenJob={openJob} refreshKey={refreshKey} />
          ) : (
            <JobsScreen userCoords={user ? null : null} onOpenJob={openJob} refreshKey={refreshKey} />
          ))}
        {tab === "saved" && <SavedScreen onOpenJob={openJob} refreshKey={refreshKey} />}
        {tab === "applications" && (
          <ApplicationsScreen refreshKey={refreshKey} onStartChat={startChat} onShowQR={showAppQR} />
        )}
        {tab === "messages" && <MessagesScreen refreshKey={refreshKey} />}
        {tab === "notifications" && (
          <NotificationsScreen
            refreshKey={refreshKey}
            onChanged={bumpRefresh}
            onOpenJob={(jobId) => setOpenJobId(jobId)}
          />
        )}
        {tab === "profile" && <ProfileScreen refreshKey={refreshKey} />}
      </View>
      <TabBar tab={tab} setTab={setTab} isEmployer={!!isEmployer} unread={unread} onNavigate={bumpRefresh} />

      {!isEmployer && (
        <Pressable style={styles.scanFab} onPress={() => setScannerOpen(true)}>
          <Text style={styles.scanFabText}>📷 QR Tara</Text>
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
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.savedWrap}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshSaved}
          tintColor={C.primary}
          colors={[C.primary]}
          progressBackgroundColor="#fff"
        />
      }
    >
      <RefreshHint refreshing={refreshing} />
      <Text style={styles.h1}>Kaydedilenler</Text>
      <Text style={styles.sub}>Daha sonra başvurmak için kaydettiğin ilanlar. ↓ Aşağı çekerek yenile.</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={C.primary} />
      ) : jobs.length === 0 ? (
        <EmptyState emoji="♡" title="Kayıtlı ilan yok" subtitle="İlan kartlarındaki ♡ ile kaydet." />
      ) : (
        jobs.map((job) => (
          <Card key={job.id}>
            <JobCardInline job={job} onOpen={() => onOpenJob(job)} onUnsave={reload} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function JobCardInline({ job, onOpen, onUnsave }: { job: ApiJob; onOpen: () => void; onUnsave: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={onOpen}>
        <Text style={styles.savedTitle}>{job.title}</Text>
        <Text style={styles.savedMeta}>
          {job.district}, {job.city} · {job.wageAmount.toLocaleString("tr-TR")} ₺{job.wageType === "HOURLY" ? "/saat" : "/gün"}
        </Text>
      </Pressable>
      <PrimaryButton
        label="Kaydı kaldır"
        variant="ghost"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await toggleSaveJob(job.id);
            onUnsave();
          } catch {
            // sessiz
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

function TabBar({
  tab,
  setTab,
  isEmployer,
  unread,
  onNavigate,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  isEmployer: boolean;
  unread: number;
  onNavigate?: () => void;
}) {
  const tabs: { key: Tab; icon: string; label: string }[] = isEmployer
    ? [
        { key: "jobs", icon: "💼", label: "Panel" },
        { key: "applications", icon: "📥", label: "Başvuru" },
        { key: "messages", icon: "💬", label: "Mesaj" },
        { key: "notifications", icon: "🔔", label: "Bildirim" },
        { key: "profile", icon: "⚙️", label: "Ayarlar" },
      ]
    : [
        { key: "jobs", icon: "💼", label: "İşler" },
        { key: "saved", icon: "♡", label: "Kayıtlı" },
        { key: "applications", icon: "📥", label: "Başvuru" },
        { key: "messages", icon: "💬", label: "Mesaj" },
        { key: "notifications", icon: "🔔", label: "Bildirim" },
        { key: "profile", icon: "⚙️", label: "Ayarlar" },
      ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          style={styles.tabItem}
          onPress={() => {
            setTab(t.key);
            onNavigate?.();
          }}
        >
          <Text style={[styles.tabIcon, tab === t.key && styles.tabIconActive]}>{t.icon}</Text>
          <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          {t.key === "notifications" && unread > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: "#fff",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    gap: 2,
  },
  tabIcon: { fontSize: 20, opacity: 0.55 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 10, fontWeight: "600", color: C.muted },
  tabLabelActive: { color: C.primary },
  tabBadge: {
    position: "absolute",
    top: 4,
    right: "28%",
    backgroundColor: "#e11d48",
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  chatTargetCard: { position: "absolute", left: 16, right: 16, bottom: 80, padding: 14, gap: 10 },
  scanFab: {
    position: "absolute",
    right: 16,
    bottom: 84,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
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
