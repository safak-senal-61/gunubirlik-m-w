import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Card, C, Loading, PrimaryButton, SectionTitle, useTheme, lightColors, type ThemeColors } from "@/components/ui";
import LeafletMap from "@/components/LeafletMap";
import { applyToJob, deleteJob, fetchJob } from "@/lib/api";
import { toggleSaved, useSavedIds } from "@/lib/saved-store";
import type { ApiApplication, ApiJob } from "@/lib/types";
import {
  JOB_STATUS_LABELS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatWage,
  parseSkills,
  timeAgo,
} from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeftIcon,
  BookmarkFilledIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExternalLinkIcon,
  HourglassIcon,
  InfoIcon,
  MapPinIcon,
  MessageIcon,
  QrScanIcon,
  StarIcon,
  TrashIcon,
  VerifiedCheckIcon,
  WalletIcon,
  XCircleIcon,
  getCategoryIconComponent,
} from "@/components/icons";

export default function JobDetailScreen({
  jobId,
  onBack,
  onStartChat,
  onShowQR,
  onScanQR,
}: {
  jobId: string;
  onBack: () => void;
  onStartChat?: (participantId: string, jobId: string) => void;
  onShowQR?: (job: ApiJob) => void;
  onScanQR?: () => void;
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [job, setJob] = useState<ApiJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const savedIds = useSavedIds();
  const isSaved = savedIds.includes(jobId);

  useEffect(() => {
    setLoading(true);
    fetchJob(jobId)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : "İlan yüklenemedi"))
      .finally(() => setLoading(false));
  }, [jobId]);

  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleToggleSave = async () => {
    if (saveBusy) return;
    setSaveBusy(true);
    try {
      await toggleSaved(jobId);
    } catch (err) {
      Alert.alert("Kaydedilemedi", err instanceof Error ? err.message : "Tekrar dene.");
    } finally {
      setSaveBusy(false);
    }
  };

  const handleDeleteJob = () => {
    Alert.alert("İlanı sil", "Bu ilan kalıcı olarak silinsin mi?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setDeleteBusy(true);
          try {
            await deleteJob(jobId);
            onBack();
          } catch (err) {
            Alert.alert("Hata", err instanceof Error ? err.message : "İlan silinemedi.");
          } finally {
            setDeleteBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;
  if (error || !job) {
    return (
      <View style={styles.wrap}>
        <Card>
          <Text style={styles.notFound}>İlan bulunamadı</Text>
          <Text style={styles.notFoundSub}>{error ?? "Bu ilan kaldırılmış olabilir."}</Text>
          <PrimaryButton label="Geri Dön" variant="outline" onPress={onBack} />
        </Card>
      </View>
    );
  }

  const isOwner = user?.id === job.employerId;
  const isWorker = user?.role === "WORKER";
  const skills = parseSkills(job.requiredSkills);

  return (
    <ScrollView style={[styles.flex, { backgroundColor: colors.bg }]} contentContainerStyle={[styles.wrap, { backgroundColor: colors.bg }]}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <ArrowLeftIcon size={16} color={colors.muted} />
        <Text style={[styles.back, { color: colors.muted }]}>Tüm ilanlar</Text>
      </Pressable>

      <Card>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{job.title}</Text>
            <View style={styles.employerRowInline}>
              <Text style={[styles.employer, { color: colors.muted }]}>
                {job.employer.companyName ?? job.employer.fullName}
              </Text>
              {job.employer.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.primarySoft }]}>
                  <VerifiedCheckIcon size={14} color={colors.primary} />
                  <Text style={[styles.verifiedText, { color: colors.primary }]}>Doğrulanmış</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.catBox, { backgroundColor: colors.primarySoft }]}>
            {getCategoryIconComponent(job.category, 24, colors.primary)}
          </View>
        </View>

        <View style={styles.badgeRow}>
          <Badge label={JOB_STATUS_LABELS[job.status]} color={colors.stone} bg={colors.stoneBg} />
          {job.urgency !== "LOW" && (
            <Badge
              label={URGENCY_LABELS[job.urgency]}
              color={URGENCY_COLORS[job.urgency]}
              bg={URGENCY_COLORS[job.urgency] === colors.rose ? colors.roseBg : URGENCY_COLORS[job.urgency] === colors.amber ? colors.amberBg : colors.emeraldBg}
            />
          )}
          {isOwner && <Badge label="Senin ilanın" color={colors.primary} bg={colors.primarySoft} />}
        </View>

        <View style={styles.tiles}>
          <Tile
            icon={<CalendarIcon size={15} color={colors.primary} />}
            label="İş günü"
            value={new Date(job.workDate).toLocaleDateString("tr-TR")}
          />
          <Tile
            icon={<ClockIcon size={15} color={colors.primary} />}
            label="Saatler"
            value={`${job.startTime.slice(0, 5)}–${job.endTime.slice(0, 5)} (${job.durationHours} sa)`}
          />
          <Tile
            icon={<MapPinIcon size={15} color={C.primary} />}
            label="Konum"
            value={`${job.district}, ${job.city}`}
          />
          <Tile
            icon={<WalletIcon size={15} color={C.primary} />}
            label="Ücret"
            value={`${formatWage(job.wageAmount, job.wageType)}${job.isWageNegotiable ? " · Pazarlık" : ""}`}
          />
        </View>

        <Text style={styles.metaLine}>
          Yayınlandı {timeAgo(job.createdAt)} · {job.viewCount} görüntülenme · {job.applicationCount} başvuru
          {job.openingsTotal > 1 ? ` · ${job.openingsFilled}/${job.openingsTotal} doluluk` : ""}
        </Text>

        {isWorker && !isOwner && (
          <View style={styles.actionRow}>
            {job.myApplication && (
              <StatusBanner status={job.myApplication.status} workDate={job.workDate} />
            )}
            <PrimaryButton
              label={isSaved ? "Kaydedildi" : "Kaydet"}
              variant="outline"
              disabled={saveBusy}
              onPress={handleToggleSave}
            />
            {onStartChat && (
              <PrimaryButton
                label="Sohbet Başlat"
                variant="outline"
                onPress={() => onStartChat(job.employerId, job.id)}
              />
            )}
            {(onScanQR || onShowQR) && job.myApplication && (
              <PrimaryButton
                label="QR Kodunu Tara"
                variant="outline"
                onPress={() => (onScanQR ? onScanQR() : onShowQR?.(job))}
              />
            )}
            {job.myApplication ? null : job.status === "OPEN" ? (
              <PrimaryButton label="Bu işe başvur" onPress={() => setApplyOpen(true)} />
            ) : (
              <Badge label="Başvuruya kapalı" color={C.muted} bg={C.stoneBg} />
            )}
          </View>
        )}

        {isOwner && (
          <View style={styles.actionRow}>
            {onShowQR && (
              <PrimaryButton
                label="QR Kodunu Göster"
                variant="outline"
                onPress={() => onShowQR(job)}
              />
            )}
            <PrimaryButton
              label="İlanı Sil"
              variant="ghost"
              disabled={deleteBusy}
              onPress={handleDeleteJob}
            />
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle>İş Açıklaması</SectionTitle>
        {job.description.split("\n").filter(Boolean).map((para, i) => (
          <Text key={i} style={styles.para}>{para}</Text>
        ))}

        {skills.length > 0 && (
          <>
            <Text style={styles.skillsTitle}>ARANAN BECERİLER</Text>
            <View style={styles.skillRow}>
              {skills.map((s) => (
                <Badge key={s} label={s} color={C.text} bg={C.stoneBg} />
              ))}
            </View>
          </>
        )}

        {job.locationNote && (
          <View style={styles.locationNoteBox}>
            <MapPinIcon size={16} color={C.primary} />
            <Text style={styles.noteText}>
              {job.locationNote}{job.address ? `\n${job.address}` : ""}
            </Text>
          </View>
        )}
      </Card>

      {job.latitude != null && job.longitude != null && (
        <Card style={styles.mapCard}>
          <View style={styles.mapRow}>
            <View style={styles.mapTitleRow}>
              <MapPinIcon size={18} color={C.primary} />
              <SectionTitle>İş Yeri Haritası</SectionTitle>
            </View>
            <Pressable
              style={styles.mapLinkBtn}
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${job.latitude},${job.longitude}`)
              }
            >
              <Text style={styles.mapLink}>Haritada Aç</Text>
              <ExternalLinkIcon size={12} color={C.primary} />
            </Pressable>
          </View>
          <LeafletMap
            latitude={job.latitude}
            longitude={job.longitude}
            title={job.title}
            category={job.category}
            address={job.address}
          />
          <Text style={styles.mapHint}>
            {job.address ?? `${job.district}, ${job.city}`} · {job.latitude?.toFixed(4)}, {job.longitude?.toFixed(4)}
          </Text>
        </Card>
      )}

      <Card>
        <SectionTitle>İşveren Hakkında</SectionTitle>
        <View style={styles.employerRow}>
          <View style={styles.employerAvatar}>
            <Text style={styles.employerInitial}>
              {(job.employer.companyName ?? job.employer.fullName).slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.employerName}>
                {job.employer.companyName ?? job.employer.fullName}
              </Text>
              {job.employer.isVerified && <VerifiedCheckIcon size={14} color={C.primary} />}
            </View>
            <View style={styles.ratingRow}>
              <StarIcon size={13} color="#D97706" />
              <Text style={styles.employerMeta}>
                {job.employer.ratingAvg.toFixed(1)} ({job.employer.ratingCount} değerlendirme)
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <ApplyModal
        job={job}
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={() => {
          setApplyOpen(false);
          fetchJob(jobId).then(setJob).catch(() => {});
        }}
      />
    </ScrollView>
  );
}

function StatusBanner({ status, workDate }: { status: ApiApplication["status"]; workDate: string }) {
  const cfg =
    status === "ACCEPTED"
      ? {
          bg: C.emeraldBg,
          border: "#34d399",
          icon: <CheckCircleIcon size={22} color={C.primary} />,
          title: "Başvurunuz onaylandı",
          desc: "İş başlangıç tarihi: " + new Date(workDate).toLocaleDateString("tr-TR"),
        }
      : status === "PENDING"
        ? {
            bg: C.amberBg,
            border: "#fbbf24",
            icon: <HourglassIcon size={22} color={C.amber} />,
            title: "Başvurunuz inceleniyor",
            desc: "İşveren başvurunuzu değerlendiriyor, yanıt bildirimi gelecektir.",
          }
        : status === "REJECTED"
          ? {
              bg: C.roseBg,
              border: "#fda4af",
              icon: <XCircleIcon size={22} color={C.rose} />,
              title: "Başvuru onaylanmadı",
              desc: "Bu ilana farklı bir aday seçildi. Benzer diğer ilanları inceleyebilirsiniz.",
            }
          : {
              bg: C.emeraldBg,
              border: "#34d399",
              icon: <CheckCircleIcon size={22} color={C.primary} />,
              title: "İş tamamlandı",
              desc: `Tamamlanan iş günü: ${new Date(workDate).toLocaleDateString("tr-TR")} · Ödeme cüzdanınıza yansıtıldı.`,
            };

  return (
    <View style={[styles.statusBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={styles.statusBannerIconBox}>
        {cfg.icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statusBannerTitle}>{cfg.title}</Text>
        <Text style={styles.statusBannerDesc}>{cfg.desc}</Text>
      </View>
    </View>
  );
}

function Tile({ icon, label, value }: { icon: ReactNode; value: string; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.tile, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
      <View style={styles.tileHeader}>
        {icon}
        <Text style={[styles.tileLabel, { color: colors.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ApplyModal({
  job,
  open,
  onClose,
  onApplied,
}: {
  job: ApiJob;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [message, setMessage] = useState("");
  const [wage, setWage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const QUICK_TEMPLATES = [
    "Merhaba, bu iş için uygunum, detayları konuşabilir miyiz?",
    "Merhaba, aynı alanda tecrübem var, tam vaktinde orada olabilirim.",
    "Selam, gün ve saatler bana uyuyor, hemen başlayabilirim.",
  ];

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await applyToJob(job.id, {
        message: message.trim() || undefined,
        ...(wage.trim() ? { proposedWage: Number(wage) } : {}),
      });
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başvuru başarısız");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Başvuru Gönder</Text>
          <Text style={[styles.modalDesc, { color: colors.muted }]}>
            İşverene kısa bir bilgilendirme mesajı iletin veya dilerseniz ücret teklifinizi belirtin.
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
              styles.textArea,
            ]}
            value={message}
            onChangeText={setMessage}
            placeholder="Merhaba, bu iş için uygunum, detayları konuşabilir miyiz?"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
          />
          <View style={styles.quickRow}>
            {QUICK_TEMPLATES.map((tpl) => (
              <Pressable
                key={tpl}
                style={({ pressed }) => [
                  styles.quickChip,
                  { backgroundColor: colors.primarySoft, borderColor: colors.border },
                  pressed && styles.quickChipPressed,
                ]}
                onPress={() => setMessage(tpl)}
              >
                <Text style={[styles.quickText, { color: colors.primary }]}>{tpl}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.spamNote, { backgroundColor: colors.amberBg, borderColor: colors.border }]}>
            <InfoIcon size={14} color={colors.amber} />
            <Text style={[styles.spamText, { color: colors.amber }]}>
              Telefon, e-posta ve hesap bilgileri güvenlik amacıyla filtrelenmektedir. Tüm iletişimi güvenli mesajlaşma üzerinden yürütünüz.
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={wage}
            onChangeText={(v) => setWage(v.replace(/\D/g, ""))}
            placeholder={`Ücret teklifiniz (₺) (opsiyonel, örn. ${job.wageAmount})`}
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} disabled={saving} />
            <PrimaryButton label="Başvuruyu Tamamla" onPress={submit} loading={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 12, backgroundColor: colors.bg },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  back: { fontSize: 13, fontWeight: "600", color: colors.muted },
  headRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, lineHeight: 26 },
  employerRowInline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  employer: { fontSize: 13, color: colors.muted },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  verifiedText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  catBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.12)",
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  tile: { width: "48.5%", backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  tileHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  tileValue: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 4 },
  metaLine: { fontSize: 11, color: colors.muted, marginTop: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" },
  para: { fontSize: 14, color: colors.text, lineHeight: 22, marginTop: 10 },
  skillsTitle: { fontSize: 11, fontWeight: "700", color: colors.muted, letterSpacing: 0.5, marginTop: 14 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  locationNoteBox: { flexDirection: "row", gap: 8, backgroundColor: colors.cardSecondary, borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border },
  noteText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  mapRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mapTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mapLinkBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  mapLink: { fontSize: 12, fontWeight: "700", color: colors.primary },
  mapCard: { gap: 10 },
  mapHint: { fontSize: 12, color: colors.muted, marginTop: 8 },
  statusBanner: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    width: "100%",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
  },
  statusBannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBannerTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  statusBannerDesc: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  employerRow: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 10 },
  employerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  employerInitial: { fontSize: 18, fontWeight: "800", color: colors.primary },
  employerName: { fontSize: 14, fontWeight: "700", color: colors.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  employerMeta: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  notFound: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  notFoundSub: { fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quickChip: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(13,104,71,0.15)" },
  quickChipPressed: { opacity: 0.8 },
  quickText: { fontSize: 11, fontWeight: "600", color: colors.primary },
  spamNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 12, padding: 10 },
  spamText: { flex: 1, fontSize: 11, color: colors.amber, lineHeight: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  modalDesc: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: colors.text },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: 13 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 4 },
});
let styles = createStyles(lightColors);
