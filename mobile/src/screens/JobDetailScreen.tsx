import React, { useEffect, useState, type ReactNode } from "react";
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
import { Badge, Card, C, Loading, PrimaryButton, SectionTitle } from "@/components/ui";
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
    <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <ArrowLeftIcon size={16} color={C.muted} />
        <Text style={styles.back}>Tüm ilanlar</Text>
      </Pressable>

      <Card>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{job.title}</Text>
            <View style={styles.employerRowInline}>
              <Text style={styles.employer}>
                {job.employer.companyName ?? job.employer.fullName}
              </Text>
              {job.employer.isVerified && (
                <View style={styles.verifiedBadge}>
                  <VerifiedCheckIcon size={14} color={C.primary} />
                  <Text style={styles.verifiedText}>Doğrulanmış</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.catBox}>
            {getCategoryIconComponent(job.category, 24, C.primary)}
          </View>
        </View>

        <View style={styles.badgeRow}>
          <Badge label={JOB_STATUS_LABELS[job.status]} color={C.stone} bg={C.stoneBg} />
          {job.urgency !== "LOW" && (
            <Badge
              label={URGENCY_LABELS[job.urgency]}
              color={URGENCY_COLORS[job.urgency]}
              bg={URGENCY_COLORS[job.urgency] === C.rose ? C.roseBg : URGENCY_COLORS[job.urgency] === C.amber ? C.amberBg : C.emeraldBg}
            />
          )}
          {isOwner && <Badge label="Senin ilanın" color={C.primary} bg={C.primarySoft} />}
        </View>

        <View style={styles.tiles}>
          <Tile
            icon={<CalendarIcon size={15} color={C.primary} />}
            label="İş günü"
            value={new Date(job.workDate).toLocaleDateString("tr-TR")}
          />
          <Tile
            icon={<ClockIcon size={15} color={C.primary} />}
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
  return (
    <View style={styles.tile}>
      <View style={styles.tileHeader}>
        {icon}
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
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
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Başvuru Gönder</Text>
          <Text style={styles.modalDesc}>
            İşverene kısa bir bilgilendirme mesajı iletin veya dilerseniz ücret teklifinizi belirtin.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Merhaba, bu iş için uygunum, detayları konuşabilir miyiz?"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={4}
          />
          <View style={styles.quickRow}>
            {QUICK_TEMPLATES.map((tpl) => (
              <Pressable
                key={tpl}
                style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
                onPress={() => setMessage(tpl)}
              >
                <Text style={styles.quickText}>{tpl}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.spamNote}>
            <InfoIcon size={14} color={C.amber} />
            <Text style={styles.spamText}>
              Telefon, e-posta ve hesap bilgileri güvenlik amacıyla filtrelenmektedir. Tüm iletişimi güvenli mesajlaşma üzerinden yürütünüz.
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={wage}
            onChangeText={(v) => setWage(v.replace(/\D/g, ""))}
            placeholder={`Ücret teklifiniz (₺) (opsiyonel, örn. ${job.wageAmount})`}
            placeholderTextColor={C.muted}
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 12, backgroundColor: C.bg },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  back: { fontSize: 13, fontWeight: "600", color: C.muted },
  headRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: "800", color: C.text, lineHeight: 26 },
  employerRowInline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  employer: { fontSize: 13, color: C.muted },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  verifiedText: { fontSize: 11, fontWeight: "700", color: C.primary },
  catBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(13,104,71,0.12)",
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  tile: { width: "48.5%", backgroundColor: "#F6F5F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E8E6DF" },
  tileHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },
  tileValue: { fontSize: 13, fontWeight: "700", color: C.text, marginTop: 4 },
  metaLine: { fontSize: 11, color: C.muted, marginTop: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" },
  para: { fontSize: 14, color: C.text, lineHeight: 22, marginTop: 10 },
  skillsTitle: { fontSize: 11, fontWeight: "700", color: C.muted, letterSpacing: 0.5, marginTop: 14 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  locationNoteBox: { flexDirection: "row", gap: 8, backgroundColor: "#F6F5F2", borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: "#E8E6DF" },
  noteText: { flex: 1, fontSize: 13, color: C.text, lineHeight: 19 },
  mapRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mapTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mapLinkBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  mapLink: { fontSize: 12, fontWeight: "700", color: C.primary },
  mapCard: { gap: 10 },
  mapHint: { fontSize: 12, color: C.muted, marginTop: 8 },
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
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBannerTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  statusBannerDesc: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },
  employerRow: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 10 },
  employerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  employerInitial: { fontSize: 18, fontWeight: "800", color: C.primary },
  employerName: { fontSize: 14, fontWeight: "700", color: C.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  employerMeta: { fontSize: 12, color: C.muted, fontWeight: "600" },
  notFound: { fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" },
  notFoundSub: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 6, marginBottom: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quickChip: { backgroundColor: C.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(13,104,71,0.15)" },
  quickChipPressed: { opacity: 0.8 },
  quickText: { fontSize: 11, fontWeight: "600", color: C.primary },
  spamNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 12, padding: 10 },
  spamText: { flex: 1, fontSize: 11, color: C.amber, lineHeight: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  modalDesc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  error: { color: C.danger, fontSize: 13 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 4 },
});
