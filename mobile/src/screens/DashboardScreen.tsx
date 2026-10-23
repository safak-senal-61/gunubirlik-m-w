import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Card, C, EmptyState, Loading, PrimaryButton, SectionTitle, StatCard } from "@/components/ui";
import { useCachedList } from "@/hooks/use-cached-list";
import { createJob, deleteJob, fetchCategories, fetchJobs } from "@/lib/api";
import type { ApiCategory, ApiJob, JobCategory, JobStatus } from "@/lib/types";
import {
  CATEGORY_ICONS,
  JOB_STATUS_LABELS,
  URGENCY_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import { addressToFormFields, locateAndReverse } from "@/hooks/use-location";
import { useAuth } from "@/hooks/use-auth";
import { DatePicker, TimePicker } from "@/components/pickers";
import { BrandRefreshScrollView } from "@/components/BrandPullToRefresh";

export default function DashboardScreen({
  onOpenJob,
  refreshKey,
  onNavigateApplications,
}: {
  onOpenJob: (job: ApiJob) => void;
  refreshKey: number;
  onNavigateApplications?: () => void;
}) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Tüm açık iş ilanları (Piyasa)
  const allJobsFetcher = useCallback(
    () => fetchJobs({ status: "OPEN", limit: 50 }),
    [],
  );
  const {
    data: allJobsData,
    loading: allLoading,
    refreshing: allRefreshing,
    refresh: refreshAllJobs,
    reload: reloadAll,
  } = useCachedList("jobs:dashboard:all", allJobsFetcher, []);

  // Benim yayınladığım ilanlar
  const myJobsFetcher = useCallback(
    () => fetchJobs({ mine: true, employerId: user?.id, limit: 50 }),
    [user?.id],
  );
  const myCacheKey = `jobs:mine:${user?.id ?? "anon"}`;
  const {
    data: myJobsData,
    loading: myLoading,
    refreshing: myRefreshing,
    refresh: refreshMyJobs,
    reload: reloadMine,
  } = useCachedList(myCacheKey, myJobsFetcher, [user?.id]);

  useEffect(() => {
    if (refreshKey > 0) {
      reloadAll();
      reloadMine();
    }
  }, [refreshKey, reloadAll, reloadMine]);

  const allJobs = allJobsData?.items ?? [];
  const myJobs = myJobsData?.items ?? [];

  const currentList = viewMode === "ALL" ? allJobs : myJobs;
  const filteredJobs = search.trim()
    ? currentList.filter(
        (j) =>
          j.title.toLowerCase().includes(search.toLowerCase()) ||
          j.district.toLowerCase().includes(search.toLowerCase()) ||
          j.city.toLowerCase().includes(search.toLowerCase()),
      )
    : currentList;

  const totalMyApps = myJobs.reduce((s, j) => s + j.applicationCount, 0);
  const totalOpenMarket = allJobs.filter((j) => j.status === "OPEN").length;

  const handleRefresh = () => {
    if (viewMode === "ALL") refreshAllJobs();
    else refreshMyJobs();
  };

  const isRefreshing = viewMode === "ALL" ? allRefreshing : myRefreshing;
  const isLoading = viewMode === "ALL" ? allLoading && allJobs.length === 0 : myLoading && myJobs.length === 0;

  return (
    <BrandRefreshScrollView
      style={styles.flex}
      contentContainerStyle={styles.wrap}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      {/* Üst Karşılama ve İşveren Rozeti */}
      <View style={styles.headerBox}>
        <View style={styles.headerTop}>
          <View style={styles.employerBadge}>
            <Text style={styles.employerBadgeText}>🏢 İŞVEREN PANELİ</Text>
          </View>
          <View style={styles.quickStatPill}>
            <View style={styles.livePulseDot} />
            <Text style={styles.quickStatPillText}>Piyasa Canlı</Text>
          </View>
        </View>
        <Text style={styles.h1}>
          Merhaba{user?.companyName ? `, ${user.companyName}` : user?.fullName ? `, ${user.fullName}` : ""} 👋
        </Text>
        <Text style={styles.sub}>
          Piyasadaki işleri incele, ilanlarını ve başvuruları kolayca yönet.
        </Text>
      </View>

      {/* İstatistik & Hızlı Filtre Kartları (Tam Kare / 1:1) */}
      <View style={styles.statRow}>
        <EmployerMetricCard
          icon="🌐"
          label="Piyasa Açık"
          value={totalOpenMarket}
          badgeText="Canlı"
          theme="indigo"
          active={viewMode === "ALL"}
          onPress={() => setViewMode("ALL")}
        />
        <EmployerMetricCard
          icon="💼"
          label="İlanlarım"
          value={myJobs.length}
          badgeText="Yayında"
          theme="emerald"
          active={viewMode === "MINE"}
          onPress={() => setViewMode("MINE")}
        />
        <EmployerMetricCard
          icon="📥"
          label="Gelen Başvuru"
          value={totalMyApps}
          badgeText={totalMyApps > 0 ? "Yeni" : undefined}
          theme="amber"
          onPress={() => {
            if (onNavigateApplications) {
              onNavigateApplications();
            } else {
              setViewMode("MINE");
            }
          }}
        />
      </View>

      {/* Yeni İlan Ver Butonu - Düzgün, Dikdörtgen ve Şık */}
      <Pressable
        style={({ pressed }) => [
          styles.createJobBtn,
          pressed && styles.createJobBtnPressed,
        ]}
        onPress={() => setCreateOpen(true)}
      >
        <Text style={styles.createJobBtnIcon}>＋</Text>
        <Text style={styles.createJobBtnText}>Yeni İlan Yayınla</Text>
      </Pressable>

      {/* Segment switcher: Tüm İlanlar vs Benim İlanlarım */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segmentBtn, viewMode === "ALL" && styles.segmentBtnActive]}
          onPress={() => setViewMode("ALL")}
        >
          <Text style={[styles.segmentText, viewMode === "ALL" && styles.segmentTextActive]}>
            🌐 Piyasa İlanları ({allJobs.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, viewMode === "MINE" && styles.segmentBtnActive]}
          onPress={() => setViewMode("MINE")}
        >
          <Text style={[styles.segmentText, viewMode === "MINE" && styles.segmentTextActive]}>
            💼 İlanlarım ({myJobs.length})
          </Text>
        </Pressable>
      </View>

      {/* Hızlı Arama */}
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder={viewMode === "ALL" ? "Piyasadaki ilanlarda ara (başlık, ilçe)…" : "İlanlarımda ara…"}
        placeholderTextColor={C.muted}
      />

      {isLoading ? (
        <Loading />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          emoji={viewMode === "ALL" ? "🔍" : "💼"}
          title={viewMode === "ALL" ? "İlan bulunamadı" : "Henüz ilanın yok"}
          subtitle={
            viewMode === "ALL"
              ? "Arama kriterlerine uygun ilan bulunamadı."
              : "İlk günübirlik iş ilanını yayınla; işçiler aynı gün başvursun."
          }
        />
      ) : (
        filteredJobs.map((job) => (
          <EmployerJobCard
            key={job.id}
            job={job}
            currentUserId={user?.id}
            onChanged={() => {
              reloadAll();
              reloadMine();
            }}
            onPress={() => onOpenJob(job)}
          />
        ))
      )}

      <CreateJobSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          reloadAll();
          reloadMine();
        }}
      />
    </BrandRefreshScrollView>
  );
}

