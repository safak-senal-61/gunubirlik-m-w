import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Badge, Card, PrimaryButton, SectionTitle, StatCard, useTheme, lightColors, type ThemeColors } from "@/components/ui";
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
  fetchSecurityInfo,
  fetchSupportTickets,
  fetchVerificationStatus,
  requestDeleteAccount,
  requestEmailChange,
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
  SecurityInfo,
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
import { BlogWebViewModal } from "@/components/BlogWebViewModal";
import {
  UserIcon,
  WalletIcon,
  LockIcon,
  BellIcon,
  FileTextIcon,
  InfoIcon,
  TrashIcon,
  CameraIcon,
  EditIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  StarIcon,
  VerifiedCheckIcon,
  ShieldCheckIcon,
  HourglassIcon,
  XIcon,
  ExternalLinkIcon,
  SunIcon,
  MoonIcon,
  CalendarIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  KeyRoundIcon,
  LaptopIcon,
  AlertCircleIcon,
  FlagIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  BuildingIcon,
  HelpCircleIcon,
  SparklesIcon,
} from "@/components/icons";

type SettingsTab = "account" | "wallet" | "security" | "notifications" | "policies" | "about";

const TABS: {
  key: SettingsTab;
  icon: (active: boolean, colors: ThemeColors) => React.ReactNode;
  label: string;
}[] = [
  {
    key: "account",
    icon: (a, c) => <UserIcon size={16} color={a ? c.primary : c.muted} />,
    label: "Hesap",
  },
  {
    key: "wallet",
    icon: (a, c) => <WalletIcon size={16} color={a ? c.primary : c.muted} />,
    label: "Cüzdan",
  },
  {
    key: "security",
    icon: (a, c) => <LockIcon size={16} color={a ? c.primary : c.muted} />,
    label: "Güvenlik",
  },
  {
    key: "notifications",
    icon: (a, c) => <BellIcon size={16} color={a ? c.primary : c.muted} />,
    label: "Bildirim",
  },
  {
    key: "policies",
    icon: (a, c) => <FileTextIcon size={16} color={a ? c.primary : c.muted} />,
    label: "Politikalar",
  },
  {
    key: "about",
    icon: (a, c) => <InfoIcon size={16} color={a ? c.primary : c.muted} />,
    label: "Hakkında",
  },
];

