import React, { useCallback, useEffect, useState, type ReactNode } from "react";
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
import { Badge, Card, C, EmptyState, Loading, PrimaryButton, useTheme } from "@/components/ui";
import { useCachedList } from "@/hooks/use-cached-list";
import { createJob, deleteJob, fetchCategories, fetchJobs } from "@/lib/api";
import type { ApiCategory, ApiJob, JobCategory } from "@/lib/types";
import {
  JOB_STATUS_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import { addressToFormFields, locateAndReverse } from "@/hooks/use-location";
import { useAuth } from "@/hooks/use-auth";
import { DatePicker, TimePicker } from "@/components/pickers";
import { BrandRefreshScrollView } from "@/components/BrandPullToRefresh";
import {
  ApplicationsIcon,
  BriefcaseIcon,
  CalendarIcon,
  MapPinIcon,
  SearchIcon,
  WalletIcon,
  getCategoryIconComponent,
} from "@/components/icons";

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
  const { colors, isDark } = useTheme();
  const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

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
      style={[styles.flex, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.wrap, { backgroundColor: colors.bg }]}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
    >
      <View style={styles.headerBox}>
        <View style={styles.headerTop}>
          <View style={[styles.employerBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.employerBadgeText, { color: colors.primary }]}>İŞVEREN PANELİ</Text>
          </View>
          <View style={[styles.quickStatPill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.livePulseDot} />
            <Text style={[styles.quickStatPillText, { color: colors.textSecondary }]}>Piyasa Canlı</Text>
          </View>
        </View>
        <Text style={[styles.h1, { color: colors.text }]}>
          Hoş Geldiniz{user?.companyName ? `, ${user.companyName}` : user?.fullName ? `, ${user.fullName}` : ""}
        </Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Piyasadaki işleri inceleyin, ilanlarınızı ve başvuruları kolayca yönetin.
        </Text>
      </View>

      <View style={styles.statRow}>
        <EmployerMetricCard
          iconNode={<BriefcaseIcon size={16} color={colors.primary} />}
          label="Açık Piyasa"
          value={totalOpenMarket}
          badgeText="Canlı"
          theme="emerald"
          active={viewMode === "ALL"}
          onPress={() => setViewMode("ALL")}
        />
        <EmployerMetricCard
          iconNode={<BriefcaseIcon size={16} color={colors.primary} />}
          label="İlanlarım"
          value={myJobs.length}
          badgeText="Yayında"
          theme="mint"
          active={viewMode === "MINE"}
          onPress={() => setViewMode("MINE")}
        />
        <EmployerMetricCard
          iconNode={<ApplicationsIcon size={16} color={colors.amber} />}
          label="Başvurular"
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

      <Pressable
        style={({ pressed }) => [
          styles.createJobBtn,
          { backgroundColor: colors.primary },
          pressed && styles.createJobBtnPressed,
        ]}
        onPress={() => setCreateOpen(true)}
      >
        <Text style={styles.createJobBtnIcon}>＋</Text>
        <Text style={styles.createJobBtnText}>Yeni İlan Yayınla</Text>
      </Pressable>

      <View style={[styles.segmentContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        <Pressable
          style={[styles.segmentBtn, viewMode === "ALL" && [styles.segmentBtnActive, { backgroundColor: colors.card }]]}
          onPress={() => setViewMode("ALL")}
        >
          <Text style={[styles.segmentText, { color: colors.muted }, viewMode === "ALL" && { color: colors.text }]}>
            Piyasa İlanları ({allJobs.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, viewMode === "MINE" && [styles.segmentBtnActive, { backgroundColor: colors.card }]]}
          onPress={() => setViewMode("MINE")}
        >
          <Text style={[styles.segmentText, { color: colors.muted }, viewMode === "MINE" && { color: colors.text }]}>
            İlanlarım ({myJobs.length})
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.inputBg,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        value={search}
        onChangeText={setSearch}
        placeholder={viewMode === "ALL" ? "Piyasadaki ilanlarda ara (başlık, ilçe)…" : "İlanlarımda ara…"}
        placeholderTextColor={colors.muted}
      />

      {isLoading ? (
        <Loading />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={viewMode === "ALL" ? <SearchIcon size={24} color={colors.muted} /> : <BriefcaseIcon size={24} color={colors.muted} />}
          title={viewMode === "ALL" ? "İlan bulunamadı" : "Henüz yayında ilanınız yok"}
          subtitle={
            viewMode === "ALL"
              ? "Arama kriterlerine uygun herhangi bir ilan bulunamadı."
              : "Yeni bir günübirlik ilan yayınlayarak uygun iş arayanlara anında ulaşabilirsiniz."
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
  emerald: {
    accent: "#0D6847",
    iconBg: "#E8F5EE",
    iconBorder: "rgba(13,104,71,0.15)",
    activeBorder: "#0D6847",
    activeBg: "#E8F5EE",
    badgeBg: "rgba(13,104,71,0.12)",
    badgeText: "#0D6847",
  },
  mint: {
    accent: "#059669",
    iconBg: "#ECFDF5",
    iconBorder: "#D1FAE5",
    activeBorder: "#059669",
    activeBg: "#F0FDF4",
    badgeBg: "#D1FAE5",
    badgeText: "#047857",
  },
  amber: {
    accent: "#D97706",
    iconBg: "#FFFBEB",
    iconBorder: "#FEF3C7",
    activeBorder: "#F59E0B",
    activeBg: "#FFFDF5",
    badgeBg: "#FEF3C7",
    badgeText: "#B45309",
  },
};

function EmployerMetricCard({
  iconNode,
  label,
  value,
  badgeText,
  theme,
  active,
  onPress,
}: {
  iconNode: ReactNode;
  label: string;
  value: number;
  badgeText?: string;
  theme: "emerald" | "mint" | "amber";
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const t = METRIC_THEMES[theme];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        {
          backgroundColor: isDark ? colors.card : "#FFFFFF",
          borderColor: isDark ? colors.border : "#E2E0D8",
        },
        active && {
          borderColor: t.activeBorder,
          backgroundColor: isDark ? colors.cardSecondary : t.activeBg,
        },
        pressed && styles.metricCardPressed,
      ]}
    >
      <View style={styles.metricTopRow}>
        <View
          style={[
            styles.metricIconWrap,
            {
              backgroundColor: isDark ? colors.primarySoft : t.iconBg,
              borderColor: isDark ? colors.border : t.iconBorder,
            },
          ]}
        >
          {iconNode}
        </View>
        {badgeText && (
          <View style={[styles.metricPill, { backgroundColor: isDark ? colors.primarySoft : t.badgeBg }]}>
            <View style={[styles.liveDot, { backgroundColor: t.accent }]} />
            <Text style={[styles.metricPillText, { color: isDark ? colors.accent : t.badgeText }]}>{badgeText}</Text>
          </View>
        )}
      </View>
      <View style={styles.metricBottomGroup}>
        <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
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
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const isOwner = job.employerId === currentUserId;

  const remove = () => {
    Alert.alert("İlanı Sil", "Bu ilan kalıcı olarak silinsin mi?", [
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
    <Card style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={onPress}>
        <View style={styles.topRow}>
          <View style={[styles.catIconWrap, { backgroundColor: colors.primarySoft }]}>
            {getCategoryIconComponent(job.category, 20, colors.primary)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{job.title}</Text>
            <View style={styles.cardMetaRow}>
              <CalendarIcon size={12} color={colors.primary} />
              <Text style={[styles.meta, { color: colors.muted }]}>
                {new Date(job.workDate).toLocaleDateString("tr-TR")} · {job.startTime.slice(0, 5)}–{job.endTime.slice(0, 5)} · {job.district}
              </Text>
            </View>
          </View>
          <Badge
            label={JOB_STATUS_LABELS[job.status]}
            color={job.status === "OPEN" ? colors.emerald : job.status === "FILLED" ? colors.indigo : colors.stone}
            bg={job.status === "OPEN" ? colors.emeraldBg : job.status === "FILLED" ? colors.indigoBg : colors.stoneBg}
          />
        </View>
        <View style={[styles.jobBottomRow, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.wageText, { color: colors.primary }]}>
            {formatWage(job.wageAmount, job.wageType)}
          </Text>
          <Text style={[styles.metaSmall, { color: colors.muted }]}>
            {job.applicationCount} başvuru · {timeAgo(job.createdAt)}
          </Text>
        </View>
      </Pressable>
      {isOwner && (
        <View style={[styles.actions, { borderTopColor: colors.borderLight }]}>
          <PrimaryButton label="İlanı Sil" variant="ghost" disabled={busy} onPress={remove} />
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
  const { colors, isDark } = useTheme();
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
      const res = await locateAndReverse();
      setLatLng({ lat: res.coords.lat, lng: res.coords.lng });
      if (res.address) {
        const parsed = addressToFormFields(res.address);
        if (parsed.city) setCity(parsed.city);
        if (parsed.district) setDistrict(parsed.district);
        if (parsed.addressText) setAddress(parsed.addressText);
      }
    } catch (err) {
      Alert.alert("Konum Alınamadı", err instanceof Error ? err.message : "Tekrar deneyin.");
    } finally {
      setLocating(false);
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (jobStep === 1) {
      if (!title.trim()) {
        setError("Lütfen ilan başlığını yazınız.");
        return;
      }
      if (description.trim().length < 20) {
        setError("Açıklama en az 20 karakter olmalıdır.");
        return;
      }
      setJobStep(2);
    } else if (jobStep === 2) {
      if (!workDate) {
        setError("Lütfen çalışma gününü seçiniz.");
        return;
      }
      if (!wage || Number(wage) <= 0) {
        setError("Lütfen geçerli bir ücret tutarı giriniz.");
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
      setError("Lütfen il ve ilçe bilgilerini doldurunuz.");
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
        durationHours: Math.max(1, durationHours),
        wageAmount: Number(wage),
        wageType,
        city: city.trim(),
        district: district.trim(),
        address: address.trim() || undefined,
        openingsTotal: Math.max(1, Number(openings) || 1),
        urgency,
        requiredSkills: skills.trim() ? skills.split(",").map((s) => s.trim()) : undefined,
        latitude: latLng?.lat,
        longitude: latLng?.lng,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İlan oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  };

  const durationHours = (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
    return diff > 0 ? diff : 0;
  })();

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheetPage, { backgroundColor: colors.bg }]}>
        <View style={[styles.sheetHeader, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Yeni Günübirlik İlan</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.sheetClose, { color: colors.muted }]}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <View style={[styles.sheetWizardCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.sheetWizardTopRow}>
              <View style={styles.sheetWizardBadgeRow}>
                <View style={[styles.sheetWizardStepBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.sheetWizardStepBadgeText}>{jobStep}</Text>
                </View>
                <Text style={[styles.sheetWizardTitleText, { color: colors.primary }]}>
                  {jobStep === 1 && "1. Adım: Başlık ve Kategori"}
                  {jobStep === 2 && "2. Adım: Çalışma Saatleri & Ücret"}
                  {jobStep === 3 && "3. Adım: Konum & Kontenjan"}
                </Text>
              </View>
              <View style={[styles.sheetXpPill, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                <Text style={[styles.sheetXpPillText, { color: colors.primary }]}>Adım {jobStep} / 3</Text>
              </View>
            </View>

            <View style={[styles.sheetProgressBarTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.sheetProgressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: jobStep === 1 ? "33.3%" : jobStep === 2 ? "66.6%" : "100%",
                  },
                ]}
              />
            </View>

            <View style={styles.sheetStepChipsRow}>
              <Pressable onPress={() => setJobStep(1)} style={styles.sheetStepChipItem}>
                <View style={[styles.sheetStepDot, { backgroundColor: colors.border }, jobStep >= 1 && [styles.sheetStepDotActive, { backgroundColor: colors.primary }]]}>
                  <Text style={[styles.sheetStepDotText, jobStep >= 1 && styles.sheetStepDotTextActive]}>
                    {jobStep > 1 ? "✓" : "1"}
                  </Text>
                </View>
                <Text style={[styles.sheetStepLabel, { color: colors.muted }, jobStep >= 1 && [styles.sheetStepLabelActive, { color: colors.primary }]]}>İlan</Text>
              </Pressable>

              <View style={[styles.sheetStepConnector, { backgroundColor: colors.border }, jobStep >= 2 && [styles.sheetStepConnectorActive, { backgroundColor: colors.primary }]]} />

              <Pressable
                onPress={() => {
                  if (jobStep > 2) setJobStep(2);
                  else if (jobStep === 1) handleNextStep();
                }}
                style={styles.sheetStepChipItem}
              >
                <View style={[styles.sheetStepDot, { backgroundColor: colors.border }, jobStep >= 2 && [styles.sheetStepDotActive, { backgroundColor: colors.primary }]]}>
                  <Text style={[styles.sheetStepDotText, jobStep >= 2 && styles.sheetStepDotTextActive]}>
                    {jobStep > 2 ? "✓" : "2"}
                  </Text>
                </View>
                <Text style={[styles.sheetStepLabel, { color: colors.muted }, jobStep >= 2 && [styles.sheetStepLabelActive, { color: colors.primary }]]}>Ücret</Text>
              </Pressable>

              <View style={[styles.sheetStepConnector, { backgroundColor: colors.border }, jobStep >= 3 && [styles.sheetStepConnectorActive, { backgroundColor: colors.primary }]]} />

              <Pressable
                onPress={() => {
                  if (jobStep === 2) handleNextStep();
                }}
                style={styles.sheetStepChipItem}
              >
                <View style={[styles.sheetStepDot, { backgroundColor: colors.border }, jobStep >= 3 && [styles.sheetStepDotActive, { backgroundColor: colors.primary }]]}>
                  <Text style={[styles.sheetStepDotText, jobStep >= 3 && styles.sheetStepDotTextActive]}>
                    3
                  </Text>
                </View>
                <Text style={[styles.sheetStepLabel, { color: colors.muted }, jobStep >= 3 && [styles.sheetStepLabelActive, { color: colors.primary }]]}>Detay</Text>
              </Pressable>
            </View>
          </View>

          {/* STEP 1: BAŞLIK, KATEGORİ & AÇIKLAMA */}
          {jobStep === 1 && (
            <View style={styles.sheetStepContent}>
              <SheetField
                label="İlan Başlığı *"
                value={title}
                onChangeText={setTitle}
                placeholder="Örn. İnşaat Destek Elemanı / Garson"
              />

              <Text style={styles.sheetLabel}>Kategori *</Text>
              <View style={styles.catGrid}>
                {categories.map((c) => {
                  const isActive = category === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setCategory(c.value)}
                      style={[styles.catItem, isActive && styles.catItemActive]}
                    >
                      <View style={styles.catIconSmall}>
                        {getCategoryIconComponent(c.value, 18, isActive ? "#0D6847" : "#5C615E")}
                      </View>
                      <Text style={[styles.catLabel, isActive && styles.catLabelActive]} numberOfLines={1}>
                        {c.label.split(" &")[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <SheetField
                label="İş Açıklaması * (En az 20 karakter)"
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Yapılacak işleri, aranan deneyimi ve çalışma ortamını belirtiniz…"
              />

              <SheetField
                label="Aranan Beceriler (virgülle ayırın, opsiyonel)"
                value={skills}
                onChangeText={setSkills}
                placeholder="Örn. Boya, Sıva, Kalıp ustası"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                label="Devam Et →"
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
              <Text style={styles.duration}>Toplam Süre: {durationHours} saat (otomatik hesaplandı)</Text>

              <View style={styles.row}>
                <View style={styles.half}>
                  <SheetField
                    label="Ücret Tutarı (₺) *"
                    value={wage}
                    onChangeText={(v) => setWage(v.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    placeholder="2500"
                  />
                </View>
                <View style={styles.half}>
                  <Text style={styles.sheetLabel}>Ücret Türü</Text>
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
                  <Pill active={urgency === "HIGH"} label="Acil" onPress={() => setUrgency("HIGH")} />
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.stepNavRow}>
                <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Geri</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="Devam Et →"
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

              <View style={styles.locBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locTitle}>İş Yeri Harita Konumu</Text>
                  <Text style={styles.locDesc} numberOfLines={2}>
                    {latLng
                      ? `${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)} — Haritada gösterilecek`
                      : "GPS konumu ekleyin; işçiler ilanı haritada ve mesafe sıralamasında görsün."}
                  </Text>
                </View>
                <PrimaryButton
                  label={locating ? "Alınıyor…" : "Konum Al"}
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
                  <View style={styles.previewCategoryIconBox}>
                    {getCategoryIconComponent(category, 22, C.primary)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewTitle} numberOfLines={1}>{title || "İş Başlığı"}</Text>
                    <View style={styles.previewMetaRow}>
                      <CalendarIcon size={12} color={C.primary} />
                      <Text style={styles.previewSubtitle}>
                        {workDate ? new Date(workDate).toLocaleDateString("tr-TR") : "Tarih"} · {startTime}–{endTime} ({durationHours} sa)
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewBottom}>
                  <View style={styles.previewMetaRow}>
                    <WalletIcon size={13} color={C.primary} />
                    <Text style={styles.previewWage}>
                      {wage ? `${Number(wage).toLocaleString("tr-TR")} ₺` : "0 ₺"} / {wageType === "DAILY" ? "Günlük" : "Saatlik"}
                    </Text>
                  </View>
                  <View style={styles.previewMetaRow}>
                    <MapPinIcon size={12} color={C.muted} />
                    <Text style={styles.previewLoc}>
                      {district}, {city} ({openings} kişi)
                    </Text>
                  </View>
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.stepNavRow}>
                <Pressable onPress={handlePrevStep} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Geri</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label="İlanı Yayınla"
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
  const { colors } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.sheetLabel, { color: colors.text }]}>{props.label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            color: colors.text,
            borderColor: colors.border,
          },
          props.multiline && styles.textArea,
        ]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        multiline={props.multiline}
        keyboardType={props.keyboardType ?? "default"}
      />
    </View>
  );
}

function Pill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[
        styles.pill,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, { color: active ? "#FFFFFF" : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },
  headerBox: {
    gap: 4,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  employerBadge: {
    backgroundColor: C.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.15)",
    alignSelf: "flex-start",
  },
  employerBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.primary,
    letterSpacing: 0.6,
  },
  quickStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.15)",
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  quickStatPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.primary,
  },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted, lineHeight: 18 },

  statRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  metricCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E0D8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
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
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.muted,
  },

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
    color: "#FFFFFF",
  },
  createJobBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  jobCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E0D8",
    shadowColor: "#000",
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
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.12)",
  },
  title: { fontSize: 15, fontWeight: "800", color: C.text },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  meta: { fontSize: 12, color: C.muted },
  jobBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F6F5F2",
  },
  wageText: {
    fontSize: 14,
    fontWeight: "800",
    color: C.primary,
  },
  metaSmall: { fontSize: 12, color: C.muted },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: "#E2E0D8", paddingTop: 10 },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#EBE9E3",
    borderRadius: 12,
    padding: 3,
    gap: 4,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
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
    borderWidth: 1,
    borderColor: "#E2E0D8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#FFFFFF",
  },
  sheetPage: { flex: 1, backgroundColor: C.bg },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: C.text },
  sheetClose: { fontSize: 18, color: C.muted },
  sheetBody: { padding: 16, paddingBottom: 40, gap: 12 },
  fieldWrap: { gap: 6 },
  sheetLabel: { fontSize: 13, fontWeight: "600", color: C.text },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: "#FFFFFF" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  duration: { fontSize: 12, color: C.muted, marginTop: -4 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catItem: { width: "23%", alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10, backgroundColor: "#FFFFFF" },
  catItemActive: { borderWidth: 1.5, borderColor: C.primary, backgroundColor: C.primarySoft },
  catIconSmall: { alignItems: "center", justifyContent: "center" },
  catLabel: { fontSize: 10, color: C.muted, fontWeight: "600" },
  catLabelActive: { color: C.primary, fontWeight: "700" },
  pillRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#FFFFFF" },
  pillActive: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { fontSize: 12, fontWeight: "600", color: C.muted },
  pillTextActive: { color: "#FFFFFF" },
  locBox: { borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, backgroundColor: "#FFFFFF", gap: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  locTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  locDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  error: { color: C.danger, fontSize: 13 },
  sheetWizardCard: {
    backgroundColor: "#F6F5F2",
    borderWidth: 1,
    borderColor: "#E2E0D8",
    borderRadius: 14,
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
    backgroundColor: C.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetWizardStepBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  sheetWizardTitleText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.primary,
  },
  sheetXpPill: {
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sheetXpPillText: {
    color: C.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  sheetProgressBarTrack: {
    height: 5,
    backgroundColor: "#E2E0D8",
    borderRadius: 999,
    overflow: "hidden",
  },
  sheetProgressBarFill: {
    height: "100%",
    backgroundColor: C.primary,
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
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E2E0D8",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetStepDotActive: {
    backgroundColor: C.primary,
  },
  sheetStepDotText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
  },
  sheetStepDotTextActive: {
    color: "#FFFFFF",
  },
  sheetStepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.muted,
  },
  sheetStepLabelActive: {
    color: C.primary,
    fontWeight: "800",
  },
  sheetStepConnector: {
    flex: 1,
    height: 1.5,
    backgroundColor: "#E2E0D8",
    marginHorizontal: 8,
  },
  sheetStepConnectorActive: {
    backgroundColor: C.primary,
  },
  sheetStepContent: {
    gap: 12,
  },
  previewBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E0D8",
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
  previewCategoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
  },
  previewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewSubtitle: {
    fontSize: 12,
    color: C.muted,
  },
  previewDivider: {
    height: 1,
    backgroundColor: "#E8E6DF",
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
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F6F5F2",
    borderWidth: 1,
    borderColor: "#E2E0D8",
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.muted,
  },
});
