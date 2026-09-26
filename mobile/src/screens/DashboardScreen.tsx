import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Card, C, EmptyState, Loading, PrimaryButton, SectionTitle, StatCard } from "@/components/ui";
import { RefreshHint } from "@/components/RefreshHint";
import { useCachedList } from "@/hooks/use-cached-list";
import { createJob, deleteJob, fetchCategories, fetchJobs, updateJob } from "@/lib/api";
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

export default function DashboardScreen({
  onOpenJob,
  refreshKey,
}: {
  onOpenJob: (job: ApiJob) => void;
  refreshKey: number;
}) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const myJobsFetcher = useCallback(() => fetchJobs({ mine: true, limit: 50 }), []);
  const {
    data: myJobsData,
    loading,
    refreshing,
    refresh: refreshMyJobs,
    reload,
  } = useCachedList("jobs:mine", myJobsFetcher, []);

  useEffect(() => {
    if (myJobsData) setJobs(myJobsData.items);
  }, [myJobsData]);

  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);

  const totalApps = jobs.reduce((s, j) => s + j.applicationCount, 0);
  const openJobs = jobs.filter((j) => j.status === "OPEN").length;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.wrap}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshMyJobs}
          tintColor={C.primary}
          colors={[C.primary]}
          progressBackgroundColor="#fff"
        />
      }
    >
      <RefreshHint refreshing={refreshing} />
      <Text style={styles.h1}>Merhaba{user?.companyName ? `, ${user.companyName}` : ""} 👋</Text>
      <Text style={styles.sub}>İlanlarını yönet, başvuruları takip et. ↓ Aşağı çekerek yenile.</Text>

      <View style={styles.statRow}>
        <StatCard emoji="💼" label="Açık ilan" value={String(openJobs)} />
        <StatCard emoji="📥" label="Başvuru" value={String(totalApps)} />
        <StatCard emoji="📋" label="Tüm ilanlar" value={String(jobs.length)} />
      </View>

      <PrimaryButton label="＋ Yeni ilan ver" onPress={() => setCreateOpen(true)} />

      {loading ? (
        <Loading />
      ) : jobs.length === 0 ? (
        <EmptyState emoji="💼" title="Henüz ilanın yok" subtitle="İlk günübirlik iş ilanını yayınla; işçiler aynı gün başvursun." />
      ) : (
        jobs.map((job) => (
          <EmployerJobCard key={job.id} job={job} onChanged={reload} onPress={() => onOpenJob(job)} />
        ))
      )}

      <CreateJobSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          reload();
        }}
      />
    </ScrollView>
  );
}

