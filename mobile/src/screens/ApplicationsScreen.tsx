import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Badge, Card, C, Chip, EmptyState, Loading, PrimaryButton, SectionTitle, useTheme } from "@/components/ui";
import { BrandRefreshScrollView } from "@/components/BrandPullToRefresh";
import { useCachedList } from "@/hooks/use-cached-list";
import { fetchApplications, fetchApplicationsByEmployer, rateApplication, updateApplicationStatus } from "@/lib/api";
import { markApplicationRated, useRatedMap } from "@/lib/rated-store";
import type { ApiApplication, ApplicationStatus } from "@/lib/types";
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  formatWage,
  timeAgo,
} from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import {
  ApplicationsIcon,
  CalendarIcon,
  MessageIcon,
  QrScanIcon,
  StarIcon,
} from "@/components/icons";

type Filter = "ALL" | "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED";

export default function ApplicationsScreen({
  refreshKey,
  onStartChat,
  onShowQR,
  onScanQR,
}: {
  refreshKey: number;
  onStartChat?: (participantId: string, jobId: string) => void;
  onShowQR?: (app: ApiApplication) => void;
  onScanQR?: () => void;
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [apps, setApps] = useState<ApiApplication[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const isEmployer = user?.role === "EMPLOYER";

  const appsFetcher = useCallback(
    () => (isEmployer ? fetchApplicationsByEmployer() : fetchApplications()),
    [isEmployer],
  );
  const {
    data: appsData,
    loading,
    refreshing,
    refresh: refreshApps,
    reload,
  } = useCachedList(isEmployer ? "applications:employer" : "applications:worker", appsFetcher, []);

  useEffect(() => {
    if (appsData) setApps(appsData);
  }, [appsData]);

  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);

  const filtered = filter === "ALL" ? apps : apps.filter((a) => a.status === filter);
  const counts: Record<Filter, number> = {
    ALL: apps.length,
    PENDING: apps.filter((a) => a.status === "PENDING").length,
    ACCEPTED: apps.filter((a) => a.status === "ACCEPTED").length,
    REJECTED: apps.filter((a) => a.status === "REJECTED").length,
    COMPLETED: apps.filter((a) => a.status === "COMPLETED").length,
  };

  return (
    <BrandRefreshScrollView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.wrap, { backgroundColor: colors.bg }]}
      refreshing={refreshing}
      onRefresh={refreshApps}
    >
      <Text style={[styles.h1, { color: colors.text }]}>{isEmployer ? "Gelen Başvurular" : "Başvurularım"}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {isEmployer
          ? "İlanlarınıza yapılan başvuruları inceleyin, onaylayın veya yanıtlayın."
          : "Gönderdiğiniz başvuruların durumunu buradan güncel olarak takip edebilirsiniz."}
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
        <EmptyState
          icon={<ApplicationsIcon size={28} color={C.muted} />}
          title="Başvuru bulunmuyor"
          subtitle="Bu filtreye uygun herhangi bir başvuru kaydı bulunamadı."
        />
      ) : (
        filtered.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            isEmployer={!!isEmployer}
            onChanged={reload}
            onStartChat={onStartChat}
            onShowQR={onShowQR}
            onScanQR={onScanQR}
          />
        ))
      )}
    </BrandRefreshScrollView>
  );
}

