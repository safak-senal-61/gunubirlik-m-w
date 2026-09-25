import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Card, C, EmptyState, Loading } from "@/components/ui";
import {
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/api";
import type { ApiConversation, ApiMessage } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

export default function MessagesScreen({ refreshKey }: { refreshKey: number }) {
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApiConversation | null>(null);

  const load = useCallback(async () => {
    try {
      setConversations(await fetchConversations());
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  const openConv = (conv: ApiConversation) => {
    setSelected(conv);
    if (conv.unreadCount > 0) {
      markConversationRead(conv.id).then(load);
    }
  };

  if (selected) {
    return (
      <ThreadView
        conversation={selected}
        onBack={() => {
          setSelected(null);
          load();
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
  const listRef = useRef<FlatList<ApiMessage>>(null);

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
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const submit = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendMessage({
        recipientId: conversation.participant.id,
        conversationId: conversation.id,
        ...(conversation.job ? { jobId: conversation.job.id } : {}),
        content: draft.trim(),
      });
      setDraft("");
      await load();
    } catch {
      // sessiz
    } finally {
      setSending(false);
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
          onChangeText={setDraft}
          placeholder="Mesaj yaz…"
          placeholderTextColor={C.muted}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={submit} disabled={sending || !draft.trim()}>
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
