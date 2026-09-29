import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Badge, Card, C, PrimaryButton, SectionTitle, StatCard } from "@/components/ui";
import {
  changePassword,
  confirmEmailChange,
  createSupportTicket,
  createVerificationRequest,
  disable2fa,
  fetchApplications,
  fetchDeleteAccountStatus,
  fetchMyRatingSummary,
  fetchMyReceivedReviews,
  fetchSupportTickets,
  fetchVerificationStatus,
  requestDeleteAccount,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  setup2fa,
  updateMe,
  uploadAvatar,
  verify2fa,
  verifyEmail,
} from "@/lib/api";
import type {
  ApiApplication,
  ApiReview,
  ApiUser,
  DeleteAccountStatus,
  RatingSummary,
  SupportCategory,
  SupportPriority,
  SupportTicket,
  VerificationStatus,
  VerificationType,
} from "@/lib/types";
import { APPLICATION_STATUS_LABELS, formatWage } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import WalletScreen from "@/screens/WalletScreen";
import NotificationSettingsScreen from "@/screens/NotificationSettingsScreen";

type SettingsTab = "account" | "wallet" | "security" | "notifications" | "policies" | "about";

const TABS: { key: SettingsTab; icon: string; label: string }[] = [
  { key: "account", icon: "👤", label: "Hesap" },
  { key: "wallet", icon: "👛", label: "Cüzdan" },
  { key: "security", icon: "🔒", label: "Güvenlik" },
  { key: "notifications", icon: "🔔", label: "Bildirim" },
  { key: "policies", icon: "📜", label: "Politikalar" },
  { key: "about", icon: "ℹ️", label: "Hakkında" },
];

export default function ProfileScreen({
  refreshKey,
  openTab,
  onOpenTabHandled,
}: {
  refreshKey: number;
  /** Bildirimler ekranındaki "Bildirimler kapalı" bandından gelindiyse "notifications". */
  openTab?: "notifications" | null;
  /** openTab uygulandıktan sonra çağrılır (bir dahaki sefere temizler). */
  onOpenTabHandled?: () => void;
}) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("account");

  // Dışarıdan (ör. bildirimler ekranı) istenen sekmeyi uygula.
  useEffect(() => {
    if (openTab) {
      setTab(openTab);
      onOpenTabHandled?.();
    }
  }, [openTab, onOpenTabHandled]);

  // Sekme geçişinde yumuşak içerik animasyonu (fade + hafif yukarı kayma)
  const contentAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, contentAnim]);

  if (!user) return null;

  return (
    <View style={styles.flex}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabStrip} contentContainerStyle={styles.tabStripInner}>
        {TABS.map((t) => (
          <SettingsTabButton key={t.key} icon={t.icon} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      {/* Cüzdan kendi kaydırma/pull-to-refresh alanına sahip olduğu için
          dış ScrollView ile sarılmaz (iç içe ScrollView kilitlenmesin). */}
      {tab === "wallet" ? (
        <WalletScreen user={user} />
      ) : (
      <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
        <Animated.View
          style={{
            gap: 12,
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          {tab === "account" && <AccountTab user={user} refreshKey={refreshKey} />}
          {tab === "security" && <SecurityTab user={user} />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "policies" && <PoliciesTab />}
          {tab === "about" && <AboutTab onLogout={() => logout()} />}
        </Animated.View>
      </ScrollView>
      )}
    </View>
  );
}

/** Animasyonlu ayar sekmesi: basışta yay animasyonu + aktifken renk geçişi. */
function SettingsTabButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  // NOT: Bu bileşendeki TÜM animasyonlar useNativeDriver:false ile sürülür.
  // Aynı Animated.View üzerinde hem native (transform) hem JS (backgroundColor)
  // animasyonu çalıştırmak "animated node has been moved to native" hatası verir.
  const scale = useRef(new Animated.Value(1)).current;
  const activeAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(activeAnim, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // backgroundColor animasyonu native driver desteklemez
    }).start();
  }, [active, activeAnim]);

  const pillBg = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(79,70,229,0)", C.primarySoft],
  });
  const labelColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.muted, C.primary],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, speed: 40, useNativeDriver: false }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: false }).start()}
      style={styles.tabBtn}
    >
      <Animated.View style={[styles.tabPill, { backgroundColor: pillBg, transform: [{ scale }] }]}>
        <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
        <Animated.Text style={[styles.tabLabel, { color: labelColor }, active && styles.tabLabelActive]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/* ================= HE SAP ================= */

function AccountTab({ user, refreshKey }: { user: ApiUser; refreshKey: number }) {
  const { refreshUser } = useAuth();
  const isEmployer = user.role === "EMPLOYER";

  return (
    <>
      {/* Modern profil kartı: renkli üst blok + yuvarlak avatar + cam hissi istatistikler */}
      <View style={styles.profileCard}>
        <View style={styles.profileGlow} pointerEvents="none" />
        <View style={styles.profileTop}>
          <Pressable
            onPress={async () => {
              try {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                  Alert.alert("İzin gerekli", "Galeri erişimi olmadan fotoğraf seçilemez.");
                  return;
                }
                const res = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ["images"],
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.8,
                });
                if (res.canceled || !res.assets?.[0]) return;
                const a = res.assets[0];
                const uri = a.uri ?? "";
                const name = a.fileName ?? `avatar-${Date.now()}.jpg`;
                const type = a.mimeType ?? "image/jpeg";
                await uploadAvatar({ uri, name, type });
                await refreshUser();
                Alert.alert("Tamam", "Profil fotoğrafın güncellendi.");
              } catch (err) {
                Alert.alert("Fotoğraf yüklenemedi", err instanceof Error ? err.message : "Tekrar dene.");
              }
            }}
            style={styles.avatarRing}
          >
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.fullName.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>📷</Text>
            </View>
          </Pressable>

          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>{user.fullName}</Text>
            </View>
            <View style={styles.profileChipRow}>
              <View style={styles.profileChip}>
                <Text style={styles.profileChipText}>{isEmployer ? "🏢 İşveren" : "🔨 İşçi"}</Text>
              </View>
              {user.isVerified && (
                <View style={[styles.profileChip, styles.profileChipOk]}>
                  <Text style={[styles.profileChipText, styles.profileChipTextOk]}>✓ Doğrulanmış</Text>
                </View>
              )}
            </View>
            {isEmployer && user.companyName ? (
              <Text style={styles.profileCompany} numberOfLines={1}>🏢 {user.companyName}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.profileInfoRow}>
          <InfoPill icon="✉️" text={user.email} />
          {user.phone ? <InfoPill icon="📞" text={user.phone} /> : null}
          {user.city || user.district ? <InfoPill icon="📍" text={`${user.district ?? ""}, ${user.city ?? ""}`.trim()} /> : null}
        </View>

        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>⭐ {user.ratingAvg.toFixed(1)}</Text>
            <Text style={styles.profileStatLabel}>{user.ratingCount} değerlendirme</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <Text style={[styles.profileStatValue, styles.profileStatValueSm]}>{formatDate(user.createdAt)}</Text>
            <Text style={styles.profileStatLabel}>Üyelik başlangıcı</Text>
          </View>
        </View>
      </View>

      <Card style={{ gap: 12 }}>
        {!isEmployer && user.skills.length > 0 && (
          <View style={styles.skillsRow}>
            {user.skills.map((s) => (
              <Badge key={s} label={s} color={C.primary} bg={C.primarySoft} />
            ))}
          </View>
        )}
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        {!user.bio && (!user.skills.length || isEmployer) ? (
          <Text style={styles.desc}>
            {isEmployer ? "Şirket tanıtımını ve iletişim bilgilerini eksiksiz tut, güven kazan." : "Profiline birkaç beceri ve kısa bir tanıtım ekle, daha çok ilan gör."}
          </Text>
        ) : null}
      </Card>

      <EditProfileSection user={user} onSaved={refreshUser} />

      {!isEmployer && <WorkerStatsSection refreshKey={refreshKey} />}
      <VerificationSection />
    </>
  );
}

