import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Card, C, EmptyState, Loading } from "@/components/ui";
import { useCachedList } from "@/hooks/use-cached-list";
import {
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/api";
import type { ApiConversation, ApiMessage } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { joinConversation, leaveConversation, sendRealtimeMessage, sendTyping, onRealtimeEvent } from "@/lib/socket";
import { sendTypingStatus } from "@/lib/api";

export default function MessagesScreen({
  refreshKey,
  openConversationId,
  onOpenConversationHandled,
}: {
  refreshKey: number;
  /** Push deep link: gunubirlik://messages/{id} → doğrudan açılacak konuşma. */
  openConversationId?: string | null;
  /** openConversationId uygulandıktan sonra çağrılır. */
  onOpenConversationHandled?: () => void;
}) {
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [selected, setSelected] = useState<ApiConversation | null>(null);

  const convFetcher = useCallback(() => fetchConversations(), []);
  const {
    data: convData,
    loading,
    refreshing,
    refresh: refreshConvs,
    reload,
  } = useCachedList("conversations:all", convFetcher, []);

  useEffect(() => {
    if (convData) setConversations(convData);
  }, [convData]);

  // Canlı akış için 15 sn'de bir sessiz tazele + sekme değişiminde.
  useEffect(() => {
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);

  const openConv = (conv: ApiConversation) => {
    setSelected(conv);
    if (conv.unreadCount > 0) {
      markConversationRead(conv.id).then(reload);
    }
  };

  // Push deep link: konuşma listesi geldiğinde istenen konuşmayı doğrudan aç.
  useEffect(() => {
    if (!openConversationId || conversations.length === 0) return;
    const target = conversations.find((c) => c.id === openConversationId);
    if (target) {
      openConv(target);
    }
    onOpenConversationHandled?.();
    // openConv bilinçli olarak bağımlılık dışı (ilk açılışta bir kez çalışsın).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openConversationId, conversations]);

  if (selected) {
    return (
      <ThreadView
        conversation={selected}
        onBack={() => {
          setSelected(null);
          reload();
        }}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.h1}>Mesajlar</Text>
        <Text style={styles.sub}>İşverenler ve işçilerle mesajlaş; detayları konuş.</Text>
      </View>
      {loading ? (
        <Loading />
      ) : conversations.length === 0 ? (
        <EmptyState emoji="💬" title="Henüz mesajın yok" subtitle="Bir ilana başvurduğunda ya da başvuru aldığında konuşmalar burada başlar." />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshConvs}
              tintColor={C.primary}
              colors={[C.primary]}
              progressBackgroundColor="#fff"
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openConv(item)}>
              <Card style={styles.convCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.participant.companyName ?? item.participant.fullName).slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName} numberOfLines={1}>
                      {item.participant.companyName ?? item.participant.fullName}
                    </Text>
                    {item.lastMessage && (
                      <Text style={styles.convTime}>{timeAgo(item.lastMessage.createdAt)}</Text>
                    )}
                  </View>
                  <Text style={styles.convPreview} numberOfLines={1}>
                    {item.lastMessage?.content ?? "Henüz mesaj yok"}
                  </Text>
                  {item.job && (
                    <Text style={styles.convJob} numberOfLines={1}>📋 {item.job.title}</Text>
                  )}
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.unread}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function ThreadView({
  conversation,
  onBack,
}: {
  conversation: ApiConversation;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherTypingName, setOtherTypingName] = useState<string | null>(null);
  const listRef = useRef<FlatList<ApiMessage>>(null);
  const typingTimerRef = useRef<any>(null);
  const remoteTypingTimerRef = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchMessages(conversation.id));
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    load();
    joinConversation(conversation.id);

    const unsubMsg = onRealtimeEvent("message:new", (msg: any) => {
      if (msg && msg.conversationId === conversation.id) {
        setMessages((prev) => {
          if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
          if (msg.tempId) {
            const idx = prev.findIndex((m: any) => m.id === msg.tempId || m.tempId === msg.tempId);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...msg, id: msg.id || updated[idx].id };
              return updated;
            }
          }
          if (msg.senderId === user?.id) {
            const idx = prev.findIndex((m: any) => (m.id && String(m.id).startsWith("temp_")));
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...msg, id: msg.id || updated[idx].id };
              return updated;
            }
          }
          return [...prev, msg];
        });

        if (msg.senderId !== user?.id) {
          setIsOtherTyping(false);
          setOtherTypingName(null);
        }
      }
    });

    const unsubTypingStart = onRealtimeEvent("typing:start", (data: any) => {
      if (data && data.conversationId === conversation.id && data.userId !== user?.id) {
        setIsOtherTyping(true);
        if (data.userName) setOtherTypingName(data.userName);
        if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
        remoteTypingTimerRef.current = setTimeout(() => {
          setIsOtherTyping(false);
          setOtherTypingName(null);
        }, 3500);
      }
    });

    const unsubTypingStop = onRealtimeEvent("typing:stop", (data: any) => {
      if (data && data.conversationId === conversation.id && data.userId !== user?.id) {
        setIsOtherTyping(false);
        setOtherTypingName(null);
      }
    });

    return () => {
      unsubMsg();
      unsubTypingStart();
      unsubTypingStop();
      leaveConversation(conversation.id);
      if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [conversation.id, load, user?.id]);

  const handleDraftChange = (text: string) => {
    setDraft(text);
    if (!user) return;

    sendTyping(conversation.id, user.id, user.fullName || user.companyName || "Kullanıcı", true);
    sendTypingStatus(conversation.id, true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTyping(conversation.id, user.id, user.fullName || user.companyName || "Kullanıcı", false);
      sendTypingStatus(conversation.id, false);
    }, 1500);
  };

  const submit = async () => {
    if (!draft.trim() || !user) return;
    const content = draft.trim();
    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

    setDraft("");
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTyping(conversation.id, user.id, user.fullName || user.companyName || "Kullanıcı", false);
    sendTypingStatus(conversation.id, false);

    const optimisticMsg: any = {
      id: tempId,
      tempId,
      conversationId: conversation.id,
      senderId: user.id,
      sender: { id: user.id, fullName: user.fullName, companyName: user.companyName },
      content,
      type: "TEXT",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    sendRealtimeMessage(conversation.id, optimisticMsg);

    try {
      const serverMsg = await sendMessage({
        recipientId: conversation.participant.id,
        conversationId: conversation.id,
        ...(conversation.job ? { jobId: conversation.job.id } : {}),
        content,
        type: "TEXT",
      });

      if (serverMsg && serverMsg.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId || (m as any).tempId === tempId ? { ...m, ...serverMsg, id: serverMsg.id } : m
          )
        );
      }
    } catch {
      // sessiz
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.threadHeader}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backBtn}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.threadName} numberOfLines={1}>
            {conversation.participant.companyName ?? conversation.participant.fullName}
          </Text>
          {conversation.job && (
            <Text style={styles.threadJob} numberOfLines={1}>{conversation.job.title}</Text>
          )}
        </View>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          ref={listRef}
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.msgList}
          ListHeaderComponent={
            isOtherTyping ? (
              <View style={[styles.msgRow, styles.msgTheirs, { marginBottom: 8 }]}>
                <View style={[styles.bubble, styles.bubbleTheirs, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                  <Text style={{ fontSize: 13, color: C.primary, fontWeight: "600" }}>
                    {otherTypingName || conversation.participant.companyName || conversation.participant.fullName} yazıyor...
                  </Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <View style={[styles.msgRow, mine ? styles.msgMine : styles.msgTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.msgText, mine && styles.msgTextMine]}>{item.content}</Text>
                  <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>
                    {new Date(item.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={handleDraftChange}
          placeholder="Mesaj yaz…"
          placeholderTextColor={C.muted}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={submit} disabled={!draft.trim()}>
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendText}>➤</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: { padding: 16, paddingBottom: 8, gap: 2 },
  h1: { fontSize: 22, fontWeight: "800", color: C.text },
  sub: { fontSize: 13, color: C.muted },
  list: { padding: 16, gap: 10 },
  convCard: { flexDirection: "row", gap: 12, alignItems: "center", padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "800", color: C.primary },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 14, fontWeight: "800", color: C.text, flex: 1 },
  convTime: { fontSize: 11, color: C.muted },
  convPreview: { fontSize: 12, color: C.muted, marginTop: 2 },
  convJob: { fontSize: 11, color: C.primary, marginTop: 2 },
  unread: { backgroundColor: "#e11d48", borderRadius: 999, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  threadHeader: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { fontSize: 20, color: C.text, paddingHorizontal: 4 },
  threadName: { fontSize: 15, fontWeight: "800", color: C.text },
  threadJob: { fontSize: 12, color: C.muted },
  msgList: { padding: 14, gap: 8, paddingBottom: 20 },
  msgRow: { flexDirection: "row" },
  msgMine: { justifyContent: "flex-end" },
  msgTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: C.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: "#eef0f3", borderBottomLeftRadius: 6 },
  msgText: { fontSize: 14, color: C.text, lineHeight: 20 },
  msgTextMine: { color: "#fff" },
  msgTime: { fontSize: 10, color: C.muted, marginTop: 3, alignSelf: "flex-end" },
  msgTimeMine: { color: "rgba(255,255,255,0.75)" },
  composer: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: "#fff", alignItems: "flex-end" },
  composerInput: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.text, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  sendText: { color: "#fff", fontSize: 16 },
});
