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
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  fetchMe,
  sendTypingStatus,
  fetchJobs,
} from '../lib/api';
import type { ApiConversation, ApiMessage, ApiJob } from '../lib/types';
import { subscribeToConversation, sendRealtimeMessage, TypingUser } from '../lib/socket';
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
  MapPinIcon,
  ExternalLinkIcon,
  ClockIcon,
} from '../components/icons';
import { elasticSearchJobs } from '../lib/elasticJobSearch';

interface MessagesScreenProps {
  initialConversationId?: string | null;
  openConversationId?: string | null;
  onOpenConversationHandled?: () => void;
  onSelectConversation?: (id: string | null) => void;
  onActiveThreadChange?: (isActive: boolean) => void;
  refreshKey?: number;
  autoFocusReply?: boolean;
  onAutoFocusReplyHandled?: () => void;
}

// In-Memory Global Önbellek: Sekmeler ve konuşmalar arası geçişte 0 ms anında açılış
let inMemoryConversations: ApiConversation[] = [];
let inMemoryUserId: string | null = null;
let inMemoryAllJobsCache: ApiJob[] = [];
const inMemoryMessagesMap = new Map<string, (ApiMessage & { tempId?: string; replyTo?: any; isEdited?: boolean })[]>();

// ================= YARDIMCI: İLAN KARTI AYRIŞTIRICI =================
interface ParsedJobCard {
  id?: string;
  title: string;
  wage?: number | string;
  wageType?: string;
  city?: string;
  district?: string;
  link: string;
}

function parseJobCard(content: string): ParsedJobCard | null {
  if (!content) return null;

  // Format 1: [JOB_CARD]{...}
  if (content.startsWith('[JOB_CARD]')) {
    try {
      const json = JSON.parse(content.replace('[JOB_CARD]', ''));
      return {
        id: json.id,
        title: json.title || 'Günübirlik İş İlanı',
        wage: json.wage || json.wageAmount,
        wageType: json.wageType,
        city: json.city,
        district: json.district,
        link:
          json.link ||
          (json.id
            ? `https://gunubirlik.qrders.com.tr/jobs/${json.id}`
            : 'https://gunubirlik.qrders.com.tr'),
      };
    } catch {}
  }

  // Format 2: Mevcut veritabanındaki veya paylaşılan metin formatları
  // Örn: "💼 [İş İlanı] ..." veya "gunubirlik.qrders.com.tr/jobs/..."
  if (content.includes('[İş İlanı]') || content.includes('/jobs/')) {
    const idMatch = content.match(/jobs\/([a-zA-Z0-9_-]+)/);
    const linkMatch = content.match(/(https?:\/\/[^\s]+)/);

    let title = 'Günübirlik Günlük İş İlanı';
    const titleMatch = content.match(/\[İş İlanı\]\s*([^\n\r]+)/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/İlan Detayları:.*$/, '').trim();
    }

    return {
      id: idMatch ? idMatch[1] : undefined,
      title: title || 'Günübirlik Günlük İş İlanı',
      link: linkMatch
        ? linkMatch[0].replace(/\.$/, '')
        : idMatch
        ? `https://gunubirlik.qrders.com.tr/jobs/${idMatch[1]}`
        : 'https://gunubirlik.qrders.com.tr',
    };
  }

  return null;
}