function ApplicationCard({
  app,
  isEmployer,
  onChanged,
  onStartChat,
  onShowQR,
  onScanQR,
}: {
  app: ApiApplication;
  isEmployer: boolean;
  onChanged: () => void;
  onStartChat?: (participantId: string, jobId: string) => void;
  onShowQR?: (app: ApiApplication) => void;
  onScanQR?: () => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const ratedMap = useRatedMap();
  const persistentRating = ratedMap[app.id] ?? null;
  const rating = persistentRating ?? app.myRating ?? app.rating ?? null;
  const isRated = Boolean(rating != null || app.hasRated || persistentRating != null);

  const act = async (status: ApplicationStatus) => {
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
          <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={1}>{jobTitle}</Text>
          <View style={styles.otherRow}>
            <Text style={[styles.other, { color: colors.muted }]}>{other}</Text>
            {app.worker?.ratingAvg ? (
              <View style={styles.ratingBadge}>
                <StarIcon size={12} color="#D97706" />
                <Text style={styles.ratingText}>{app.worker.ratingAvg.toFixed(1)}</Text>
              </View>
            ) : null}
            {isEmployer && app.worker?.phone ? <Text style={[styles.otherMeta, { color: colors.muted }]}>· {app.worker.phone}</Text> : null}
            {!isEmployer && app.job ? <Text style={[styles.otherMeta, { color: colors.muted }]}>· {app.job.district}, {app.job.city}</Text> : null}
          </View>
        </View>
        <Badge
          label={APPLICATION_STATUS_LABELS[app.status]}
          color={APPLICATION_STATUS_COLORS[app.status]}
          bg={
            app.status === "PENDING" ? colors.amberBg
            : app.status === "ACCEPTED" ? colors.emeraldBg
            : app.status === "REJECTED" ? colors.roseBg
            : colors.indigoBg
          }
        />
      </View>

      {app.job?.workDate && (
        <View style={styles.metaRow}>
          <CalendarIcon size={13} color={colors.primary} />
          <Text style={[styles.meta, { color: colors.muted }]}>
            {new Date(app.job.workDate).toLocaleDateString("tr-TR")} · {app.job.startTime?.slice(0, 5)}–{app.job.endTime?.slice(0, 5)}
            {!isEmployer && app.job ? ` · ${formatWage(app.job.wageAmount, app.job.wageType)}` : ""}
          </Text>
        </View>
      )}
      {app.message ? (
        <Text style={[styles.quote, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }]}>
          “{app.message}”
        </Text>
      ) : null}
      {app.proposedWage ? <Text style={[styles.proposal, { color: colors.primary }]}>Teklif Edilen Ücret: {app.proposedWage.toLocaleString("tr-TR")} ₺</Text> : null}
      {app.employerNote ? <Text style={[styles.note, { color: colors.muted }]}>İşveren Notu: {app.employerNote}</Text> : null}
      <Text style={[styles.time, { color: colors.muted }]}>{timeAgo(app.createdAt)}</Text>

      {app.status === "ACCEPTED" && onStartChat && app.job && (
        <View style={styles.chatRow}>
          <PrimaryButton
            label="Sohbet Başlat"
            variant="outline"
            onPress={() => {
              const job = app.job;
              if (!job) return;
              const otherId = isEmployer ? app.worker?.id : job.employerId;
              if (otherId) onStartChat(otherId, app.jobId ?? job.id);
            }}
          />
          {isEmployer ? (
            onShowQR && (
              <PrimaryButton
                label="QR Göster"
                variant="outline"
                onPress={() => onShowQR(app)}
              />
            )
          ) : (
            (onScanQR || onShowQR) && (
              <PrimaryButton
                label="QR Tara"
                variant="outline"
                onPress={() => (onScanQR ? onScanQR() : onShowQR?.(app))}
              />
            )
          )}
        </View>
      )}

      {isEmployer ? (
        <View style={styles.actions}>
          {app.status === "PENDING" && (
            <>
              <PrimaryButton label="Başvuruyu Onayla" disabled={busy} onPress={() => act("ACCEPTED")} />
              <PrimaryButton label="Reddet" variant="outline" disabled={busy} onPress={() => act("REJECTED")} />
            </>
          )}
          {app.status === "ACCEPTED" && (
            <PrimaryButton label="İşi Tamamlandı Olarak İşaretle" disabled={busy} onPress={() => act("COMPLETED")} />
          )}
          {app.status === "COMPLETED" && !isRated && (
            <PrimaryButton label="Puan Ver" variant="outline" onPress={() => setRatingOpen(true)} />
          )}
          {isRated ? <Badge label={`Puan: ${rating ?? 5}/5`} color={C.amber} bg={C.amberBg} /> : null}
        </View>
      ) : (
        <View style={styles.actions}>
          {app.status === "PENDING" && (
            <PrimaryButton
              label="Başvuruyu Geri Çek"
              variant="outline"
              disabled={busy}
              onPress={() => act("WITHDRAWN")}
            />
          )}
          {app.status === "COMPLETED" && !isRated && (
            <PrimaryButton label="İşvereni Değerlendir" variant="outline" onPress={() => setRatingOpen(true)} />
          )}
          {isRated ? <Badge label={`Puan: ${rating ?? 5}/5`} color={C.amber} bg={C.amberBg} /> : null}
        </View>
      )}

      <RatingModal
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        onSubmit={async (value, comment) => {
          try {
            await rateApplication(app.id, value, comment);
            await markApplicationRated(app.id, value);
            setRatingOpen(false);
            onChanged();
          } catch (err) {
            if (err instanceof Error && err.message.toLowerCase().includes("zaten puanlanmış")) {
              await markApplicationRated(app.id, value);
              setRatingOpen(false);
              onChanged();
            } else {
              Alert.alert("Değerlendirme kaydedilemedi", err instanceof Error ? err.message : "Tekrar deneyin.");
            }
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
  const { colors } = useTheme();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionTitle>İşi Değerlendir</SectionTitle>
          <Text style={[styles.modalDesc, { color: colors.muted }]}>
            Tamamlanan iş süreci için 1–5 arası puanlama yapın ve deneyiminizi paylaşın.
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} style={styles.starBtn}>
                <StarIcon size={30} color={n <= rating ? "#D97706" : colors.border} />
              </Pressable>
            ))}
          </View>
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
            value={comment}
            onChangeText={setComment}
            placeholder="Görüş ve değerlendirmeleriniz (isteğe bağlı)…"
            placeholderTextColor={colors.muted}
            multiline
          />
          <View style={styles.modalActions}>
            <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
            <PrimaryButton
              label="Kaydet"
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
  otherRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  other: { fontSize: 12, color: C.muted, fontWeight: "600" },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  otherMeta: { fontSize: 12, color: C.muted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  meta: { fontSize: 12, color: C.muted },
  quote: { fontSize: 13, color: C.text, backgroundColor: "#F6F5F2", borderRadius: 10, padding: 10, marginTop: 8, lineHeight: 19, borderWidth: 1, borderColor: "#E8E6DF" },
  proposal: { fontSize: 12, fontWeight: "700", color: C.primary, marginTop: 6 },
  note: { fontSize: 12, color: C.muted, marginTop: 6 },
  time: { fontSize: 11, color: C.muted, marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: "#E8E6DF", paddingTop: 12, alignItems: "center" },
  chatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "100%", gap: 10 },
  modalDesc: { fontSize: 13, color: C.muted },
  stars: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 10 },
  starBtn: { padding: 4 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
});