function InfoPill({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillIcon}>{icon}</Text>
      <Text style={styles.infoPillText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/* ================= HESAP: profil düzenle ================= */

function EditProfileSection({ user, onSaved }: { user: ApiUser; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const isEmployer = user.role === "EMPLOYER";
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [district, setDistrict] = useState(user.district ?? "");
  const [companyName, setCompanyName] = useState(user.companyName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [skills, setSkills] = useState(user.skills.join(", "));
  const [exp, setExp] = useState(user.experienceYears != null ? String(user.experienceYears) : "");
  const [wMin, setWMin] = useState(user.hourlyWageMin != null ? String(user.hourlyWageMin) : "");
  const [wMax, setWMax] = useState(user.hourlyWageMax != null ? String(user.hourlyWageMax) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSheet = () => {
    // Açılışta alanları kullanıcının güncel verileriyle doldur.
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
    setCity(user.city ?? "");
    setDistrict(user.district ?? "");
    setCompanyName(user.companyName ?? "");
    setBio(user.bio ?? "");
    setSkills(user.skills.join(", "));
    setExp(user.experienceYears != null ? String(user.experienceYears) : "");
    setWMin(user.hourlyWageMin != null ? String(user.hourlyWageMin) : "");
    setWMax(user.hourlyWageMax != null ? String(user.hourlyWageMax) : "");
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateMe({
        fullName,
        phone,
        city,
        district,
        ...(isEmployer && companyName ? { companyName } : {}),
        ...(bio ? { bio } : {}),
        ...(skills.trim() ? { skills: skills.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
        ...(exp ? { experienceYears: Number(exp) } : {}),
        ...(wMin ? { hourlyWageMin: Number(wMin) } : {}),
        ...(wMax ? { hourlyWageMax: Number(wMax) } : {}),
      });
      await onSaved();
      setOpen(false);
      Alert.alert("Tamam", "Profilin güncellendi. ✨");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PrimaryButton label="✏️ Profili düzenle" variant="outline" onPress={openSheet} />

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
                <Text style={styles.sheetTitle}>Profili düzenle</Text>
                <Text style={styles.sheetSub}>Bilgilerini güncel tut, işverenler seni daha kolay bulur.</Text>
                <View style={{ gap: 10, paddingBottom: 8 }}>
                  <Field label="Ad Soyad" value={fullName} onChangeText={setFullName} />
                  <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  {isEmployer && <Field label="Şirket adı" value={companyName} onChangeText={setCompanyName} />}
                  <View style={styles.row}>
                    <View style={styles.half}><Field label="İl" value={city} onChangeText={setCity} /></View>
                    <View style={styles.half}><Field label="İlçe" value={district} onChangeText={setDistrict} /></View>
                  </View>
                  {!isEmployer && (
                    <>
                      <Field label="Beceriler (virgülle)" value={skills} onChangeText={setSkills} />
                      <View style={styles.row}>
                        <View style={styles.half}><Field label="Deneyim (yıl)" value={exp} onChangeText={(v) => setExp(v.replace(/\D/g, ""))} keyboardType="number-pad" /></View>
                        <View style={styles.half}><Field label="Saatlik min ₺" value={wMin} onChangeText={(v) => setWMin(v.replace(/\D/g, ""))} keyboardType="number-pad" /></View>
                        <View style={styles.half}><Field label="max ₺" value={wMax} onChangeText={(v) => setWMax(v.replace(/\D/g, ""))} keyboardType="number-pad" /></View>
                      </View>
                    </>
                  )}
                  <Field label="Hakkımda" value={bio} onChangeText={setBio} multiline />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <View style={styles.row}>
                    <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setOpen(false)} /></View>
                    <View style={styles.half}><PrimaryButton label="Kaydet" loading={saving} onPress={submit} /></View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

/* ================= HESAP: işçi istatistikleri ================= */

function WorkerStatsSection({ refreshKey }: { refreshKey: number }) {
  const { refreshUser } = useAuth();
  const [apps, setApps] = useState<ApiApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setApps(await fetchApplications());
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const completed = apps.filter((a) => a.status === "COMPLETED");
  const earned = completed.reduce((sum, a) => sum + (a.job ? a.job.wageAmount * (a.job.wageType === "HOURLY" ? a.job.durationHours : 1) : 0), 0);
  const visible = showAll ? completed : completed.slice(0, 5);

  return (
    <>
      <View style={styles.statRow}>
        <GradientStat emoji="✅" label="Tamamlanan" value={String(completed.length)} color="#059669" bg={C.emeraldBg} />
        <GradientStat emoji="💰" label="Toplam kazanç" value={`${earned.toLocaleString("tr-TR")} ₺`} color="#4f46e5" bg={C.primarySoft} />
        <GradientStat emoji="📥" label="Başvuru" value={String(apps.length)} color="#b45309" bg={C.amberBg} />
      </View>

      <RatingSummarySection />
      <MyReviewsSection />

      <Card style={{ gap: 10 }}>
        <SectionTitle>İş geçmişim</SectionTitle>
        {loading ? (
          <Text style={styles.desc}>Yükleniyor…</Text>
        ) : completed.length === 0 ? (
          <Text style={styles.desc}>Henüz tamamlanmış işin yok. Başvuruların kabul edildikten sonra burada birikir.</Text>
        ) : (
          <>
            {visible.map((a) => (
              <View key={a.id} style={styles.historyRow}>
                <Text style={styles.historyTitle} numberOfLines={1}>{a.job?.title ?? "İş"}</Text>
                <Text style={styles.historyMeta}>
                  {a.job ? `${new Date(a.job.workDate).toLocaleDateString("tr-TR")} · ${formatWage(a.job.wageAmount, a.job.wageType)}` : APPLICATION_STATUS_LABELS[a.status]}
                  {a.rating ? ` · ⭐ ${a.rating}/5` : ""}
                </Text>
              </View>
            ))}
            {completed.length > 5 && (
              <PrimaryButton label={showAll ? "Daha az göster" : `Tümünü göster (${completed.length})`} variant="ghost" onPress={() => setShowAll(!showAll)} />
            )}
            <Text style={styles.miniNote}>💡 Tamamlanan işlerden sonra karşı taraftan puan beklemeyi unutma.</Text>
          </>
        )}
        <PrimaryButton label="Yenile" variant="ghost" onPress={async () => { await load(); await refreshUser(); }} />
      </Card>
    </>
  );
}

/* ================= HESAP: modern istatistik kartı ================= */

function GradientStat({
  emoji,
  label,
  value,
  color,
  bg,
}: {
  emoji: string;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.gradStat, { backgroundColor: bg, borderColor: `${color}22` }]}>
      <View style={[styles.gradStatIcon, { backgroundColor: `${color}1A` }]}>
        <Text style={styles.gradStatEmoji}>{emoji}</Text>
      </View>
      <Text style={[styles.gradStatValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.gradStatLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

/* ================= HESAP: puan özeti + yorumlar ================= */

function Stars({ value, size = 12 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <Text style={{ fontSize: size, color: C.amber, letterSpacing: 1 }}>
      {"★".repeat(Math.max(0, Math.min(5, full)))}
      <Text style={{ color: "#d1d5db" }}>{"★".repeat(5 - Math.max(0, Math.min(5, full)))}</Text>
    </Text>
  );
}

function RatingSummarySection() {
  const [data, setData] = useState<RatingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyRatingSummary()
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err instanceof Error ? err.message : null));
    return () => {
      alive = false;
    };
  }, []);

  if (error || !data) return null;
  const dist = data.distribution ?? {};
  const total = Object.values(dist).reduce((a, b) => a + (Number(b) || 0), 0) || data.count || 0;

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.ratingHeadRow}>
        <SectionTitle>Puan Özetim</SectionTitle>
        {data.recentCount30d ? (
          <View style={styles.trendChip}>
            <Text style={styles.trendText}>🔥 Son 30 gün: +{data.recentCount30d}</Text>
          </View>
        ) : null}
      </View>
      {data.count > 0 ? (
        <>
          <View style={styles.ratingHeroRow}>
            <Text style={styles.ratingHeroAvg}>{data.average.toFixed(1)}</Text>
            <View style={{ gap: 3 }}>
              <Stars value={data.average} size={16} />
              <Text style={styles.ratingHeroCount}>{data.count} değerlendirme</Text>
            </View>
          </View>
          <View style={{ gap: 5 }}>
            {[5, 4, 3, 2, 1].map((s) => {
              const n = Number(dist[String(s)] ?? 0);
              const pct = total > 0 ? Math.round((n / total) * 100) : 0;
              return (
                <View key={s} style={styles.distRow}>
                  <Text style={styles.distStar}>{s}★</Text>
                  <View style={styles.distTrack}>
                    <View style={[styles.distFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.distCount}>{n}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={styles.desc}>Henüz puanın yok. İş tamamlayınca karşı taraf seni puanlar.</Text>
      )}
    </Card>
  );
}

function MyReviewsSection() {
  const [items, setItems] = useState<ApiReview[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyReceivedReviews({ pageSize: 5 })
      .then((d) => alive && setItems(d.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  if (items === null) {
    return (
      <Card style={{ gap: 8 }}>
        <SectionTitle>Aldığım Yorumlar</SectionTitle>
        <ActivityIndicator color={C.primary} style={{ paddingVertical: 8 }} />
      </Card>
    );
  }
  if (items.length === 0) return null;

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Aldığım Yorumlar</SectionTitle>
      {items.map((r) => (
        <View key={r.id} style={styles.reviewRow}>
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>{(r.reviewer?.fullName ?? "?").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.reviewHeadRow}>
              <Text style={styles.reviewName} numberOfLines={1}>{r.reviewer?.fullName ?? "Kullanıcı"}</Text>
              <Stars value={r.rating} />
            </View>
            {r.comment ? (
              <Text style={styles.reviewComment} numberOfLines={3}>“{r.comment}”</Text>
            ) : null}
            <Text style={styles.reviewMeta}>
              {r.job?.title ? `${r.job.title} · ` : ""}
              {new Date(r.createdAt).toLocaleDateString("tr-TR")}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

/* ================= HESAP: doğrulama & rozet ================= */

const VERIF_TYPES: { type: VerificationType; icon: string; label: string; hint: string }[] = [
  { type: "IDENTITY", icon: "🪪", label: "Kimlik", hint: "TC kimlik / pasaport foto" },
  { type: "COMPANY", icon: "🏢", label: "Şirket", hint: "Ticari sicil / faaliyet belgesi" },
  { type: "TAX", icon: "🧾", label: "Vergi", hint: "Vergi levhası" },
];

function VerificationSection() {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [type, setType] = useState<VerificationType>("IDENTITY");
  const [docUri, setDocUri] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchVerificationStatus());
    } catch {
      // sessiz — kart gösterilmez
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!status) return null;

  const pickDocument = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("İzin gerekli", "Galeri erişimi olmadan belge seçilemez.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      setDocUri(res.assets[0].uri ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Belge seçilemedi");
    }
  };

  const submit = async () => {
    if (!docUri) {
      setError("Önce belge fotoğrafı seç.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Backend base64 data URL bekliyor: data:image/...;base64,...
      const base64 = await readImageAsBase64DataUrl(docUri);
      await createVerificationRequest({ type, documentUrl: base64, documentNote: note.trim() || undefined });
      await load();
      setSheetOpen(false);
      setDocUri(null);
      setNote("");
      Alert.alert("Talebin alındı", "Belgen admin ekibince incelenecek. Sonuç bildirim olarak gelir.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Talep gönderilemedi");
    } finally {
      setBusy(false);
    }
  };

  // Doğrulanmış rozet
  if (status.isVerified && !status.pendingRequest) {
    return (
      <View style={styles.verifiedBanner}>
        <View style={styles.verifiedBadgeIcon}>
          <Text style={styles.verifiedBadgeCheck}>✓</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.verifiedTitle}>Hesabın doğrulanmış</Text>
          <Text style={styles.verifiedSub}>Mavi rozet profilinde ve ilanlarında görünüyor.</Text>
        </View>
        <Text style={styles.verifiedEmoji}>🛡️</Text>
      </View>
    );
  }

  // Bekleyen talep
  if (status.pendingRequest) {
    return (
      <View style={[styles.verifiedBanner, styles.verifiedBannerPending]}>
        <Text style={{ fontSize: 24 }}>⏳</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.verifiedTitle, { color: C.amber }]}>Doğrulama talebin beklemede</Text>
          <Text style={[styles.verifiedSub, { color: C.amber }]}>
            {VERIF_TYPES.find((t) => t.type === status.pendingRequest?.type)?.label ?? "Belge"} kontrol ediliyor.
            Sonuç bildirimle gelir.
          </Text>
        </View>
      </View>
    );
  }

  const rejected = status.lastDecision?.status === "REJECTED";

  return (
    <>
      <Card style={{ gap: 10 }}>
        <View style={styles.ratingHeadRow}>
          <SectionTitle>Doğrulama & Rozetler</SectionTitle>
          <Text style={styles.verifiedMiniIcon}>🛡️</Text>
        </View>
        {rejected ? (
          <Text style={styles.rejectNote}>
            Son talebin reddedildi{status.lastDecision?.reviewNote ? `: ${status.lastDecision.reviewNote}` : ""}. Yeni belgeyle tekrar başvurabilirsin.
          </Text>
        ) : (
          <Text style={styles.desc}>
            Kimlik, şirket veya vergi belgeni yükle; hesabın mavi ✓ rozet kazanır ve ilanların anında yayımlanır.
          </Text>
        )}
        <PrimaryButton label="🛡️ Doğrulama talebi oluştur" onPress={() => setSheetOpen(true)} />
      </Card>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheetOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 500 }}>
                <Text style={styles.sheetTitle}>Doğrulama talebi</Text>
                <Text style={styles.sheetSub}>Belge tipini seç, fotoğraf yükle ve gönder. Aynı anda tek talep olabilir.</Text>
                <View style={{ gap: 10, paddingBottom: 8 }}>
                  {VERIF_TYPES.map((t) => (
                    <Pressable
                      key={t.type}
                      onPress={() => setType(t.type)}
                      style={({ pressed }) => [
                        styles.verifTypeRow,
                        type === t.type && styles.verifTypeRowActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>{t.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.verifTypeLabel}>{t.label}</Text>
                        <Text style={styles.verifTypeHint}>{t.hint}</Text>
                      </View>
                      <View style={[styles.verifRadio, type === t.type && styles.verifRadioActive]}>
                        {type === t.type ? <View style={styles.verifRadioDot} /> : null}
                      </View>
                    </Pressable>
                  ))}

                  <Pressable
                    onPress={pickDocument}
                    style={({ pressed }) => [styles.docPickBox, pressed && { opacity: 0.9 }]}
                  >
                    {docUri ? (
                      <Image source={{ uri: docUri }} style={styles.docPreview} resizeMode="cover" />
                    ) : (
                      <View style={styles.docPickEmpty}>
                        <Text style={{ fontSize: 26 }}>📎</Text>
                        <Text style={styles.docPickText}>Belge fotoğrafı seç</Text>
                        <Text style={styles.docPickHint}>Galeriden yükle (JPG/PNG)</Text>
                      </View>
                    )}
                  </Pressable>
                  {docUri ? (
                    <PrimaryButton label="📷 Belgeyi değiştir" variant="ghost" onPress={pickDocument} />
                  ) : null}

                  <Field label="Not (opsiyonel)" value={note} onChangeText={setNote} multiline placeholder="Belgeyle ilgili açıklama" />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <View style={styles.row}>
                    <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setSheetOpen(false)} /></View>
                    <View style={styles.half}><PrimaryButton label="Gönder" loading={busy} onPress={submit} /></View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

/** Yerel dosyayı base64 data URL'e çevirir (verification-request documentUrl formatı). */
async function readImageAsBase64DataUrl(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  const FileSystem = require("expo-file-system");
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) throw new Error("Belge dosyası okunamadı.");
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mime};base64,${b64}`;
}

/* ================= GÜVENLİK ================= */

function SecurityTab({ user }: { user: ApiUser }) {
  const { refreshUser } = useAuth();
  return (
    <>
      <View style={styles.secHero}>
        <View style={styles.secHeroBlob} pointerEvents="none" />
        <Text style={styles.secHeroIcon}>🔒</Text>
        <Text style={styles.secHeroTitle}>Güvenlik merkezi</Text>
        <Text style={styles.secHeroSub}>
          {user.twoFactorEnabled && user.emailVerified
            ? "Hesabın en güçlü korumada. Harika! ✨"
            : "Hesabını güçlendir: e-postanı doğrula, 2FA'yı aç."}
        </Text>
      </View>
      {!user.emailVerified && <EmailVerificationSection email={user.email} onVerified={refreshUser} />}
      <TwoFactorSection enabled={!!user.twoFactorEnabled} onChanged={refreshUser} />
      <PasswordSection />
      <EmailChangeSection currentEmail={user.email} onChanged={refreshUser} />
      <AccountSecuritySection user={user} />
      <ForgotPasswordInline />
    </>
  );
}

function AccountSecuritySection({ user }: { user: ApiUser }) {
  const rows: { icon: string; label: string; value: string; danger?: boolean }[] = [
    { icon: "📧", label: "E-posta doğrulanmış", value: user.emailVerified ? "Evet ✓" : "Hayır" },
    { icon: "🔐", label: "İki faktörlü koruma", value: user.twoFactorEnabled ? "Açık ✓" : "Kapalı" },
    { icon: "🌐", label: "Giriş yöntemi", value: user.provider === "GOOGLE" ? "Google hesabı" : "E-posta + şifre" },
    { icon: "⚠️", label: "Uyarı sayısı", value: String(user.warningCount ?? 0), danger: (user.warningCount ?? 0) > 0 },
    { icon: "🚩", label: "Rapor sayısı", value: String(user.flagCount ?? 0), danger: (user.flagCount ?? 0) > 0 },
  ];

  return (
    <Card style={{ gap: 8 }}>
      <SectionTitle>Hesap güvenlik durumu</SectionTitle>
      {rows.map((r) => (
        <View key={r.label} style={[styles.secRow, r.danger && styles.secRowDanger]}>
          <View style={[styles.secIconBox, r.danger && styles.secIconBoxDanger]}>
            <Text style={styles.secIcon}>{r.icon}</Text>
          </View>
          <Text style={styles.secLabel}>{r.label}</Text>
          <Text style={[styles.secValue, r.danger && styles.secValueDanger]}>{r.value}</Text>
        </View>
      ))}
      {user.isSuspended || user.isPermanentlyBanned ? (
        <View style={styles.banBox}>
          <Text style={styles.banText}>
            {user.isPermanentlyBanned
              ? "🚫 Hesabın kalıcı olarak askıya alınmış. Destekle iletişime geç."
              : `⏸️ Hesabın ${user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleDateString("tr-TR") : "belirsiz"} tarihine kadar askıda.`}
          </Text>
        </View>
      ) : (
        <Text style={styles.miniNote}>✅ Hesabın aktif ve good standing'de. Kurallara uymaya devam et!</Text>
      )}
    </Card>
  );
}

function TwoFactorSection({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");

  const start = async () => {
    setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const setup = await setup2fa();
      setQr(setup.qrCode);
      setSecret(setup.secret);
      setBackupCodes(setup.backupCodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "2FA başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setQr(null); setSecret(null); setBackupCodes([]); setCode(""); setError(null);
  };

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>İki Faktörlü Doğrulama (2FA)</SectionTitle>
      <Text style={styles.desc}>
        {enabled
          ? "Hesabın iki faktörlü doğrulama ile korunuyor."
          : "Hesabını ekstra bir katmanla koru; girişte authenticator kodu istenir."}
      </Text>

      {!open && (
        enabled ? (
          <PrimaryButton label="2FA'yı kapat" variant="outline" onPress={() => setOpen(true)} />
        ) : (
          <PrimaryButton label="🔐 2FA'yı etkinleştir" onPress={start} />
        )
      )}

      {open && (
        <>
          {!enabled && (
            <>
              {busy && !qr ? (
                <Text style={styles.desc}>QR oluşturuluyor…</Text>
              ) : qr ? (
                <>
                  <Image source={{ uri: qr }} style={styles.qrImage} resizeMode="contain" />
                  {secret ? <Text style={styles.secretText}>Manuel anahtar: {secret}</Text> : null}
                  <Text style={styles.backupTitle}>Yedek kodlar (tek kullanım):</Text>
                  <Text style={styles.backupCodes}>{backupCodes.join("  ·  ")}</Text>
                </>
              ) : null}
            </>
          )}
          <Field label="6 haneli kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <View style={styles.half}>
              <PrimaryButton label="Vazgeç" variant="ghost" onPress={() => { setOpen(false); reset(); }} />
            </View>
            <View style={styles.half}>
              {enabled ? (
                <PrimaryButton
                  label="Kapat"
                  variant="danger"
                  loading={busy}
                  disabled={code.length !== 6}
                  onPress={async () => {
                    setBusy(true); setError(null);
                    try {
                      await disable2fa(code);
                      await onChanged();
                      setOpen(false); reset();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Kod hatalı");
                    } finally { setBusy(false); }
                  }}
                />
              ) : (
                <PrimaryButton
                  label="Etkinleştir"
                  loading={busy}
                  disabled={!qr || code.length !== 6}
                  onPress={async () => {
                    setBusy(true); setError(null);
                    try {
                      await verify2fa(code);
                      await onChanged();
                      setOpen(false); reset();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Kod hatalı");
                    } finally { setBusy(false); }
                  }}
                />
              )}
            </View>
          </View>
        </>
      )}
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Şifre değiştir</SectionTitle>
      <Field label="Mevcut şifre" value={current} onChangeText={setCurrent} secureTextEntry />
      <Field label="Yeni şifre" value={next} onChangeText={setNext} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label="Şifreyi güncelle"
        loading={saving}
        onPress={async () => {
          setSaving(true);
          setError(null);
          try {
            await changePassword(current, next);
            setCurrent("");
            setNext("");
            Alert.alert("Tamam", "Şifren güncellendi");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Şifre değiştirilemedi");
          } finally {
            setSaving(false);
          }
        }}
      />
    </Card>
  );
}

function EmailChangeSection({ currentEmail, onChanged }: { currentEmail: string; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>E-posta değiştir</SectionTitle>
      {!open ? (
        <PrimaryButton label="E-posta değiştir" variant="outline" onPress={() => setOpen(true)} />
      ) : !requested ? (
        <>
          <Text style={styles.desc}>Doğrulama kodu YENİ e-posta adresine gönderilir (10 dk geçerli). Mevcut e-postanın doğrulanmış olması gerekir.</Text>
          <Field label="Yeni e-posta" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setOpen(false)} /></View>
            <View style={styles.half}>
              <PrimaryButton
                label="Kod gönder"
                loading={busy}
                disabled={!newEmail.includes("@")}
                onPress={async () => {
                  setBusy(true); setError(null);
                  try {
                    await requestEmailChange(newEmail);
                    setRequested(true);
                    setInfo("Kod gönderildi.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Kod gönderilemedi");
                  } finally { setBusy(false); }
                }}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.desc}>{info}</Text>
          <Field label="Doğrulama kodu" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => { setOpen(false); setRequested(false); setCode(""); setInfo(null); setError(null); }} /></View>
            <View style={styles.half}>
              <PrimaryButton
                label="Onayla"
                loading={busy}
                disabled={code.length < 4}
                onPress={async () => {
                  setBusy(true); setError(null);
                  try {
                    await confirmEmailChange(code);
                    await onChanged();
                    setOpen(false); setRequested(false); setCode(""); setInfo(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Doğrulama başarısız");
                  } finally { setBusy(false); }
                }}
              />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}

function ForgotPasswordInline() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [stage, setStage] = useState<"idle" | "code-sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Şifremi unuttum</SectionTitle>
      {stage === "idle" ? (
        <>
          <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label="Sıfırlama kodu gönder"
            variant="outline"
            onPress={async () => {
              setError(null);
              try {
                await requestPasswordReset(email.trim());
                setStage("code-sent");
                setInfo("Kod e-postana gönderildi.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "İstek başarısız");
              }
            }}
          />
        </>
      ) : (
        <>
          <Text style={styles.desc}>{info}</Text>
          <Field label="Kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
          <Field label="Yeni şifre" value={newPass} onChangeText={setNewPass} secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label="Şifreyi sıfırla"
            onPress={async () => {
              setError(null);
              try {
                // Backend gövdesi { code, newPassword } — email beklenmez (bkz. api-doc).
                await resetPassword(code, newPass);
                Alert.alert("Tamam", "Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.");
                setStage("idle"); setCode(""); setNewPass(""); setInfo(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sıfırlama başarısız");
              }
            }}
          />
        </>
      )}
    </Card>
  );
}

/**
 * E-posta doğrulanmamış hesaplar için: send-otp (EMAIL_ACTIVATION) + verify-email.
 * email-change/request backend'de emailVerified=true ister (403) — bu kart o
 * engeli kaldırır.
 */
function EmailVerificationSection({ email, onVerified }: { email: string; onVerified: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10, borderColor: "#fdba74", borderWidth: 1.5 }}>
      <SectionTitle>📧 E-postanı doğrula</SectionTitle>
      <Text style={styles.desc}>
        {email} adresi henüz doğrulanmadı. E-posta değişikliği ve tam hesap güvenliği için doğrula.
      </Text>
      {!sent ? (
        <PrimaryButton
          label="Doğrulama kodu gönder"
          loading={sending}
          onPress={async () => {
            setSending(true); setError(null);
            try {
              await sendOtp(email, "EMAIL_ACTIVATION");
              setSent(true);
              setInfo("Kod e-postana gönderildi (10 dk geçerli).");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Gönderilemedi");
            } finally { setSending(false); }
          }}
        />
      ) : (
        <>
          <Text style={styles.desc}>{info}</Text>
          <Field label="6 haneli kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label="Doğrula"
            loading={verifying}
            disabled={code.length !== 6}
            onPress={async () => {
              setVerifying(true); setError(null);
              try {
                await verifyEmail(email, code);
                Alert.alert("Tamam", "E-posta adresin doğrulandı! 🎉");
                await onVerified();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Doğrulama başarısız");
              } finally { setVerifying(false); }
            }}
          />
          <PrimaryButton
            label="Kodu tekrar gönder"
            variant="ghost"
            onPress={async () => {
              setError(null);
              try {
                await sendOtp(email, "EMAIL_ACTIVATION");
                setInfo("Kod tekrar gönderildi.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Gönderilemedi");
              }
            }}
          />
        </>
      )}
      {error && !sent ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

/* ================= BİLDİRİM TERCİHLERİ ================= */

function NotificationsTab() {
  return <NotificationSettingsScreen />;
}

/* ================= POLİTİKALAR ================= */

function PoliciesTab() {
  const [openRule, setOpenRule] = useState<string | null>("moderation");
  const toggle = (k: string) => setOpenRule(openRule === k ? null : k);

  return (
    <>
      <Card style={{ gap: 10 }}>
        <SectionTitle>Otomatik Moderasyon Sistemi</SectionTitle>
        <Text style={styles.desc}>
          Mesajlarda içerik otomatik olarak filtrelenir. Aşağıdaki ihlaller sistemce yakalanır ve yaptırım uygulanır:
        </Text>
        {[
          { label: "Küfür & hakaret (TR + EN, leetspeak dahil)", sev: "HIGH", color: C.rose, bg: C.roseBg },
          { label: "Telefon numarası paylaşımı", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "E-posta adresi paylaşımı", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "URL / sosyal medya (wa.me, instagram, @handle)", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "IBAN paylaşımı", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "Açık adres (mahalle/cadde/sokak)", sev: "LOW", color: C.amber, bg: C.amberBg },
          { label: "Tehdit içeren mesajlar (otomatik engelleme)", sev: "CRITICAL", color: C.rose, bg: C.roseBg },
        ].map((r) => (
          <View key={r.label} style={styles.ruleRow}>
            <Text style={styles.ruleText}>{r.label}</Text>
            <Badge label={r.sev} color={r.color} bg={r.bg} />
          </View>
        ))}
        <View style={styles.divider} />
        <Text style={styles.desc}>Otomatik yaptırım tablosu:</Text>
        {[
          { k: "5 LOW ihlali", v: "24 saat sessize alma" },
          { k: "3 MEDIUM ihlali", v: "24 saat sessize alma" },
          { k: "2 HIGH ihlali", v: "7 gün askıya alma" },
          { k: "1 CRITICAL ihlali", v: "30 gün ban incelemesi" },
          { k: "20+ toplam ihlal", v: "kalıcı ban incelemesi" },
        ].map((r) => (
          <View key={r.k} style={styles.ruleRow}>
            <Text style={styles.ruleText}>{r.k}</Text>
            <Text style={styles.ruleValue}>{r.v}</Text>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("payment")}>
          <View style={styles.accHeader}>
            <SectionTitle>Ödeme politikası</SectionTitle>
            <Text style={styles.accChevron}>{openRule === "payment" ? "▾" : "▸"}</Text>
          </View>
        </Pressable>
        {openRule === "payment" && (
          <Text style={styles.accBody}>
            Ücretler iş ilanında belirtilen tutar üzerinden anlaşılır. İş tamamlandığında ödeme kaydı oluşur;
            yönetim onayı sonrası işveren “ödendi”, işçi “aldım” onayı verir. Ödeme anlaşmazlığında iki tarafın
            da QR kayıtları ve mesaj geçmişi delil olarak incelenir. Nakit ödemede “Ödemeyi Al” QR'ını karşılıklı
            okutmak her iki taraf için kayıt oluşturur.
          </Text>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("job")}>
          <View style={styles.accHeader}>
            <SectionTitle>İlan onay politikası</SectionTitle>
            <Text style={styles.accChevron}>{openRule === "job" ? "▾" : "▸"}</Text>
          </View>
        </Pressable>
        {openRule === "job" && (
          <Text style={styles.accBody}>
            Doğrulanmış işverenler ilanlarını anında yayımlar. Doğrulanmamış hesapların ilanları yönetim onayı
            bekler (onaylanır veya reddedilir). Yanıltıcı ilanlar kaldırılır ve hesap uyarı alır.
          </Text>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("conduct")}>
          <View style={styles.accHeader}>
            <SectionTitle>Topluluk kuralları</SectionTitle>
            <Text style={styles.accChevron}>{openRule === "conduct" ? "▾" : "▸"}</Text>
          </View>
        </Pressable>
        {openRule === "conduct" && (
          <Text style={styles.accBody}>
            1) Karşılıklı saygı — hakaret, tehdit ve ayrımcılık yasaktır.{"\n"}
            2) Dış kanala yönlendirme yasaktır (telefon/e-posta/WhatsApp/sosyal medya) — güvenliğin için tüm
            konuşma platform içinde kalır.{"\n"}
            3) Sahte ilan ve sahte başvurular kalıcı ban sebebidir.{"\n"}
            4) İş sonrası karşılıklı puanlama zorunludur; adil puan ver.{"\n"}
            5) Ödeme anlaşmazlıklarını platform üzerinden çöz; itiraz hakkın saklıdır.
          </Text>
        )}
      </Card>
    </>
  );
}

/* ================= HAKKINDA ================= */

function AboutTab({ onLogout }: { onLogout: () => void }) {
  return (
    <>
      <Card style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 44 }}>💼</Text>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.text }}>Günübirlik</Text>
        <Text style={styles.desc}>Günlük iş bulma ve işçi bulma platformu</Text>
        <Badge label="Mobil v1.3.1" color={C.primary} bg={C.primarySoft} />
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Uygulama</SectionTitle>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>Sürüm</Text>
          <Text style={styles.ruleValue}>1.3.1 (build 15)</Text>
        </View>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>Sunucu</Text>
          <Text style={styles.ruleValue}>gunubirlik.space-z.ai</Text>
        </View>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>Teknoloji</Text>
          <Text style={styles.ruleValue}>Expo · React Native</Text>
        </View>
      </Card>

      <SupportTicketSection />
      <DeleteAccountSection />

      <PrimaryButton label="🚪 Çıkış yap" variant="danger" onPress={onLogout} />
    </>
  );
}

/* ================= HAKKINDA: destek talepleri ================= */

const TICKET_CATEGORIES: { value: SupportCategory; icon: string; label: string }[] = [
  { value: "COMPLAINT", icon: "📣", label: "Şikayet" },
  { value: "SUGGESTION", icon: "💡", label: "Öneri" },
  { value: "BUG", icon: "🐞", label: "Hata bildirimi" },
  { value: "ACCOUNT", icon: "👤", label: "Hesap" },
  { value: "PAYMENT", icon: "💳", label: "Ödeme" },
  { value: "OTHER", icon: "💬", label: "Diğer" },
];

const TICKET_PRIORITIES: { value: SupportPriority; label: string; color: string; bg: string }[] = [
  { value: "LOW", label: "Düşük", color: C.muted, bg: "#f3f4f6" },
  { value: "NORMAL", label: "Normal", color: C.primary, bg: C.primarySoft },
  { value: "HIGH", label: "Yüksek", color: C.rose, bg: C.roseBg },
];

function SupportTicketSection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [history, setHistory] = useState<SupportTicket[] | null>(null);
  const [category, setCategory] = useState<SupportCategory>("OTHER");
  const [priority, setPriority] = useState<SupportPriority>("NORMAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchSupportTickets());
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const openSheet = () => {
    setCategory("OTHER");
    setPriority("NORMAL");
    setSubject("");
    setMessage("");
    setError(null);
    setSheetOpen(true);
  };

  const submit = async () => {
    if (subject.trim().length < 3) {
      setError("Konu başlığı en az 3 karakter olmalı.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Mesajın en az 10 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createSupportTicket({ category, subject, message, priority });
      setSheetOpen(false);
      await loadHistory();
      Alert.alert("Talebin alındı", "Ekibimiz en kısa sürede dönüş yapacak. Bildirim de alacaksın.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Talep gönderilemedi");
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (s: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      OPEN: { label: "Açık", color: C.primary, bg: C.primarySoft },
      IN_PROGRESS: { label: "İnceleniyor", color: C.amber, bg: C.amberBg },
      RESOLVED: { label: "Çözüldü", color: C.emerald, bg: C.emeraldBg },
      CLOSED: { label: "Kapandı", color: C.muted, bg: "#f3f4f6" },
    };
    const it = map[s] ?? map.OPEN;
    return <Badge label={it.label} color={it.color} bg={it.bg} />;
  };

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>🎧 Destek Talebi</SectionTitle>
      <Text style={styles.desc}>
        Sorun, öneri veya ödeme itirazlarını yaz; admin ekibine bildirim gider.
      </Text>
      <PrimaryButton label="✍️ Yeni talep oluştur" onPress={openSheet} />

      {history === null ? null : history.length === 0 ? null : (
        <>
          <View style={styles.divider} />
          <Text style={styles.historyLabel}>Önceki taleplerin</Text>
          {history.slice(0, 5).map((t) => (
            <View key={t.id} style={styles.ticketRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.ticketHeadRow}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                  {statusChip(String(t.status ?? "OPEN"))}
                </View>
                <Text style={styles.ticketMeta}>
                  {TICKET_CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category} ·{" "}
                  {new Date(t.createdAt).toLocaleDateString("tr-TR")}
                </Text>
                {t.reply ? (
                  <Text style={styles.ticketReply} numberOfLines={2}>↩️ {t.reply}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      )}

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheetOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
                <Text style={styles.sheetTitle}>Yeni destek talebi</Text>
                <Text style={styles.sheetSub}>Talebin doğrudan admin ekibine bildirim olarak düşer.</Text>
                <View style={{ gap: 10, paddingBottom: 8 }}>
                  <Text style={styles.label}>Kategori</Text>
                  <View style={styles.chipWrap}>
                    {TICKET_CATEGORIES.map((c) => (
                      <Pressable
                        key={c.value}
                        onPress={() => setCategory(c.value)}
                        style={[styles.chip, category === c.value && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                          {c.icon} {c.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>Öncelik</Text>
                  <View style={styles.chipWrap}>
                    {TICKET_PRIORITIES.map((p) => (
                      <Pressable
                        key={p.value}
                        onPress={() => setPriority(p.value)}
                        style={[styles.chip, priority === p.value && { backgroundColor: p.bg, borderColor: p.color }]}
                      >
                        <Text style={[styles.chipText, priority === p.value && { color: p.color, fontWeight: "800" }]}>
                          {p.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Field label="Konu" value={subject} onChangeText={setSubject} placeholder="Kısaca konu" maxLength={80} />
                  <Field label="Mesaj" value={message} onChangeText={setMessage} multiline placeholder="Sorununu detaylı anlat…" />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <View style={styles.row}>
                    <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setSheetOpen(false)} /></View>
                    <View style={styles.half}><PrimaryButton label="Gönder" loading={busy} onPress={submit} /></View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Card>
  );
}

/* ================= HAKKINDA: hesap silme ================= */

function DeleteAccountSection() {
  const [status, setStatus] = useState<DeleteAccountStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDeleteAccountStatus()
      .then(setStatus)
      .catch(() => setStatus({}));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestDeleteAccount({ reason, feedback });
      setSheetOpen(false);
      setStatus({ hasRequest: true, status: "PENDING" });
      Alert.alert(
        "Talebin alındı",
        "Hesap silme talebin admin onayına gönderildi. Onaylandığında hesabın ve tüm verilerin kalıcı olarak silinir.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Talep gönderilemedi");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Hesap silinsin mi?",
      "Tüm ilanların, başvuruların, mesajların ve cüzdan bakiyen silinir. Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Talep gönder", style: "destructive", onPress: () => void submit() },
      ],
    );
  };

  if (status?.hasRequest) {
    const pending = status.status === "PENDING";
    return (
      <View style={[styles.verifiedBanner, pending ? styles.verifiedBannerPending : styles.deleteBannerDone]}>
        <Text style={{ fontSize: 22 }}>{pending ? "⏳" : "🗑️"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.verifiedTitle, { color: C.amber }]}>
            {pending ? "Hesap silme talebin beklemede" : `Hesap silme talebi: ${status.status}`}
          </Text>
          <Text style={[styles.verifiedSub, { color: C.amber }]}>
            Admin onayına kadar uygulamayı kullanmaya devam edebilirsin.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Card style={{ gap: 10, borderColor: "#fecaca" }}>
        <SectionTitle>🗑️ Hesap Silme</SectionTitle>
        <Text style={styles.desc}>
          Hesabını silmek istersen talep oluşturursun; admin onayladığında tüm verilerin
          kalıcı olarak kaldırılır.
        </Text>
        <PrimaryButton label="Hesap silme talebi oluştur" variant="danger" onPress={() => setSheetOpen(true)} />
      </Card>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheetOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 440 }}>
                <Text style={styles.sheetTitle}>Hesap silme talebi</Text>
                <Text style={styles.sheetSub}>
                  Neden ayrılıyorsun? Geri bildirimin bizi geliştirir. Admin onayından sonra silme kalıcıdır.
                </Text>
                <View style={{ gap: 10, paddingBottom: 8 }}>
                  <Field label="Sebep (opsiyonel)" value={reason} onChangeText={setReason} multiline placeholder="Örn. iş buldum, uygulamayı kullanmıyorum" />
                  <Field label="Geribildirim (opsiyonel)" value={feedback} onChangeText={setFeedback} multiline placeholder="Neyi daha iyi yapabiliriz?" />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <View style={styles.row}>
                    <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setSheetOpen(false)} /></View>
                    <View style={styles.half}><PrimaryButton label="Talep gönder" variant="danger" loading={busy} onPress={confirmDelete} /></View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

/* ================= Ortak parçalar ================= */

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  autoCapitalize?: "none" | "sentences";
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.textArea]}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        multiline={props.multiline}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        placeholderTextColor={C.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  tabStrip: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  tabStripInner: { flexDirection: "row", gap: 2, paddingHorizontal: 8, paddingVertical: 8 },
  tabBtn: { alignItems: "center", justifyContent: "center" },
  tabPill: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, gap: 2 },
  tabIcon: { fontSize: 18, opacity: 0.6 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, fontWeight: "700", color: C.muted },
  tabLabelActive: { fontWeight: "800" },
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },
  idRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 62, height: 62, borderRadius: 31 },
  avatarBadge: { position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  avatarBadgeText: { fontSize: 11 },
  avatarText: { fontSize: 18, fontWeight: "800", color: C.primary },
  avatarEdit: { fontSize: 9, fontWeight: "700", color: C.primary, textAlign: "center", marginTop: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 17, fontWeight: "800", color: C.text },
  meta: { fontSize: 12, color: C.muted, marginTop: 2 },
  ratingBox: { alignItems: "center", backgroundColor: C.amberBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  ratingValue: { fontSize: 16, fontWeight: "800", color: C.amber },
  ratingCount: { fontSize: 10, color: C.amber },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  bio: { fontSize: 13, color: C.text, backgroundColor: "#f5f5f7", borderRadius: 10, padding: 10, marginTop: 10, lineHeight: 20 },
  memberSince: { fontSize: 11, color: C.muted, marginTop: 8 },
  // --- Modern profil kartı ---
  profileCard: {
    backgroundColor: C.primary,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  profileGlow: {
    position: "absolute",
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  profileTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarRing: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  profileName: { fontSize: 19, fontWeight: "800", color: "#fff" },
  profileChipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  profileChip: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  profileChipOk: { backgroundColor: "rgba(16,185,129,0.28)" },
  profileChipText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  profileChipTextOk: { color: "#a7f3d0" },
  profileCompany: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
  profileInfoRow: { gap: 6 },
  infoPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  infoPillIcon: { fontSize: 12 },
  infoPillText: { flex: 1, fontSize: 12, color: "#fff", fontWeight: "600" },
  profileStats: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingVertical: 12 },
  profileStat: { flex: 1, alignItems: "center", gap: 2 },
  profileStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  profileStatValue: { fontSize: 15, fontWeight: "800", color: "#fff" },
  profileStatValueSm: { fontSize: 13 },
  profileStatLabel: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  desc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  backupTitle: { fontSize: 12, fontWeight: "700", color: C.amber },
  backupCodes: { fontSize: 12, color: C.amber, lineHeight: 20 },
  qrImage: { width: 180, height: 180, alignSelf: "center", borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border },
  secretText: { fontSize: 12, fontWeight: "700", color: C.text, textAlign: "center", letterSpacing: 1 },
  label: { fontSize: 13, fontWeight: "600", color: C.text },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: "#fff" },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  error: { color: C.danger, fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  statRow: { flexDirection: "row", gap: 10 },
  historyRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  historyTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  historyMeta: { fontSize: 12, color: C.muted },
  miniNote: { fontSize: 11, color: C.muted, lineHeight: 16, backgroundColor: "#f5f5f7", borderRadius: 8, padding: 8 },
  walletHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  walletTitle: { fontSize: 16, fontWeight: "800", color: C.text },
  walletBalance: { fontSize: 34, fontWeight: "800", color: C.primary },
  walletSub: { fontSize: 12, color: C.muted, marginTop: -4 },
  divider: { height: 1, backgroundColor: "#f3f4f6" },
  infoRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 12, color: C.muted, width: 110 },
  infoValue: { fontSize: 13, color: C.text, flex: 1, lineHeight: 19 },
  infoValueStrong: { fontSize: 13, fontWeight: "800", color: C.primary, flex: 1 },
  flowStep: { fontSize: 13, color: C.text, lineHeight: 20 },
  flowStrong: { fontWeight: "800" },
  ledgerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  ledgerAmount: { fontSize: 14, fontWeight: "800", color: C.text },
  secRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  secIcon: { fontSize: 16 },
  secLabel: { fontSize: 13, fontWeight: "700", color: C.text },
  secDesc: { fontSize: 12, color: C.muted, marginTop: 1 },
  secValue: { fontSize: 13, fontWeight: "700", color: C.emerald },
  secValueDanger: { color: C.danger },
  banBox: { backgroundColor: C.roseBg, borderRadius: 10, padding: 10 },
  banText: { fontSize: 13, color: C.rose, fontWeight: "700", lineHeight: 19 },
  ruleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingVertical: 4 },
  ruleText: { fontSize: 13, color: C.text, flex: 1, lineHeight: 18 },
  ruleValue: { fontSize: 12, fontWeight: "700", color: C.muted, textAlign: "right" },
  accHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accChevron: { fontSize: 14, color: C.muted },
  accBody: { fontSize: 13, color: C.text, lineHeight: 20 },
  // --- Modal sheet (profil düzenle / doğrulama / destek / hesap silme) ---
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#e2e8f0", marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: C.text },
  sheetSub: { fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 4, marginBottom: 12 },
  // --- Modern istatistik kartları ---
  gradStat: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gradStatIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  gradStatEmoji: { fontSize: 15 },
  gradStatValue: { fontSize: 19, fontWeight: "900", letterSpacing: -0.4 },
  gradStatLabel: { fontSize: 10.5, fontWeight: "700", color: C.muted, lineHeight: 13 },
  // --- Puan özeti ---
  ratingHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  trendChip: { backgroundColor: C.amberBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  trendText: { fontSize: 10.5, fontWeight: "800", color: C.amber },
  ratingHeroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  ratingHeroAvg: { fontSize: 42, fontWeight: "900", color: C.text, letterSpacing: -1.5 },
  ratingHeroCount: { fontSize: 12, color: C.muted, fontWeight: "600" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  distStar: { fontSize: 11, fontWeight: "700", color: C.amber, width: 26 },
  distTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#f1f5f9", overflow: "hidden" },
  distFill: { height: "100%", borderRadius: 4, backgroundColor: C.amber },
  distCount: { fontSize: 11, color: C.muted, width: 26, textAlign: "right", fontWeight: "700" },
  // --- Yorumlar ---
  reviewRow: { flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontSize: 15, fontWeight: "800", color: C.primary },
  reviewHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reviewName: { fontSize: 13, fontWeight: "800", color: C.text, flex: 1 },
  reviewComment: { fontSize: 12.5, color: C.text, lineHeight: 18 },
  reviewMeta: { fontSize: 10.5, color: C.muted },
  // --- Doğrulama ---
  verifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1.5,
    borderColor: "#bfdbfe",
    borderRadius: 18,
    padding: 14,
  },
  verifiedBannerPending: { backgroundColor: C.amberBg, borderColor: "#fde68a" },
  deleteBannerDone: { backgroundColor: C.roseBg, borderColor: "#fecaca" },
  verifiedBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadgeCheck: { fontSize: 18, fontWeight: "900", color: "#fff" },
  verifiedTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  verifiedSub: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },
  verifiedEmoji: { fontSize: 22 },
  verifiedMiniIcon: { fontSize: 18 },
  rejectNote: { fontSize: 13, color: C.rose, lineHeight: 19, backgroundColor: C.roseBg, borderRadius: 10, padding: 10 },
  verifTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fafafa",
  },
  verifTypeRowActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
  verifTypeLabel: { fontSize: 14, fontWeight: "800", color: C.text },
  verifTypeHint: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  verifRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  verifRadioActive: { borderColor: C.primary },
  verifRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.primary },
  docPickBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#c7d2fe",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fafaff",
  },
  docPickEmpty: { alignItems: "center", paddingVertical: 22, gap: 4 },
  docPickText: { fontSize: 13.5, fontWeight: "800", color: C.primary },
  docPickHint: { fontSize: 11, color: C.muted },
  docPreview: { width: "100%", height: 170 },
  // --- Güvenlik hero ---
  secHero: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 18,
    overflow: "hidden",
    gap: 3,
  },
  secHeroBlob: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(79,70,229,0.35)",
  },
  secHeroIcon: { fontSize: 24 },
  secHeroTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  secHeroSub: { fontSize: 12.5, color: "rgba(255,255,255,0.72)", lineHeight: 18 },
  secRowDanger: { backgroundColor: C.roseBg, borderRadius: 12, paddingHorizontal: 8, marginHorizontal: -8, paddingVertical: 8 },
  secIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  secIconBoxDanger: { backgroundColor: C.roseBg },
  // --- Destek talebi ---
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fafafa",
  },
  chipActive: { backgroundColor: C.primarySoft, borderColor: C.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: C.muted },
  chipTextActive: { color: C.primary },
  historyLabel: { fontSize: 12.5, fontWeight: "800", color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  ticketRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  ticketHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketSubject: { fontSize: 13.5, fontWeight: "800", color: C.text, flex: 1 },
  ticketMeta: { fontSize: 11, color: C.muted },
  ticketReply: { fontSize: 12, color: C.emerald, backgroundColor: C.emeraldBg, borderRadius: 8, padding: 7, lineHeight: 17 },
});
