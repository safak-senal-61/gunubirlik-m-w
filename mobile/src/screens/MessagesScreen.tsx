import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ScrollView,
  Pressable,
  Animated,
  Linking,
  Alert,
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
import {
  ArrowLeftIcon,
  SendIcon,
  VerifiedCheckIcon,
  SearchIcon,
  DoubleCheckIcon,
  PhoneIcon,
  PaperclipIcon,
  MapPinIcon,
  BriefcaseIcon,
  ClockIcon,
} from '../components/icons';

interface MessagesScreenProps {
  initialConversationId?: string | null;
  openConversationId?: string | null;
  onOpenConversationHandled?: () => void;
  onSelectConversation?: (id: string | null) => void;
  onActiveThreadChange?: (isActive: boolean) => void;
  refreshKey?: number;
}

const QUICK_ACTIONS = [
  { label: '📍 Konum Gönder', text: 'İşin yapılacağı tam konumu paylaşabilir misiniz?' },
  { label: '👍 İşi Onaylıyorum', text: 'Şartlar benim için uygundur, işi onaylıyorum.' },
  { label: '⏰ Başlangıç Saati?', text: 'İşe tam olarak saat kaçta başlanacak?' },
  { label: '💵 Ücret Detayı', text: 'Günlük yevmiye ve ödeme detaylarını teyit edebilir miyiz?' },
  { label: '📞 İletişim Numarası', text: 'Görüşmek için telefon numaranızı alabilir miyim?' },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'jobs' | 'unread'>('all');
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

  const handleSendText = async (textToSend: string) => {
    if (!textToSend.trim() || !selected || sending) return;

    const content = textToSend.trim();
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

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('İletişim', 'Kullanıcının telefon numarası profilinde gizli veya henüz eklenmemiş.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const name = c.participant?.fullName || c.participant?.companyName || c.job?.title || '';
      const jobTitle = c.job?.title || '';
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        jobTitle.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterTab === 'jobs') {
        return !!c.job;
      }
      if (filterTab === 'unread') {
        return (c.unreadCount ?? 0) > 0;
      }
      return true;
    });
  }, [conversations, searchQuery, filterTab]);

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>
            {typingUsers.map((u) => u.name || u.userName || 'Biri').join(', ')} yazıyor…
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
        <Text style={styles.loadingText}>Sohbetler yükleniyor…</Text>
      </View>
    );
  }

  // --- CONVERSATION CHAT VIEW ---
  if (selected) {
    const displayName =
      selected.participant?.fullName || selected.participant?.companyName || selected.job?.title || 'Sohbet';
    const isVerified = (selected.participant as any)?.isVerified;
    const phone = (selected.participant as any)?.phone;
    const jobTitle = selected.job?.title;
    const wageAmount = (selected.job as any)?.wageAmount;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.threadContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
      >
        {/* Modern Sleek Header */}
        <View style={styles.threadHeader}>
          <TouchableOpacity
            onPress={() => handleSelectConversation(null)}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeftIcon size={20} color="#141615" strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.headerAvatarContainer}>
            <Avatar name={displayName} size={40} />
            <View style={styles.onlineBadge} />
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {displayName}
              </Text>
              {isVerified && <VerifiedCheckIcon size={15} color="#0D6847" />}
            </View>
            {jobTitle && (
              <View style={styles.headerJobPill}>
                <BriefcaseIcon size={11} color="#0D6847" />
                <Text style={styles.headerJobText} numberOfLines={1}>
                  {jobTitle} {wageAmount ? `· ₺${wageAmount.toLocaleString('tr-TR')}` : ''}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => handleCall(phone)}
            style={styles.headerActionBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <PhoneIcon size={18} color="#0D6847" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Messages Feed */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item, index }) => {
            const isMe = item.senderId === currentUserId || item.senderId === 'me';
            const prevItem = index > 0 ? messages[index - 1] : null;

            // Show date separator if day changed
            const isDifferentDay =
              !prevItem ||
              new Date(item.createdAt).toDateString() !== new Date(prevItem.createdAt).toDateString();

            const dateStr = new Date(item.createdAt).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
            });

            return (
              <View>
                {isDifferentDay && (
                  <View style={styles.dateSeparator}>
                    <View style={styles.dateLine} />
                    <View style={styles.datePill}>
                      <Text style={styles.dateText}>{dateStr}</Text>
                    </View>
                    <View style={styles.dateLine} />
                  </View>
                )}
                <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
                  <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                    <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
                      {item.content}
                    </Text>
                    <View style={styles.messageMetaRow}>
                      <Text style={[styles.messageTime, isMe ? styles.myTime : styles.otherTime]}>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      {isMe && <DoubleCheckIcon size={13} color="rgba(255,255,255,0.7)" strokeWidth={2} />}
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
          ListFooterComponent={renderTypingIndicator}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Quick Suggestion Chips */}
        <View style={styles.quickChipsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChipsScroll}
          >
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickChip}
                onPress={() => handleSendText(action.text)}
                activeOpacity={0.75}
              >
                <Text style={styles.quickChipText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Composer Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => Alert.alert('Dosya Paylaşımı', 'Konum, görsel ve belge ekleme özelliği yakında aktifleşecek.')}
          >
            <PaperclipIcon size={19} color="#5C615E" strokeWidth={1.8} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Mesajınızı yazın…"
            placeholderTextColor="#8C928E"
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            onPress={() => handleSendText(inputText)}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <SendIcon size={16} color="#FFFFFF" strokeWidth={2.2} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // --- INBOX LIST VIEW ---
  return (
    <View style={styles.listContainer}>
      {/* Search Header */}
      <View style={styles.inboxHeader}>
        <View style={styles.inboxTitleRow}>
          <Text style={styles.inboxTitle}>Mesajlar</Text>
          <View style={styles.activeConvCountPill}>
            <Text style={styles.activeConvCountText}>{conversations.length} Sohbet</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <SearchIcon size={16} color="#717673" />
          <TextInput
            style={styles.searchInput}
            placeholder="Kişi veya iş ilanlarında ara…"
            placeholderTextColor="#8C928E"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, filterTab === 'all' && styles.filterChipActive]}
            onPress={() => setFilterTab('all')}
          >
            <Text style={[styles.filterChipText, filterTab === 'all' && styles.filterChipTextActive]}>
              Tümü
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterTab === 'jobs' && styles.filterChipActive]}
            onPress={() => setFilterTab('jobs')}
          >
            <Text style={[styles.filterChipText, filterTab === 'jobs' && styles.filterChipTextActive]}>
              İş Görüşmeleri
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filterTab === 'unread' && styles.filterChipActive]}
            onPress={() => setFilterTab('unread')}
          >
            <Text style={[styles.filterChipText, filterTab === 'unread' && styles.filterChipTextActive]}>
              Okunmamış
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.conversationsScroll}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <SearchIcon size={24} color="#0D6847" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Aramayla eşleşen sohbet bulunamadı' : 'Henüz mesajınız yok'}
            </Text>
            <Text style={styles.emptyDesc}>
              {searchQuery
                ? 'Farklı bir arama kelimesi deneyebilir veya filtreyi temizleyebilirsiniz.'
                : 'İş ilanlarına başvurduğunuzda veya ilan verdiğinizde burada mesajlaşabilirsiniz.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const name = item.participant?.fullName || item.participant?.companyName || item.job?.title || 'Sohbet';
          const isVerified = (item.participant as any)?.isVerified;
          const lastMsg = item.lastMessage?.content || 'Henüz mesaj yok';
          const unreadCount = item.unreadCount ?? 0;
          const time = item.lastMessage?.createdAt
            ? new Date(item.lastMessage.createdAt).toLocaleDateString('tr-TR', {
                month: 'short',
                day: 'numeric',
              })
            : '';

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectConversation(item)}
              style={styles.conversationCard}
            >
              <View style={styles.cardAvatarContainer}>
                <Avatar name={name} size={48} />
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.cardCenter}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardNameRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {name}
                    </Text>
                    {isVerified && <VerifiedCheckIcon size={14} color="#0D6847" />}
                  </View>
                  {time ? <Text style={styles.cardTime}>{time}</Text> : null}
                </View>

                {item.job && (
                  <View style={styles.cardJobBadge}>
                    <BriefcaseIcon size={10} color="#0D6847" />
                    <Text style={styles.cardJobTitle} numberOfLines={1}>
                      {item.job.title}
                    </Text>
                  </View>
                )}

                <View style={styles.cardBottomRow}>
                  <Text style={styles.cardLastMsg} numberOfLines={1}>
                    {lastMsg}
                  </Text>
                  {unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
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
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#5C615E',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#F6F5F2',
  },
  inboxHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#F6F5F2',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6DF',
    gap: 10,
  },
  inboxTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inboxTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
    color: '#141615',
    letterSpacing: -0.4,
  },
  activeConvCountPill: {
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C5DDD0',
  },
  activeConvCountText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#141615',
    height: '100%',
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  filterChipActive: {
    backgroundColor: '#0D6847',
    borderColor: '#0D6847',
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: '#5C615E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  conversationsScroll: {
    paddingVertical: 6,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardAvatarContainer: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cardCenter: {
    flex: 1,
    gap: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
    letterSpacing: -0.2,
  },
  cardTime: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#717673',
  },
  cardJobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardJobTitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: '#0D6847',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardLastMsg: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#5C615E',
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0D6847',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 8,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAF3EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#5C615E',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Thread Chat View Styles
  threadContainer: {
    flex: 1,
    backgroundColor: '#F6F5F2',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6DF',
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F5F2',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
    letterSpacing: -0.2,
  },
  headerJobPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  headerJobText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: '#0D6847',
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EAF3EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C5DDD0',
  },

  messagesList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E0D8',
  },
  datePill: {
    backgroundColor: '#EAE8E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dateText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: '#5C615E',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#0D6847',
    borderBottomRightRadius: 4,
    shadowColor: '#0D6847',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8E6DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 20,
  },
  myText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#141615',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  myTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherTime: {
    color: '#717673',
  },

  quickChipsWrapper: {
    backgroundColor: '#F6F5F2',
    borderTopWidth: 1,
    borderTopColor: '#EAE8E2',
    paddingVertical: 6,
  },
  quickChipsScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  quickChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: '#0D6847',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8E6DF',
    gap: 8,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F6F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F6F5F2',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 90,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#141615',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#0D6847',
  },
  sendButtonDisabled: {
    backgroundColor: '#C5DDD0',
  },

  typingContainer: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EAE8E2',
  },
  typingText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#717673',
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
});

export default MessagesScreen;
