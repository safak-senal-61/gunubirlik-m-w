import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Badge, C, Card, Chip, EmptyState, PrimaryButton, SectionTitle, useTheme, lightColors, type ThemeColors } from "@/components/ui";
import { BrandRefreshScrollView } from "@/components/BrandPullToRefresh";
import { timeAgo } from "@/lib/format";
import {
  createDepositRequest,
  createWithdrawRequest,
  fetchDepositRequests,
  fetchWalletBalance,
  fetchWalletBalanceCached,
  fetchWalletTransactions,
  fetchWithdrawRequests,
  invalidateWalletBalanceCache,
  isValidTrIban,
  MIN_DEPOSIT,
  MIN_WITHDRAW,
  normalizeIban,
  peekMemoryCache,
} from "@/lib/api";
import type {
  ApiUser,
  DepositRequest,
  WalletTransaction,
  WalletTxType,
  WithdrawRequest,
} from "@/lib/types";

const TRY = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

const COMPANY_ACCOUNT = {
  title: "Günübirlik İş Bul A.Ş.",
  bank: "Ziraat Bankası",
  iban: "TR99 0001 2345 6789 0123 4567 89",
};

const DEPOSIT_PRESETS = [250, 500, 1000, 2500, 5000];
const WITHDRAW_PRESETS = [100, 250, 500, 1000];
const POPULAR_BANKS = [
  "Ziraat Bankası",
  "Garanti BBVA",
  "İş Bankası",
  "Yapı Kredi",
  "Akbank",
  "QNB Finansbank",
  "VakıfBank",
  "Halkbank",
];

const TX_META: Record<string, { label: string; icon: string }> = {
  DEPOSIT: { label: "Para yatırma", icon: "⬇️" },
  WITHDRAW: { label: "Para çekme", icon: "⬆️" },
  TRANSFER: { label: "Transfer", icon: "↔️" },
  QR_PAYMENT: { label: "QR ödeme", icon: "📲" },
  JOB_PAYMENT: { label: "İş ödemesi", icon: "🧰" },
  REFUND: { label: "İade", icon: "↩️" },
  FEE: { label: "Ücret", icon: "🏦" },
  BONUS: { label: "Bonus", icon: "🎁" },
};

const TX_FILTERS: { key: WalletTxType; label: string }[] = [
  { key: "ALL", label: "Tümü" },
  { key: "DEPOSIT", label: "Yatırma" },
  { key: "WITHDRAW", label: "Çekme" },
  { key: "JOB_PAYMENT", label: "İş ödemesi" },
];

const getReqStatus = (colors: ThemeColors): Record<string, { label: string; color: string; bg: string }> => ({
  PENDING: { label: "Onay bekliyor", color: colors.amber, bg: colors.amberBg },
  APPROVED: { label: "Onaylandı", color: colors.emerald, bg: colors.emeraldBg },
  COMPLETED: { label: "Tamamlandı", color: colors.emerald, bg: colors.emeraldBg },
  REJECTED: { label: "Reddedildi", color: colors.rose, bg: colors.roseBg },
});

type SheetType = "deposit" | "withdraw" | null;