export default function ProfileScreen({
  refreshKey,
  openTab,
  openSub,
  onOpenTabHandled,
}: {
  refreshKey: number;
  /** Bildirimler ekranındaki "Bildirimler kapalı" bandından gelindiyse "notifications". */
  openTab?: "notifications" | null;
  /** Push deep link hedefi: gunubirlik://wallet → "wallet"; verification/profile → hesap sekmesi. */
  openSub?: "wallet" | "verification" | "profile" | null;
  /** openTab/openSub uygulandıktan sonra çağrılır (bir dahaki sefere temizler). */
  onOpenTabHandled?: () => void;
}) {
  const { user, logout } = useAuth();
  const { colors, isDark } = useTheme();
  styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<SettingsTab>("account");

  // Dışarıdan (ör. bildirimler ekranı / push deep link) istenen sekmeyi uygula.
  useEffect(() => {
    if (openSub === "wallet") {
      setTab("wallet");
      onOpenTabHandled?.();
    } else if (openTab) {
      setTab(openTab);
      onOpenTabHandled?.();
    }
  }, [openTab, openSub, onOpenTabHandled]);

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
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabStrip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabStripInner}
      >
        {TABS.map((t) => (
          <SettingsTabButton key={t.key} icon={t.icon(tab === t.key, colors)} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      {/* Cüzdan ve Bildirimler kendi kaydırma/pull-to-refresh alanına sahip olduğu için
          dış ScrollView ile sarılmaz (iç içe ScrollView kilitlenmesin). */}
      {tab === "wallet" ? (
        <WalletScreen user={user} />
      ) : tab === "notifications" ? (
        <NotificationSettingsScreen />
      ) : (
      <ScrollView style={[styles.flex, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.wrap, { backgroundColor: colors.bg }]}>
        <Animated.View
          style={{
            gap: 12,
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          {tab === "account" && <AccountTab user={user} refreshKey={refreshKey} />}
          {tab === "security" && <SecurityTab user={user} />}
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
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
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
    outputRange: ["rgba(0,0,0,0)", colors.primarySoft],
  });
  const labelColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.muted, colors.primary],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, speed: 40, useNativeDriver: false }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: false }).start()}
      style={styles.tabBtn}
    >
      <Animated.View style={[styles.tabPill, { backgroundColor: pillBg, transform: [{ scale }] }]}>
        <View style={styles.tabIconBox}>{icon}</View>
        <Animated.Text style={[styles.tabLabel, { color: labelColor }, active && styles.tabLabelActive]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/* ================= HE SAP ================= */

function AccountTab({ user, refreshKey }: { user: ApiUser; refreshKey: number }) {
  const { refreshUser } = useAuth();
  const { colors } = useTheme();
  const isEmployer = user.role === "EMPLOYER";

  return (
    <>
      {/* Modern ve zarif profil kartı */}
      <View style={styles.profileCard}>
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
              <CameraIcon size={11} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </Pressable>

          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>{user.fullName}</Text>
            </View>
            <View style={styles.profileChipRow}>
              <View style={styles.profileChip}>
                <Text style={styles.profileChipText}>{isEmployer ? "İşveren" : "İş Arayan"}</Text>
              </View>
              {user.isVerified && (
                <View style={[styles.profileChip, styles.profileChipOk]}>
                  <VerifiedCheckIcon size={12} color={colors.primary} />
                  <Text style={[styles.profileChipText, styles.profileChipTextOk]}>Doğrulanmış Hesap</Text>
                </View>
              )}
            </View>
            {isEmployer && user.companyName ? (
              <Text style={styles.profileCompany} numberOfLines={1}>{user.companyName}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.profileInfoRow}>
          <InfoPill icon={<MailIcon size={13} color={colors.muted} />} text={user.email} />
          {user.phone ? <InfoPill icon={<PhoneIcon size={13} color={colors.muted} />} text={user.phone} /> : null}
          {user.city || user.district ? (
            <InfoPill
              icon={<MapPinIcon size={13} color={colors.muted} />}
              text={[user.district, user.city].filter(Boolean).join(", ")}
            />
          ) : null}
        </View>

        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={styles.profileStatValue}>{user.ratingAvg.toFixed(1)}</Text>
              <StarIcon size={13} color={colors.amber} />
            </View>
            <Text style={styles.profileStatLabel}>{user.ratingCount} değerlendirme</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <CalendarIcon size={12} color={colors.muted} />
              <Text style={[styles.profileStatValue, styles.profileStatValueSm]}>{formatDate(user.createdAt)}</Text>
            </View>
            <Text style={styles.profileStatLabel}>Üyelik başlangıcı</Text>
          </View>
        </View>
      </View>

      <Card style={{ gap: 12 }}>
        {!isEmployer && user.skills.length > 0 && (
          <View style={styles.skillsRow}>
            {user.skills.map((s) => (
              <Badge key={s} label={s} color={colors.primary} bg={colors.primarySoft} />
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

      <ThemeSettingsSection />

      <EditProfileSection user={user} onSaved={refreshUser} />

      {!isEmployer && <WorkerStatsSection refreshKey={refreshKey} />}
      <VerificationSection />
    </>
  );
}

function ThemeSettingsSection() {
  const { themeMode, setThemeMode, isDark, colors } = useTheme();

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isDark ? <MoonIcon size={18} color={colors.primary} /> : <SunIcon size={18} color="#F59E0B" />}
          </View>
          <View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>Görünüm ve Tema</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              {themeMode === "dark"
                ? "Karanlık Mod (Göz dostu gece teması)"
                : themeMode === "light"
                ? "Aydınlık Mod (Klasik beyaz tema)"
                : "Sistem teması ile otomatik eşitlenir"}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <Pressable
          style={[
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1.5,
              backgroundColor: themeMode === "light" ? colors.primarySoft : colors.cardSecondary,
              borderColor: themeMode === "light" ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setThemeMode("light")}
        >
          <SunIcon size={15} color={themeMode === "light" ? colors.primary : colors.muted} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: themeMode === "light" ? colors.primary : colors.muted,
            }}
          >
            Aydınlık
          </Text>
        </Pressable>

        <Pressable
          style={[
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1.5,
              backgroundColor: themeMode === "dark" ? colors.primarySoft : colors.cardSecondary,
              borderColor: themeMode === "dark" ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setThemeMode("dark")}
        >
          <MoonIcon size={15} color={themeMode === "dark" ? colors.primary : colors.muted} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: themeMode === "dark" ? colors.primary : colors.muted,
            }}
          >
            Karanlık
          </Text>
        </Pressable>

        <Pressable
          style={[
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1.5,
              backgroundColor: themeMode === "system" ? colors.primarySoft : colors.cardSecondary,
              borderColor: themeMode === "system" ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setThemeMode("system")}
        >
          <Text style={{ fontSize: 13 }}>⚙️</Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: themeMode === "system" ? colors.primary : colors.muted,
            }}
          >
            Sistem
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function InfoPill({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <View style={styles.infoPill}>
      {icon ? <View style={styles.infoPillIconBox}>{icon}</View> : null}
      <Text style={styles.infoPillText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

/* ================= HESAP: profil düzenle ================= */

function EditProfileSection({ user, onSaved }: { user: ApiUser; onSaved: () => Promise<void> }) {
  const { colors } = useTheme();
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

  const pickAvatar = async () => {
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
      await onSaved();
      Alert.alert("Tamam", "Profil fotoğrafın güncellendi.");
    } catch (err) {
      Alert.alert("Fotoğraf yüklenemedi", err instanceof Error ? err.message : "Tekrar deneyin.");
    }
  };

  const submit = async () => {
    if (!fullName.trim()) {
      setError("Lütfen ad ve soyadınızı giriniz.");
      return;
    }
    if (wMin && wMax && Number(wMin) > Number(wMax)) {
      setError("Minimum saatlik ücret maksimumdan büyük olamaz.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMe({
        fullName: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        district: district.trim(),
        ...(isEmployer && companyName ? { companyName: companyName.trim() } : {}),
        ...(bio ? { bio: bio.trim() } : {}),
        ...(skills.trim() ? { skills: skills.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
        ...(exp ? { experienceYears: Number(exp) } : {}),
        ...(wMin ? { hourlyWageMin: Number(wMin) } : {}),
        ...(wMax ? { hourlyWageMax: Number(wMax) } : {}),
      });
      await onSaved();
      setOpen(false);
      Alert.alert("Tamam", "Profiliniz güncellendi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PrimaryButton label="Profili Düzenle" variant="outline" onPress={openSheet} />

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", maxHeight: "88%" }}
          >
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              {/* Modern başlık: ikon rozeti + başlık + kapat butonu */}
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetIconBox, { backgroundColor: colors.primarySoft }]}>
                  <EditIcon size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Profili Düzenle</Text>
                  <Text style={styles.sheetSub}>Bilgilerini güncel tut, işverenler seni daha kolay bulur.</Text>
                </View>
                <Pressable onPress={() => setOpen(false)} hitSlop={8} style={styles.sheetClose}>
                  <XIcon size={16} color={colors.muted} />
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ gap: 14, paddingBottom: 32 }}
              >
                {/* Fotoğraf düzenleme */}
                <View style={[styles.formSectionCard, { flexDirection: "row", alignItems: "center", gap: 14 }]}>
                  <Pressable onPress={pickAvatar} style={styles.avatarRing}>
                    {user.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user.fullName.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.avatarBadge}>
                      <CameraIcon size={11} color="#FFFFFF" strokeWidth={2.2} />
                    </View>
                  </Pressable>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.sectionLabel}>Profil Fotoğrafı</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      Net bir fotoğraf güvenilirliği artırır.
                    </Text>
                    <Pressable onPress={pickAvatar} hitSlop={6} style={{ marginTop: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Fotoğrafı Değiştir</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.formSectionCard}>
                  <Text style={styles.sectionLabel}>Kişisel Bilgiler</Text>
                  <Field label="Ad Soyad" value={fullName} onChangeText={setFullName} placeholder="Adınız Soyadınız" />
                  <Field label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0532 000 00 00" />
                  {isEmployer && <Field label="Şirket adı" value={companyName} onChangeText={setCompanyName} placeholder="Şirket Ünvanı" />}
                </View>

                <View style={styles.formSectionCard}>
                  <Text style={styles.sectionLabel}>Konum ve Adres</Text>
                  <View style={styles.row}>
                    <View style={styles.half}><Field label="İl" value={city} onChangeText={setCity} placeholder="İstanbul" /></View>
                    <View style={styles.half}><Field label="İlçe" value={district} onChangeText={setDistrict} placeholder="Kadıköy" /></View>
                  </View>
                </View>

                {!isEmployer && (
                  <View style={styles.formSectionCard}>
                    <Text style={styles.sectionLabel}>İşçi Profili ve Ücret Beklentisi</Text>
                    <Field label="Beceriler (virgülle ayır)" value={skills} onChangeText={setSkills} placeholder="Garsonluk, Kurye, Temizlik..." />
                    <View style={styles.row}>
                      <View style={styles.half}><Field label="Deneyim (yıl)" value={exp} onChangeText={(v) => setExp(v.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="2" /></View>
                      <View style={styles.half}><Field label="Saatlik min ₺" value={wMin} onChangeText={(v) => setWMin(v.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="150" /></View>
                      <View style={styles.half}><Field label="max ₺" value={wMax} onChangeText={(v) => setWMax(v.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="300" /></View>
                    </View>
                  </View>
                )}

                <View style={styles.formSectionCard}>
                  <Text style={styles.sectionLabel}>Hakkımda</Text>
                  <Field label="Kendini kısaca tanıt" value={bio} onChangeText={setBio} multiline placeholder="Deneyimlerinden ve çalışma prensiplerinden kısaca bahset..." />
                </View>

                {error ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.roseBg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.rose }}>
                    <AlertCircleIcon size={16} color={colors.rose} />
                    <Text style={{ color: colors.rose, fontSize: 13, fontWeight: "600", flex: 1 }}>{error}</Text>
                  </View>
                ) : null}

                <View style={[styles.row, { marginTop: 4 }]}>
                  <View style={styles.half}><PrimaryButton label="Vazgeç" variant="ghost" onPress={() => setOpen(false)} /></View>
                  <View style={styles.half}><PrimaryButton label="Değişiklikleri Kaydet" loading={saving} onPress={submit} /></View>
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
        <StatCard label="Tamamlanan" value={String(completed.length)} />
        <StatCard label="Toplam Kazanç" value={`${earned.toLocaleString("tr-TR")} ₺`} />
        <StatCard label="Başvurular" value={String(apps.length)} />
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
                  {a.rating ? ` · ${a.rating}/5 Puan` : ""}
                </Text>
              </View>
            ))}
            {completed.length > 5 && (
              <PrimaryButton label={showAll ? "Daha az göster" : `Tümünü göster (${completed.length})`} variant="ghost" onPress={() => setShowAll(!showAll)} />
            )}
            <Text style={styles.miniNote}>Tamamlanan işlerden sonra karşı taraftan puan beklemeyi unutmayın.</Text>
          </>
        )}
        <PrimaryButton label="Yenile" variant="ghost" onPress={async () => { await load(); await refreshUser(); }} />
      </Card>
    </>
  );
}

/* ================= HESAP: puan özeti + yorumlar ================= */

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const full = Math.round(value);
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} size={size} color={i <= full ? colors.amber : colors.border} />
      ))}
    </View>
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
            <Text style={styles.trendText}>Son 30 gün: +{data.recentCount30d}</Text>
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
  const { colors } = useTheme();
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
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: 8 }} />
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