const METRIC_THEMES = {
  indigo: {
    accent: "#4f46e5",
    iconBg: "#eef2ff",
    iconBorder: "#e0e7ff",
    activeBorder: "#6366f1",
    activeBg: "#f8faff",
    badgeBg: "#e0e7ff",
    badgeText: "#4338ca",
  },
  emerald: {
    accent: "#059669",
    iconBg: "#ecfdf5",
    iconBorder: "#d1fae5",
    activeBorder: "#10b981",
    activeBg: "#f0fdf4",
    badgeBg: "#d1fae5",
    badgeText: "#047857",
  },
  amber: {
    accent: "#d97706",
    iconBg: "#fffbeb",
    iconBorder: "#fef3c7",
    activeBorder: "#f59e0b",
    activeBg: "#fffdf5",
    badgeBg: "#fef3c7",
    badgeText: "#b45309",
  },
};

function EmployerMetricCard({
  icon,
  label,
  value,
  badgeText,
  theme,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  value: number;
  badgeText?: string;
  theme: "indigo" | "emerald" | "amber";
  active?: boolean;
  onPress?: () => void;
}) {
  const t = METRIC_THEMES[theme];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        active && {
          borderColor: t.activeBorder,
          backgroundColor: t.activeBg,
          shadowColor: t.accent,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 3,
        },
        pressed && styles.metricCardPressed,
      ]}
    >
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIconWrap, { backgroundColor: t.iconBg, borderColor: t.iconBorder }]}>
          <Text style={styles.metricIconText}>{icon}</Text>
        </View>
        {badgeText ? (
          <View style={[styles.metricPill, { backgroundColor: t.badgeBg }]}>
            {theme === "indigo" ? <View style={styles.liveDot} /> : null}
            <Text style={[styles.metricPillText, { color: t.badgeText }]}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metricBottomGroup}>
        <Text style={[styles.metricValue, active && { color: t.accent }]}>
          {value.toLocaleString("tr-TR")}
        </Text>
        <Text style={styles.metricLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function EmployerJobCard({
  job,
  currentUserId,
  onChanged,
  onPress,
}: {
  job: ApiJob;
  currentUserId?: string;
  onChanged: () => void;
  onPress: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isOwner = Boolean(currentUserId && job.employerId === currentUserId);

  const remove = () => {
    Alert.alert("İlanı sil", "Bu ilan kalıcı olarak silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteJob(job.id);
            onChanged();
          } catch {
            // sessiz
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Card style={styles.jobCard}>
      <Pressable onPress={onPress}>
        <View style={styles.topRow}>
          <View style={styles.catIconWrap}>
            <Text style={styles.catIcon}>{CATEGORY_ICONS[job.category]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
            <Text style={styles.meta}>
              📅 {new Date(job.workDate).toLocaleDateString("tr-TR")} · {job.startTime.slice(0, 5)}–{job.endTime.slice(0, 5)} · {job.district}
            </Text>
          </View>
          <Badge
            label={JOB_STATUS_LABELS[job.status]}
            color={job.status === "OPEN" ? C.emerald : job.status === "FILLED" ? C.indigo : C.stone}
            bg={job.status === "OPEN" ? C.emeraldBg : job.status === "FILLED" ? C.indigoBg : C.stoneBg}
          />
        </View>
        <View style={styles.jobBottomRow}>
          <Text style={styles.wageText}>
            {formatWage(job.wageAmount, job.wageType)}
          </Text>
          <Text style={styles.metaSmall}>
            {job.applicationCount} başvuru · {timeAgo(job.createdAt)}
          </Text>
        </View>
      </Pressable>
      {isOwner && (
        <View style={styles.actions}>
          <PrimaryButton label="🗑️ İlanı Sil" variant="ghost" disabled={busy} onPress={remove} />
        </View>
      )}
    </Card>
  );
}

function CreateJobSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<JobCategory>("INSAAT");
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [wage, setWage] = useState("");
  const [wageType, setWageType] = useState<"DAILY" | "HOURLY">("DAILY");
  const [city, setCity] = useState("İstanbul");
  const [district, setDistrict] = useState("Kadıköy");
  const [address, setAddress] = useState("");
  const [openings, setOpenings] = useState("1");
  const [urgency, setUrgency] = useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
  const [skills, setSkills] = useState("");
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jobStep, setJobStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setJobStep(1);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setCategory(cats[0].value);
      })
      .catch(() => {});
  }, []);

  const grabLocation = async () => {
    setLocating(true);
    try {
      const { coords, address: addr } = await locateAndReverse();
      const fields = addressToFormFields(addr);
      if (fields.city) setCity(fields.city);
      if (fields.district) setDistrict(fields.district);
      if (fields.addressText) setAddress(fields.addressText);
      setLatLng(coords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konum alınamadı");
    } finally {
      setLocating(false);
    }
  };

  const durationHours = (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return Math.round((diff / 60) * 10) / 10;
  })();

  const handleNextStep = () => {
    setError(null);
    if (jobStep === 1) {
      if (!title.trim()) {
        setError("Lütfen iş başlığını girin.");
        return;
      }
      if (!category) {
        setError("Lütfen bir kategori seçin.");
        return;
      }
      if (description.trim().length < 20) {
        setError(`Açıklama en az 20 karakter olmalıdır (Şu an: ${description.trim().length})`);
        return;
      }
      setJobStep(2);
    } else if (jobStep === 2) {
      if (!workDate) {
        setError("Lütfen çalışma gününü seçin.");
        return;
      }
      const w = Number(wage);
      if (!w || w <= 0) {
        setError("Lütfen geçerli bir ücret tutarı girin.");
        return;
      }
      setJobStep(3);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (jobStep === 3) setJobStep(2);
    else if (jobStep === 2) setJobStep(1);
  };

  const submit = async () => {
    if (!city.trim() || !district.trim()) {
      setError("Lütfen il ve ilçe bilgilerini doldurun.");
      return;
    }
    const w = Number(wage);
    if (!title.trim() || !description.trim() || !workDate || !w) {
      setError("Lütfen zorunlu alanları doldurun.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createJob({
        title: title.trim(),
        description: description.trim(),
        category,
        workDate,
        startTime,
        endTime,
        durationHours,
        wageAmount: w,
        wageType,
        city: city.trim(),
        district: district.trim(),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(latLng ? { latitude: latLng.lat, longitude: latLng.lng } : {}),
        openingsTotal: Number(openings) || 1,
        urgency,
        ...(skills.trim()
          ? { requiredSkills: skills.split(",").map((s) => s.trim()).filter(Boolean) }
          : {}),
      });
      setTitle(""); setDescription(""); setWorkDate(""); setWage(""); setSkills(""); setLatLng(null);
      setJobStep(1);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İlan oluşturulamadı");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetPage}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Yeni İlan Yayınla</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.sheetClose}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {/* Level Up Wizard Header */}
          <View style={styles.sheetWizardCard}>
            <View style={styles.sheetWizardTopRow}>
              <View style={styles.sheetWizardBadgeRow}>
                <View style={styles.sheetWizardStepBadge}>
                  <Text style={styles.sheetWizardStepBadgeText}>{jobStep}</Text>
                </View>
                <Text style={styles.sheetWizardTitleText}>
                  {jobStep === 1 && "Level 1: Temel Bilgiler & Kategori 📝"}
                  {jobStep === 2 && "Level 2: Çalışma & Ücret 💰"}
                  {jobStep === 3 && "Level 3: Konum & Onay 🚀"}
                </Text>
              </View>
              <View style={styles.sheetXpPill}>
                <Text style={styles.sheetXpPillText}>
                  {jobStep === 1 && "⚡ 33% XP"}
                  {jobStep === 2 && "🔥 66% XP"}
                  {jobStep === 3 && "🏆 Son Seviye"}
                </Text>
              </View>
            </View>

            {/* Progress track */}
            <View style={styles.sheetProgressBarTrack}>
              <View
                style={[
                  styles.sheetProgressBarFill,
                  {
                    width: jobStep === 1 ? "33.3%" : jobStep === 2 ? "66.6%" : "100%",
                  },
                ]}
              />
            </View>

            {/* Step navigation chips */}
            <View style={styles.sheetStepChipsRow}>
              <Pressable onPress={() => setJobStep(1)} style={styles.sheetStepChipItem}>
                <View style={[styles.sheetStepDot, jobStep >= 1 && styles.sheetStepDotActive]}>
                  <Text style={[styles.sheetStepDotText, jobStep >= 1 && styles.sheetStepDotTextActive]}>
                    {jobStep > 1 ? "✓" : "1"}
                  </Text>
                </View>
                <Text style={[styles.sheetStepLabel, jobStep >= 1 && styles.sheetStepLabelActive]}>İlan</Text>
              </Pressable>

              <View style={[styles.sheetStepConnector, jobStep >= 2 && styles.sheetStepConnectorActive]} />

              <Pressable
                onPress={() => {
                  if (jobStep > 2) setJobStep(2);
                  else if (jobStep === 1) handleNextStep();
                }}
                style={styles.sheetStepChipItem}
              >
                <View style={[styles.sheetStepDot, jobStep >= 2 && styles.sheetStepDotActive]}>
                  <Text style={[styles.sheetStepDotText, jobStep >= 2 && styles.sheetStepDotActive]}>
                    {jobStep > 2 ? "✓" : "2"}
                  </Text>
                </View>
                <Text style={[styles.sheetStepLabel, jobStep >= 2 && styles.sheetStepLabelActive]}>Ücret</Text>
              </Pressable>

              <View style={[styles.sheetStepConnector, jobStep >= 3 && styles.sheetStepConnectorActive]} />

              <Pressable
                onPress={() => {
                  if (jobStep === 2) handleNextStep();
                }}
                style={styles.sheetStepChipItem}
              >
                <View style={[styles.sheetStepDot, jobStep >= 3 && styles.sheetStepDotActive]}>
                  <Text style={[styles.sheetStepDotText, jobStep >= 3 && styles.sheetStepDotActive]}>
                    3
                  </Text>
                </View>
                <Text style={[styles.sheetStepLabel, jobStep >= 3 && styles.sheetStepLabelActive]}>Konum</Text>
              </Pressable>
            </View>
          </View>

          {/* STEP 1: TEMEL BİLGİLER & KATEGORİ */}
          {jobStep === 1 && (
            <View style={styles.sheetStepContent}>
              <SheetField
                label="İş başlığı *"
                value={title}
                onChangeText={setTitle}
                placeholder="Örn. İnşaat İşçisi / Garson Aranıyor"
              />

              <Text style={styles.sheetLabel}>Kategori *</Text>
              <View style={styles.catGrid}>
                {categories.map((c) => (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={[styles.catItem, category === c.value && styles.catItemActive]}
                  >
                    <Text style={styles.catEmoji}>{CATEGORY_ICONS[c.value]}</Text>
                    <Text style={[styles.catLabel, category === c.value && styles.catLabelActive]} numberOfLines={1}>
                      {c.label.split(" &")[0]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <SheetField
                label="Açıklama * (min 20 karakter)"
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Yapılacak işleri, beklenen deneyimi ve çalışma koşullarını detaylandırın…"
              />

              <SheetField
                label="Aranan beceriler (virgülle ayır, opsiyonel)"
                value={skills}
                onChangeText={setSkills}
                placeholder="Örn. Boya, Sıva, Kalıp ustası"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                label="Devam Et → (Level 2)"
                onPress={handleNextStep}
              />
            </View>
          )}

          {/* STEP 2: ÇALIŞMA ZAMANI & ÜCRET */}
          {jobStep === 2 && (
            <View style={styles.sheetStepContent}>
              <Text style={styles.sheetLabel}>Çalışma Günü *</Text>
              <DatePicker value={workDate} onChange={setWorkDate} />

              <View style={styles.row}>
                <View style={styles.half}>
                  <TimePicker label="Başlangıç" value={startTime} onChange={setStartTime} />
                </View>
                <View style={styles.half}>
                  <TimePicker label="Bitiş" value={endTime} onChange={setEndTime} />
                </View>
              </View>
              <Text style={styles.duration}>⏱️ Toplam Süre: {durationHours} saat (otomatik hesaplandı)</Text>

              <View style={styles.row}>
                <View style={styles.half}>
                  <SheetField
                    label="Ücret (₺) *"
                    value={wage}
                    onChangeText={(v) => setWage(v.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    placeholder="2500"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.sheetLabel}>Ücret türü</Text>
                  <View style={styles.pillRow}>
                    <Pill active={wageType === "DAILY"} label="Günlük" onPress={() => setWageType("DAILY")} />
                    <Pill active={wageType === "HOURLY"} label="Saatlik" onPress={() => setWageType("HOURLY")} />
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 4 }}>
                <Text style={styles.sheetLabel}>Aciliyet Seviyesi</Text>
                <View style={styles.pillRow}>
                  <Pill active={urgency === "LOW"} label="Normal" onPress={() => setUrgency("LOW")} />
                  <Pill active={urgency === "MEDIUM"} label="Orta" onPress={() => setUrgency("MEDIUM")} />
                  <Pill active={urgency === "HIGH"} label="🔥 Acil" onPress={() => setUrgency("HIGH")} />
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.stepNavRow}>
                <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Geri</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Devam Et → (Level 3)"
                    onPress={handleNextStep}
                  />
                </View>
              </View>
            </View>
          )}

          {/* STEP 3: KONUM, KONTENJAN & ONAY */}
          {jobStep === 3 && (
            <View style={styles.sheetStepContent}>
              <View style={styles.row}>
                <View style={styles.half}>
                  <SheetField label="İl *" value={city} onChangeText={setCity} />
                </View>
                <View style={styles.half}>
                  <SheetField label="İlçe *" value={district} onChangeText={setDistrict} />
                </View>
              </View>

              {/* Konum Al GPS */}
              <View style={styles.locBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locTitle}>İş konumu (Harita)</Text>
                  <Text style={styles.locDesc} numberOfLines={2}>
                    {latLng
                      ? `📍 ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)} — Haritada gösterilecek`
                      : "GPS konumu ekle; işçiler ilanı haritada ve mesafe sıralamasında görsün."}
                  </Text>
                </View>
                <PrimaryButton
                  label={locating ? "Alınıyor…" : "📍 Konum Al"}
                  variant="outline"
                  loading={locating}
                  onPress={grabLocation}
                />
                {latLng && (
                  <PrimaryButton label="Kaldır" variant="ghost" onPress={() => setLatLng(null)} />
                )}
              </View>

              {address ? <SheetField label="Açık Adres (opsiyonel)" value={address} onChangeText={setAddress} /> : null}

              <SheetField
                label="Aranan Kişi Sayısı (Kontenjan)"
                value={openings}
                onChangeText={(v) => setOpenings(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
              />

              {/* İlan Özeti Önizleme */}
              <View style={styles.previewBox}>
                <View style={styles.previewTop}>
                  <Text style={styles.previewCategoryIcon}>{CATEGORY_ICONS[category]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewTitle} numberOfLines={1}>{title || "İş Başlığı"}</Text>
                    <Text style={styles.previewSubtitle}>
                      📅 {workDate ? new Date(workDate).toLocaleDateString("tr-TR") : "Tarih"} · {startTime}–{endTime} ({durationHours} sa)
                    </Text>
                  </View>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewBottom}>
                  <Text style={styles.previewWage}>
                    💰 {wage ? `${Number(wage).toLocaleString("tr-TR")} ₺` : "0 ₺"} / {wageType === "DAILY" ? "Günlük" : "Saatlik"}
                  </Text>
                  <Text style={styles.previewLoc}>
                    📍 {district}, {city} ({openings} kişi)
                  </Text>
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.stepNavRow}>
                <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Geri</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="🚀 İlanı Yayınla"
                    onPress={submit}
                    loading={saving}
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SheetField(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.sheetLabel}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.textArea]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={C.muted}
        multiline={props.multiline}
        keyboardType={props.keyboardType}
      />
    </View>
  );
}

function Pill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },

  // Header & Karşılama
  headerBox: {
    gap: 4,
    paddingTop: 2,
    marginBottom: 2,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  employerBadge: {
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#e0e7ff",
    alignSelf: "flex-start",
  },
  employerBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4f46e5",
    letterSpacing: 0.6,
  },
  quickStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ecfdf5",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  quickStatPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted, lineHeight: 18 },

  // Üst Metrik Kartları
  statRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  metricCard: {
    flex: 1,
    aspectRatio: 1, // TAM KARE
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: "space-between",
  },
  metricCardPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  metricIconText: {
    fontSize: 13,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10b981",
  },
  metricPillText: {
    fontSize: 9,
    fontWeight: "700",
  },
  metricBottomGroup: {
    gap: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    fontVariant: ["tabular-nums"],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },

  // Yeni İlan Butonu (Düzgün Dikdörtgen)
  createJobBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  createJobBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  createJobBtnIcon: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  createJobBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  // İlan Kartı
  jobCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1.5,
  },
  topRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  catIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  catIcon: { fontSize: 20 },
  title: { fontSize: 15, fontWeight: "800", color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 3 },
  jobBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f8fafc",
  },
  wageText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.primary,
  },
  metaSmall: { fontSize: 12, color: C.muted },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 10 },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.muted,
  },
  segmentTextActive: {
    color: C.primary,
  },
  searchInput: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#fff",
  },
  sheetPage: { flex: 1, backgroundColor: C.bg },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: C.text },
  sheetClose: { fontSize: 18, color: C.muted },
  sheetBody: { padding: 16, paddingBottom: 40, gap: 12 },
  fieldWrap: { gap: 6 },
  sheetLabel: { fontSize: 13, fontWeight: "600", color: C.text },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: "#fff" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  duration: { fontSize: 12, color: C.muted, marginTop: -4 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catItem: { width: "23%", alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10, backgroundColor: "#fff" },
  catItemActive: { borderWidth: 2, borderColor: C.primary, backgroundColor: C.primarySoft },
  catEmoji: { fontSize: 18 },
  catLabel: { fontSize: 10, color: C.muted, fontWeight: "600" },
  catLabelActive: { color: C.primary },
  pillRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  pillActive: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { fontSize: 12, fontWeight: "600", color: C.muted },
  pillTextActive: { color: "#fff" },
  locBox: { borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, backgroundColor: "#fff", gap: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  locTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  locDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  error: { color: C.danger, fontSize: 13 },
  sheetWizardCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 6,
    gap: 8,
  },
  sheetWizardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetWizardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetWizardStepBadge: {
    backgroundColor: "#059669",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sheetWizardStepBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  sheetWizardTitleText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#065f46",
  },
  sheetXpPill: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sheetXpPillText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "800",
  },
  sheetProgressBarTrack: {
    height: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    overflow: "hidden",
  },
  sheetProgressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 999,
  },
  sheetStepChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sheetStepChipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sheetStepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetStepDotActive: {
    backgroundColor: "#059669",
  },
  sheetStepDotText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
  },
  sheetStepDotTextActive: {
    color: "#fff",
  },
  sheetStepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  sheetStepLabelActive: {
    color: "#065f46",
    fontWeight: "800",
  },
  sheetStepConnector: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 8,
  },
  sheetStepConnectorActive: {
    backgroundColor: "#34d399",
  },
  sheetStepContent: {
    gap: 12,
  },
  previewBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  previewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewCategoryIcon: {
    fontSize: 24,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
  },
  previewSubtitle: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  previewDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  previewBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewWage: {
    fontSize: 13,
    fontWeight: "800",
    color: C.primary,
  },
  previewLoc: {
    fontSize: 12,
    color: C.muted,
  },
  stepNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
});
