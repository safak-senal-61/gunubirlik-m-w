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
import { Badge, Card, Chip, C, EmptyState, Loading, PrimaryButton, useTheme } from "@/components/ui";
import { BrandRefreshFlatList } from "@/components/BrandPullToRefresh";
import { useCachedList } from "@/hooks/use-cached-list";
import { fetchCategories, fetchJobs, suggestAddress } from "@/lib/api";
import { toggleSaved, useSavedIds } from "@/lib/saved-store";
import type { ApiCategory, ApiJob, GeocodeSuggestion, JobCategory } from "@/lib/types";
import {
  CATEGORY_LABELS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatDistance,
  formatWage,
  haversineKm,
  timeAgo,
} from "@/lib/format";
import { getCurrentCoords, locateAndReverse } from "@/hooks/use-location";
import {
  getCategoryIconComponent,
  BookmarkIcon,
  BookmarkFilledIcon,
  VerifiedCheckIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  StarIcon,
  SearchIcon,
  ChevronRightIcon,
  BriefcaseIcon,
} from "@/components/icons";

const RADIUS_OPTIONS = [1, 3, 5, 10, 25];
const PAGE_SIZE = 20;

export const CATEGORY_CODES: Record<string, string> = {
  INSAAT: "İNŞ",
  RESTAURANT: "RST",
  TEMIZLIK: "TMZ",
  NAKLIYE: "NAK",
  TARIM: "TRM",
  TEKNIK: "TKN",
  SAGLIK: "SĞL",
  DIGER: "GNL",
};