const VERIF_TYPES: { type: VerificationType; label: string; hint: string }[] = [
  { type: "IDENTITY", label: "Kimlik Doğrulama", hint: "T.C. kimlik veya pasaport belgesi" },
  { type: "COMPANY", label: "Şirket Doğrulama", hint: "Ticari sicil gazetesi veya faaliyet belgesi" },
  { type: "TAX", label: "Vergi Levhası", hint: "Güncel vergi levhası belgesi" },
];

function getVerifIcon(type: VerificationType, colors: ThemeColors) {
  switch (type) {
    case "IDENTITY":
      return <UserIcon size={18} color={colors.primary} />;
    case "COMPANY":
      return <BuildingIcon size={18} color={colors.primary} />;
    case "TAX":
      return <FileTextIcon size={18} color={colors.primary} />;
  }
}

function VerificationSection() {
  const { colors } = useTheme();
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
        <VerifiedCheckIcon size={24} color="#0D6847" />
        <View style={{ flex: 1 }}>
          <Text style={styles.verifiedTitle}>Hesabınız Doğrulanmış</Text>
          <Text style={styles.verifiedSub}>Onaylı rozet profilinizde ve ilanlarınızda görüntülenir.</Text>
        </View>
      </View>
    );
  }

  // Bekleyen talep
  if (status.pendingRequest) {
    return (
      <View style={[styles.verifiedBanner, styles.verifiedBannerPending]}>
        <HourglassIcon size={24} color={colors.amber} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.verifiedTitle, { color: colors.amber }]}>Doğrulama Talebiniz Beklemede</Text>
          <Text style={[styles.verifiedSub, { color: colors.muted }]}>
            {VERIF_TYPES.find((t) => t.type === status.pendingRequest?.type)?.label ?? "Belge"} kontrol ediliyor. Sonuç bildirimle iletilecektir.
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
        <PrimaryButton label="Doğrulama Talebi Oluştur" onPress={() => setSheetOpen(true)} />
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
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                        {getVerifIcon(t.type, colors)}
                      </View>
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
                        <FileTextIcon size={24} color={colors.primary} />
                        <Text style={styles.docPickText}>Belge fotoğrafı seç</Text>
                        <Text style={styles.docPickHint}>Galeriden yükle (JPG/PNG)</Text>
                      </View>
                    )}
                  </Pressable>
                  {docUri ? (
                    <PrimaryButton label="Belgeyi Değiştir" variant="ghost" onPress={pickDocument} />
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
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.secHero}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={styles.secHeroIconBox}>
            <ShieldCheckIcon size={20} color={colors.primary} />
          </View>
          <Text style={styles.secHeroTitle}>Güvenlik Merkezi</Text>
        </View>
        <Text style={styles.secHeroSub}>
          {user.twoFactorEnabled && user.emailVerified
            ? "Hesabınız üst düzey güvenlik standartlarıyla korunmaktadır."
            : "Hesabınızı güçlendirmek için e-postanızı doğrulayın ve iki adımlı doğrulamayı açın."}
        </Text>
      </View>
      {!user.emailVerified && <EmailVerificationSection email={user.email} onVerified={refreshUser} />}
      <TwoFactorSection enabled={!!user.twoFactorEnabled} onChanged={refreshUser} />
      <PasswordSection provider={user.provider} />
      <EmailChangeSection currentEmail={user.email} onChanged={refreshUser} />
      <AccountSecuritySection user={user} />
    </>
  );
}

