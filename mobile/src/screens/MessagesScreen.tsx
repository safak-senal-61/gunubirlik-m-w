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
  Modal,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
  BriefcaseIcon,
  CheckIcon,
  XIcon,
  EditIcon,
  TrashIcon,
} from '../components/icons';

interface MessagesScreenProps {
  initialConversationId?: string | null;
  openConversationId?: string | null;
  onOpenConversationHandled?: () => void;
  onSelectConversation?: (id: string | null) => void;
  onActiveThreadChange?: (isActive: boolean) => void;
  refreshKey?: number;
}

// In-Memory Önbellek: Sekme değişimlerinde tam ekran "Yükleniyor..." spinner'ı çıkmaz!
let cachedConversations: ApiConversation[] = [];
let cachedUserId: string | null = null;
const cachedMessagesMap = new Map<string, (ApiMessage & { replyTo?: any; isEdited?: boolean })[]>();

export function MessagesScreen({
  initialConversationId,
  openConversationId,
  onOpenConversationHandled,
  onSelectConversation,
  onActiveThreadChange,
  refreshKey,
}: MessagesScreenProps) {
  const targetId = openConversationId || initialConversationId;

  // Başlangıçta önbellek doluysa anında göster
  const [conversations, setConversations] = useState<ApiConversation[]>(cachedConversations);
  const [selected, setSelected] = useState<ApiConversation | null>(null);
  const [messages, setMessages] = useState<(ApiMessage & { tempId?: string; replyTo?: any; isEdited?: boolean })[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'jobs' | 'unread'>('all');
  const [loading, setLoading] = useState(cachedConversations.length === 0);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(cachedUserId);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Mesaj Yanıtlama & Düzenleme Durumları
  const [replyingMessage, setReplyingMessage] = useState<ApiMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ApiMessage | null>(null);

  // Mesaj Aksiyon Menüsü Modalı (Uzun Basış)
  const [actionMessage, setActionMessage] = useState<ApiMessage | null>(null);

  // İlan Paylaşımı Modalı
  const [shareJobModalOpen, setShareJobModalOpen] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const handleSelectConversation = useCallback(
    (conv: ApiConversation | null) => {
      setSelected(conv);
      onSelectConversation?.(conv ? conv.id : null);
      onActiveThreadChange?.(conv !== null);
      setReplyingMessage(null);
      setEditingMessage(null);

      // Konuşma seçildiği an önbellekten mesajları 0 ms'de yükle
      if (conv) {
        const cached = cachedMessagesMap.get(conv.id);
        if (cached && cached.length > 0) {
          setMessages(cached);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
        }
      }
    },
    [onSelectConversation, onActiveThreadChange]
  );

  useEffect(() => {
    loadUserAndConversations();
  }, [refreshKey, targetId]);

  const loadUserAndConversations = async () => {
    try {
      if (!cachedUserId) {
        const user = await fetchMe();
        if (user) {
          cachedUserId = user.id;
          setCurrentUserId(user.id);
        }
      }
      const data = await fetchConversations();
      cachedConversations = data;
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

  // Aktif Konuşma Mesajlarını Getir & Gerçek Zamanlı Dinle
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    const convId = selected.id;

    // Arka planda sunucudan taze mesajları çek
    const loadFresh = async () => {
      try {
        const fresh = await fetchMessages(convId);
        cachedMessagesMap.set(convId, fresh);
        setMessages(fresh);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      } catch (err) {
        console.error(err);
      }
    };
    loadFresh();

    // 2.5 sn'lik akıllı yedek polling (WebSocket gecikmelerini önler)
    const pollInterval = setInterval(async () => {
      try {
        const fresh = await fetchMessages(convId);
        if (fresh.length !== (cachedMessagesMap.get(convId)?.length ?? 0)) {
          cachedMessagesMap.set(convId, fresh);
          setMessages(fresh);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
        }
      } catch {}
    }, 2500);

    // Supabase Realtime WebSocket aboneliği
    const unsubscribe = subscribeToConversation(
      convId,
      (newMsg: any) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMsg.id || (m.tempId && m.tempId === newMsg.tempId));
          let updated;
          if (exists) {
            updated = prev.map((m) => (m.id === newMsg.id || (m.tempId && m.tempId === newMsg.tempId) ? newMsg : m));
          } else {
            updated = [...prev, newMsg];
          }
          cachedMessagesMap.set(convId, updated);
          return updated;
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      },
      (typingList: TypingUser[]) => {
        setTypingUsers(typingList.filter((u: TypingUser) => u.userId !== currentUserId));
      }
    );

    return () => {
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [selected?.id, currentUserId]);

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

  // Mesaj Gönderme / Düzenleme
  const handleSendText = async (textToSend: string, metadata?: any) => {
    if (!textToSend.trim() || !selected || sending) return;

    const content = textToSend.trim();
    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTypingStatus(selected.id, false).catch(() => {});

    // DÜZENLEME MODUNDAYSA
    if (editingMessage) {
      const editTargetId = editingMessage.id;
      setMessages((prev) =>
        prev.map((m) => (m.id === editTargetId ? { ...m, content, isEdited: true } : m))
      );
      setEditingMessage(null);
      return;
    }

    // YENİ MESAJ: Hızlı İyimser Güncelleme
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ApiMessage & { tempId?: string; replyTo?: any } = {
      id: tempId,
      tempId,
      conversationId: selected.id,
      senderId: currentUserId || 'me',
      content,
      createdAt: new Date().toISOString(),
      ...(replyingMessage
        ? {
            replyTo: {
              id: replyingMessage.id,
              content: replyingMessage.content,
              senderName:
                replyingMessage.senderId === currentUserId
                  ? 'Siz'
                  : selected.participant?.fullName || 'Karşı Taraf',
            },
          }
        : {}),
    };

    setMessages((prev) => {
      const updated = [...prev, optimisticMessage];
      cachedMessagesMap.set(selected.id, updated);
      return updated;
    });

    setReplyingMessage(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);

    setSending(true);
    try {
      const saved = await sendMessage({
        conversationId: selected.id,
        recipientId: selected.participant?.id,
        content,
        type: 'TEXT',
        metadata,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId || m.tempId === tempId ? { ...saved, tempId, replyTo: optimisticMessage.replyTo } : m))
      );
    } catch (e) {
      console.error('Send error:', e);
    } finally {
      setSending(false);
    }
  };

  // Mesaj İşlemleri
  const handleActionReply = (msg: ApiMessage) => {
    setReplyingMessage(msg);
    setEditingMessage(null);
    setActionMessage(null);
  };

  const handleActionEdit = (msg: ApiMessage) => {
    setEditingMessage(msg);
    setInputText(msg.content);
    setReplyingMessage(null);
    setActionMessage(null);
  };

  const handleActionDelete = (msg: ApiMessage) => {
    setActionMessage(null);
    Alert.alert('Mesajı Sil', 'Bu mesajı konuşmadan silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        },
      },
    ]);
  };

  const handleActionCopy = async (msg: ApiMessage) => {
    setActionMessage(null);
    await Clipboard.setStringAsync(msg.content);
    Alert.alert('Kopyalandı', 'Mesaj panoya kopyalandı.');
  };

  // İlan Paylaşma
  const handleShareJobLink = (jobTitle: string, jobId?: string) => {
    setShareJobModalOpen(false);
    const link = `https://gunubirlik.qrders.com.tr/jobs/${jobId ?? selected?.job?.id ?? 'detay'}`;
    const shareText = `💼 [İş İlanı] ${jobTitle}\nİlan Detayları: ${link}`;
    handleSendText(shareText);
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

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D6847" />
        <Text style={styles.loadingText}>Sohbetler hazırlanıyor…</Text>
      </View>
    );
  }

  // ================= CONVERSATION CHAT VIEW =================
  if (selected) {
    const displayName =
      selected.participant?.fullName || selected.participant?.companyName || selected.job?.title || 'Sohbet';
    const isVerified = (selected.participant as any)?.isVerified;
    const jobTitle = selected.job?.title;
    const wageAmount = (selected.job as any)?.wageAmount;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.threadContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Modern Sade Başlık — Telefon butonu yok, sadece kişi ve ilan */}
        <View style={styles.threadHeader}>
          <TouchableOpacity
            onPress={() => handleSelectConversation(null)}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeftIcon size={20} color="#141615" strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.headerAvatarContainer}>
            <Avatar name={displayName} size={38} />
            <View style={styles.onlineBadge} />
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {displayName}
              </Text>
              {isVerified && <VerifiedCheckIcon size={14} color="#0D6847" />}
            </View>
            {jobTitle && (
              <View style={styles.headerJobPill}>
                <BriefcaseIcon size={10} color="#0D6847" />
                <Text style={styles.headerJobText} numberOfLines={1}>
                  {jobTitle} {wageAmount ? `· ₺${wageAmount.toLocaleString('tr-TR')}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* İlan Paylaş Butonu */}
          <TouchableOpacity
            onPress={() => setShareJobModalOpen(true)}
            style={styles.headerShareJobBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BriefcaseIcon size={15} color="#0D6847" />
            <Text style={styles.headerShareJobText}>İlan Paylaş</Text>
          </TouchableOpacity>
        </View>

        {/* Mesaj Akışı — paddingBottom: 28 ile son mesajın yarısı ASLA kesilmez */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item, index }) => {
            const isMe = item.senderId === currentUserId || item.senderId === 'me';
            const prevItem = index > 0 ? messages[index - 1] : null;
            const isDifferentDay =
              !prevItem ||
              new Date(item.createdAt).toDateString() !== new Date(prevItem.createdAt).toDateString();

            const dateStr = new Date(item.createdAt).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
            });

            const isJobShare = item.content.includes('[İş İlanı]');

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

                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={() => setActionMessage(item)}
                  style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}
                >
                  <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                    {/* Alıntılanan / Yanıtlanan Mesaj Başlığı */}
                    {item.replyTo && (
                      <View style={[styles.quotedBubble, isMe ? styles.quotedBubbleMe : styles.quotedBubbleOther]}>
                        <Text style={[styles.quotedSender, isMe && { color: '#A7F3D0' }]}>
                          {item.replyTo.senderName}
                        </Text>
                        <Text style={[styles.quotedText, isMe && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
                          {item.replyTo.content}
                        </Text>
                      </View>
                    )}

                    {/* İlan Paylaşım Kartı */}
                    {isJobShare ? (
                      <View style={styles.jobShareCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BriefcaseIcon size={16} color={isMe ? '#FFFFFF' : '#0D6847'} />
                          <Text style={[styles.jobShareTitle, isMe && { color: '#FFFFFF' }]}>Günübirlik İş İlanı</Text>
                        </View>
                        <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText, { marginTop: 4 }]}>
                          {item.content}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
                        {item.content}
                      </Text>
                    )}

                    <View style={styles.messageMetaRow}>
                      {item.isEdited && (
                        <Text style={[styles.editedLabel, isMe ? styles.myTime : styles.otherTime]}>
                          (düzenlendi)
                        </Text>
                      )}
                      <Text style={[styles.messageTime, isMe ? styles.myTime : styles.otherTime]}>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      {isMe && <DoubleCheckIcon size={13} color="rgba(255,255,255,0.7)" strokeWidth={2} />}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
          ListFooterComponent={renderTypingIndicator}
        />

        {/* Yanıtlama Çubuğu */}
        {replyingMessage && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarIndicator} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarSender}>
                {replyingMessage.senderId === currentUserId ? 'Kendinize yanıt veriyorsunuz' : 'Yanıtlanan Mesaj'}
              </Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyingMessage.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingMessage(null)} hitSlop={8}>
              <XIcon size={16} color="#717673" />
            </TouchableOpacity>
          </View>
        )}

        {/* Düzenleme Çubuğu */}
        {editingMessage && (
          <View style={[styles.replyBar, { backgroundColor: '#FEF3C7' }]}>
            <View style={[styles.replyBarIndicator, { backgroundColor: '#D97706' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyBarSender, { color: '#B45309' }]}>Mesajı Düzenliyorsunuz</Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {editingMessage.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setEditingMessage(null); setInputText(''); }} hitSlop={8}>
              <XIcon size={16} color="#B45309" />
            </TouchableOpacity>
          </View>
        )}

        {/* Sade Mesaj Giriş Çubuğu — Dosya/Telefon ikonu yok */}
        <View style={styles.inputContainer}>
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

        {/* Mesaj Aksiyon Modalı (Uzun Basıldığında) */}
        <Modal
          visible={!!actionMessage}
          transparent
          animationType="fade"
          onRequestClose={() => setActionMessage(null)}
        >
          <Pressable style={styles.actionModalOverlay} onPress={() => setActionMessage(null)}>
            <View style={styles.actionModalContent}>
              <Text style={styles.actionModalTitle} numberOfLines={1}>
                {actionMessage?.content}
              </Text>
              <View style={styles.actionDivider} />

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => actionMessage && handleActionReply(actionMessage)}
              >
                <Text style={styles.actionItemText}>↩️ Yanıtla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => actionMessage && handleActionCopy(actionMessage)}
              >
                <Text style={styles.actionItemText}>📋 Kopyala</Text>
              </TouchableOpacity>

              {actionMessage?.senderId === currentUserId && (
                <>
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => actionMessage && handleActionEdit(actionMessage)}
                  >
                    <Text style={styles.actionItemText}>✏️ Düzenle</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => actionMessage && handleActionDelete(actionMessage)}
                  >
                    <Text style={[styles.actionItemText, { color: '#DC2626' }]}>🗑️ Mesajı Geri Çek / Sil</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </Modal>

        {/* İlan Paylaşma Modalı */}
        <Modal
          visible={shareJobModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setShareJobModalOpen(false)}
        >
          <Pressable style={styles.actionModalOverlay} onPress={() => setShareJobModalOpen(false)}>
            <View style={styles.shareJobModalSheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.shareJobTitle}>Sohbette İlan Paylaş</Text>
              <Text style={styles.shareJobDesc}>
                Karşı tarafa incelemesi için iş ilanının bağlantısını gönderin.
              </Text>

              {selected.job ? (
                <TouchableOpacity
                  style={styles.jobPickCard}
                  onPress={() => handleShareJobLink(selected.job!.title, selected.job!.id)}
                >
                  <BriefcaseIcon size={20} color="#0D6847" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jobPickTitle}>{selected.job.title}</Text>
                    <Text style={styles.jobPickSubtitle}>Mevcut görüşülen ilan</Text>
                  </View>
                  <Text style={styles.jobPickSendBtn}>Paylaş</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.jobPickCard}
                onPress={() => handleShareJobLink('Günübirlik Günlük İş İlanları')}
              >
                <SearchIcon size={20} color="#0D6847" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobPickTitle}>Tüm Günübirlik İlanları</Text>
                  <Text style={styles.jobPickSubtitle}>gunubirlik.qrders.com.tr/jobs</Text>
                </View>
                <Text style={styles.jobPickSendBtn}>Paylaş</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ================= INBOX LIST VIEW =================
  return (
    <View style={styles.listContainer}>
      <View style={styles.inboxHeader}>
        <View style={styles.inboxTitleRow}>
          <Text style={styles.inboxTitle}>Mesajlar</Text>
          <View style={styles.activeConvCountPill}>
            <Text style={styles.activeConvCountText}>{conversations.length} Sohbet</Text>
          </View>
        </View>

        {/* Arama Çubuğu */}
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

        {/* Filtre Butonları */}
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
                <Avatar name={name} size={46} />
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE8E2',
    gap: 12,
  },
  cardAvatarContainer: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
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
  headerShareJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5DDD0',
  },
  headerShareJobText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
  },

  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28, // Alt mesajın kesilmesini önleyen geniş boşluk
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
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8E6DF',
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
  editedLabel: {
    fontSize: 9,
    fontStyle: 'italic',
  },

  // Alıntılanan Mesaj
  quotedBubble: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  quotedBubbleMe: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderLeftColor: '#A7F3D0',
  },
  quotedBubbleOther: {
    backgroundColor: '#F6F5F2',
    borderLeftColor: '#0D6847',
  },
  quotedSender: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
  },
  quotedText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#5C615E',
    marginTop: 1,
  },

  // İlan Paylaşım Kartı
  jobShareCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  jobShareTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
  },

  // Yanıt / Düzenleme Barı
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#EAF3EE',
    borderTopWidth: 1,
    borderTopColor: '#C5DDD0',
    gap: 10,
  },
  replyBarIndicator: {
    width: 3,
    height: '100%',
    backgroundColor: '#0D6847',
    borderRadius: 2,
  },
  replyBarSender: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
  },
  replyBarText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#5C615E',
  },

  // Input Container
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

  // Aksiyon Modalı (Uzun Basış)
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actionModalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  actionModalTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#717673',
    paddingHorizontal: 4,
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#EAE8E2',
  },
  actionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionItemText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#141615',
  },

  // İlan Paylaş Modalı Sheet
  shareJobModalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 4,
  },
  shareJobTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
    color: '#141615',
  },
  shareJobDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#5C615E',
    lineHeight: 18,
  },
  jobPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F5F2',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  jobPickTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
  },
  jobPickSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#717673',
    marginTop: 2,
  },
  jobPickSendBtn: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C5DDD0',
  },
});

export default MessagesScreen;