function EmployerJobCard({
  job,
  onChanged,
  onPress,
}: {
  job: ApiJob;
  onChanged: () => void;
  onPress: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: JobStatus) => {
    setBusy(true);
    try {
      await updateJob(job.id, { status });
      onChanged();
    } catch {
      // sessiz
    } finally {
      setBusy(false);
    }
  };

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
    <Card>
      <Pressable onPress={onPress}>
        <View style={styles.topRow}>
          <Text style={styles.catIcon}>{CATEGORY_ICONS[job.category]}</Text>
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
        <Text style={styles.metaSmall}>
          {formatWage(job.wageAmount, job.wageType)} · {job.applicationCount} başvuru · {timeAgo(job.createdAt)}
        </Text>
      </Pressable>
      <View style={styles.actions}>
        {job.status === "OPEN" ? (
          <PrimaryButton label="Kapat" variant="outline" disabled={busy} onPress={() => setStatus("CLOSED")} />
        ) : job.status === "CLOSED" || job.status === "CANCELLED" ? (
          <PrimaryButton label="Yeniden aç" variant="outline" disabled={busy} onPress={() => setStatus("OPEN")} />
        ) : null}
        <PrimaryButton label="Sil" variant="ghost" disabled={busy} onPress={remove} />
      </View>
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
  const [error, setError] = useState<string | null>(null);

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

  const submit = async () => {
    const w = Number(wage);
    if (!title.trim() || !description.trim() || !workDate || !w) {
      setError("Lütfen zorunlu alanları doldur.");
      return;
    }
    if (description.trim().length < 20) {
      setError("Açıklama en az 20 karakter olmalı.");
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
          <Text style={styles.sheetTitle}>Yeni günübirlik iş ilanı</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.sheetClose}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <SheetField label="İş başlığı *" value={title} onChangeText={setTitle} placeholder="Örn. İnşaat İşçisi Aranıyor" />
          <SheetField label="Açıklama * (min 20 karakter)" value={description} onChangeText={setDescription} multiline placeholder="Yapılacak işleri, beklenen deneyimi ve olanakları yaz…" />

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

          <SheetField label="İş günü * (YYYY-MM-DD)" value={workDate} onChangeText={setWorkDate} placeholder="2026-10-01" />
          <View style={styles.row}>
            <View style={styles.half}>
              <SheetField label="Başlangıç *" value={startTime} onChangeText={setStartTime} placeholder="08:00" />
            </View>
            <View style={styles.half}>
              <SheetField label="Bitiş *" value={endTime} onChangeText={setEndTime} placeholder="17:00" />
            </View>
          </View>
          <Text style={styles.duration}>Süre: {durationHours} saat (otomatik)</Text>

          <View style={styles.row}>
            <View style={styles.half}>
              <SheetField label="Ücret (₺) *" value={wage} onChangeText={(v) => setWage(v.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="2500" />
            </View>
            <View style={styles.half}>
              <Text style={styles.sheetLabel}>Ücret türü</Text>
              <View style={styles.pillRow}>
                <Pill active={wageType === "DAILY"} label="Günlük" onPress={() => setWageType("DAILY")} />
                <Pill active={wageType === "HOURLY"} label="Saatlik" onPress={() => setWageType("HOURLY")} />
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <SheetField label="İl *" value={city} onChangeText={setCity} />
            </View>
            <View style={styles.half}>
              <SheetField label="İlçe *" value={district} onChangeText={setDistrict} />
            </View>
          </View>

          {/* Konum Al */}
          <View style={styles.locBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.locTitle}>İş konumu</Text>
              <Text style={styles.locDesc} numberOfLines={2}>
                {latLng
                  ? `📍 ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)} — ilan haritada gösterilecek`
                  : "Konum ekle; işçiler ilanı haritada ve mesafe sıralamasında görsün."}
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
          {address ? <SheetField label="Adres" value={address} onChangeText={setAddress} /> : null}

          <View style={styles.row}>
            <View style={styles.half}>
              <SheetField label="Kişi sayısı" value={openings} onChangeText={(v) => setOpenings(v.replace(/\D/g, ""))} keyboardType="number-pad" />
            </View>
            <View style={styles.half}>
              <Text style={styles.sheetLabel}>Aciliyet</Text>
              <View style={styles.pillRow}>
                <Pill active={urgency === "LOW"} label="Normal" onPress={() => setUrgency("LOW")} />
                <Pill active={urgency === "MEDIUM"} label="Orta" onPress={() => setUrgency("MEDIUM")} />
                <Pill active={urgency === "HIGH"} label="Acil" onPress={() => setUrgency("HIGH")} />
              </View>
            </View>
          </View>

          <SheetField label="Aranan beceriler (virgülle ayır)" value={skills} onChangeText={setSkills} placeholder="İnşaat işçisi, Kalıpçı" />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton label="Yayınla" onPress={submit} loading={saving} />
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
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: -6 },
  statRow: { flexDirection: "row", gap: 10 },
  topRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  catIcon: { fontSize: 20 },
  title: { fontSize: 15, fontWeight: "800", color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 3 },
  metaSmall: { fontSize: 12, color: C.muted, marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 12 },
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
});