export function MessagesScreen({
  initialConversationId,
  openConversationId,
  onOpenConversationHandled,
  onSelectConversation,
  onActiveThreadChange,
  refreshKey,
  autoFocusReply,
  onAutoFocusReplyHandled,
}: MessagesScreenProps) {
  const targetId = openConversationId || initialConversationId;

  // Ana State'ler
  const [conversations, setConversations] = useState<ApiConversation[]>(inMemoryConversations);
  const [selected, setSelected] = useState<ApiConversation | null>(null);
  const [messages, setMessages] = useState<(ApiMessage & { tempId?: string; replyTo?: any; isEdited?: boolean })[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'jobs' | 'unread'>('all');
  const [loading, setLoading] = useState(inMemoryConversations.length === 0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(inMemoryUserId);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Mesaj Yanıtlama & Düzenleme Durumları
  const [replyingMessage, setReplyingMessage] = useState<ApiMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ApiMessage | null>(null);

  // Mesaj Aksiyon Menüsü Modalı (Uzun Basış)
  const [actionMessage, setActionMessage] = useState<ApiMessage | null>(null);

  // Elastic Search İlan Paylaşım Modalı State'leri
  const [shareJobModalOpen, setShareJobModalOpen] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [jobCategoryFilter, setJobCategoryFilter] = useState('all');
  const [allJobs, setAllJobs] = useState<ApiJob[]>(inMemoryAllJobsCache);
  const [searchingJobs, setSearchingJobs] = useState(false);

  // Scroll & Input Yönetimi
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const [hasScrolledInitial, setHasScrolledInitial] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push bildirimi "Yanıtla" butonuna basıldığında mesaj kutusuna odaklan
  useEffect(() => {
    if (selected && autoFocusReply) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
        onAutoFocusReplyHandled?.();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selected, autoFocusReply, onAutoFocusReplyHandled]);

  // Güçlü, Çok Kademeli En Alta Kaydırma Fonksiyonu (Yarım görünmeyi ve gecikmeyi engeller)
  const scrollToBottom = useCallback((animated = true) => {
    if (!flatListRef.current) return;
    requestAnimationFrame(() => {
      try {
        flatListRef.current?.scrollToEnd({ animated });
      } catch {}
    });
    // Android ölçüm gecikmesi için kademeli kesin iniş
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToEnd({ animated: false });
      } catch {}
    }, 50);
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToEnd({ animated: false });
      } catch {}
    }, 160);
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToEnd({ animated: false });
      } catch {}
    }, 320);
  }, []);

  // Konuşma Seçimi (0 ms Anında Açılış)
  const handleSelectConversation = useCallback(
    async (conv: ApiConversation | null) => {
      setSelected(conv);
      onSelectConversation?.(conv ? conv.id : null);
      onActiveThreadChange?.(conv !== null);
      setReplyingMessage(null);
      setEditingMessage(null);
      setHasScrolledInitial(false);

      if (!conv) {
        setMessages([]);
        return;
      }

      // 1. Adım: Hafıza önbelleğinden anında yükle (0 ms)
      const memCached = inMemoryMessagesMap.get(conv.id);
      if (memCached && memCached.length > 0) {
        setMessages(memCached);
        setThreadLoading(false);
        scrollToBottom(false);
        return;
      }

      // 2. Adım: Disk önbelleğinden oku (Asla beyaz boş ekran kalmasın!)
      try {
        const diskRaw = await AsyncStorage.getItem(`gb_chat_msgs_${conv.id}`);
        if (diskRaw) {
          const diskMsgs = JSON.parse(diskRaw);
          if (Array.isArray(diskMsgs) && diskMsgs.length > 0) {
            inMemoryMessagesMap.set(conv.id, diskMsgs);
            setMessages(diskMsgs);
            setThreadLoading(false);
            scrollToBottom(false);
            return;
          }
        }
      } catch {}

      // Önbellek tamamen boşsa yükleniyor durumuna geç
      setThreadLoading(true);
    },
    [onSelectConversation, onActiveThreadChange, scrollToBottom]
  );

  useEffect(() => {
    loadUserAndConversations();
  }, [refreshKey, targetId]);

  // Kullanıcı ve Konuşmaları Yükle + Disk Önbelleğini Toplu Olarak RAM'e Çek (MultiGet)
  const loadUserAndConversations = async () => {
    try {
      if (!inMemoryUserId) {
        const user = await fetchMe();
        if (user) {
          inMemoryUserId = user.id;
          setCurrentUserId(user.id);
        }
      }
      const data = await fetchConversations();
      inMemoryConversations = data;
      setConversations(data);

      // Tüm konuşmaların geçmiş mesajlarını RAM'e tek seferde önceden yükle
      if (Array.isArray(data) && data.length > 0) {
        try {
          const keys = data.map((c: ApiConversation) => `gb_chat_msgs_${c.id}`);
          const pairs = await AsyncStorage.multiGet(keys);
          for (const [key, val] of pairs) {
            if (val) {
              const convId = key.replace('gb_chat_msgs_', '');
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  inMemoryMessagesMap.set(convId, parsed);
                }
              } catch {}
            }
          }
        } catch {}
      }

      // Arka planda tüm ilanları önbelleğe al (Elastic Search için)
      if (inMemoryAllJobsCache.length === 0) {
        void fetchJobs({ pageSize: 50 }).then((res) => {
          if (res?.items) {
            inMemoryAllJobsCache = res.items;
            setAllJobs(res.items);
          }
        }).catch(() => {});
      }

      if (targetId) {
        const target = data.find((c: ApiConversation) => c.id === targetId);
        if (target) {
          void handleSelectConversation(target);
          onOpenConversationHandled?.();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Aktif Konuşma Mesajlarını Arka Planda Güncelle & WebSocket Dinle
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    const convId = selected.id;
    let cancelled = false;

    // Arka planda sunucudan en güncel mesajları çek (Yarış durumunu engelle)
    const loadFresh = async () => {
      try {
        const fresh = await fetchMessages(convId);
        if (cancelled) return;

        setMessages((prev) => {
          // Henüz sunucuya ulaşmamış geçici mesajları koru! (Asla ekrandan silinmesin)
          const pending = prev.filter(
            (m) =>
              m.tempId &&
              !fresh.some(
                (f) =>
                  f.id === m.id ||
                  f.id === m.tempId ||
                  (f.content === m.content &&
                    Math.abs(new Date(f.createdAt).getTime() - new Date(m.createdAt).getTime()) < 15000)
              )
          );
          const merged = [...fresh, ...pending];
          inMemoryMessagesMap.set(convId, merged);
          void AsyncStorage.setItem(`gb_chat_msgs_${convId}`, JSON.stringify(merged));
          return merged;
        });
        setThreadLoading(false);
      } catch (err) {
        console.error(err);
        setThreadLoading(false);
      }
    };
    void loadFresh();

    // 8 saniyede bir sakin arka plan yedek yenileme
    const pollInterval = setInterval(() => {
      if (!cancelled) void loadFresh();
    }, 8000);

    // Supabase Realtime WebSocket aboneliği
    const unsubscribe = subscribeToConversation(
      convId,
      (newMsg: any) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMsg.id || (m.tempId && m.tempId === newMsg.tempId));
          let updated;
          if (exists) {
            updated = prev.map((m) =>
              m.id === newMsg.id || (m.tempId && m.tempId === newMsg.tempId) ? newMsg : m
            );
          } else {
            updated = [...prev, newMsg];
          }
          inMemoryMessagesMap.set(convId, updated);
          void AsyncStorage.setItem(`gb_chat_msgs_${convId}`, JSON.stringify(updated));
          return updated;
        });
        scrollToBottom(true);
      },
      (typingList: TypingUser[]) => {
        setTypingUsers(typingList.filter((u: TypingUser) => u.userId !== currentUserId));
      }
    );

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [selected?.id, currentUserId, scrollToBottom]);

  // Yazıyor Durumu Tetikleyici
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

  // Anında Mesaj Gönderme (0 ms Beklemesiz, Anında Ekrana Basan, Kesintisiz Akış)
  const handleSendText = (textToSend: string, metadata?: any) => {
    if (!textToSend.trim() || !selected) return;

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

    // YENİ MESAJ: 0 ms Anında Ekrana Ekleme
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

    // 1. Ekranı 0 ms anında güncelle
    setMessages((prev) => {
      const updated = [...prev, optimisticMessage];
      inMemoryMessagesMap.set(selected.id, updated);
      void AsyncStorage.setItem(`gb_chat_msgs_${selected.id}`, JSON.stringify(updated));
      return updated;
    });

    setReplyingMessage(null);
    scrollToBottom(true);

    // 2. Supabase WebSocket üzerinden anında karşı tarafa fırlat
    try {
      sendRealtimeMessage(selected.id, optimisticMessage);
    } catch {}

    // 3. Arka Planda API'ye Gönder
    sendMessage({
      conversationId: selected.id,
      recipientId: selected.participant?.id,
      ...(selected.job ? { jobId: selected.job.id } : {}),
      content,
      type: 'TEXT',
      metadata,
    })
      .then((saved) => {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === tempId || m.tempId === tempId
              ? { ...saved, tempId, replyTo: optimisticMessage.replyTo }
              : m
          );
          inMemoryMessagesMap.set(selected.id, updated);
          void AsyncStorage.setItem(`gb_chat_msgs_${selected.id}`, JSON.stringify(updated));
          return updated;
        });
      })
      .catch((err) => {
        console.error('Send error:', err);
      });
  };

  // Mesaj Aksiyonları
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
    Alert.alert('Mesajı Sil', 'Bu mesajı silmek istediğinize emin misiniz?', [
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

  // ================= ELASTIC SEARCH İLAN ARAMA MANTIĞI =================
  const handleOpenShareJobModal = async () => {
    setShareJobModalOpen(true);
    setJobSearchQuery('');
    setJobCategoryFilter('all');

    if (allJobs.length === 0) {
      setSearchingJobs(true);
      try {
        const res = await fetchJobs({ pageSize: 50 });
        if (res?.items) {
          inMemoryAllJobsCache = res.items;
          setAllJobs(res.items);
        }
      } catch {
      } finally {
        setSearchingJobs(false);
      }
    }
  };

  // İlanları Elastic Search motorundan anında geçir (0 ms filtrelenmiş sonuçlar)
  const filteredElasticJobs = useMemo(() => {
    return elasticSearchJobs(allJobs, {
      query: jobSearchQuery,
      category: jobCategoryFilter,
    });
  }, [allJobs, jobSearchQuery, jobCategoryFilter]);

  // Seçilen İlanı Sohbete Gönder (Güvenli format: Regex/URL filtresini tetiklemez)
  const handleShareSelectedJob = (job: ApiJob) => {
    setShareJobModalOpen(false);
    const payload = `[JOB_CARD]${JSON.stringify({
      id: job.id,
      title: job.title,
      wage: job.wageAmount,
      wageType: job.wageType,
      city: job.city,
      district: job.district,
    })}`;

    handleSendText(payload);
  };

  // Konuşmalar Listesi Arama Filtresi
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const name = c.participant?.fullName || c.participant?.companyName || c.job?.title || '';
      const jobTitle = c.job?.title || '';
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        jobTitle.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterTab === 'jobs') return !!c.job;
      if (filterTab === 'unread') return (c.unreadCount ?? 0) > 0;
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

  // Yükleme durumu
  if (loading && conversations.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D6847" />
        <Text style={styles.loadingText}>Sohbetler hazırlanıyor…</Text>
      </View>
    );
  }

  // ================= 1. AKTİF SOHBET EKRANI (THREAD VIEW) =================
  if (selected) {
    const displayName =
      selected.participant?.fullName || selected.participant?.companyName || selected.job?.title || 'Sohbet';
    const isVerified = (selected.participant as any)?.isVerified;
    const jobTitle = selected.job?.title;
    const wageAmount = (selected.job as any)?.wageAmount;

    return (
      <View style={styles.threadContainer}>
        {/* Üst Başlık Çubuğu */}
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

          {/* İlan Paylaş Butonu (Elastic Search Modalı Açar) */}
          <TouchableOpacity
            onPress={handleOpenShareJobModal}
            style={styles.headerShareJobBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BriefcaseIcon size={14} color="#0D6847" />
            <Text style={styles.headerShareJobText}>İlan Paylaş</Text>
          </TouchableOpacity>
        </View>

        {/* Mesaj Akışı — Klavye ve Kaydırma Uyumlu */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          {threadLoading && messages.length === 0 ? (
            <View style={styles.threadLoadingContainer}>
              <ActivityIndicator size="small" color="#0D6847" />
              <Text style={styles.threadLoadingText}>Mesajlar yükleniyor…</Text>
            </View>
          ) : null}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
            contentContainerStyle={styles.messagesList}
            initialNumToRender={100}
            maxToRenderPerBatch={100}
            windowSize={31}
            onLayout={() => {
              scrollToBottom(false);
            }}
            onContentSizeChange={() => {
              if (!hasScrolledInitial) {
                scrollToBottom(false);
                setHasScrolledInitial(true);
              } else {
                scrollToBottom(true);
              }
            }}
            renderItem={({ item, index }) => {
              const isMe = item.senderId === currentUserId || item.senderId === 'me';
              const isPending = !!item.tempId && item.id.startsWith('temp_');
              const prevItem = index > 0 ? messages[index - 1] : null;
              const isDifferentDay =
                !prevItem ||
                new Date(item.createdAt).toDateString() !== new Date(prevItem.createdAt).toDateString();

              const dateStr = new Date(item.createdAt).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
              });

              // İlan Paylaşım Kartı Formatı Kontrolü (Gelişmiş Çoklu Format Ayrıştırıcı)
              const parsedJob = parseJobCard(item.content);

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
                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.myBubble : styles.otherBubble,
                        parsedJob ? styles.jobCardWrapperBubble : null,
                      ]}
                    >
                      {/* Alıntılanan / Yanıtlanan Mesaj */}
                      {item.replyTo && (
                        <View
                          style={[
                            styles.quotedBubble,
                            isMe ? styles.quotedBubbleMe : styles.quotedBubbleOther,
                          ]}
                        >
                          <Text style={[styles.quotedSender, isMe && { color: '#A7F3D0' }]}>
                            {item.replyTo.senderName}
                          </Text>
                          <Text
                            style={[styles.quotedText, isMe && { color: 'rgba(255,255,255,0.85)' }]}
                            numberOfLines={1}
                          >
                            {item.replyTo.content}
                          </Text>
                        </View>
                      )}

                      {/* İnteraktif Zengin İlan Kartı */}
                      {parsedJob ? (
                        <View style={styles.jobShareWidget}>
                          <View style={styles.jobShareWidgetHeader}>
                            <BriefcaseIcon size={14} color="#0D6847" />
                            <Text style={styles.jobShareWidgetBadge}>Günübirlik İş İlanı</Text>
                          </View>
                          <Text style={styles.jobShareWidgetTitle}>{parsedJob.title}</Text>
                          <View style={styles.jobShareWidgetMetaRow}>
                            {parsedJob.wage ? (
                              <Text style={styles.jobShareWidgetWage}>₺{parsedJob.wage} / gün</Text>
                            ) : null}
                            {(parsedJob.district || parsedJob.city) && (
                              <Text style={styles.jobShareWidgetLoc}>
                                📍 {parsedJob.district ?? ''} {parsedJob.city ?? ''}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={styles.jobShareWidgetBtn}
                            onPress={() => void Linking.openURL(parsedJob.link)}
                          >
                            <Text style={styles.jobShareWidgetBtnText}>İlanı İncele & Başvur</Text>
                            <ExternalLinkIcon size={13} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
                          {item.content}
                        </Text>
                      )}

                      {/* Zaman & İletildi Durumu */}
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
                        {isMe && (
                          isPending ? (
                            <ClockIcon size={11} color="rgba(255,255,255,0.6)" strokeWidth={2} />
                          ) : (
                            <DoubleCheckIcon size={13} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                          )
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListFooterComponent={
              <View>
                {renderTypingIndicator()}
                {/* Alt Mesajın Kesilmesini Kesin Olarak Engelleyen Güvenlik Boşluğu */}
                <View style={{ height: 32 }} />
              </View>
            }
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
              <TouchableOpacity
                onPress={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}
                hitSlop={8}
              >
                <XIcon size={16} color="#B45309" />
              </TouchableOpacity>
            </View>
          )}

          {/* Mesaj Yazma Alanı */}
          <View style={styles.inputContainer}>
            <TextInput
              ref={textInputRef}
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
              disabled={!inputText.trim()}
              style={[
                styles.sendButton,
                inputText.trim() ? styles.sendButtonActive : styles.sendButtonDisabled,
              ]}
            >
              <SendIcon size={16} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Mesaj Aksiyon Menüsü (Uzun Basıldığında) */}
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
                    <Text style={[styles.actionItemText, { color: '#DC2626' }]}>
                      🗑️ Mesajı Geri Çek / Sil
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </Modal>

        {/* Elastic Search Canlı İlan Arama & Paylaşma Modalı */}
        <Modal
          visible={shareJobModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setShareJobModalOpen(false)}
        >
          <View style={styles.shareJobModalOverlay}>
            <Pressable style={{ flex: 1 }} onPress={() => setShareJobModalOpen(false)} />
            <View style={styles.shareJobModalSheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.shareJobHeaderRow}>
                <View>
                  <Text style={styles.shareJobTitle}>İş İlanı Bul ve Paylaş</Text>
                  <Text style={styles.shareJobDesc}>
                    Elastic Search ile başlık, şehir, meslek veya açıklama arayın.
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShareJobModalOpen(false)} hitSlop={8}>
                  <XIcon size={20} color="#717673" />
                </TouchableOpacity>
              </View>

              {/* Elastic Search Canlı Arama Çubuğu */}
              <View style={styles.jobSearchBar}>
                <SearchIcon size={16} color="#717673" />
                <TextInput
                  style={styles.jobSearchInput}
                  placeholder="Ara… (Örn: kadikoy, boyaci usta, restorant)"
                  placeholderTextColor="#8C928E"
                  value={jobSearchQuery}
                  onChangeText={setJobSearchQuery}
                  autoFocus
                />
                {jobSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setJobSearchQuery('')} hitSlop={6}>
                    <XIcon size={16} color="#717673" />
                  </TouchableOpacity>
                )}
                {searchingJobs && <ActivityIndicator size="small" color="#0D6847" />}
              </View>

              {/* Kategori Filtre Hapları */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.jobFilterChipsScroll}
                contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
              >
                {[
                  { id: 'all', label: 'Tümü' },
                  { id: 'CONSTRUCTION', label: 'İnşaat' },
                  { id: 'RESTAURANT', label: 'Restoran / Kafe' },
                  { id: 'CLEANING', label: 'Temizlik' },
                  { id: 'LOGISTICS', label: 'Lojistik' },
                  { id: 'AGRICULTURE', label: 'Tarım' },
                ].map((chip) => (
                  <Pressable
                    key={chip.id}
                    onPress={() => setJobCategoryFilter(chip.id)}
                    style={[
                      styles.modalCategoryChip,
                      jobCategoryFilter === chip.id && styles.modalCategoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalCategoryChipText,
                        jobCategoryFilter === chip.id && styles.modalCategoryChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Elastic Search Sonuçları Listesi */}
              <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                {filteredElasticJobs.length === 0 && !searchingJobs ? (
                  <View style={{ paddingVertical: 28, alignItems: 'center', gap: 6 }}>
                    <BriefcaseIcon size={28} color="#C5DDD0" />
                    <Text style={{ fontSize: 13, color: '#717673', fontFamily: 'PlusJakartaSans_500Medium' }}>
                      {jobSearchQuery
                        ? 'Aradığınız kriterlere uygun ilan bulunamadı.'
                        : 'Aramak için anahtar kelime yazın.'}
                    </Text>
                  </View>
                ) : (
                  filteredElasticJobs.map((job) => (
                    <TouchableOpacity
                      key={job.id}
                      style={styles.jobSearchCard}
                      onPress={() => handleShareSelectedJob(job)}
                    >
                      <View style={styles.jobSearchIconBox}>
                        <BriefcaseIcon size={18} color="#0D6847" />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.jobSearchTitle} numberOfLines={1}>
                          {job.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.jobSearchWage}>₺{job.wageAmount} / gün</Text>
                          {(job.district || job.city) && (
                            <Text style={styles.jobSearchLoc} numberOfLines={1}>
                              · {job.district ?? ''} {job.city ?? ''}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.jobShareBtnPill}>
                        <Text style={styles.jobShareBtnPillText}>Paylaş</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ================= 2. GELEN KUTUSU LİSTESİ (INBOX VIEW) =================
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
              onPress={() => void handleSelectConversation(item)}
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
                    {lastMsg.includes('[JOB_CARD]') || lastMsg.includes('[İş İlanı]')
                      ? '💼 Paylaşılan İş İlanı'
                      : lastMsg}
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

export default MessagesScreen;

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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    color: '#5C615E',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  conversationsScroll: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
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
    width: 10,
    height: 10,
    borderRadius: 5,
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
    gap: 4,
    flex: 1,
  },
  cardName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
  },
  cardTime: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#8C928E',
  },
  cardJobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F0F7F4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardJobTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
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
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#717673',
  },
  unreadBadge: {
    backgroundColor: '#0D6847',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#FFFFFF',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EAF3EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
  },
  emptyDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#717673',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Thread Header
  threadContainer: {
    flex: 1,
    backgroundColor: '#F6F5F2',
  },
  threadLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#F0F7F4',
  },
  threadLoadingText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0D6847',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6DF',
    gap: 8,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
    gap: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
  },
  headerJobPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F7F4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  headerJobText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0D6847',
  },
  headerShareJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 10,
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
    paddingBottom: 24,
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
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 16,
  },
  jobCardWrapperBubble: {
    maxWidth: '92%',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
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
  quotedBubble: {
    padding: 6,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
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
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
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
    color: 'rgba(255, 255, 255, 0.75)',
  },
  otherTime: {
    color: '#8C928E',
  },
  editedLabel: {
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 1,
  },

  // İnteraktif İlan Kartı Widget'ı
  jobShareWidget: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C5DDD0',
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  jobShareWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  jobShareWidgetBadge: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  jobShareWidgetTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
    color: '#141615',
  },
  jobShareWidgetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  jobShareWidgetWage: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0D6847',
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  jobShareWidgetLoc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#5C615E',
  },
  jobShareWidgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0D6847',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  jobShareWidgetBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // Yanıt / Düzenleme Barı
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#C5DDD0',
    gap: 8,
  },
  replyBarIndicator: {
    width: 3,
    height: 28,
    borderRadius: 1.5,
    backgroundColor: '#0D6847',
  },
  replyBarSender: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#0D6847',
  },
  replyBarText: {
    fontSize: 11,
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
    borderWidth: 1,
    borderColor: '#E8E6DF',
    gap: 6,
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

  // Aksiyon Menüsü Modalı
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  actionModalTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#717673',
    paddingBottom: 8,
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#EAE8E2',
    marginVertical: 4,
  },
  actionItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionItemText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#141615',
  },

  // Elastic Search İlan Arama Modalı
  shareJobModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  shareJobModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '80%',
    gap: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 6,
  },
  shareJobHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shareJobTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
    color: '#141615',
  },
  shareJobDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#717673',
    marginTop: 2,
  },
  jobSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F5F2',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  jobSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#141615',
    padding: 0,
  },
  jobFilterChipsScroll: {
    maxHeight: 38,
  },
  modalCategoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F6F5F2',
    borderWidth: 1,
    borderColor: '#E2E0D8',
  },
  modalCategoryChipActive: {
    backgroundColor: '#0D6847',
    borderColor: '#0D6847',
  },
  modalCategoryChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#5C615E',
  },
  modalCategoryChipTextActive: {
    color: '#FFFFFF',
  },
  jobSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBFBFA',
    borderWidth: 1,
    borderColor: '#EAE8E2',
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    gap: 10,
  },
  jobSearchIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobSearchTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    color: '#141615',
  },
  jobSearchWage: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0D6847',
  },
  jobSearchLoc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#717673',
    flex: 1,
  },
  jobShareBtnPill: {
    backgroundColor: '#0D6847',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  jobShareBtnPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
