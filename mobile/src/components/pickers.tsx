// Mobil tarih + saat seçici bileşenleri (harici bağımlılık yok).
// - DatePicker: 2 aylık yatay şerit + büyütülebilir tam takvim (Modal).
// - TimePicker: 15 dk aralıklı yatay saat şeridi + manuel giriş (Modal).
// Tüm animasyonlar useNativeDriver:true (yalnız transform/opacity) —
// "animated node moved to native" hatasına yol açmaz.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { C, PrimaryButton } from "@/components/ui";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_DAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** Pazartesi başlangıçlı hafta satırları (6 satır). */
function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isPast(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/* =========================== DatePicker =========================== */

export function DatePicker({
  value,
  onChange,
}: {
  /** ISO "YYYY-MM-DD" ya da "" */
  value: string;
  onChange: (iso: string) => void;
}) {
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const selected = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState<Date>(selected ?? new Date());
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (expanded) setCursor(selected ?? new Date());
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bugünden itibaren 60 günlük hızlı şerit.
  const strip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 60 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const label = selected
    ? `${selected.getDate()} ${TR_MONTHS[selected.getMonth()]} ${selected.getFullYear()}`
    : "Tarih seç";

  const rows = monthMatrix(cursor.getFullYear(), cursor.getMonth());
  const monthLabel = `${TR_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, speed: 40, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start()}
        style={({ pressed }) => [styles.fieldBtn, pressed && styles.fieldBtnPressed]}
      >
        <Animated.View style={[styles.fieldBtnInner, { transform: [{ scale }] }]}>
          <Text style={styles.fieldBtnIcon}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldBtnLabel}>İş günü</Text>
            <Text style={[styles.fieldBtnValue, !selected && styles.fieldBtnPlaceholder]} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <Text style={styles.fieldBtnChevron}>▾</Text>
        </Animated.View>
      </Pressable>

      {/* Hızlı tarih şeridi (ilk 14 gün) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {strip.slice(0, 14).map((d) => {
          const active = isSameDay(selected, d);
          const isToday = isSameDay(d, new Date());
          return (
            <Pressable
              key={toISODate(d)}
              onPress={() => onChange(toISODate(d))}
              style={[styles.dateChip, active && styles.dateChipActive]}
            >
              <Text style={[styles.dateChipDow, active && styles.dateChipTextActive]}>
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][(d.getDay() + 6) % 7]}
              </Text>
              <Text style={[styles.dateChipDay, active && styles.dateChipTextActive]}>{d.getDate()}</Text>
              {isToday ? <Text style={[styles.dateChipToday, active && styles.dateChipTextActive]}>Bugün</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={expanded} transparent animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setExpanded(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.calHeader}>
              <Pressable onPress={() => setCursor((c) => addMonths(c, -1))} hitSlop={8}>
                <Text style={styles.calNav}>‹</Text>
              </Pressable>
              <Text style={styles.calMonth}>{monthLabel}</Text>
              <Pressable onPress={() => setCursor((c) => addMonths(c, 1))} hitSlop={8}>
                <Text style={styles.calNav}>›</Text>
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {TR_DAYS.map((d) => (
                <Text key={d} style={styles.weekDay}>{d}</Text>
              ))}
            </View>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.weekRow}>
                {row.map((d, ci) => {
                  if (!d) return <View key={ci} style={styles.dayCell} />;
                  const active = isSameDay(selected, d);
                  const past = isPast(d);
                  return (
                    <Pressable
                      key={ci}
                      disabled={past}
                      onPress={() => {
                        onChange(toISODate(d));
                        setExpanded(false);
                      }}
                      style={[styles.dayCell, active && styles.dayCellActive, past && styles.dayCellPast]}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive, past && styles.dayTextPast]}>
                        {d.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={styles.calFooter}>
              <PrimaryButton label="Tamam" onPress={() => setExpanded(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* =========================== TimePicker =========================== */

export function TimePicker({
  value,
  label,
  onChange,
}: {
  /** "HH:MM" */
  value: string;
  label: string;
  onChange: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [manual, setManual] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (expanded) {
      setManual(value);
      setError(null);
    }
  }, [expanded, value]);

  // 06:00 - 22:00, 30 dk adım
  const slots = useMemo(() => {
    const list: string[] = [];
    for (let h = 6; h <= 22; h++) {
      list.push(`${pad(h)}:00`);
      if (h < 22) list.push(`${pad(h)}:30`);
    }
    return list;
  }, []);

  const submitManual = () => {
    const m = manual.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
      setError("Saat biçimi: 08:30");
      return;
    }
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) {
      setError("Geçersiz saat");
      return;
    }
    setError(null);
    onChange(`${pad(h)}:${pad(min)}`);
    setExpanded(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, speed: 40, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start()}
        style={({ pressed }) => [styles.fieldBtn, pressed && styles.fieldBtnPressed]}
      >
        <Animated.View style={[styles.fieldBtnInner, { transform: [{ scale }] }]}>
          <Text style={styles.fieldBtnIcon}>⏰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldBtnLabel}>{label}</Text>
            <Text style={styles.fieldBtnValue}>{value || "--:--"}</Text>
          </View>
          <Text style={styles.fieldBtnChevron}>▾</Text>
        </Animated.View>
      </Pressable>

      <Modal visible={expanded} transparent animationType="slide" onRequestClose={() => setExpanded(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setExpanded(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={styles.timeGrid}>
              {slots.map((t) => {
                const active = t === value;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      onChange(t);
                      setExpanded(false);
                    }}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                  >
                    <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{t}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manual}
                onChangeText={(v) => setManual(v.replace(/[^\d:]/g, "").slice(0, 5))}
                placeholder="Manuel: 07:45"
                placeholderTextColor={C.muted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <View style={styles.manualBtnWrap}>
                <PrimaryButton label="Uygula" onPress={submitManual} />
              </View>
            </View>
            {error ? <Text style={styles.manualError}>{error}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldBtn: { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: "#fff" },
  fieldBtnPressed: { borderColor: C.primary },
  fieldBtnInner: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  fieldBtnIcon: { fontSize: 18 },
  fieldBtnLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },
  fieldBtnValue: { fontSize: 15, fontWeight: "800", color: C.text, marginTop: 1 },
  fieldBtnPlaceholder: { color: C.muted, fontWeight: "600" },
  fieldBtnChevron: { fontSize: 16, color: C.muted },
  dateStrip: { gap: 8, paddingVertical: 4 },
  dateChip: {
    width: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 8,
    gap: 1,
  },
  dateChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  dateChipDow: { fontSize: 10, fontWeight: "700", color: C.muted },
  dateChipDay: { fontSize: 17, fontWeight: "800", color: C.text },
  dateChipToday: { fontSize: 8, fontWeight: "700", color: C.primary },
  dateChipTextActive: { color: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 30,
    gap: 12,
  },
  sheetHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 2 },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: C.text },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calNav: { fontSize: 24, color: C.primary, fontWeight: "800", paddingHorizontal: 14 },
  calMonth: { fontSize: 15, fontWeight: "800", color: C.text },
  weekRow: { flexDirection: "row", gap: 4 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: C.muted, paddingVertical: 6 },
  dayCell: { flex: 1, aspectRatio: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", marginVertical: 2 },
  dayCellActive: { backgroundColor: C.primary },
  dayCellPast: { opacity: 0.35 },
  dayText: { fontSize: 13, fontWeight: "700", color: C.text },
  dayTextActive: { color: "#fff", fontWeight: "800" },
  dayTextPast: { color: C.muted },
  calFooter: { marginTop: 6 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 },
  timeChip: {
    flexGrow: 0,
    flexBasis: "30%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 10,
  },
  timeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  timeChipText: { fontSize: 14, fontWeight: "700", color: C.text },
  timeChipTextActive: { color: "#fff" },
  manualRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#fff",
  },
  manualBtnWrap: { width: 110 },
  manualError: { color: C.danger, fontSize: 12 },
});
