import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Card, Chip, C, EmptyState, Loading, PrimaryButton } from "@/components/ui";
import { useCachedList } from "@/hooks/use-cached-list";
import { fetchCategories, fetchJobs, suggestAddress } from "@/lib/api";
import { toggleSaved, useSavedIds } from "@/lib/saved-store";
import type { ApiCategory, ApiJob, GeocodeSuggestion, JobCategory } from "@/lib/types";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatDistance,
  formatWage,
  haversineKm,
  timeAgo,
} from "@/lib/format";
import { getCurrentCoords, locateAndReverse } from "@/hooks/use-location";

const RADIUS_OPTIONS = [1, 3, 5, 10, 25];
const PAGE_SIZE = 20;

export default function JobsScreen({
  userCoords,
  onOpenJob,
  refreshKey,
}: {
  userCoords: { lat: number; lng: number } | null;
  onOpenJob: (job: ApiJob) => void;
  refreshKey: number;
}) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, hasNext: false });
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<JobCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"distance" | "new">("new");
  const [saving, setSaving] = useState<string | null>(null);
  // Ortak store: liste, detay ve "Kaydedilenler" ekranı hep aynı durumu görür.
  const savedIds = useSavedIds();
  // Konum seçimi (adres autocomplete)
  const [locQuery, setLocQuery] = useState("");
  const [locCoords, setLocCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locLabel, setLocLabel] = useState<string | null>(null);
  const [locDetail, setLocDetail] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [locating, setLocating] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Adres önerisi debounce
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (locQuery.trim().length < 2 || locCoords) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      suggestAddress(locQuery.trim())
        .then((items) => setSuggestions(items.slice(0, 5)))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [locQuery, locCoords]);

  const refCoords = locCoords ?? userCoords;

  // Sayfalama + filtre parametrelerine göre cache'li çekim (stale-while-revalidate).
  const listCacheKey = `jobs:${page}:${category}:${search.trim().toLowerCase()}:${refCoords ? `${refCoords.lat.toFixed(3)},${refCoords.lng.toFixed(3)}` : "no"}`;
  const jobsFetcher = useCallback(
    () =>
      fetchJobs({
        page,
        limit: PAGE_SIZE,
        status: "OPEN",
        ...(category !== "ALL" ? { category } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(refCoords ? { lat: refCoords.lat, lng: refCoords.lng } : {}),
      }),
    [page, category, search, refCoords],
  );
  const {
    data: jobsData,
    loading: jobsLoading,
    refreshing,
    refresh: refreshJobs,
    reload: reloadJobs,
  } = useCachedList(listCacheKey, jobsFetcher, [listCacheKey]);

  useEffect(() => {
    if (jobsData) {
      setJobs(jobsData.items);
      setPagination({
        page: jobsData.pagination.page,
        total: jobsData.pagination.total,
        hasNext: jobsData.pagination.hasNext,
      });
    }
  }, [jobsData]);
  const loading = jobsLoading;

  // Sekme değişiminde (refreshKey) sessiz tazele (cache varsa anında göster, spinner yok).
  useEffect(() => {
    if (refreshKey > 0) reloadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const withDistance = useMemo(
    () =>
      jobs.map((job) => {
        let km = job.distanceKm ?? null;
        if (km == null && refCoords && job.latitude != null && job.longitude != null) {
          km = haversineKm(refCoords, { lat: job.latitude, lng: job.longitude });
        }
        return { job, km };
      }),
    [jobs, refCoords],
  );

  const visible = useMemo(() => {
    let list = withDistance;
    if (radiusKm != null && refCoords) {
      list = list.filter(({ km }) => km != null && km <= radiusKm);
    }
    if (sortBy === "distance" && refCoords) {
      list = [...list].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    } else {
      list = [...list].sort(
        (a, b) => new Date(b.job.createdAt).getTime() - new Date(a.job.createdAt).getTime(),
      );
    }
    return list;
  }, [withDistance, radiusKm, sortBy, refCoords]);

  const useMyGps = async () => {
    setLocating(true);
    try {
      // GPS + reverse geocode: konumun il/ilçe/mahalle/cadde bilgisi ekranda görünür.
      const { coords, address } = await locateAndReverse();
      setLocCoords(coords);
      setLocLabel("Konumum");
      setLocDetail(formatAddressDetail(address));
      setLocQuery("");
      setPage(1);
    } catch {
      // izin reddi vs.
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async (job: ApiJob) => {
    if (saving) return;
    setSaving(job.id);
    try {
      await toggleSaved(job.id);
    } catch {
      Alert.alert("İşlem başarısız", "İş kaydedilemedi/kaldırılamadı, tekrar dene.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <FlatList
      data={visible}
      keyExtractor={({ job }) => job.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshJobs}
          tintColor={C.primary}
          colors={[C.primary]}
          progressBackgroundColor="#fff"
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.h1}>Bugünün işleri</Text>
          <Text style={styles.sub}>Yakınındaki günlük işleri bul, hemen başvur. ↓ Aşağı çekerek yenile.</Text>

          {/* Adres + GPS */}
          <View style={styles.locRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                value={locQuery}
                onChangeText={(v) => {
                  setLocQuery(v);
                  if (locCoords) {
                    setLocCoords(null);
                    setLocLabel(null);
                  }
                }}
                placeholder="Adres, mahalle, ilçe ara…"
                placeholderTextColor={C.muted}
              />
              {suggestions.length > 0 && (
                <View style={styles.suggestBox}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={`${s.lat},${s.lng}`}
                      style={styles.suggestItem}
                      onPress={() => {
                        setLocCoords({ lat: s.lat, lng: s.lng });
                        setLocLabel(s.displayName.split(",").slice(0, 2).join(",").trim());
                        setLocDetail(null);
                        setSuggestions([]);
                        setLocQuery("");
                        setPage(1);
                      }}
                    >
                      <Text style={styles.suggestText} numberOfLines={1}>
                        📍 {s.displayName.split(",").slice(0, 3).join(", ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <Pressable style={styles.gpsBtn} onPress={useMyGps} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <Text style={styles.gpsText}>📍 GPS</Text>
              )}
            </Pressable>
          </View>

          {/* Aktif konum + yarıçap + sıralama */}
          {refCoords && (
            <>
              <View style={styles.filterRow}>
                <Text style={styles.locLabel}>
                  📍 {locLabel ?? "Konumum"} {locCoords ? "" : "(GPS)"}
                </Text>
                <Pressable
                  onPress={() => {
                    setLocCoords(null);
                    setLocLabel(null);
                    setLocDetail(null);
                    setLocQuery("");
                    setRadiusKm(null);
                    setPage(1);
                  }}
                >
                  <Text style={styles.clearText}>✕ Temizle</Text>
                </Pressable>
              </View>
              {locDetail ? <Text style={styles.locDetail}>🗺️ {locDetail}</Text> : null}
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Yarıçap:</Text>
                <Chip active={radiusKm == null} label="Tümü" onPress={() => setRadiusKm(null)} />
                {RADIUS_OPTIONS.map((r) => (
                  <Chip key={r} active={radiusKm === r} label={`${r} km`} onPress={() => setRadiusKm(r)} />
                ))}
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Sırala:</Text>
                <Chip active={sortBy === "distance"} label="Mesafe" onPress={() => setSortBy("distance")} />
                <Chip active={sortBy === "new"} label="Yeni" onPress={() => setSortBy("new")} />
              </View>
            </>
          )}

          {/* Metin arama */}
          <TextInput
            style={[styles.input, styles.searchInput]}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="İlan başlığı veya açıklamada ara…"
            placeholderTextColor={C.muted}
          />

          {/* Kategoriler — modern kart görünümü (yatay kaydırmalı, gölgeli ikon kutuları) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            <CategoryTile
              emoji="🌐"
              label="Tümü"
              active={category === "ALL"}
              onPress={() => { setCategory("ALL"); setPage(1); }}
            />
            {categories.map((c) => (
              <CategoryTile
                key={c.value}
                emoji={CATEGORY_ICONS[c.value]}
                label={c.label.split(" &")[0]}
                active={category === c.value}
                onPress={() => { setCategory(c.value); setPage(1); }}
              />
            ))}
          </ScrollView>

          {loading && visible.length === 0 ? (
            <View style={styles.skeletonWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonIcon} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={[styles.skeletonLine, { width: "70%" }]} />
                      <View style={[styles.skeletonLine, { width: "45%" }]} />
                    </View>
                  </View>
                  <View style={[styles.skeletonLine, { width: "35%", marginTop: 10 }]} />
                </View>
              ))}
              <Text style={styles.skeletonHint}>İlanlar yükleniyor…</Text>
            </View>
          ) : (
            <Text style={styles.count}>{visible.length} ilan</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <JobCard
          job={item.job}
          distanceKm={item.km}
          isSaved={savedIds.includes(item.job.id)}
          saving={saving === item.job.id}
          onPress={() => onOpenJob(item.job)}
          onSave={() => handleSave(item.job)}
        />
      )}
      ListEmptyComponent={
        !loading ? (
          <EmptyState
            emoji="💼"
            title="İlan bulunamadı"
            subtitle={
              radiusKm != null
                ? `Seçtiğin ${radiusKm} km yarıçapta ilan yok; yarıçapı büyütmeyi dene.`
                : "Filtreleri değiştirip tekrar dene."
            }
          />
        ) : null
      }
      ListFooterComponent={
        !loading && visible.length > 0 ? (
          <View style={styles.pager}>
            <PrimaryButton
              label="← Önceki"
              variant="outline"
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            />
            <Text style={styles.pageText}>
              {pagination.page} / {Math.max(1, pagination.total)}
            </Text>
            <PrimaryButton
              label="Sonraki →"
              variant="outline"
              disabled={!pagination.hasNext}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        ) : null
      }
    />
  );
}

/** Reverse geocode sonucunu tek satırlık okunur adrese çevirir: il · ilçe · mahalle · cadde. */
function formatAddressDetail(address: {
  displayName?: string;
  street?: string | null;
  neighbourhood?: string | null;
  district?: string | null;
  city?: string | null;
}): string {
  const parts = [
    address.city ?? "",
    address.district ?? "",
    address.neighbourhood ?? "",
    address.street ?? "",
  ].map((p) => p?.trim() ?? "").filter(Boolean);
  if (parts.length === 0) {
    return (address.displayName ?? "").split(",").slice(0, 4).join(", ").trim();
  }
  return parts.join(" · ");
}

/** Modern kategori kutusu: yumuşak gölgeli ikon kartı + aktifken indigo dolgu. */
function CategoryTile({
  emoji,
  label,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, speed: 40, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start()}
      style={styles.catTileWrap}
    >
      <Animated.View style={[styles.catTile, active && styles.catTileActive, { transform: [{ scale }] }]}>
        <Text style={styles.catTileEmoji}>{emoji}</Text>
      </Animated.View>
      <Text style={[styles.catTileLabel, active && styles.catTileLabelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function JobCard({
  job,
  distanceKm,
  isSaved,
  saving,
  onPress,
  onSave,
}: {
  job: ApiJob;
  distanceKm?: number | null;
  isSaved?: boolean;
  saving?: boolean;
  onPress: () => void;
  onSave?: () => void;
}) {
  const dist = formatDistance(distanceKm);
  return (
    <Card style={styles.jobCard}>
      <Pressable onPress={onPress}>
        <View style={styles.jobTop}>
          <View style={styles.jobIconBox}>
            <Text style={styles.jobIcon}>{CATEGORY_ICONS[job.category] ?? "💼"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
            <Text style={styles.jobEmployer} numberOfLines={1}>
              {job.employer.companyName ?? job.employer.fullName}
              {job.employer.isVerified ? " ✓" : ""}
            </Text>
          </View>
          {onSave && (
            <Pressable onPress={onSave} disabled={saving} hitSlop={8} style={styles.saveHit}>
              <Text style={[styles.saveBtn, isSaved && styles.saveBtnSaved]}>
                {saving ? "…" : isSaved ? "✓" : "♡"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.badgeRow}>
          <Badge label={`${job.district}, ${job.city}`} color={C.primary} bg={C.primarySoft} />
          {dist ? <Badge label={dist} color={C.primary} bg={C.indigoBg} /> : null}
          {job.urgency !== "LOW" && (
            <Badge
              label={URGENCY_LABELS[job.urgency]}
              color={URGENCY_COLORS[job.urgency]}
              bg={URGENCY_COLORS[job.urgency] === C.rose ? C.roseBg : URGENCY_COLORS[job.urgency] === C.amber ? C.amberBg : C.emeraldBg}
            />
          )}
        </View>

        <Text style={styles.jobMeta}>
          📅 {new Date(job.workDate).toLocaleDateString("tr-TR")} · {job.startTime.slice(0, 5)}–{job.endTime.slice(0, 5)}
          {job.openingsTotal > 1 ? ` · 👥 ${job.openingsFilled}/${job.openingsTotal}` : ""}
        </Text>

        <View style={styles.jobFooter}>
          <Text style={styles.wage}>{formatWage(job.wageAmount, job.wageType)}</Text>
          <Text style={styles.detailLink}>Detay →</Text>
        </View>

        {job.employer.ratingAvg > 0 && (
          <Text style={styles.rating}>
            ⭐ {job.employer.ratingAvg.toFixed(1)} ({job.employer.ratingCount}) · {timeAgo(job.createdAt)}
          </Text>
        )}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, gap: 12, backgroundColor: C.bg },
  header: { gap: 10, marginBottom: 4 },
  h1: { fontSize: 24, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted },
  locRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: "#fff" },
  searchInput: { marginTop: 2 },
  suggestBox: { position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: C.border, zIndex: 20, marginTop: 4, elevation: 5 },
  suggestItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  suggestText: { fontSize: 13, color: C.text },
  gpsBtn: { backgroundColor: C.primarySoft, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center", minHeight: 46 },
  gpsText: { color: C.primary, fontWeight: "700", fontSize: 13 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  filterLabel: { fontSize: 12, color: C.muted, fontWeight: "600" },
  locLabel: { fontSize: 12, fontWeight: "700", color: C.primary, flex: 1 },
  clearText: { fontSize: 12, color: C.muted },
  catRow: { gap: 10, paddingVertical: 4 },
  catTileWrap: { alignItems: "center", width: 68 },
  catTile: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1e1b33",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  catTileActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.35,
    elevation: 5,
  },
  catTileEmoji: { fontSize: 22 },
  catTileLabel: { fontSize: 10, fontWeight: "700", color: C.muted, marginTop: 5, textAlign: "center" },
  catTileLabelActive: { color: C.primary },
  locDetail: { fontSize: 12, color: C.muted, lineHeight: 17, marginTop: -2 },
  skeletonWrap: { gap: 10, marginTop: 2 },
  skeletonCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  skeletonRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  skeletonIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#eceef3" },
  skeletonLine: { height: 11, borderRadius: 6, backgroundColor: "#eceef3" },
  skeletonHint: { fontSize: 12, color: C.muted, textAlign: "center", marginTop: 2 },
  count: { fontSize: 12, color: C.muted },
  jobCard: { padding: 14 },
  jobTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  jobIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  jobIcon: { fontSize: 18 },
  jobTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  jobEmployer: { fontSize: 12, color: C.muted, marginTop: 2 },
  saveHit: { minWidth: 36, alignItems: "center", justifyContent: "center" },
  saveBtn: { fontSize: 22, color: C.muted, paddingHorizontal: 4 },
  saveBtnSaved: { color: C.success, fontWeight: "800", fontSize: 20 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  jobMeta: { fontSize: 12, color: C.muted, marginTop: 8 },
  jobFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 10 },
  wage: { fontSize: 14, fontWeight: "800", color: C.primary },
  detailLink: { fontSize: 12, fontWeight: "700", color: C.primary },
  rating: { fontSize: 11, color: C.muted, marginTop: 6 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 },
  pageText: { fontSize: 13, color: C.muted },
});