export default function WalletScreen({ user }: { user: ApiUser }) {
  const { colors } = useTheme();
  styles = useMemo(() => createStyles(colors), [colors]);
  const isEmployer = user.role === "EMPLOYER";
  const isAdmin = user.role === "ADMIN";
  const isWorker = !isEmployer && !isAdmin;

  // Anında önbellekten ilk render (0ms gecikme, boş ekran yok)
  const [balance, setBalance] = useState<number | null>(() => {
    return peekMemoryCache<{ balance: number }>("wallet:balance")?.balance ?? null;
  });
  const [loading, setLoading] = useState(balance === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [txFilter, setTxFilter] = useState<WalletTxType>("ALL");
  const [txLoading, setTxLoading] = useState(false);

  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>([]);

  const [sheet, setSheet] = useState<SheetType>(null);

  const load = useCallback(async (force = false) => {
    try {
      const promises: Promise<any>[] = [
        fetchWalletBalanceCached({
          force,
          onUpdate: (fresh) => {
            setBalance(fresh.balance);
            setError(null);
          },
        }),
        fetchWalletTransactions({ type: txFilter, pageSize: 30 }),
      ];

      if (isEmployer || isAdmin) {
        promises.push(fetchDepositRequests());
      }
      if (isWorker || isAdmin) {
        promises.push(fetchWithdrawRequests());
      }

      const results = await Promise.allSettled(promises);
      const b = results[0];
      const t = results[1];

      if (b.status === "fulfilled") {
        setBalance((b.value as any).balance.balance);
        setError(null);
      } else {
        setError(b.reason instanceof Error ? b.reason.message : "Bakiye alınamadı");
      }

      if (t.status === "fulfilled") setTxs(t.value as any);

      let idx = 2;
      if (isEmployer || isAdmin) {
        const d = results[idx++];
        if (d && d.status === "fulfilled") setDeposits(d.value as any);
      }
      if (isWorker || isAdmin) {
        const w = results[idx++];
        if (w && w.status === "fulfilled") setWithdraws(w.value as any);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [txFilter, isEmployer, isWorker, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hareket listesi filtre değişince ayrıca tazelenir
  useEffect(() => {
    let active = true;
    setTxLoading(true);
    fetchWalletTransactions({ type: txFilter, pageSize: 30 })
      .then((list) => {
        if (active) setTxs(list);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setTxLoading(false);
      });
    return () => {
      active = false;
    };
  }, [txFilter]);

  const pendingDepositTotal = deposits
    .filter((d) => d.status === "PENDING")
    .reduce((s, d) => s + d.amount, 0);
  const pendingWithdrawTotal = withdraws
    .filter((w) => w.status === "PENDING")
    .reduce((s, w) => s + w.amount, 0);

  // Yatırma ve çekme talepleri (tarihe göre sıralı)
  const allRequests = [
    ...(isEmployer || isAdmin
      ? deposits.map((d) => ({
          kind: "deposit" as const,
          id: d.id,
          amount: d.amount,
          status: d.status,
          createdAt: d.createdAt,
          iban: d.senderIban,
          bank: d.senderBank ?? null,
          note: d.senderNote ?? null,
          rejectReason: d.rejectReason ?? null,
        }))
      : []),
    ...(isWorker || isAdmin
      ? withdraws.map((w) => ({
          kind: "withdraw" as const,
          id: w.id,
          amount: w.amount,
          status: w.status,
          createdAt: w.createdAt,
          iban: w.recipientIban,
          bank: w.recipientBank ?? null,
          note: w.recipientNote ?? null,
          rejectReason: w.rejectReason ?? null,
        }))
      : []),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <BrandRefreshScrollView
        style={[styles.flex, { backgroundColor: colors.bg }]}
        contentContainerStyle={[styles.wrap, { backgroundColor: colors.bg }]}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          invalidateWalletBalanceCache();
          void load(true);
        }}
      >
        {/* Bakiye kartı */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceBlob} pointerEvents="none" />
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Cüzdan bakiyen</Text>
            <View style={styles.balanceRole}>
              <Text style={styles.balanceRoleText}>
                {isAdmin ? "👑 Yönetici" : isEmployer ? "🏢 İşveren" : "🔨 İşçi"}
              </Text>
            </View>
          </View>
          <Text style={styles.balanceValue}>{balance == null ? (loading ? "…" : "—") : TRY(balance)}</Text>
          <Text style={styles.balanceCurrency}>Günübirlik cüzdanı · TRY</Text>

          <View style={styles.balanceStats}>
            {(isEmployer || isAdmin) && (
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatValue}>{TRY(pendingDepositTotal)}</Text>
                <Text style={styles.balanceStatLabel}>Yatırma bekliyor</Text>
              </View>
            )}
            {isAdmin && <View style={styles.balanceStatDivider} />}
            {(isWorker || isAdmin) && (
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatValue}>{TRY(pendingWithdrawTotal)}</Text>
                <Text style={styles.balanceStatLabel}>Çekme bekliyor</Text>
              </View>
            )}
          </View>
        </View>

        {error ? <Banner tone="error" text={error} /> : null}

        {/* Hızlı işlemler - api-doc rol ayrımı gereğince:
            İşveren: Yalnızca "Para Yatır"
            İşçi: Yalnızca "Para Çek" */}
        <View style={styles.actionGrid}>
          {(isEmployer || isAdmin) && (
            <ActionTile
              icon="⬇️"
              label="Para Yatır"
              hint="EFT / Havale ile Bakiye Yükle"
              color={C.emerald}
              onPress={() => setSheet("deposit")}
            />
          )}
          {(isWorker || isAdmin) && (
            <ActionTile
              icon="⬆️"
              label="Para Çek"
              hint="Banka IBAN'ına Çekim Talebi"
              color={C.primary}
              onPress={() => setSheet("withdraw")}
            />
          )}
        </View>

        {/* Bekleyen talepler */}
        {((isEmployer || isAdmin) && deposits.some((d) => d.status === "PENDING") ||
          ((isWorker || isAdmin) && withdraws.some((w) => w.status === "PENDING"))) && (
          <Card style={{ gap: 10 }}>
            <SectionTitle>Bekleyen talepler</SectionTitle>
            {(isEmployer || isAdmin) &&
              deposits
                .filter((d) => d.status === "PENDING")
                .map((d) => (
                  <RequestRow
                    key={d.id}
                    icon="⬇️"
                    title={`Yatırma · ${TRY(d.amount)}`}
                    subtitle={`${d.senderName} · ${d.senderIban.slice(-4)}••`}
                    status={d.status}
                  />
                ))}
            {(isWorker || isAdmin) &&
              withdraws
                .filter((w) => w.status === "PENDING")
                .map((w) => (
                  <RequestRow
                    key={w.id}
                    icon="⬆️"
                    title={`Çekme · ${TRY(w.amount)}`}
                    subtitle={`${w.recipientName} · ${w.recipientIban.slice(-4)}••`}
                    status={w.status}
                  />
                ))}
            <Text style={styles.noteText}>
              {isEmployer
                ? "ℹ️ EFT/havale talebin yönetim onayından sonra bakiyene işlenir (1-3 iş günü)."
                : "ℹ️ Çekme talepleri onaylandığında IBAN'a gönderilir (3-5 iş günü)."}
            </Text>
          </Card>
        )}

        {/* Tüm talepler (geçmiş) */}
        {allRequests.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionTitle>
              {isEmployer ? "Para yatırma taleplerim" : isWorker ? "Para çekme taleplerim" : "Taleplerim"}
            </SectionTitle>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {allRequests.map((r, i) => (
                <View key={`${r.kind}-${r.id}`} style={[styles.txRow, i === allRequests.length - 1 ? {} : styles.txRowBorder]}>
                  <View style={[styles.txIcon, { backgroundColor: r.kind === "deposit" ? C.emeraldBg : C.primarySoft }]}>
                    <Text style={styles.txEmoji}>{r.kind === "deposit" ? "⬇️" : "⬆️"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>
                      {r.kind === "deposit" ? "Yatırma" : "Çekme"} · {TRY(r.amount)}
                    </Text>
                    <Text style={styles.txSub}>
                      {timeAgo(r.createdAt)} · {r.iban.slice(-4)}••{r.bank ? ` · ${r.bank}` : ""}
                    </Text>
                    {r.note ? <Text style={styles.txSub} numberOfLines={1}>“{r.note}”</Text> : null}
                    {r.rejectReason ? <Text style={styles.rejectText}>Ret: {r.rejectReason}</Text> : null}
                  </View>
                  <Badge
                    label={(getReqStatus(colors)[r.status] ?? getReqStatus(colors).PENDING).label}
                    color={(getReqStatus(colors)[r.status] ?? getReqStatus(colors).PENDING).color}
                    bg={(getReqStatus(colors)[r.status] ?? getReqStatus(colors).PENDING).bg}
                  />
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Hareketler */}
        <View style={{ gap: 10 }}>
          <View style={styles.sectionRow}>
            <SectionTitle>Hareketler</SectionTitle>
            {txLoading ? <Text style={styles.sectionHint}>yükleniyor…</Text> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TX_FILTERS.map((f) => (
              <Chip key={f.key} active={txFilter === f.key} label={f.label} onPress={() => setTxFilter(f.key)} />
            ))}
          </ScrollView>

          {txs.length === 0 && !txLoading ? (
            <EmptyState emoji="🧾" title="Hareket yok" subtitle="Yatırma, çekme ve iş ödemeleri burada listelenir." />
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {txs.map((t, i) => (
                <TxRow key={t.id} tx={t} last={i === txs.length - 1} />
              ))}
            </Card>
          )}
        </View>

        {/* Ödeme akışı rehberi */}
        <Card style={{ gap: 8 }}>
          <SectionTitle>Ödeme akışı nasıl işler?</SectionTitle>
          <Text style={styles.flowStep}>
            1️⃣ İşveren iş ilanı açar ve işçi kabul eder (ücret emanete alınır).
          </Text>
          <Text style={styles.flowStep}>
            2️⃣ İşe başlarken ve gün bitiminde QR kod okutulur.
          </Text>
          <Text style={styles.flowStep}>
            3️⃣ İş tamamlandığında ücret işçinin cüzdan bakiyesine otomatik aktarılır.
          </Text>
          <Text style={styles.flowStep}>
            4️⃣ {isEmployer ? "İşveren platform hesabına EFT/Havale ile bakiye yükler." : "İşçi biriken bakiyesini banka IBAN hesabına çeker."}
          </Text>
          <Text style={styles.noteText}>
            ℹ️ {isEmployer ? "Yatırma talepleriniz banka dekontu kontrolünden sonra onaylanır." : "Çekme talepleriniz 3-5 iş günü içinde banka hesabınıza aktarılır."}
          </Text>
        </Card>

        <Text style={styles.footNote}>Bakiye ve hareketler anlık olarak güncellenir. ↓ Aşağı çekerek yenile.</Text>
      </BrandRefreshScrollView>

      {/* ================= Modallar ================= */}

      {(isEmployer || isAdmin) && (
        <DepositModal
          open={sheet === "deposit"}
          defaultName={user.fullName}
          onClose={() => setSheet(null)}
          onDone={async () => {
            setSheet(null);
            invalidateWalletBalanceCache();
            await load(true);
          }}
        />
      )}

      {(isWorker || isAdmin) && (
        <WithdrawModal
          open={sheet === "withdraw"}
          balance={balance}
          defaultName={user.fullName}
          onClose={() => setSheet(null)}
          onDone={async () => {
            setSheet(null);
            invalidateWalletBalanceCache();
            await load(true);
          }}
        />
      )}
    </View>
  );
}

/* ================= Alt bileşenler ================= */

function ActionTile({
  icon,
  label,
  hint,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  hint: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color}1a` }]}>
        <Text style={styles.actionEmoji}>{icon}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionHint}>{hint}</Text>
    </Pressable>
  );
}

function RequestRow({
  icon,
  title,
  subtitle,
  status,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status: string;
}) {
  const { colors } = useTheme();
  const meta = getReqStatus(colors)[status] ?? getReqStatus(colors).PENDING;
  return (
    <View style={styles.requestRow}>
      <Text style={styles.requestIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.requestTitle}>{title}</Text>
        <Text style={styles.requestSub}>{subtitle}</Text>
      </View>
      <Badge label={meta.label} color={meta.color} bg={meta.bg} />
    </View>
  );
}

function TxRow({ tx, last }: { tx: WalletTransaction; last: boolean }) {
  const meta = TX_META[tx.type] ?? { label: tx.type, icon: "💳" };
  const isPos = tx.amount > 0;
  return (
    <View style={[styles.txRow, last ? {} : styles.txRowBorder]}>
      <View style={[styles.txIcon, { backgroundColor: isPos ? C.emeraldBg : C.stoneBg }]}>
        <Text style={styles.txEmoji}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle}>{tx.description || meta.label}</Text>
        <Text style={styles.txSub}>{timeAgo(tx.createdAt)}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.txAmount, { color: isPos ? C.emerald : C.text }]}>
          {isPos ? "+" : ""}
          {TRY(tx.amount)}
        </Text>
        {tx.balanceAfter != null ? <Text style={styles.txBalance}>{TRY(tx.balanceAfter)}</Text> : null}
      </View>
    </View>
  );
}

function Banner({ tone, text }: { tone: "error" | "success" | "info"; text: string }) {
  const bg = tone === "error" ? "#fef2f2" : tone === "success" ? "#ecfdf5" : C.primarySoft;
  const fg = tone === "error" ? C.danger : tone === "success" ? C.success : C.primary;
  const border = tone === "error" ? "#fecaca" : tone === "success" ? "#a7f3d0" : "#c7d2fe";
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.bannerText, { color: fg }]}>
        {tone === "error" ? "⚠️" : tone === "success" ? "✅" : "ℹ️"} {text}
      </Text>
    </View>
  );
}

function Sheet({
  visible,
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              {icon ? (
                <View style={styles.sheetIconBox}>
                  <Text style={styles.sheetIcon}>{icon}</Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{title}</Text>
                {subtitle ? <Text style={styles.sheetSub}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.sheetCloseBtn}>
                <Text style={styles.sheetCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ gap: 14, paddingBottom: 16 }}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "email-address" | "phone-pad";
  multiline?: boolean;
  error?: string | null;
  autoCapitalize?: "none" | "sentences" | "words";
  prefix?: string;
  suffix?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <View style={[styles.fieldWrap, focused && styles.fieldWrapFocused, !!props.error && styles.fieldWrapError]}>
        {props.prefix ? <Text style={styles.fieldPrefix}>{props.prefix}</Text> : null}
        <TextInput
          style={[styles.fieldInput, props.multiline && { minHeight: 68, textAlignVertical: "top" }]}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor="#94a3b8"
          keyboardType={props.keyboardType}
          multiline={props.multiline}
          autoCapitalize={props.autoCapitalize ?? "sentences"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {props.suffix ? <Text style={styles.fieldSuffix}>{props.suffix}</Text> : null}
      </View>
      {props.error ? <Text style={styles.fieldError}>{props.error}</Text> : null}
    </View>
  );
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/* ================= Para Yatırma ================= */

function DepositModal({
  open,
  defaultName,
  onClose,
  onDone,
}: {
  open: boolean;
  defaultName: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState(defaultName);
  const [iban, setIban] = useState("");
  const [bank, setBank] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setSenderName(defaultName);
      setIban("");
      setBank("");
      setNote("");
      setErr(null);
      setCopied(false);
    }
  }, [open, defaultName]);

  const copyCompanyIban = async () => {
    try {
      await Clipboard.setStringAsync(COMPANY_ACCOUNT.iban.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      Alert.alert("Bilgi", COMPANY_ACCOUNT.iban);
    }
  };

  const submit = async () => {
    const value = parseAmount(amount);
    if (!value) return setErr("Geçerli bir tutar gir.");
    if (value < MIN_DEPOSIT) return setErr(`Minimum yatırma tutarı ${MIN_DEPOSIT} ₺.`);
    if (!senderName.trim()) return setErr("Ad soyad gir.");
    if (!isValidTrIban(iban)) return setErr("Geçerli bir TR IBAN gir (TR + 26 hane).");
    setErr(null);
    setBusy(true);
    try {
      await createDepositRequest({
        amount: value,
        senderName,
        senderIban: iban,
        senderBank: bank,
        senderNote: note,
      });
      Alert.alert(
        "Talebin alındı ✅",
        "Yönetim EFT/havaleni teyit ettikten sonra bakiyene işlenecek. Taleplerim bölümünden takip edebilirsin.",
      );
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Talep oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      icon="⬇️"
      title="Para Yatır"
      subtitle={`Banka hesabından havale/EFT yap, onay sonrası bakiyene işlensin. Min ${MIN_DEPOSIT} ₺.`}
    >
      {/* Şirket Resmi Hesap Kartı (1-Dokunuşla Kopyalama) */}
      <View style={styles.companyCard}>
        <View style={styles.companyCardTop}>
          <View style={styles.companyBankBadge}>
            <Text style={styles.companyBankBadgeText}>🏦 {COMPANY_ACCOUNT.bank}</Text>
          </View>
          <Pressable onPress={copyCompanyIban} style={[styles.copyBtn, copied && styles.copyBtnDone]}>
            <Text style={[styles.copyBtnText, copied && styles.copyBtnTextDone]}>
              {copied ? "✓ Kopyalandı" : "📋 IBAN Kopyala"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.companyTitle}>{COMPANY_ACCOUNT.title}</Text>
        <Text style={styles.companyIban} selectable>{COMPANY_ACCOUNT.iban}</Text>
        <Text style={styles.companyNote}>
          💡 Havale açıklamasına sistemde kayıtlı telefon numaranızı yazınız.
        </Text>
      </View>

      {/* Hızlı Tutar Seçici */}
      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>Tutar (₺)</Text>
        <View style={styles.presetsRow}>
          {DEPOSIT_PRESETS.map((p) => {
            const active = amount === String(p);
            return (
              <Pressable
                key={p}
                onPress={() => setAmount(String(p))}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  +{p.toLocaleString("tr-TR")} ₺
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Field
          label=""
          value={amount}
          onChangeText={setAmount}
          placeholder="1000"
          keyboardType="decimal-pad"
          suffix="₺"
        />
      </View>

      <Field label="Ad Soyad (gönderen hesap sahibi)" value={senderName} onChangeText={setSenderName} placeholder="Ahmet Yılmaz" />

      {/* Hızlı Banka Seçimi */}
      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>Gönderdiğin Banka</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
          {POPULAR_BANKS.map((b) => {
            const active = bank.toLowerCase().includes(b.split(" ")[0].toLowerCase());
            return (
              <Pressable
                key={b}
                onPress={() => setBank(b)}
                style={[styles.bankPill, active && styles.bankPillActive]}
              >
                <Text style={[styles.bankPillText, active && styles.bankPillTextActive]}>{b}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Field label="" value={bank} onChangeText={setBank} placeholder="Banka adı (veya yukarıdan seç)" />
      </View>

      <Field
        label="Gönderen IBAN"
        value={iban}
        onChangeText={(v) => setIban(normalizeIban(v).slice(0, 34))}
        placeholder="TR00 0000 0000 0000 0000 0000 00"
        autoCapitalize="none"
      />

      <Field
        label="Açıklama / Not (opsiyonel)"
        value={note}
        onChangeText={setNote}
        placeholder="Örn: 0532 000 00 00"
        multiline
      />

      {err ? <Banner tone="error" text={err} /> : null}

      <View style={{ gap: 8, marginTop: 4 }}>
        <PrimaryButton label={busy ? "Gönderiliyor…" : "Yatırma talebi oluştur"} loading={busy} onPress={submit} />
        <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

/* ================= Para Çekme ================= */

function WithdrawModal({
  open,
  balance,
  defaultName,
  onClose,
  onDone,
}: {
  open: boolean;
  balance: number | null;
  defaultName: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState(defaultName);
  const [iban, setIban] = useState("");
  const [bank, setBank] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setName(defaultName);
      setIban("");
      setBank("");
      setNote("");
      setErr(null);
    }
  }, [open, defaultName]);

  const submit = async () => {
    const value = parseAmount(amount);
    if (!value) return setErr("Geçerli bir tutar gir.");
    if (value < MIN_WITHDRAW) return setErr(`Minimum çekme tutarı ${MIN_WITHDRAW} ₺.`);
    if (balance != null && value > balance) return setErr("Bakiyenden fazla çekemezsin.");
    if (!name.trim()) return setErr("Alıcı ad soyad gir.");
    if (!isValidTrIban(iban)) return setErr("Geçerli bir TR IBAN gir (TR + 26 hane).");
    setErr(null);
    setBusy(true);
    try {
      const res = await createWithdrawRequest({
        amount: value,
        recipientName: name,
        recipientIban: iban,
        recipientBank: bank,
        recipientNote: note,
      });
      Alert.alert(
        "Talebin alındı ✅",
        res.message ?? "Çekme talebin onaylandıktan sonra IBAN'a gönderilecek (3-5 iş günü).",
      );
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Talep oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      icon="⬆️"
      title="Para Çek"
      subtitle={`Bakiyenden banka IBAN hesabına aktar. Min ${MIN_WITHDRAW} ₺.`}
    >
      {balance != null ? (
        <View style={styles.availableCard}>
          <View>
            <Text style={styles.availableCardLabel}>Kullanılabilir Bakiye</Text>
            <Text style={styles.availableCardValue}>{TRY(balance)}</Text>
          </View>
          <Pressable
            onPress={() => setAmount(String(Math.floor(balance)))}
            style={styles.allBalanceBtn}
          >
            <Text style={styles.allBalanceBtnText}>Tümünü Çek</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Hızlı Tutar Seçici */}
      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>Çekilecek Tutar (₺)</Text>
        <View style={styles.presetsRow}>
          {WITHDRAW_PRESETS.map((p) => {
            const active = amount === String(p);
            return (
              <Pressable
                key={p}
                onPress={() => setAmount(String(p))}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {p.toLocaleString("tr-TR")} ₺
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Field
          label=""
          value={amount}
          onChangeText={setAmount}
          placeholder="500"
          keyboardType="decimal-pad"
          suffix="₺"
        />
      </View>

      <Field label="Alıcı Ad Soyad" value={name} onChangeText={setName} placeholder="Ahmet Yılmaz" />

      {/* Hızlı Banka Seçimi */}
      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>Banka Seç (opsiyonel)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
          {POPULAR_BANKS.map((b) => {
            const active = bank.toLowerCase().includes(b.split(" ")[0].toLowerCase());
            return (
              <Pressable
                key={b}
                onPress={() => setBank(b)}
                style={[styles.bankPill, active && styles.bankPillActive]}
              >
                <Text style={[styles.bankPillText, active && styles.bankPillTextActive]}>{b}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Field label="" value={bank} onChangeText={setBank} placeholder="Ziraat Bankası" />
      </View>

      <Field
        label="Alıcı IBAN (Paranın Yatacağı Hesap)"
        value={iban}
        onChangeText={(v) => setIban(normalizeIban(v).slice(0, 34))}
        placeholder="TR00 0000 0000 0000 0000 0000 00"
        autoCapitalize="none"
      />

      <Field label="Açıklama (opsiyonel)" value={note} onChangeText={setNote} placeholder="Acil ihtiyaç" multiline />

      <View style={styles.processInfoCard}>
        <Text style={styles.processInfoTitle}>⏳ İşlem Süreci</Text>
        <Text style={styles.processInfoText}>
          Talebiniz alındıktan sonra 3-5 iş günü içinde incelenir ve IBAN hesabınıza aktarılır.
        </Text>
      </View>

      {err ? <Banner tone="error" text={err} /> : null}

      <View style={{ gap: 8, marginTop: 4 }}>
        <PrimaryButton label={busy ? "Gönderiliyor…" : "Çekme talebi oluştur"} loading={busy} onPress={submit} />
        <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 14 },

  // Bakiye kartı
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    gap: 4,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  balanceBlob: { position: "absolute", top: -80, right: -40, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(255,255,255,0.13)" },
  balanceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.85)" },
  balanceRole: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  balanceRoleText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  balanceValue: { fontSize: 34, fontWeight: "900", color: "#fff", marginTop: 6, letterSpacing: -0.5 },
  balanceCurrency: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  balanceStats: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, paddingVertical: 12, marginTop: 14 },
  balanceStat: { flex: 1, alignItems: "center", gap: 2 },
  balanceStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  balanceStatValue: { fontSize: 14, fontWeight: "800", color: "#fff" },
  balanceStatLabel: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.8)" },

  // Hızlı işlemler
  actionGrid: { flexDirection: "row", gap: 10 },
  actionTile: { flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  actionEmoji: { fontSize: 20 },
  actionLabel: { fontSize: 15, fontWeight: "800", color: colors.text },
  actionHint: { fontSize: 12, color: colors.muted },

  // Talepler
  requestRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bg, borderRadius: 12, padding: 10 },
  requestIcon: { fontSize: 16 },
  requestTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  requestSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  noteText: { fontSize: 11, color: colors.muted, lineHeight: 16 },
  flowStep: { fontSize: 12, color: colors.text, lineHeight: 19 },
  footNote: { fontSize: 11, color: colors.muted, textAlign: "center", lineHeight: 16 },

  // Hareketler
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHint: { fontSize: 11, color: colors.muted },
  chipRow: { gap: 6, paddingVertical: 2 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  txIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txEmoji: { fontSize: 15 },
  txTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  txSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: "800" },
  txBalance: { fontSize: 10, color: colors.muted, marginTop: 1 },
  rejectText: { fontSize: 10, color: colors.rose, marginTop: 2, fontWeight: "600" },

  // Banner / sheet / form
  banner: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  bannerText: { fontSize: 12, fontWeight: "600", lineHeight: 18 },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#e2e8f0", marginBottom: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  sheetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetIcon: { fontSize: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  sheetSub: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: { fontSize: 13, color: colors.muted, fontWeight: "800" },

  // Modern input field
  fieldLabel: { fontSize: 12, fontWeight: "800", color: colors.text, letterSpacing: 0.2 },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 12,
  },
  fieldWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.inputBg,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldWrapError: { borderColor: colors.rose },
  fieldInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  fieldPrefix: { fontSize: 14, fontWeight: "800", color: colors.primary, marginRight: 6 },
  fieldSuffix: { fontSize: 14, fontWeight: "800", color: colors.muted, marginLeft: 6 },
  fieldError: { fontSize: 11, color: colors.danger, fontWeight: "600" },

  // Hızlı tutar çipleri
  presetsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  presetChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  presetChipTextActive: { color: colors.primary, fontWeight: "800" },

  // Hızlı banka hapları
  bankPillsRow: { gap: 6, paddingVertical: 2 },
  bankPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankPillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: "#3b82f6",
  },
  bankPillText: { fontSize: 11.5, fontWeight: "600", color: "#475569" },
  bankPillTextActive: { color: "#1d4ed8", fontWeight: "800" },

  // Resmi şirket hesap kartı
  companyCard: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1.5,
    borderColor: "#bfdbfe",
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  companyCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  companyBankBadge: {
    backgroundColor: "#dbeafe",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  companyBankBadgeText: { fontSize: 11, fontWeight: "800", color: "#1d4ed8" },
  copyBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  copyBtnDone: { backgroundColor: "#059669" },
  copyBtnText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  copyBtnTextDone: { color: "#fff" },
  companyTitle: { fontSize: 14, fontWeight: "900", color: "#1e3a8a", marginTop: 2 },
  companyIban: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1e40af",
    letterSpacing: 0.8,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  companyNote: { fontSize: 11, color: "#1e40af", lineHeight: 16 },

  // Bakiye & Süreç kutuları
  availableCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    borderRadius: 16,
    padding: 14,
  },
  availableCardLabel: { fontSize: 11, fontWeight: "700", color: "#166534" },
  availableCardValue: { fontSize: 20, fontWeight: "900", color: "#15803d", marginTop: 2 },
  allBalanceBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  allBalanceBtnText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  processInfoCard: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fef3c7",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  processInfoTitle: { fontSize: 12, fontWeight: "800", color: "#92400e" },
  processInfoText: { fontSize: 11, color: "#92400e", lineHeight: 16 },
});
let styles = createStyles(lightColors);
