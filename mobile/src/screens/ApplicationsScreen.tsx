import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge, Card, C, Chip, EmptyState, Loading, PrimaryButton, SectionTitle } from "@/components/ui";
import { fetchApplications, rateApplication, updateApplicationStatus } from "@/lib/api";
import type { ApiApplication, ApplicationStatus } from "@/lib/types";
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

type Filter = "ALL" | ApplicationStatus;

export default function ApplicationsScreen({
  refreshKey,
  onStartChat,
  onShowQR,
}: {
  refreshKey: number;
  onStartChat?: (participantId: string, jobId: string) => void;
  onShowQR?: (app: ApiApplication) => void;
}) {
  const { user } = useAuth();
  const [apps, setApps] = useState<ApiApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const isEmployer = user?.role === "EMPLOYER";

  const load = useCallback(async () => {
    setLoading(true);
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

  const filtered = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);
  const counts: Record<Filter, number> = {
    ALL: apps.length,
    PENDING: apps.filter((a) => a.status === "PENDING").length,
    ACCEPTED: apps.filter((a) => a.status === "ACCEPTED").length,
    REJECTED: apps.filter((a) => a.status === "REJECTED").length,
    COMPLETED: apps.filter((a) => a.status === "COMPLETED").length,
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>{isEmployer ? "Gelen başvurular" : "Başvurularım"}</Text>
      <Text style={styles.sub}>
        {isEmployer
          ? "İlanlarına yapılan başvuruları değerlendir, kabul et veya reddet."
          : "Gönderdiğin başvuruların durumunu buradan takip et."}
      </Text>

      <View style={styles.chipRow}>
        {(["ALL", "PENDING", "ACCEPTED", "REJECTED", "COMPLETED"] as Filter[]).map((f) => (
          <Chip
            key={f}
            active={filter === f}
            label={`${f === "ALL" ? "Tümü" : APPLICATION_STATUS_LABELS[f]} (${counts[f]})`}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="📥" title="Bu filtrede başvuru yok" />
      ) : (
        filtered.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            isEmployer={!!isEmployer}
            onChanged={load}
            onStartChat={onStartChat}
            onShowQR={onShowQR}
          />
        ))
      )}
    </ScrollView>
  );
}