function AccountSecuritySection({ user }: { user: ApiUser }) {
  const { colors } = useTheme();
  const [secInfo, setSecInfo] = useState<SecurityInfo | null>(null);

  useEffect(() => {
    fetchSecurityInfo().then(setSecInfo).catch(() => {});
  }, []);

  const rows: { icon: React.ReactNode; label: string; value: string; danger?: boolean }[] = [
    {
      icon: <MailIcon size={16} color={colors.primary} />,
      label: "E-posta Doğrulanmış",
      value: (secInfo?.emailVerified ?? user.emailVerified) ? "Doğrulandı" : "Doğrulanmadı",
    },
    {
      icon: <ShieldCheckIcon size={16} color={colors.primary} />,
      label: "İki Faktörlü Koruma (2FA)",
      value: (secInfo?.twoFactorEnabled ?? user.twoFactorEnabled) ? "Aktif" : "Kapalı",
    },
    {
      icon: <KeyRoundIcon size={16} color={colors.primary} />,
      label: "Giriş Yöntemi",
      value: user.provider === "GOOGLE" ? "Google Hesabı" : "E-posta ve Şifre",
    },
    ...(secInfo?.activeSessions ? [{
      icon: <LaptopIcon size={16} color={colors.primary} />,
      label: "Aktif Oturum",
      value: `${secInfo.activeSessions} Cihaz`,
    }] : []),
    {
      icon: <AlertCircleIcon size={16} color={colors.rose} />,
      label: "Uyarı Sayısı",
      value: String(user.warningCount ?? 0),
      danger: (user.warningCount ?? 0) > 0,
    },
    {
      icon: <FlagIcon size={16} color={colors.rose} />,
      label: "Rapor Sayısı",
      value: String(user.flagCount ?? 0),
      danger: (user.flagCount ?? 0) > 0,
    },
  ];

  return (
    <Card style={{ gap: 8 }}>
      <SectionTitle>Hesap Güvenlik Durumu</SectionTitle>
      {rows.map((r) => (
        <View key={r.label} style={[styles.secRow, r.danger && styles.secRowDanger]}>
          <View style={[styles.secIconBox, r.danger && styles.secIconBoxDanger]}>
            {r.icon}
          </View>
          <Text style={styles.secLabel}>{r.label}</Text>
          <Text style={[styles.secValue, r.danger && styles.secValueDanger]}>{r.value}</Text>
        </View>
      ))}
      {user.isSuspended || user.isPermanentlyBanned ? (
        <View style={styles.banBox}>
          <Text style={styles.banText}>
            {user.isPermanentlyBanned
              ? "Hesabınız askıya alınmıştır. Lütfen destek ekibiyle iletişime geçiniz."
              : `Hesabınız ${user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleDateString("tr-TR") : "belirsiz"} tarihine kadar askıya alınmıştır.`}
          </Text>
        </View>
      ) : (
        <Text style={styles.miniNote}>Hesabınız aktif ve güvenli durumdadır.</Text>
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
          <PrimaryButton label="2FA'yı Etkinleştir" onPress={start} />
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

function PasswordSection({ provider }: { provider?: string }) {
  const { colors } = useTheme();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isGoogle = provider === "GOOGLE";

  return (
    <View style={styles.pwCard}>
      <View style={styles.pwHead}>
        <View style={[styles.pwIconBox, { backgroundColor: colors.primarySoft }]}>
          <KeyRoundIcon size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pwTitle}>Şifre Değiştir</Text>
          <Text style={styles.pwSub}>
            {isGoogle
              ? "Google ile giriş yapıyorsunuz; isterseniz bağımsız bir şifre de belirleyebilirsiniz."
              : "En az 8 karakter, harf ve rakam kombinasyonu önerilir."}
          </Text>
        </View>
      </View>
      <Field
        label="Mevcut Şifre"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry={!showCurrent}
        placeholder="Mevcut şifreniz"
        rightElement={
          <Pressable onPress={() => setShowCurrent(!showCurrent)} hitSlop={8}>
            {showCurrent ? <EyeOffIcon size={18} color={colors.muted} /> : <EyeIcon size={18} color={colors.muted} />}
          </Pressable>
        }
      />
      <Field
        label="Yeni Şifre"
        value={next}
        onChangeText={setNext}
        secureTextEntry={!showNext}
        placeholder="En az 8 karakter"
        rightElement={
          <Pressable onPress={() => setShowNext(!showNext)} hitSlop={8}>
            {showNext ? <EyeOffIcon size={18} color={colors.muted} /> : <EyeIcon size={18} color={colors.muted} />}
          </Pressable>
        }
      />
      <Field
        label="Yeni Şifre Tekrarı"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!showNext}
        placeholder="Yeni şifrenizi tekrar girin"
      />
      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.roseBg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.rose }}>
          <AlertCircleIcon size={16} color={colors.rose} />
          <Text style={{ color: colors.rose, fontSize: 13, fontWeight: "600", flex: 1 }}>{error}</Text>
        </View>
      ) : null}
      <PrimaryButton
        label="Şifreyi Güncelle"
        loading={saving}
        onPress={async () => {
          if (!current) return setError("Lütfen mevcut şifrenizi giriniz.");
          if (next.length < 8) return setError("Yeni şifreniz en az 8 karakter olmalıdır.");
          if (next !== confirm) return setError("Yeni şifreler birbiriyle eşleşmiyor.");
          setSaving(true);
          setError(null);
          try {
            await changePassword(current, next);
            setCurrent("");
            setNext("");
            setConfirm("");
            Alert.alert("Tamam", "Şifreniz başarıyla güncellendi.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Şifre değiştirilemedi");
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
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
      <SectionTitle>E-posta Doğrulama</SectionTitle>
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
                Alert.alert("Tamam", "E-posta adresiniz doğrulandı.");
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

/* ================= POLİTİKALAR ================= */

function PoliciesTab() {
  const { colors } = useTheme();
  const [openRule, setOpenRule] = useState<string | null>("terms");
  const toggle = (k: string) => setOpenRule(openRule === k ? null : k);

  const openOfficialWebsiteContracts = () => {
    void Linking.openURL("https://gunubirlik.qrders.com.tr/sozlesmeler");
  };

  return (
    <>
      {/* Doğrudan Resmi Web Sitesi Bağlantısı */}
      <Card style={{ gap: 8, backgroundColor: colors.primarySoft, borderColor: colors.primary + "30" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <FileTextIcon size={20} color={colors.primary} />
          <Text style={{ fontSize: 15, fontFamily: "PlusJakartaSans_700Bold", color: colors.primary }}>
            Resmi Sözleşmeler Merkezi
          </Text>
        </View>
        <Text style={styles.desc}>
          Platformumuzdaki tüm yasal metinler, kullanım koşulları ve KVKK aydınlatma bildirimleri gunubirlik.qrders.com.tr/sozlesmeler adresinde eksiksiz yayımlanmaktadır.
        </Text>
        <PrimaryButton
          label="Resmi Sözleşmeleri Web'de Aç ↗"
          onPress={openOfficialWebsiteContracts}
          variant="primary"
        />
      </Card>

      {/* 1. Kullanım Koşulları ve Üyelik Sözleşmesi */}
      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("terms")}>
          <View style={styles.accHeader}>
            <SectionTitle>Kullanım Koşulları & Üyelik Sözleşmesi</SectionTitle>
            {openRule === "terms" ? <ChevronDownIcon size={16} color={colors.muted} /> : <ChevronRightIcon size={16} color={colors.muted} />}
          </View>
        </Pressable>
        {openRule === "terms" && (
          <View style={{ gap: 6 }}>
            <Text style={styles.accBody}>
              <Text style={{ fontWeight: "700" }}>MADDE 1 — TARAFLAR VE AMAÇ:{"\n"}</Text>
              İşbu sözleşme Günübirlik İş Bul platformu ile platforma üye olan Çalışan (İşçi) ve İşveren (İşletme) taraflar arasındaki hak ve yükümlülükleri düzenler.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 2 — ÜYELİK VE ROL SEÇİMİ:{"\n"}</Text>
              Platforma 18 yaşını doldurmuş gerçek ve tüzel kişiler üye olabilir. Kullanıcılar kayıt aşamasında İş Arayan veya İşveren rolünü seçer; her rol kendi yasal sorumluluklarına tabidir.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 3 — ÇALIŞAN (İŞÇİ) YÜKÜMLÜLÜKLERİ:{"\n"}</Text>
              Başvurusu kabul edilen işçi, kararlaştırılan gün ve saatte iş yerinde hazır bulunur. İşe başlama ve bitiş anında platformun güvenli QR kodunu karşılıklı okutarak hakediş kaydı oluşturur.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 4 — İŞVEREN HAK VE YÜKÜMLÜLÜKLERİ:{"\n"}</Text>
              İşveren, ilan detayında belirtilen günlük yevmiyeyi ve çalışma şartlarını tam olarak sağlamakla yükümlüdür. İş sağlığı ve güvenliği önlemleri işverenin sorumluluğundadır.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 5 — PLATFORM DIŞI İŞLEM YASAĞI:{"\n"}</Text>
              Kullanıcıların komisyon atlatmak amacıyla platform dışına iletişim yönlendirmesi veya sahte ilan açması sistem tarafından otomatik engellenir ve hesap kalıcı olarak askıya alınır.
            </Text>
          </View>
        )}
      </Card>

      {/* 2. Gizlilik ve Google OAuth Politikası */}
      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("privacy")}>
          <View style={styles.accHeader}>
            <SectionTitle>Gizlilik & Google OAuth Politikası</SectionTitle>
            {openRule === "privacy" ? <ChevronDownIcon size={16} color={colors.muted} /> : <ChevronRightIcon size={16} color={colors.muted} />}
          </View>
        </Pressable>
        {openRule === "privacy" && (
          <View style={{ gap: 6 }}>
            <Text style={styles.accBody}>
              <Text style={{ fontWeight: "700" }}>MADDE 1 — VERİ SORUMLUSU VE KAPSAM:{"\n"}</Text>
              Günübirlik İş Bul, kullanıcıların gizliliğine en yüksek derecede önem verir. Toplanan veriler yalnızca iş eşleştirme, güvenli ödeme ve hesap doğrulama amacıyla işlenir.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 2 — GOOGLE OAUTH 2.0 SINIRLI KULLANIMI:{"\n"}</Text>
              Google hesabı ile giriş yapıldığında yalnızca ad, soyad ve e-posta verileri kimlik doğrulama için alınır. Google kullanıcı verileri asla reklam şirketlerine aktarılmaz veya satılmaz.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 3 — VERİ GÜVENLİĞİ VE ŞİFRELEME:{"\n"}</Text>
              Tüm veri trafiği 256-bit SSL şifreleme ve modern bulut güvenlik protokolleriyle korunur. Şifreler tuzlanmış hash algoritmasıyla saklanır.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 4 — HESAP SİLME VE UNUTULMA HAKKI:{"\n"}</Text>
              Kullanıcılar diledikleri zaman Ayarlar {">"} Güvenlik {">"} Hesabımı Sil adımı ile tüm kişisel verilerinin sistemden kalıcı olarak silinmesini talep edebilir.
            </Text>
          </View>
        )}
      </Card>

      {/* 3. Mesafeli Satış ve Emanet (Escrow) Sözleşmesi */}
      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("escrow")}>
          <View style={styles.accHeader}>
            <SectionTitle>Mesafeli Satış & Emanet (Escrow) Sözleşmesi</SectionTitle>
            {openRule === "escrow" ? <ChevronDownIcon size={16} color={colors.muted} /> : <ChevronRightIcon size={16} color={colors.muted} />}
          </View>
        </Pressable>
        {openRule === "escrow" && (
          <View style={{ gap: 6 }}>
            <Text style={styles.accBody}>
              <Text style={{ fontWeight: "700" }}>MADDE 1 — EMANET (ESCROW) HAVUZU İŞLEYİŞİ:{"\n"}</Text>
              İşveren bir başvuruyu onayladığında günlük yevmiye tutarı güvenli emanet havuzuna aktarılır. İş günü sonunda QR kod okutulup iş tamamlandı onayı verildiğinde bakiye işçinin cüzdanına geçer.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 2 — İPTAL VE CAYMA HAKKI:{"\n"}</Text>
              İş başlangıç saatinden 12 saat öncesine kadar taraflar haklı gerekçeyle işi iptal edebilir. İş başlangıcından sonra keyfi iptallerde platform kuralları ve puanlama yaptırımı uygulanır.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>MADDE 3 — UYUŞMAZLIK VE HAKEM İNCELEMESİ:{"\n"}</Text>
              Ödeme veya iş tamamlama anlaşmazlıklarında iki tarafın QR kayıtları, konum doğrulamaları ve sohbet geçmişi platform yönetimince delil olarak incelenir.
            </Text>
          </View>
        )}
      </Card>

      {/* 4. 6698 Sayılı KVKK Aydınlatma Metni */}
      <Card style={{ gap: 8 }}>
        <Pressable onPress={() => toggle("kvkk")}>
          <View style={styles.accHeader}>
            <SectionTitle>6698 Sayılı KVKK Aydınlatma Metni</SectionTitle>
            {openRule === "kvkk" ? <ChevronDownIcon size={16} color={colors.muted} /> : <ChevronRightIcon size={16} color={colors.muted} />}
          </View>
        </Pressable>
        {openRule === "kvkk" && (
          <View style={{ gap: 6 }}>
            <Text style={styles.accBody}>
              <Text style={{ fontWeight: "700" }}>VERİ İŞLEME HUKUKİ SEBEPLERİ:{"\n"}</Text>
              Kişisel verileriniz 6698 sayılı KVKK Madde 5 ve 6 kapsamında; sözleşmenin kurulması, yasal yükümlülüklerin ifası ve meşru menfaatler doğrultusunda işlenmektedir.{"\n\n"}
              <Text style={{ fontWeight: "700" }}>HAKLARINIZ (MADDE 11):{"\n"}</Text>
              Kişisel verilerinizin işlenip işlenmediğini öğrenme, yanlış verilerin düzeltilmesini isteme, silinmesini talep etme ve kanuna aykırı işlem sebebiyle zararın giderilmesini talep etme hakkına sahipsiniz. İletişim: destek@gunubirlik.qrders.com.tr
            </Text>
          </View>
        )}
      </Card>

      {/* Otomatik Moderasyon ve İhlal Yaptırım Tablosu */}
      <Card style={{ gap: 10 }}>
        <Pressable onPress={() => toggle("moderation")}>
          <View style={styles.accHeader}>
            <SectionTitle>Otomatik Moderasyon & İhlal Tablosu</SectionTitle>
            {openRule === "moderation" ? <ChevronDownIcon size={16} color={colors.muted} /> : <ChevronRightIcon size={16} color={colors.muted} />}
          </View>
        </Pressable>
        {openRule === "moderation" && (
          <View style={{ gap: 8 }}>
            <Text style={styles.desc}>
              Mesajlarda içerik otomatik olarak taranır. İhlaller sistemce yakalanır ve puanınıza yansıtılır:
            </Text>
            {[
              { label: "Küfür & hakaret içeren ifadeler", sev: "HIGH", color: colors.rose, bg: colors.roseBg },
              { label: "Telefon numarası paylaşımı", sev: "LOW", color: colors.amber, bg: colors.amberBg },
              { label: "E-posta veya harici link paylaşımı", sev: "LOW", color: colors.amber, bg: colors.amberBg },
              { label: "IBAN ve banka hesap paylaşımı", sev: "LOW", color: colors.amber, bg: colors.amberBg },
              { label: "Tehdit içeren mesajlar (otomatik engelleme)", sev: "CRITICAL", color: colors.rose, bg: colors.roseBg },
            ].map((r) => (
              <View key={r.label} style={styles.ruleRow}>
                <Text style={styles.ruleText}>{r.label}</Text>
                <Badge label={r.sev} color={r.color} bg={r.bg} />
              </View>
            ))}
            <View style={styles.divider} />
            <Text style={styles.desc}>Yaptırım kademeleri:</Text>
            {[
              { k: "5 Düşük İhlal", v: "24 saat sessize alma" },
              { k: "3 Orta İhlal", v: "24 saat sessize alma" },
              { k: "2 Yüksek İhlal", v: "7 gün askıya alma" },
              { k: "1 Kritik İhlal", v: "Kalıcı ban incelemesi" },
            ].map((r) => (
              <View key={r.k} style={styles.ruleRow}>
                <Text style={styles.ruleText}>{r.k}</Text>
                <Text style={styles.ruleValue}>{r.v}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

/* ================= HAKKINDA ================= */

function AboutTab({ onLogout }: { onLogout: () => void }) {
  const { colors } = useTheme();
  const [blogModalOpen, setBlogModalOpen] = useState(false);
  return (
    <>
      <Card style={{ alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Günübirlik</Text>
        <Text style={styles.desc}>Günlük iş bulma ve işçi bulma platformu</Text>
        <Badge label="Mobil v1.4.0" color={colors.primary} bg={colors.primarySoft} />
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Saha Rehberi & Blog</SectionTitle>
        <Text style={styles.desc}>
          2026 günlük yevmiye tarifeleri, öğrenci ek iş rehberleri ve çalışan hakları üzerine güncel saha analizleri.
        </Text>
        <PrimaryButton
          label="Günübirlik Blog & Rehberini Oku"
          variant="outline"
          onPress={() => setBlogModalOpen(true)}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle>Uygulama</SectionTitle>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleText}>Sürüm</Text>
          <Text style={styles.ruleValue}>1.4.0 (build 16)</Text>
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

      <PrimaryButton label="Oturumu Kapat" variant="danger" onPress={onLogout} />

      {blogModalOpen && (
        <BlogWebViewModal
          visible={blogModalOpen}
          url="https://gunubirlik.qrders.com.tr/blog"
          title="Günübirlik Rehber & Blog"
          onClose={() => setBlogModalOpen(false)}
        />
      )}
    </>
  );
}

/* ================= HAKKINDA: destek talepleri ================= */

const TICKET_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: "COMPLAINT", label: "Şikayet" },
  { value: "SUGGESTION", label: "Öneri" },
  { value: "BUG", label: "Hata Bildirimi" },
  { value: "ACCOUNT", label: "Hesap İşlemleri" },
  { value: "PAYMENT", label: "Ödeme ve Bakiye" },
  { value: "OTHER", label: "Diğer" },
];

function getCategoryIcon(cat: SupportCategory, colors: ThemeColors) {
  switch (cat) {
    case "COMPLAINT":
      return <AlertCircleIcon size={14} color={colors.rose} />;
    case "SUGGESTION":
      return <SparklesIcon size={14} color={colors.amber} />;
    case "BUG":
      return <HelpCircleIcon size={14} color={colors.rose} />;
    case "ACCOUNT":
      return <UserIcon size={14} color={colors.primary} />;
    case "PAYMENT":
      return <WalletIcon size={14} color={colors.primary} />;
    case "OTHER":
    default:
      return <InfoIcon size={14} color={colors.muted} />;
  }
}

const getTicketPriorities = (colors: ThemeColors): { value: SupportPriority; label: string; color: string; bg: string }[] => [
  { value: "LOW", label: "Düşük", color: colors.muted, bg: colors.cardSecondary },
  { value: "NORMAL", label: "Normal", color: colors.primary, bg: colors.primarySoft },
  { value: "HIGH", label: "Yüksek", color: colors.rose, bg: colors.roseBg },
];

function SupportTicketSection() {
  const { colors } = useTheme();
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
      OPEN: { label: "Açık", color: colors.primary, bg: colors.primarySoft },
      IN_PROGRESS: { label: "İnceleniyor", color: colors.amber, bg: colors.amberBg },
      RESOLVED: { label: "Çözüldü", color: colors.emerald, bg: colors.emeraldBg },
      CLOSED: { label: "Kapandı", color: colors.muted, bg: colors.cardSecondary },
    };
    const it = map[s] ?? map.OPEN;
    return <Badge label={it.label} color={it.color} bg={it.bg} />;
  };

  return (
    <Card style={{ gap: 10 }}>
      <SectionTitle>Destek Talebi</SectionTitle>
      <Text style={styles.desc}>
        Sorun, öneri veya ödeme itirazlarını yaz; admin ekibine bildirim gider.
      </Text>
      <PrimaryButton label="Yeni Destek Talebi Oluştur" onPress={openSheet} />

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
                  <Text style={styles.ticketReply} numberOfLines={2}>Admin Cevabı: {t.reply}</Text>
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          {getCategoryIcon(c.value, colors)}
                          <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                            {c.label}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.label}>Öncelik</Text>
                  <View style={styles.chipWrap}>
                    {getTicketPriorities(colors).map((p) => (
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
  const { colors } = useTheme();
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
        <TrashIcon size={20} color={pending ? colors.amber : colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.verifiedTitle, { color: pending ? colors.amber : colors.danger }]}>
            {pending ? "Hesap silme talebin beklemede" : `Hesap silme talebi: ${status.status}`}
          </Text>
          <Text style={[styles.verifiedSub, { color: colors.muted }]}>
            Admin onayına kadar uygulamayı kullanmaya devam edebilirsin.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Card style={{ gap: 10, borderColor: colors.rose + "40" }}>
        <SectionTitle>Hesap Silme</SectionTitle>
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
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const { colors } = useTheme();
  return (
    <View style={{ gap: 5 }}>
      {props.label ? <Text style={[styles.label, { color: colors.text }]}>{props.label}</Text> : null}
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused, { flexDirection: "row", alignItems: "center" }]}>
        <TextInput
          style={[styles.input, props.multiline && styles.textArea, { flex: 1, color: colors.text }]}
          value={props.value}
          onChangeText={props.onChangeText}
          secureTextEntry={props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize ?? "sentences"}
          multiline={props.multiline}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {props.rightElement ? <View style={{ paddingLeft: 8 }}>{props.rightElement}</View> : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  tabStrip: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  tabStripInner: { flexDirection: "row", gap: 2, paddingHorizontal: 8, paddingVertical: 8 },
  tabBtn: { alignItems: "center", justifyContent: "center" },
  tabPill: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, gap: 2 },
  tabIconBox: { alignItems: "center", justifyContent: "center" },
  tabIcon: { fontSize: 18, opacity: 0.6 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  tabLabelActive: { fontWeight: "800" },
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },
  idRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 62, height: 62, borderRadius: 31 },
  avatarBadge: { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: "#0D6847", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  avatarBadgeText: { fontSize: 11 },
  avatarText: { fontSize: 18, fontWeight: "800", color: colors.primary },
  avatarEdit: { fontSize: 9, fontWeight: "700", color: colors.primary, textAlign: "center", marginTop: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 17, fontWeight: "800", color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  ratingBox: { alignItems: "center", backgroundColor: colors.amberBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  ratingValue: { fontSize: 16, fontWeight: "800", color: colors.amber },
  ratingCount: { fontSize: 10, color: colors.amber },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  bio: { fontSize: 13, color: colors.text, backgroundColor: colors.cardSecondary, borderRadius: 10, padding: 10, marginTop: 10, lineHeight: 20 },
  memberSince: { fontSize: 11, color: colors.muted, marginTop: 8 },
  // --- Modern profil kartı ---
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  profileTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarRing: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  profileName: { fontSize: 18, fontWeight: "800", color: colors.text },
  profileChipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  profileChip: { backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  profileChipOk: { backgroundColor: colors.emeraldBg, borderColor: colors.emerald + "40" },
  profileChipText: { fontSize: 10.5, fontWeight: "700", color: colors.text },
  profileChipTextOk: { color: colors.emerald },
  profileCompany: { fontSize: 12, fontWeight: "600", color: colors.muted },
  profileInfoRow: { gap: 6 },
  infoPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  infoPillIconBox: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  infoPillIcon: { fontSize: 12 },
  infoPillText: { flex: 1, fontSize: 12, color: colors.text, fontWeight: "600" },
  profileStats: { flexDirection: "row", backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 12 },
  profileStat: { flex: 1, alignItems: "center", gap: 2 },
  profileStatDivider: { width: 1, backgroundColor: colors.border },
  profileStatValue: { fontSize: 15, fontWeight: "800", color: colors.text },
  profileStatValueSm: { fontSize: 13 },
  profileStatLabel: { fontSize: 10.5, fontWeight: "600", color: colors.muted },
  desc: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  backupTitle: { fontSize: 12, fontWeight: "700", color: colors.amber },
  backupCodes: { fontSize: 12, color: colors.amber, lineHeight: 20 },
  qrImage: { width: 180, height: 180, alignSelf: "center", borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  secretText: { fontSize: 12, fontWeight: "700", color: colors.text, textAlign: "center", letterSpacing: 1 },
  label: { fontSize: 12, fontWeight: "800", color: colors.text, letterSpacing: 0.2 },
  inputWrap: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 12,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  input: { paddingVertical: 11, fontSize: 14, fontWeight: "600", color: colors.text },
  textArea: { minHeight: 74, textAlignVertical: "top" },
  formSectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  error: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  statRow: { flexDirection: "row", gap: 10 },
  historyRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  historyTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  historyMeta: { fontSize: 12, color: colors.muted },
  miniNote: { fontSize: 11, color: colors.muted, lineHeight: 16, backgroundColor: colors.cardSecondary, borderRadius: 8, padding: 8 },
  walletHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  walletTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  walletBalance: { fontSize: 34, fontWeight: "800", color: colors.primary },
  walletSub: { fontSize: 12, color: colors.muted, marginTop: -4 },
  divider: { height: 1, backgroundColor: colors.borderLight },
  infoRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 12, color: colors.muted, width: 110 },
  infoValue: { fontSize: 13, color: colors.text, flex: 1, lineHeight: 19 },
  infoValueStrong: { fontSize: 13, fontWeight: "800", color: colors.primary, flex: 1 },
  flowStep: { fontSize: 13, color: colors.text, lineHeight: 20 },
  flowStrong: { fontWeight: "800" },
  ledgerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  ledgerAmount: { fontSize: 14, fontWeight: "800", color: colors.text },
  secRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  secIcon: { fontSize: 16 },
  secLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  secDesc: { fontSize: 12, color: colors.muted, marginTop: 1 },
  secValue: { fontSize: 13, fontWeight: "700", color: colors.emerald },
  secValueDanger: { color: colors.danger },
  banBox: { backgroundColor: colors.roseBg, borderRadius: 10, padding: 10 },
  banText: { fontSize: 13, color: colors.rose, fontWeight: "700", lineHeight: 19 },
  ruleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, paddingVertical: 4 },
  ruleText: { fontSize: 13, color: colors.text, flex: 1, lineHeight: 18 },
  ruleValue: { fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "right" },
  accHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accChevron: { fontSize: 14, color: colors.muted },
  accBody: { fontSize: 13, color: colors.text, lineHeight: 20 },
  // --- Modal sheet (profil düzenle / doğrulama / destek / hesap silme) ---
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
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
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: colors.text },
  sheetSub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4, marginBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2, marginBottom: 14 },
  sheetIconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIcon: { fontSize: 20 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: { fontSize: 14, color: colors.muted, fontWeight: "800" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 2,
  },
  // --- Modern şifre kartı ---
  pwCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pwHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 },
  pwIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.emeraldBg,
    alignItems: "center",
    justifyContent: "center",
  },
  pwIcon: { fontSize: 18 },
  pwTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  pwSub: { fontSize: 11, color: colors.muted, lineHeight: 15, marginTop: 2 },
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
  gradStatLabel: { fontSize: 10.5, fontWeight: "700", color: colors.muted, lineHeight: 13 },
  // --- Puan özeti ---
  ratingHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  trendChip: { backgroundColor: colors.amberBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  trendText: { fontSize: 10.5, fontWeight: "800", color: colors.amber },
  ratingHeroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  ratingHeroAvg: { fontSize: 42, fontWeight: "900", color: colors.text, letterSpacing: -1.5 },
  ratingHeroCount: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  distStar: { fontSize: 11, fontWeight: "700", color: colors.amber, width: 26 },
  distTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.cardSecondary, overflow: "hidden" },
  distFill: { height: "100%", borderRadius: 4, backgroundColor: colors.amber },
  distCount: { fontSize: 11, color: colors.muted, width: 26, textAlign: "right", fontWeight: "700" },
  // --- Yorumlar ---
  reviewRow: { flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontSize: 15, fontWeight: "800", color: colors.primary },
  reviewHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reviewName: { fontSize: 13, fontWeight: "800", color: colors.text, flex: 1 },
  reviewComment: { fontSize: 12.5, color: colors.text, lineHeight: 18 },
  reviewMeta: { fontSize: 10.5, color: colors.muted },
  // --- Doğrulama ---
  verifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  verifiedBannerPending: { backgroundColor: colors.amberBg, borderColor: "#fde68a" },
  deleteBannerDone: { backgroundColor: colors.roseBg, borderColor: "#fecaca" },
  verifiedBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadgeCheck: { fontSize: 18, fontWeight: "900", color: "#fff" },
  verifiedTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  verifiedSub: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  verifiedEmoji: { fontSize: 22 },
  verifiedMiniIcon: { fontSize: 18 },
  rejectNote: { fontSize: 13, color: colors.rose, lineHeight: 19, backgroundColor: colors.roseBg, borderRadius: 10, padding: 10 },
  verifTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.cardSecondary,
  },
  verifTypeRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  verifTypeLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
  verifTypeHint: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
  verifRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  verifRadioActive: { borderColor: colors.primary },
  verifRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },
  docPickBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.cardSecondary,
  },
  docPickEmpty: { alignItems: "center", paddingVertical: 22, gap: 4 },
  docPickText: { fontSize: 13.5, fontWeight: "800", color: colors.primary },
  docPickHint: { fontSize: 11, color: colors.muted },
  docPreview: { width: "100%", height: 170 },
  // --- Güvenlik hero ---
  secHero: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  secHeroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  secHeroIcon: { fontSize: 24 },
  secHeroTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  secHeroSub: { fontSize: 12.5, color: colors.muted, lineHeight: 18 },
  secRowDanger: { backgroundColor: colors.roseBg, borderRadius: 12, paddingHorizontal: 8, marginHorizontal: -8, paddingVertical: 8 },
  secIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  secIconBoxDanger: { backgroundColor: colors.roseBg },
  // --- Destek talebi ---
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.cardSecondary,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  chipTextActive: { color: colors.primary },
  historyLabel: { fontSize: 12.5, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  ticketRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  ticketHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketSubject: { fontSize: 13.5, fontWeight: "800", color: colors.text, flex: 1 },
  ticketMeta: { fontSize: 11, color: colors.muted },
  ticketReply: { fontSize: 12, color: colors.emerald, backgroundColor: colors.emeraldBg, borderRadius: 8, padding: 7, lineHeight: 17 },
});
let styles = createStyles(lightColors);
