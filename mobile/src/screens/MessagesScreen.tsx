import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  fetchMe,
  sendTypingStatus,
} from '../lib/api';
import type { ApiConversation, ApiMessage } from '../lib/types';
import { subscribeToConversation, TypingUser } from '../lib/socket';
import { Avatar } from '../components/ui';
import { ArrowLeftIcon, SendIcon, VerifiedCheckIcon } from '../components/icons';

interface MessagesScreenProps {
  initialConversationId?: string | null;
  openConversationId?: string | null;
  onOpenConversationHandled?: () => void;
  onSelectConversation?: (id: string | null) => void;
  onActiveThreadChange?: (isActive: boolean) => void;
  refreshKey?: number;
}

export function MessagesScreen({
  initialConversationId,
  openConversationId,
  onOpenConversationHandled,
  onSelectConversation,
  onActiveThreadChange,
  refreshKey,
}: MessagesScreenProps) {
  const targetId = openConversationId || initialConversationId;
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [selected, setSelected] = useState<ApiConversation | null>(null);
  const [messages, setMessages] = useState<(ApiMessage & { tempId?: string })[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const handleSelectConversation = useCallback(
    (conv: ApiConversation | null) => {
      setSelected(conv);
      onSelectConversation?.(conv ? conv.id : null);
      onActiveThreadChange?.(conv !== null);
    },
    [onSelectConversation, onActiveThreadChange]
  );

  useEffect(() => {
    loadUserAndConversations();
  }, [refreshKey, targetId]);

  const loadUserAndConversations = async () => {
    try {
      const user = await fetchMe();
      if (user) {
        setCurrentUserId(user.id);
      }
      const data = await fetchConversations();
      setConversations(data);

      if (targetId) {
        const target = data.find((c: ApiConversation) => c.id === targetId);
        if (target) {
          handleSelectConversation(target);
          onOpenConversationHandled?.();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    loadMessages(selected.id);

    // Subscribe to realtime messages & typing
    const unsubscribe = subscribeToConversation(
      selected.id,
      (newMsg: any) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMsg.id || (m.tempId && m.tempId === newMsg.tempId));
          if (exists) {
            return prev.map((m) => (m.id === newMsg.id || (m.tempId && m.tempId === newMsg.tempId) ? newMsg : m));
          }
          return [...prev, newMsg];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      },
      (typingList: TypingUser[]) => {
        setTypingUsers(typingList.filter((u: TypingUser) => u.userId !== currentUserId));
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selected?.id, currentUserId]);

  const loadMessages = async (convId: string) => {
    try {
      const data = await fetchMessages(convId);
      setMessages(data);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (!selected) return;

    if (!typingTimeoutRef.current) {
      sendTypingStatus(selected.id, true).catch(() => {});
    } else {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (selected) {
        sendTypingStatus(selected.id, false).catch(() => {});
      }
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selected || sending) return;

    const content = inputText.trim();
    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTypingStatus(selected.id, false).catch(() => {});

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ApiMessage & { tempId?: string } = {
      id: tempId,
      tempId,
      conversationId: selected.id,
      senderId: currentUserId || 'me',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    setSending(true);
    try {
      const saved = await sendMessage({
        conversationId: selected.id,
        recipientId: selected.participant?.id,
        content,
        type: 'TEXT',
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId || m.tempId === tempId ? { ...saved, tempId } : m))
      );
    } catch (e) {
      console.error('Send error:', e);
    } finally {
      setSending(false);
    }
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>
            {typingUsers.map((u) => u.name || u.userName || 'Biri').join(', ')} yazıyor
          </Text>
          <View style={styles.typingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D6847" />
      </View>
    );
  }

  // --- CONVERSATION CHAT VIEW ---
  if (selected) {
    const displayName = selected.participant?.fullName || selected.participant?.companyName || selected.job?.title || 'Sohbet';

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.threadContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
      >
        {/* Modern Architectural Header */}
        <View style={styles.threadHeader}>
          <TouchableOpacity
            onPress={() => handleSelectConversation(null)}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeftIcon size={22} color="#0C0E0D" />
          </TouchableOpacity>
          <Avatar name={displayName} size={38} />
          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {displayName}
              </Text>
              <VerifiedCheckIcon size={14} color="#0D6847" />
            </View>
            {selected.job && (
              <Text style={styles.headerSub} numberOfLines={1}>
                {selected.job.title}
              </Text>
            )}
          </View>
        </View>

        {/* Messages Feed */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isMe = item.senderId === currentUserId || item.senderId === 'me';
            return (
              <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
                <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                  <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.messageTime, isMe ? styles.myTime : styles.otherTime]}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={renderTypingIndicator}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Composer Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Mesajınızı yazın..."
            placeholderTextColor="#8C928E"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <SendIcon size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // --- INBOX LIST VIEW ---
  return (
    <View style={styles.listContainer}>
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>Mesajlar</Text>
        <Text style={styles.listHeaderSub}>Günübirlik İş Görüşmeleri</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.conversationsScroll}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Henüz mesajınız yok</Text>
            <Text style={styles.emptyDesc}>İş ilanlarına başvurduğunuzda burada mesajlaşabilirsiniz.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const name = item.participant?.fullName || item.participant?.companyName || item.job?.title || 'Sohbet';
          const lastMsg = item.lastMessage?.content || 'Henüz mesaj yok';
          const time = item.lastMessage?.createdAt
            ? new Date(item.lastMessage.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              })
            : '';

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSelectConversation(item)}
              style={styles.conversationCard}
            >
              <Avatar name={name} size={46} />
              <View style={styles.cardCenter}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {name}
                  </Text>
                  {time ? <Text style={styles.cardTime}>{time}</Text> : null}
                </View>
                {item.job && (
                  <Text style={styles.cardListing} numberOfLines={1}>
                    {item.job.title}
                  </Text>
                )}
                <Text style={styles.cardLastMsg} numberOfLines={1}>
                  {lastMsg}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#F6F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#F6F5F2',
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#F6F5F2',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E0D8',
  },
  listHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0C0E0D',
    letterSpacing: -0.5,
  },
  listHeaderSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#656D67',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  conversationsScroll: {
    padding: 16,
    gap: 10,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E0D8',
    marginBottom: 8,
  },
  cardCenter: {
    flex: 1,
    marginLeft: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C0E0D',
    flex: 1,
    marginRight: 6,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8C928E',
  },
  cardListing: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D6847',
    marginTop: 2,
  },
  cardLastMsg: {
    fontSize: 13,
    color: '#656D67',
    marginTop: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0C0E0D',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#656D67',
    textAlign: 'center',
    lineHeight: 18,
  },
  threadContainer: {
    flex: 1,
    backgroundColor: '#F6F5F2',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E0D8',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C0E0D',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D6847',
    marginTop: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  messageRow: {
    marginVertical: 3,
    flexDirection: 'row',
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: '#0D6847',
    borderBottomRightRadius: 3,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderBottomLeftRadius: 3,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  myText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#0C0E0D',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherTime: {
    color: '#8C928E',
  },
  typingContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBE9E1',
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  typingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#656D67',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0D6847',
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E0D8',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F6F5F2',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0C0E0D',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#0D6847',
  },
  sendButtonDisabled: {
    backgroundColor: '#C5C9C6',
  },
});

export default MessagesScreen;