function ApplicationCard({
  app,
  isEmployer,
  onChanged,
  onStartChat,
  onShowQR,
}: {
  app: ApiApplication;
  isEmployer: boolean;
  onChanged: () => void;
  onStartChat?: (participantId: string, jobId: string) => void;
  onShowQR?: (app: ApiApplication) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);

  const act = async (status: "ACCEPTED" | "REJECTED" | "COMPLETED") => {
    setBusy(true);
    try {
      await updateApplicationStatus(app.id, status);
      onChanged();
    } catch {
      // sessiz
    } finally {
      setBusy(false);
    }
  };

  const jobTitle = app.job?.title ?? "İlan kaldırıldı";
  const other = isEmployer
    ? app.worker?.fullName ?? "İşçi"
    : app.job?.employer?.companyName ?? app.job?.employer?.fullName ?? "İşveren";

  return (
    <Card>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobTitle} numberOfLines={1}>{jobTitle}</Text>
          <Text style={styles.other}>
            {other}
            {app.worker?.ratingAvg ? ` · ${app.worker.ratingAvg.toFixed(1)}★` : ""}
            {isEmployer && app.worker?.phone ? ` · ${app.worker.phone}` : ""}
            {!isEmployer && app.job ? ` · ${app.job.district}, ${app.job.city}` : ""}
          </Text>
        </View>
        <Badge
          label={APPLICATION_STATUS_LABELS[app.status]}
          color={APPLICATION_STATUS_COLORS[app.status]}
          bg={
            app.status === "PENDING" ? C.amberBg
            : app.status === "ACCEPTED" ? C.emeraldBg
            : app.status === "REJECTED" ? C.roseBg
            : C.indigoBg
          }
        />
      </View>

      {app.job?.workDate && (
        <Text style={styles.meta}>
          📅 {new Date(app.job.workDate).toLocaleDateString("tr-TR")} · {app.job.startTime?.slice(0, 5)}–{app.job.endTime?.slice(0, 5)}
          {!isEmployer && app.job ? ` · ${formatWage(app.job.wageAmount, app.job.wageType)}` : ""}
        </Text>
      )}
      {app.message ? <Text style={styles.quote}>“{app.message}”</Text> : null}
      {app.proposedWage ? <Text style={styles.proposal}>Teklif: {app.proposedWage.toLocaleString("tr-TR")} ₺</Text> : null}
      {app.employerNote ? <Text style={styles.note}>İşveren notu: {app.employerNote}</Text> : null}
      <Text style={styles.time}>{timeAgo(app.createdAt)}</Text>

      {app.status === "ACCEPTED" && onStartChat && app.job && (
        <View style={styles.chatRow}>
          <PrimaryButton
            label="💬 Sohbet Et"
            variant="outline"
            onPress={() => {
              const job = app.job;
              if (!job) return;
              const otherId = isEmployer ? app.worker?.id : job.employerId;
              if (otherId) onStartChat(otherId, app.jobId ?? job.id);
            }}
          />
          {onShowQR && (
            <PrimaryButton
              label={isEmployer ? "📱 İş QR'ı" : "📱 QR Göster"}
              variant="outline"
              onPress={() => onShowQR(app)}
            />
          )}
        </View>
      )}

      {isEmployer ? (
        <View style={styles.actions}>
          {app.status === "PENDING" && (
            <>
              <PrimaryButton label="Kabul et" disabled={busy} onPress={() => act("ACCEPTED")} />
              <PrimaryButton label="Reddet" variant="outline" disabled={busy} onPress={() => act("REJECTED")} />
            </>
          )}
          {app.status === "ACCEPTED" && (
            <PrimaryButton label="Tamamlandı" disabled={busy} onPress={() => act("COMPLETED")} />
          )}
          {app.status === "COMPLETED" && !app.rating && (
            <PrimaryButton label="⭐ Puan ver" variant="outline" onPress={() => setRatingOpen(true)} />
          )}
          {app.rating ? <Badge label={`⭐ ${app.rating}/5`} color={C.amber} bg={C.amberBg} /> : null}
        </View>
      ) : (
        app.status === "COMPLETED" && !app.rating && (
          <View style={styles.actions}>
            <PrimaryButton label="⭐ İşvereni puanla" variant="outline" onPress={() => setRatingOpen(true)} />
          </View>
        )
      )}
      {!isEmployer && app.rating ? (
        <View style={styles.actions}>
          <Badge label={`⭐ ${app.rating}/5`} color={C.amber} bg={C.amberBg} />
        </View>
      ) : null}

      <RatingModal
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        onSubmit={async (rating, comment) => {
          try {
            await rateApplication(app.id, rating, comment);
            setRatingOpen(false);
            onChanged();
          } catch {
            // sessiz
          }
        }}
      />
    </Card>
  );
}

function RatingModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <SectionTitle>Değerlendir</SectionTitle>
          <Text style={styles.modalDesc}>Tamamlanan iş için 1–5 yıldız ve yorum bırak.</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Text style={[styles.star, n <= rating && styles.starActive]}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={comment}
            onChangeText={setComment}
            placeholder="Yorumun (opsiyonel)…"
            placeholderTextColor={C.muted}
            multiline
          />
          <View style={styles.modalActions}>
            <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
            <PrimaryButton
              label="Gönder"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                await onSubmit(rating, comment || undefined);
                setBusy(false);
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: -6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  topRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", justifyContent: "space-between" },
  jobTitle: { fontSize: 15, fontWeight: "800", color: C.text },
  other: { fontSize: 12, color: C.muted, marginTop: 3 },
  meta: { fontSize: 12, color: C.muted, marginTop: 8 },
  quote: { fontSize: 13, color: C.text, backgroundColor: "#f5f5f7", borderRadius: 10, padding: 10, marginTop: 8, lineHeight: 19 },
  proposal: { fontSize: 12, fontWeight: "700", color: C.primary, marginTop: 6 },
  note: { fontSize: 12, color: C.muted, marginTop: 6 },
  time: { fontSize: 11, color: C.muted, marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 12, alignItems: "center" },
  chatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "100%", gap: 10 },
  modalDesc: { fontSize: 13, color: C.muted },
  stars: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 8 },
  star: { fontSize: 34, color: "#d1d5db" },
  starActive: { color: "#f59e0b" },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
});
