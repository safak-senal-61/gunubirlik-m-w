import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Badge, C, Card, Chip, EmptyState, PrimaryButton, SectionTitle } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import {
  createDepositRequest,
  createWithdrawRequest,
  fetchDepositRequests,
  fetchWalletBalance,
  fetchWalletBalanceCached,
  fetchWalletTransactions,
  fetchWithdrawRequests,
  generateQrPay,
  invalidateWalletBalanceCache,
  isValidTrIban,
  MIN_DEPOSIT,
  MIN_TRANSFER,
  MIN_WITHDRAW,
  normalizeIban,
  scanQrPay,
  walletTransfer,
} from "@/lib/api";
import type {
  ApiUser,
  DepositRequest,
  QrPayCode,
  WalletTransaction,
  WalletTxType,
  WithdrawRequest,
} from "@/lib/types";

const TRY = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

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
  { key: "QR_PAYMENT", label: "QR ödeme" },
  { key: "TRANSFER", label: "Transfer" },
];

const REQ_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Onay bekliyor", color: C.amber, bg: C.amberBg },
  APPROVED: { label: "Onaylandı", color: C.emerald, bg: C.emeraldBg },
  COMPLETED: { label: "Tamamlandı", color: C.emerald, bg: C.emeraldBg },
  REJECTED: { label: "Reddedildi", color: C.rose, bg: C.roseBg },
};

type Sheet = "deposit" | "withdraw" | "transfer" | "qrpay" | null;

