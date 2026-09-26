import { useEffect, useState } from "react";
import {
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
import { applyToJob, fetchJob, toggleSaveJob } from "@/lib/api";
import type { ApiJob } from "@/lib/types";
import {
  CATEGORY_ICONS,
  JOB_STATUS_LABELS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatWage,
  parseSkills,
  timeAgo,
} from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export default function JobDetailScreen({
  jobId,
  onBack,
  onStartChat,
  onShowQR,
}: {
  jobId: string;
  onBack: () => void;
  onStartChat?: (participantId: string, jobId: string) => void;
  onShowQR?: (job: ApiJob) => void;
}) {
  const { user } = useAuth();
  const [job, setJob] = useState<ApiJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchJob(jobId)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : "İlan yüklenemedi"))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return <Loading />;
  if (error || !job) {
    return (
      <View style={styles.wrap}>
        <Card>
          <Text style={styles.notFound}>İlan bulunamadı</Text>
          <Text style={styles.notFoundSub}>{error ?? "Bu ilan kaldırılmış olabilir."}</Text>
          <PrimaryButton label="← Geri" variant="outline" onPress={onBack} />
        </Card>
      </View>
    );
  }

  const isOwner = user?.id === job.employerId;
  const isWorker = user?.role === "WORKER";
  const skills = parseSkills(job.requiredSkills);

  const mapUrl =
    job.latitude != null && job.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${job.latitude},${job.longitude}`
      : null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.back}>← Tüm ilanlar</Text>
      </Pressable>

      <Card>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.employer}>
              {job.employer.companyName ?? job.employer.fullName}
              {job.employer.isVerified ? " ✓ Doğrulanmış" : ""}
            </Text>
          </View>
          <Text style={styles.catIcon}>{CATEGORY_ICONS[job.category] ?? "💼"}</Text>
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
          <Tile emoji="📅" label="İş günü" value={new Date(job.workDate).toLocaleDateString("tr-TR")} />
          <Tile emoji="⏰" label="Saatler" value={`${job.startTime.slice(0, 5)}–${job.endTime.slice(0, 5)} (${job.durationHours} sa)`} />
          <Tile emoji="📍" label="Konum" value={`${job.district}, ${job.city}`} />
          <Tile emoji="💰" label="Ücret" value={`${formatWage(job.wageAmount, job.wageType)}${job.isWageNegotiable ? " · Pazarlık payı" : ""}`} />
        </View>

        <Text style={styles.metaLine}>
          Yayınlandı {timeAgo(job.createdAt)} · {job.viewCount} görüntülenme · {job.applicationCount} başvuru
          {job.openingsTotal > 1 ? ` · ${job.openingsFilled}/${job.openingsTotal} doluluk` : ""}
        </Text>

        {isWorker && !isOwner && (
          <View style={styles.actionRow}>
            <PrimaryButton
              label="♡ Kaydet"
              variant="outline"
              onPress={async () => {
                try {
                  await toggleSaveJob(job.id);
                } catch {
                  // sessiz
                }
              }}
            />
            {onStartChat && (
              <PrimaryButton
                label="💬 Sohbet Et"
                variant="outline"
                onPress={() => onStartChat(job.employerId, job.id)}
              />
            )}
            {onShowQR && job.myApplication && (
              <PrimaryButton
                label="📱 QR Göster"
                variant="outline"
                onPress={() => onShowQR(job)}
              />
            )}
            {job.myApplication ? (
              <Badge
                label={
                  job.myApplication.status === "PENDING" ? "Başvurun beklemede"
                  : job.myApplication.status === "ACCEPTED" ? "Başvurun kabul edildi ✓"
                  : job.myApplication.status === "REJECTED" ? "Başvurun reddedildi"
                  : "İş tamamlandı"
                }
                color={C.emerald}
                bg={C.emeraldBg}
              />
            ) : job.status === "OPEN" ? (
              <PrimaryButton label="Bu işe başvur" onPress={() => setApplyOpen(true)} />
            ) : (
              <Badge label="Başvuruya kapalı" color={C.muted} bg={C.stoneBg} />
            )}
          </View>
        )}

        {isOwner && onShowQR && (
          <View style={styles.actionRow}>
            <PrimaryButton
              label="📱 İş QR'ı (Başlat / Bitir)"
              variant="outline"
              onPress={() => onShowQR(job)}
            />
          </View>
        )}

        {isOwner && onShowQR && (
          <View style={styles.actionRow}>
            <PrimaryButton
              label="📱 İş QR'ı (Başlat / Bitir)"
              variant="outline"
              onPress={() => onShowQR(job)}
            />
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle>İş açıklaması</SectionTitle>
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
          <Text style={styles.note}>📍 {job.locationNote}{job.address ? `\n${job.address}` : ""}</Text>
        )}
      </Card>

      {mapUrl && (
        <Card>
          <View style={styles.mapRow}>
            <SectionTitle>Konum</SectionTitle>
            <Pressable onPress={() => Linking.openURL(mapUrl)}>
              <Text style={styles.mapLink}>Haritada aç →</Text>
            </Pressable>
          </View>
          <Text style={styles.mapHint}>
            {job.address ?? `${job.district}, ${job.city}`} · {job.latitude?.toFixed(4)}, {job.longitude?.toFixed(4)}
          </Text>
        </Card>
      )}

      <Card>
        <SectionTitle>İşveren</SectionTitle>
        <View style={styles.employerRow}>
          <View style={styles.employerAvatar}>
            <Text style={styles.employerInitial}>
              {(job.employer.companyName ?? job.employer.fullName).slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.employerName}>
              {job.employer.companyName ?? job.employer.fullName}
              {job.employer.isVerified ? " ✓" : ""}
            </Text>
            <Text style={styles.employerMeta}>
              ⭐ {job.employer.ratingAvg.toFixed(1)} ({job.employer.ratingCount} değerlendirme)
            </Text>
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

function Tile({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{emoji} {label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
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
          <Text style={styles.modalTitle}>Başvurunu gönder</Text>
          <Text style={styles.modalDesc}>
            Kısa bir mesaj yaz; işveren seni hemen görsün. Dilersen ücret teklifin de belirtebilirsin.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Deneyimini ve neden uygun olduğunu kısaca anlat…"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={4}
          />
          <TextInput
            style={styles.input}
            value={wage}
            onChangeText={(v) => setWage(v.replace(/\D/g, ""))}
            placeholder={`Ücret teklifin ₺ (opsiyonel, örn. ${job.wageAmount})`}
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} disabled={saving} />
            <PrimaryButton label="Gönder" onPress={submit} loading={saving} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 12, backgroundColor: C.bg },
  back: { fontSize: 13, fontWeight: "600", color: C.muted },
  headRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: "800", color: C.text, lineHeight: 26 },
  employer: { fontSize: 13, color: C.muted, marginTop: 4 },
  catIcon: { fontSize: 24 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  tile: { width: "48.5%", backgroundColor: "#f5f5f7", borderRadius: 12, padding: 12 },
  tileLabel: { fontSize: 11, color: C.muted },
  tileValue: { fontSize: 13, fontWeight: "700", color: C.text, marginTop: 4 },
  metaLine: { fontSize: 11, color: C.muted, marginTop: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap" },
  para: { fontSize: 14, color: C.text, lineHeight: 22, marginTop: 10 },
  skillsTitle: { fontSize: 11, fontWeight: "700", color: C.muted, letterSpacing: 0.5, marginTop: 14 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  note: { fontSize: 13, color: C.text, backgroundColor: "#f5f5f7", borderRadius: 12, padding: 12, marginTop: 12, lineHeight: 20 },
  mapRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mapLink: { fontSize: 12, fontWeight: "700", color: C.primary },
  mapHint: { fontSize: 12, color: C.muted, marginTop: 8 },
  employerRow: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 10 },
  employerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  employerInitial: { fontSize: 18, fontWeight: "800", color: C.primary },
  employerName: { fontSize: 14, fontWeight: "700", color: C.text },
  employerMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  notFound: { fontSize: 16, fontWeight: "700", color: C.text, textAlign: "center" },
  notFoundSub: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 6, marginBottom: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  modalDesc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  error: { color: C.danger, fontSize: 13 },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
});