export default function JobsScreen({
  userCoords,
  onOpenJob,
  refreshKey,
}: {
  userCoords: { lat: number; lng: number } | null;
  onOpenJob: (job: ApiJob) => void;
  refreshKey: number;
}) {
  const { colors, isDark } = useTheme();
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
        pageSize: PAGE_SIZE,
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
    <BrandRefreshFlatList
      data={visible}
      keyExtractor={({ job }) => job.id}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.list, { backgroundColor: colors.bg }]}
      refreshing={refreshing}
      onRefresh={refreshJobs}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.h1, { color: colors.text }]}>Günlük İş İlanları</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>Konumuna göre sıralanan acil ve günübirlik işler</Text>

          {/* Adres + GPS */}
          <View style={styles.locRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={locQuery}
                onChangeText={(v) => {
                  setLocQuery(v);
                  if (locCoords) {
                    setLocCoords(null);
                    setLocLabel(null);
                  }
                }}
                placeholder="Adres, mahalle, ilçe ara…"
                placeholderTextColor={colors.muted}
              />
              {suggestions.length > 0 && (
                <View style={[styles.suggestBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={`${s.lat},${s.lng}`}
                      style={[styles.suggestItem, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setLocCoords({ lat: s.lat, lng: s.lng });
                        setLocLabel(s.displayName.split(",").slice(0, 2).join(",").trim());
                        setLocDetail(null);
                        setSuggestions([]);
                        setLocQuery("");
                        setPage(1);
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MapPinIcon size={14} color={colors.primary} />
                        <Text style={[styles.suggestText, { color: colors.text }]} numberOfLines={1}>
                          {s.displayName.split(",").slice(0, 3).join(", ")}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <Pressable
              style={[styles.gpsBtn, { backgroundColor: colors.primarySoft }]}
              onPress={useMyGps}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MapPinIcon size={13} color={colors.primary} />
                  <Text style={[styles.gpsText, { color: colors.primary }]}>GPS</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Aktif konum + yarıçap + sıralama */}
          {refCoords && (
            <>
              <View style={styles.filterRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
                  <MapPinIcon size={14} color={colors.primary} />
                  <Text style={[styles.locLabel, { color: colors.primary }]} numberOfLines={1}>
                    {locLabel ?? "Konumum"} {locCoords ? "" : "(GPS)"}
                  </Text>
                </View>
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
                  <Text style={[styles.clearText, { color: colors.muted }]}>✕ Temizle</Text>
                </Pressable>
              </View>
              {locDetail ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: -4 }}>
                  <MapPinIcon size={12} color={colors.muted} />
                  <Text style={[styles.locDetail, { color: colors.muted }]}>{locDetail}</Text>
                </View>
              ) : null}
              <View style={styles.filterRow}>
                <Text style={[styles.filterLabel, { color: colors.muted }]}>Yarıçap:</Text>
                <Chip active={radiusKm == null} label="Tümü" onPress={() => setRadiusKm(null)} />
                {RADIUS_OPTIONS.map((r) => (
                  <Chip key={r} active={radiusKm === r} label={`${r} km`} onPress={() => setRadiusKm(r)} />
                ))}
              </View>
              <View style={styles.filterRow}>
                <Text style={[styles.filterLabel, { color: colors.muted }]}>Sırala:</Text>
                <Chip active={sortBy === "distance"} label="Mesafe" onPress={() => setSortBy("distance")} />
                <Chip active={sortBy === "new"} label="Yeni" onPress={() => setSortBy("new")} />
              </View>
            </>
          )}

          {/* Metin arama */}
          <TextInput
            style={[
              styles.input,
              styles.searchInput,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="İlan başlığı veya açıklamada ara…"
            placeholderTextColor={colors.muted}
          />

          {/* Kategoriler — modern kart görünümü (yatay kaydırmalı, gölgeli ikon kutuları) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            <CategoryTile
              icon={<BriefcaseIcon size={20} color={category === "ALL" ? "#FFFFFF" : colors.primary} />}
              label="Tümü"
              active={category === "ALL"}
              onPress={() => { setCategory("ALL"); setPage(1); }}
            />
            {categories.map((c) => (
              <CategoryTile
                key={c.value}
                icon={getCategoryIconComponent(c.value, 20, category === c.value ? "#FFFFFF" : colors.primary)}
                label={c.label.split(" &")[0]}
                active={category === c.value}
                onPress={() => { setCategory(c.value); setPage(1); }}
              />
            ))}
          </ScrollView>

          {loading && visible.length === 0 ? (
            <View style={styles.skeletonWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.skeletonRow}>
                    <View style={[styles.skeletonIcon, { backgroundColor: colors.cardSecondary }]} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={[styles.skeletonLine, { width: "70%", backgroundColor: colors.cardSecondary }]} />
                      <View style={[styles.skeletonLine, { width: "45%", backgroundColor: colors.cardSecondary }]} />
                    </View>
                  </View>
                  <View style={[styles.skeletonLine, { width: "35%", marginTop: 10, backgroundColor: colors.cardSecondary }]} />
                </View>
              ))}
              <Text style={[styles.skeletonHint, { color: colors.muted }]}>İlanlar yükleniyor…</Text>
            </View>
          ) : (
            <Text style={[styles.count, { color: colors.muted }]}>{visible.length} ilan</Text>
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
            icon={<BriefcaseIcon size={28} color={C.primary} />}
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

/** Modern kategori kutusu: kurumsal SVG vektör ikonu + akıcı yaylanma mikro animasyonu. */
function CategoryTile({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, speed: 45, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start()}
      style={styles.catTileWrap}
    >
      <Animated.View
        style={[
          styles.catTile,
          {
            backgroundColor: active ? colors.primary : colors.card,
            borderColor: active ? colors.primary : colors.border,
          },
          { transform: [{ scale }] },
        ]}
      >
        {icon}
      </Animated.View>
      <Text
        style={[
          styles.catTileLabel,
          { color: active ? colors.primary : colors.muted },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
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
  const { colors } = useTheme();
  const dist = formatDistance(distanceKm);
  return (
    <Card style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable onPress={onPress}>
        <View style={styles.jobTop}>
          <View style={[styles.jobIconBox, { backgroundColor: colors.primarySoft }]}>
            {getCategoryIconComponent(job.category, 22, colors.primary)}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.jobTitle, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                {job.title}
              </Text>
              <View style={[styles.catCodeBadge, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Text style={[styles.catCodeText, { color: colors.textSecondary }]}>
                  {CATEGORY_CODES[job.category] ?? "GNL"}
                </Text>
              </View>
            </View>
            <View style={styles.employerRow}>
              <Text style={[styles.jobEmployer, { color: colors.muted }]} numberOfLines={1}>
                {job.employer.companyName ?? job.employer.fullName}
              </Text>
              {job.employer.isVerified ? (
                <VerifiedCheckIcon size={13} color={colors.primary} />
              ) : null}
            </View>
          </View>
          {onSave && (
            <Pressable onPress={onSave} disabled={saving} hitSlop={10} style={styles.saveHit}>
              {isSaved ? (
                <BookmarkFilledIcon size={22} color={colors.primary} />
              ) : (
                <BookmarkIcon size={22} color={colors.muted} />
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.locationBadge, { backgroundColor: colors.primarySoft }]}>
            <MapPinIcon size={12} color={colors.primary} />
            <Text style={[styles.locationBadgeText, { color: colors.primary }]}>
              {job.district}, {job.city}
            </Text>
          </View>
          {dist ? (
            <View style={[styles.distBadge, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.distBadgeText, { color: colors.muted }]}>{dist}</Text>
            </View>
          ) : null}
          {job.urgency !== "LOW" && (
            <Badge
              label={URGENCY_LABELS[job.urgency]}
              color={URGENCY_COLORS[job.urgency]}
              bg={URGENCY_COLORS[job.urgency] === colors.rose ? colors.roseBg : URGENCY_COLORS[job.urgency] === colors.amber ? colors.amberBg : colors.emeraldBg}
            />
          )}
        </View>

        <View style={[styles.metaRow, { borderTopColor: colors.borderLight }]}>
          <View style={styles.metaItem}>
            <CalendarIcon size={13} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {new Date(job.workDate).toLocaleDateString("tr-TR")}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <ClockIcon size={13} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {job.startTime.slice(0, 5)}–{job.endTime.slice(0, 5)}
            </Text>
          </View>
          {job.openingsTotal > 1 ? (
            <View style={styles.metaItem}>
              <UsersIcon size={13} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {job.openingsFilled}/{job.openingsTotal}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.jobFooter, { borderTopColor: colors.borderLight }]}>
          <View style={[styles.wageBox, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.wage, { color: colors.primary }]}>
              {formatWage(job.wageAmount, job.wageType)}
            </Text>
          </View>
          <View style={styles.detailButton}>
            <Text style={[styles.detailLink, { color: colors.primary }]}>İncele</Text>
            <ChevronRightIcon size={14} color={colors.primary} />
          </View>
        </View>

        {job.employer.ratingAvg > 0 ? (
          <View style={styles.ratingRow}>
            <StarIcon size={13} color="#D97706" />
            <Text style={[styles.rating, { color: colors.muted }]}>
              {job.employer.ratingAvg.toFixed(1)} ({job.employer.ratingCount}) · {timeAgo(job.createdAt)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.timeAgoSingle, { color: colors.muted }]}>{timeAgo(job.createdAt)}</Text>
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
  jobCard: { padding: 16, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E0D8" },
  jobTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  jobIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EAF3EE", alignItems: "center", justifyContent: "center" },
  jobIcon: { fontSize: 18 },
  jobTitle: { fontSize: 16, fontWeight: "800", color: "#0C0E0D", letterSpacing: -0.3 },
  employerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  jobEmployer: { fontSize: 12, fontWeight: "600", color: "#656D67" },
  saveHit: { minWidth: 36, height: 36, alignItems: "center", justifyContent: "center" },
  saveBtn: { fontSize: 22, color: C.muted, paddingHorizontal: 4 },
  saveBtnSaved: { color: C.success, fontWeight: "800", fontSize: 20 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  locationBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EAF3EE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  locationBadgeText: { fontSize: 11, fontWeight: "700", color: "#0D6847" },
  distBadge: { backgroundColor: "#F0EFEA", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  distBadgeText: { fontSize: 11, fontWeight: "600", color: "#656D67" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ECEAE4" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontWeight: "500", color: "#656D67" },
  jobFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ECEAE4" },
  wageBox: { backgroundColor: "#EAF3EE", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  catCodeBadge: { backgroundColor: "#F0EFEA", paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4, borderWidth: 1, borderColor: "#E2E0D8" },
  catCodeText: { fontSize: 9, fontWeight: "700", color: "#424845", letterSpacing: 0.5 },
  wage: { fontSize: 14, fontWeight: "800", color: "#0D6847", fontVariant: ["tabular-nums"] },
  detailButton: { flexDirection: "row", alignItems: "center", gap: 2 },
  detailLink: { fontSize: 12, fontWeight: "700", color: "#0D6847" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  rating: { fontSize: 11, fontWeight: "600", color: "#656D67" },
  timeAgoSingle: { fontSize: 11, color: "#8C928E", marginTop: 6 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 },
  pageText: { fontSize: 13, color: C.muted },
});