export default function WalletScreen({ user }: { user: ApiUser }) {
  const isEmployer = user.role === "EMPLOYER";
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [txFilter, setTxFilter] = useState<WalletTxType>("ALL");
  const [txLoading, setTxLoading] = useState(false);

  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>([]);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [scanner, setScanner] = useState(false);
  const [qrPay, setQrPay] = useState<QrPayCode | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      const [b, t, d, w] = await Promise.allSettled([
        // Bakiye cache'li: sekmeye her girişte spinner YOK, önce önbellekteki
        // değer anında yazılır; ağ sonucu gelince sessizce güncellenir.
        fetchWalletBalanceCached({
          force,
          onUpdate: (fresh) => {
            setBalance(fresh.balance);
            setError(null);
          },
        }),
        fetchWalletTransactions({ type: txFilter, pageSize: 30 }),
        fetchDepositRequests(),
        fetchWithdrawRequests(),
      ]);
      if (b.status === "fulfilled") {
        setBalance(b.value.balance.balance);
        setError(null);
      } else {
        setError(b.reason instanceof Error ? b.reason.message : "Bakiye alınamadı");
      }
      if (t.status === "fulfilled") setTxs(t.value);
      if (d.status === "fulfilled") setDeposits(d.value);
      if (w.status === "fulfilled") setWithdraws(w.value);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [txFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hareket listesi filtre değişince ayrıca tazelenir (bakiye gereksiz yere çekilmez).
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

  const refreshBalance = async () => {
    try {
      const b = await fetchWalletBalance();
      setBalance(b.balance);
    } catch {
      // sessiz
    }
  };

  const pendingDepositTotal = deposits
    .filter((d) => d.status === "PENDING")
    .reduce((s, d) => s + d.amount, 0);
  const pendingWithdrawTotal = withdraws
    .filter((w) => w.status === "PENDING")
    .reduce((s, w) => s + w.amount, 0);

  // Yatırma ve çekme taleplerini tek listede, tarihine göre yeniden eskiye.
  const allRequests = [
    ...deposits.map((d) => ({
      kind: "deposit" as const,
      id: d.id,
      amount: d.amount,
      status: d.status,
      createdAt: d.createdAt,
      iban: d.senderIban,
      bank: d.senderBank ?? null,
      note: d.senderNote ?? null,
      rejectReason: d.rejectReason ?? null,
    })),
    ...withdraws.map((w) => ({
      kind: "withdraw" as const,
      id: w.id,
      amount: w.amount,
      status: w.status,
      createdAt: w.createdAt,
      iban: w.recipientIban,
      bank: w.recipientBank ?? null,
      note: w.recipientNote ?? null,
      rejectReason: w.rejectReason ?? null,
    })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const onQrPayScanned = useCallback(async () => {
    setScanner(false);
    await refreshBalance();
  }, []);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.wrap}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              invalidateWalletBalanceCache();
              void load(true);
            }}
            tintColor={C.primary}
            colors={[C.primary]}
            progressBackgroundColor="#fff"
          />
        }
      >
        {/* Bakiye kartı */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceBlob} pointerEvents="none" />
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Cüzdan bakiyen</Text>
            <View style={styles.balanceRole}>
              <Text style={styles.balanceRoleText}>{isEmployer ? "🏢 İşveren" : "🔨 İşçi"}</Text>
            </View>
          </View>
          <Text style={styles.balanceValue}>{balance == null ? (loading ? "…" : "—") : TRY(balance)}</Text>
          <Text style={styles.balanceCurrency}>Günübirlik cüzdanı · TRY</Text>

          <View style={styles.balanceStats}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatValue}>{TRY(pendingDepositTotal)}</Text>
              <Text style={styles.balanceStatLabel}>Yatırma bekliyor</Text>
            </View>
            <View style={styles.balanceStatDivider} />
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatValue}>{TRY(pendingWithdrawTotal)}</Text>
              <Text style={styles.balanceStatLabel}>Çekme bekliyor</Text>
            </View>
          </View>
        </View>

        {error ? <Banner tone="error" text={error} /> : null}

        {/* Hızlı işlemler */}
        <View style={styles.actionGrid}>
          <ActionTile icon="⬇️" label="Para Yatır" hint="EFT / Havale" color={C.emerald} onPress={() => setSheet("deposit")} />
          <ActionTile icon="⬆️" label="Para Çek" hint="IBAN'ına gönder" color={C.primary} onPress={() => setSheet("withdraw")} />
          <ActionTile icon="📲" label="QR ile Öde" hint="Kod üret" color="#b45309" onPress={() => setSheet("qrpay")} />
          <ActionTile icon="📷" label="QR ile Al" hint="Kod okut" color="#be123c" onPress={() => setScanner(true)} />
        </View>
        <Pressable style={styles.transferBtn} onPress={() => setSheet("transfer")}>
          <Text style={styles.transferIcon}>↔️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.transferLabel}>Birişine gönder</Text>
            <Text style={styles.transferHint}>Başka bir kullanıcıya anında para transferi (min {MIN_TRANSFER} ₺)</Text>
          </View>
          <Text style={styles.transferChevron}>›</Text>
        </Pressable>

        {/* Bekleyen talepler */}
        {(deposits.some((d) => d.status === "PENDING") || withdraws.some((w) => w.status === "PENDING")) && (
          <Card style={{ gap: 10 }}>
            <SectionTitle>Bekleyen talepler</SectionTitle>
            {deposits
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
            {withdraws
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
              ℹ️ EFT/havale talebin yönetim onayından sonra bakiyene işlenir (1-3 iş günü). Çekme talepleri
              onaylandığında IBAN'a gönderilir.
            </Text>
          </Card>
        )}

        {/* Tüm talepler (geçmiş) */}
        {deposits.length + withdraws.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionTitle>Yatırma / çekme taleplerim</SectionTitle>
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
                    label={(REQ_STATUS[r.status] ?? REQ_STATUS.PENDING).label}
                    color={(REQ_STATUS[r.status] ?? REQ_STATUS.PENDING).color}
                    bg={(REQ_STATUS[r.status] ?? REQ_STATUS.PENDING).bg}
                  />
                </View>
              ))}
            </Card>
          </View>
        ) : null}

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
            1️⃣ İşveren işi <Text style={styles.flowStrong}>Tamamlandı</Text> yapar → sistemde otomatik bekleyen ödeme oluşur.
          </Text>
          <Text style={styles.flowStep}>2️⃣ Platform yönetimi ödeme kaydını onaylar.</Text>
          <Text style={styles.flowStep}>
            3️⃣ İşveren ödemeyi <Text style={styles.flowStrong}>Ödendi</Text> işaretler.
          </Text>
          <Text style={styles.flowStep}>
            4️⃣ İşçi <Text style={styles.flowStrong}>Aldım</Text> onayı verir → işlem kapanır.
          </Text>
          <Text style={styles.flowStep}>5️⃣ Anlaşmazlıkta itiraz → yönetim çözümler.</Text>
          <Text style={styles.noteText}>
            ℹ️ Para yatırma ve çekme talepleri elle işlenir: yatırmada banka hesabından EFT/havale yapılır,
            çekmede tutar emanete alınır. İki işlem de yönetim onayıyla tamamlanır.
          </Text>
        </Card>

        <Text style={styles.footNote}>Bakiye ve hareketler anlık olarak güncellenir. ↓ Aşağı çekerek yenile.</Text>
      </ScrollView>

      {/* ================= Modallar ================= */}

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

      <TransferModal
        open={sheet === "transfer"}
        balance={balance}
        onClose={() => setSheet(null)}
        onDone={async () => {
          setSheet(null);
          invalidateWalletBalanceCache();
          await load(true);
        }}
      />

      <QrPayGenerateModal
        open={sheet === "qrpay"}
        balance={balance}
        onClose={() => setSheet(null)}
        onGenerated={(code) => {
          setSheet(null);
          setQrPay(code);
        }}
      />

      <QrPayResultModal code={qrPay} onClose={() => setQrPay(null)} />

      <QrPayScannerModal
        visible={scanner}
        onClose={() => setScanner(false)}
        onScanned={onQrPayScanned}
      />
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
      style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.75 }]}
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
  const meta = REQ_STATUS[status] ?? REQ_STATUS.PENDING;
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
  const meta = TX_META[tx.type] ?? { label: tx.type, icon: "•" };
  const positive = tx.amount >= 0;
  return (
    <View style={[styles.txRow, !last && styles.txRowBorder]}>
      <View style={[styles.txIcon, { backgroundColor: positive ? C.emeraldBg : C.roseBg }]}>
        <Text style={styles.txEmoji}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle}>{tx.description || meta.label}</Text>
        <Text style={styles.txSub}>
          {timeAgo(tx.createdAt)}
          {tx.counterparty?.fullName ? ` · ${tx.counterparty.fullName}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.txAmount, { color: positive ? C.emerald : C.rose }]}>
          {positive ? "+" : ""}
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
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
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
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSub}>{subtitle}</Text> : null}
              <View style={{ gap: 10, paddingBottom: 8 }}>{children}</View>
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
  keyboardType?: "default" | "numeric" | "decimal-pad" | "email-address";
  multiline?: boolean;
  error?: string | null;
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={[styles.field, props.multiline && { minHeight: 64, textAlignVertical: "top" }]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#a1a1aa"
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
      />
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

  useEffect(() => {
    if (open) {
      setAmount("");
      setSenderName(defaultName);
      setIban("");
      setBank("");
      setNote("");
      setErr(null);
    }
  }, [open, defaultName]);

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
        "Yönetim EFT/havaleni teyit ettikten sonra bakiyene işlenecek. Talepler sekmesinden takip edebilirsin.",
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
      title="Para Yatır"
      subtitle={`Banka hesabından EFT/havale yap, yönetim onayladığında bakiyene eklensin. Min ${MIN_DEPOSIT} ₺.`}
    >
      <Field
        label="Tutar (₺)"
        value={amount}
        onChangeText={setAmount}
        placeholder="1000"
        keyboardType="decimal-pad"
      />
      <Field label="Ad Soyad (gönderen)" value={senderName} onChangeText={setSenderName} placeholder="Ahmet Yılmaz" />
      <Field
        label="Gönderen IBAN"
        value={iban}
        onChangeText={(v) => setIban(normalizeIban(v).slice(0, 34))}
        placeholder="TR00 0000 0000 0000 0000 0000 00"
        autoCapitalize="none"
      />
      <Field label="Banka (opsiyonel)" value={bank} onChangeText={setBank} placeholder="İş Bankası" />
      <Field
        label="Not (opsiyonel)"
        value={note}
        onChangeText={setNote}
        placeholder="Telefon numaram: 0532…"
        multiline
      />
      {err ? <Banner tone="error" text={err} /> : null}
      <PrimaryButton label={busy ? "Gönderiliyor…" : "Yatırma talebi oluştur"} loading={busy} onPress={submit} />
      <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
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
      title="Para Çek"
      subtitle={`Bakiyenden IBAN'ına gönder. Tutar hemen emanete alınır, onaydan sonra ödenir. Min ${MIN_WITHDRAW} ₺.`}
    >
      {balance != null ? (
        <View style={styles.availableRow}>
          <Text style={styles.availableLabel}>Kullanılabilir bakiye</Text>
          <Text style={styles.availableValue}>{TRY(balance)}</Text>
        </View>
      ) : null}
      <Field label="Tutar (₺)" value={amount} onChangeText={setAmount} placeholder="500" keyboardType="decimal-pad" />
      <Field label="Alıcı Ad Soyad" value={name} onChangeText={setName} placeholder="Ahmet Yılmaz" />
      <Field
        label="Alıcı IBAN"
        value={iban}
        onChangeText={(v) => setIban(normalizeIban(v).slice(0, 34))}
        placeholder="TR00 0000 0000 0000 0000 0000 00"
        autoCapitalize="none"
      />
      <Field label="Banka (opsiyonel)" value={bank} onChangeText={setBank} placeholder="Ziraat Bankası" />
      <Field label="Not (opsiyonel)" value={note} onChangeText={setNote} placeholder="Acil ihtiyaç" multiline />
      {err ? <Banner tone="error" text={err} /> : null}
      <PrimaryButton label={busy ? "Gönderiliyor…" : "Çekme talebi oluştur"} loading={busy} onPress={submit} />
      <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

/* ================= Transfer ================= */

function TransferModal({
  open,
  balance,
  onClose,
  onDone,
}: {
  open: boolean;
  balance: number | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRecipientId("");
      setAmount("");
      setDescription("");
      setNote("");
      setErr(null);
    }
  }, [open]);

  const submit = async () => {
    const value = parseAmount(amount);
    if (!value) return setErr("Geçerli bir tutar gir.");
    if (value < MIN_TRANSFER) return setErr(`Minimum transfer tutarı ${MIN_TRANSFER} ₺.`);
    if (balance != null && value > balance) return setErr("Bakiyenden fazla gönderemezsin.");
    if (!recipientId.trim()) return setErr("Alıcı kullanıcı ID'sini gir.");
    setErr(null);
    setBusy(true);
    try {
      const res = await walletTransfer({
        recipientId: recipientId.trim(),
        amount: value,
        description,
        note,
      });
      Alert.alert("Transfer tamamlandı ✅", res.message ?? "Para karşı tarafa ulaştı.");
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transfer yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      title="Para Gönder"
      subtitle={`Bir kullanıcıya anında transfer. Min ${MIN_TRANSFER} ₺.`}
    >
      <Field
        label="Alıcı kullanıcı ID"
        value={recipientId}
        onChangeText={setRecipientId}
        placeholder="cmu..."
        autoCapitalize="none"
      />
      <Field label="Tutar (₺)" value={amount} onChangeText={setAmount} placeholder="250" keyboardType="decimal-pad" />
      <Field label="Açıklama" value={description} onChangeText={setDescription} placeholder="Günlük işçi ücreti" />
      <Field label="Not (opsiyonel)" value={note} onChangeText={setNote} placeholder="Bugünkü iş için" multiline />
      {err ? <Banner tone="error" text={err} /> : null}
      <PrimaryButton label={busy ? "Gönderiliyor…" : "Transferi onayla"} loading={busy} onPress={submit} />
      <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

/* ================= QR ile Öde ================= */

function QrPayGenerateModal({
  open,
  balance,
  onClose,
  onGenerated,
}: {
  open: boolean;
  balance: number | null;
  onClose: () => void;
  onGenerated: (code: QrPayCode) => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
      setErr(null);
    }
  }, [open]);

  const submit = async () => {
    const value = parseAmount(amount);
    if (!value) return setErr("Geçerli bir tutar gir.");
    if (value < MIN_TRANSFER) return setErr(`Minimum tutar ${MIN_TRANSFER} ₺.`);
    if (balance != null && value > balance) return setErr("Bakiyenden fazla ödeyemezsin.");
    setErr(null);
    setBusy(true);
    try {
      const code = await generateQrPay({ amount: value, description });
      onGenerated(code);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "QR kod üretilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      title="QR ile Öde"
      subtitle="Ödeme kodunu üret, karşı taraf telefonuyla okutsun. Kod 5 dakika geçerli ve tek kullanımlıktır."
    >
      {balance != null ? (
        <View style={styles.availableRow}>
          <Text style={styles.availableLabel}>Kullanılabilir bakiye</Text>
          <Text style={styles.availableValue}>{TRY(balance)}</Text>
        </View>
      ) : null}
      <Field label="Tutar (₺)" value={amount} onChangeText={setAmount} placeholder="2500" keyboardType="decimal-pad" />
      <Field label="Açıklama" value={description} onChangeText={setDescription} placeholder="İnşaat işçisi günlük ücret" />
      {err ? <Banner tone="error" text={err} /> : null}
      <PrimaryButton label={busy ? "Üretiliyor…" : "QR ödeme kodu üret"} loading={busy} onPress={submit} />
      <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

function QrPayResultModal({ code, onClose }: { code: QrPayCode | null; onClose: () => void }) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!code) return;
    const tick = () => {
      const sec = Math.max(0, Math.floor((new Date(code.expiresAt).getTime() - Date.now()) / 1000));
      setLeft(sec);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [code]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  if (!code) return null;

  return (
    <Modal visible={!!code} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView>
            <Text style={styles.sheetTitle}>Ödeme kodu hazır</Text>
            <Text style={styles.sheetSub}>
              Karşı taraf bu kodu okutunca {TRY(code.amount)} bakiyenden düşer ve alıcıya geçer.
            </Text>
            {code.qrImageDataUrl ? (
              <Image source={{ uri: code.qrImageDataUrl }} style={styles.qrImage} resizeMode="contain" />
            ) : null}
            <View style={styles.qrMetaRow}>
              <Text style={styles.qrAmount}>{TRY(code.amount)}</Text>
              <View style={[styles.qrTimer, left <= 0 && { backgroundColor: C.roseBg }]}>
                <Text style={[styles.qrTimerText, left <= 0 && { color: C.rose }]}>
                  {left > 0 ? `⏱️ ${mm}:${ss}` : "Süresi doldu"}
                </Text>
              </View>
            </View>
            {code.description ? <Text style={styles.qrDesc}>{code.description}</Text> : null}
            <Text style={styles.qrGenerator}>Gönderen: {code.generator?.fullName ?? "—"}</Text>
            {left <= 0 ? (
              <Banner tone="error" text="Kodun süresi doldu. Yeni kod üret." />
            ) : null}
            <PrimaryButton label="Kapat" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ================= QR ile Al (tarama) ================= */

function QrPayScannerModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: () => void | Promise<void>;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manual, setManual] = useState("");

  const submitToken = async (rawToken: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await scanQrPay(rawToken);
      Alert.alert(
        "Ödeme alındı ✅",
        `${TRY(res.amount)} hesabına eklendi.\nYeni bakiye: ${TRY(res.balanceAfter)}`,
        [{ text: "Tamam", onPress: () => { onClose(); void onScanned(); } }],
      );
    } catch (e) {
      Alert.alert(
        "Ödeme alınamadı",
        e instanceof Error ? e.message : "Kod geçersiz veya süresi dolmuş.",
      );
    } finally {
      setBusy(false);
    }
  };

  const extractToken = (data: string): string => {
    try {
      const payload = JSON.parse(data) as { token?: string };
      if (payload?.token) return payload.token;
    } catch {
      // ham token
    }
    return data;
  };

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || busy) return;
    setScanned(true);
    await submitToken(extractToken(data));
    setScanned(false);
  };

  const handleManual = async () => {
    const raw = manual.trim();
    if (!raw || busy) return;
    await submitToken(extractToken(raw));
    setManual("");
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.darkHeader}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.darkClose}>✕</Text>
          </Pressable>
          <Text style={styles.darkTitle}>QR ile Ödeme Al</Text>
          <View style={{ width: 24 }} />
        </View>

        {!permission?.granted ? (
          <View style={styles.center}>
            <Text style={styles.permEmoji}>📷</Text>
            <Text style={styles.permTitle}>Kamera izni gerekli</Text>
            <Text style={styles.permDesc}>
              Ödeme kodunu okutmak için kamera erişimi ver. Alternatif olarak aşağıya token'ı yapıştırabilirsin.
            </Text>
            <PrimaryButton label="İzin ver" onPress={requestPermission} />
            <PrimaryButton label="Vazgeç" variant="ghost" onPress={onClose} />
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <CameraView
                style={{ flex: 1 }}
                onBarcodeScanned={scanned ? undefined : handleScan}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              />
              <View style={styles.frame} pointerEvents="none" />
            </View>
            <View style={styles.darkFooter}>
              <Text style={styles.darkFooterText}>
                {busy ? "İşleniyor…" : "Ödeme kodunu çerçeveye getir. Tutar bakiyene eklenecek."}
              </Text>
              <View style={styles.manualBox}>
                <Text style={styles.manualTitle}>Kameran çalışmıyor mu?</Text>
                <TextInput
                  style={styles.manualInput}
                  value={manual}
                  onChangeText={setManual}
                  placeholder='Token veya {"token":"..."} içeriği'
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
                <PrimaryButton
                  label={busy ? "İşleniyor…" : "Token ile doğrula"}
                  disabled={!manual.trim() || busy}
                  onPress={handleManual}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  wrap: { padding: 16, paddingBottom: 40, gap: 14 },

  // Bakiye kartı
  balanceCard: {
    backgroundColor: C.primary,
    borderRadius: 22,
    padding: 20,
    gap: 4,
    overflow: "hidden",
    shadowColor: C.primary,
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
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionTile: { flexGrow: 1, flexBasis: "47%", backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 3 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  actionEmoji: { fontSize: 18 },
  actionLabel: { fontSize: 14, fontWeight: "800", color: C.text },
  actionHint: { fontSize: 11, color: C.muted },
  transferBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  transferIcon: { fontSize: 20 },
  transferLabel: { fontSize: 14, fontWeight: "800", color: C.text },
  transferHint: { fontSize: 11, color: C.muted },
  transferChevron: { fontSize: 22, color: C.muted },

  // Talepler
  requestRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg, borderRadius: 12, padding: 10 },
  requestIcon: { fontSize: 16 },
  requestTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  requestSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  noteText: { fontSize: 11, color: C.muted, lineHeight: 16 },
  flowStep: { fontSize: 12, color: C.text, lineHeight: 19 },
  flowStrong: { fontWeight: "800" },
  footNote: { fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 16 },

  // Hareketler
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHint: { fontSize: 11, color: C.muted },
  chipRow: { gap: 6, paddingVertical: 2 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  txIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txEmoji: { fontSize: 15 },
  txTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  txSub: { fontSize: 11, color: C.muted, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: "800" },
  txBalance: { fontSize: 10, color: C.muted, marginTop: 1 },
  rejectText: { fontSize: 10, color: C.rose, marginTop: 2, fontWeight: "600" },

  // Banner / sheet / form
  banner: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  bannerText: { fontSize: 12, fontWeight: "600", lineHeight: 18 },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 10, paddingBottom: 28 },
  sheetHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 6 },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: C.text },
  sheetSub: { fontSize: 12, color: C.muted, lineHeight: 18, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: C.text },
  field: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: "#fafafa" },
  fieldError: { fontSize: 11, color: C.danger },
  availableRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.primarySoft, borderRadius: 12, padding: 12 },
  availableLabel: { fontSize: 12, fontWeight: "600", color: C.primary },
  availableValue: { fontSize: 15, fontWeight: "800", color: C.primary },

  // QR
  qrImage: { width: 220, height: 220, alignSelf: "center", backgroundColor: "#fff", borderRadius: 16, marginVertical: 12 },
  qrMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qrAmount: { fontSize: 24, fontWeight: "900", color: C.text },
  qrTimer: { backgroundColor: C.amberBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  qrTimerText: { fontSize: 12, fontWeight: "800", color: C.amber },
  qrDesc: { fontSize: 13, color: C.text, textAlign: "center" },
  qrGenerator: { fontSize: 11, color: C.muted, textAlign: "center" },

  // Scanner
  page: { flex: 1, backgroundColor: "#000" },
  darkHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#111" },
  darkClose: { fontSize: 18, color: "#fff", width: 24 },
  darkTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  frame: { position: "absolute", top: "22%", left: "12%", right: "12%", height: 240, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", borderRadius: 18 },
  darkFooter: { padding: 16, backgroundColor: "#111", gap: 10 },
  darkFooterText: { color: "#fff", fontSize: 12, textAlign: "center", lineHeight: 18, opacity: 0.85 },
  manualBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", padding: 14, gap: 8 },
  manualTitle: { color: "#fff", fontSize: 13, fontWeight: "800" },
  manualInput: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderRadius: 10, color: "#fff", paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 44, textAlignVertical: "top" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: C.bg, padding: 24 },
  permEmoji: { fontSize: 44 },
  permTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  permDesc: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 19, marginBottom: 8 },
});
