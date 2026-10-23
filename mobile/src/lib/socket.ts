/**
 * Mobile Realtime Client - Günübirlik Expo/React Native
 * Supabase Realtime WebSocket bağlantısı
 */
import { createClient, RealtimeChannel } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dyiqfounesugdljzzebh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_irls6ujUsDGr3ImADjaKMA_pgxe-_hy";

let supabaseClient: any = null;

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }
  return supabaseClient;
}

const eventListeners = new Map<string, Set<(...args: any[]) => void>>();

function triggerEvent(event: string, ...args: any[]) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.warn(`[Mobile Realtime] Listener hatası (${event}):`, err);
      }
    });
  }
}

const conversationChannels = new Map<string, RealtimeChannel>();

export function joinConversation(conversationId: string): RealtimeChannel {
  const supabase = getSupabase();

  if (conversationChannels.has(conversationId)) {
    return conversationChannels.get(conversationId)!;
  }

  const channel = supabase.channel(`conversation:${conversationId}`, {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "*" }, ({ event, payload }: any) => {
    triggerEvent(event, payload);
  });

  channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      console.log(`[Mobile Realtime] Konuşmaya katıldı: conversation:${conversationId}`);
    }
  });

  conversationChannels.set(conversationId, channel);
  return channel;
}

export function leaveConversation(conversationId: string) {
  const ch = conversationChannels.get(conversationId);
  if (ch) {
    const supabase = getSupabase();
    supabase.removeChannel(ch);
    conversationChannels.delete(conversationId);
  }
}

export function sendRealtimeMessage(conversationId: string, data: any) {
  const ch = joinConversation(conversationId);
  ch.send({
    type: "broadcast",
    event: "message:new",
    payload: data,
  });
}

export function sendTyping(conversationId: string, userId: string, userName: string, isTyping: boolean) {
  const ch = joinConversation(conversationId);
  ch.send({
    type: "broadcast",
    event: isTyping ? "typing:start" : "typing:stop",
    payload: {
      conversationId,
      userId,
      userName,
    },
  });
}

export function onRealtimeEvent(event: string, callback: (...args: any[]) => void) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);
  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

export interface TypingUser {
  userId: string;
  userName?: string;
  name?: string;
}

export function subscribeToConversation(
  conversationId: string,
  onMessage: (msg: any) => void,
  onTyping: (typingUsers: TypingUser[]) => void
) {
  const activeTyping = new Map<string, { user: TypingUser; timer: any }>();

  joinConversation(conversationId);

  const unsubMsg = onRealtimeEvent("message:new", (payload: any) => {
    if (payload && (payload.conversationId === conversationId || !payload.conversationId)) {
      onMessage(payload);
    }
  });

  const unsubTypingStart = onRealtimeEvent("typing:start", (payload: any) => {
    if (payload?.conversationId === conversationId && payload?.userId) {
      if (activeTyping.has(payload.userId)) {
        clearTimeout(activeTyping.get(payload.userId)!.timer);
      }
      const timer = setTimeout(() => {
        activeTyping.delete(payload.userId);
        onTyping(Array.from(activeTyping.values()).map((v) => v.user));
      }, 3000);
      activeTyping.set(payload.userId, {
        user: { userId: payload.userId, userName: payload.userName, name: payload.userName },
        timer,
      });
      onTyping(Array.from(activeTyping.values()).map((v) => v.user));
    }
  });

  const unsubTypingStop = onRealtimeEvent("typing:stop", (payload: any) => {
    if (payload?.conversationId === conversationId && payload?.userId) {
      if (activeTyping.has(payload.userId)) {
        clearTimeout(activeTyping.get(payload.userId)!.timer);
        activeTyping.delete(payload.userId);
        onTyping(Array.from(activeTyping.values()).map((v) => v.user));
      }
    }
  });

  return () => {
    unsubMsg();
    unsubTypingStart();
    unsubTypingStop();
    activeTyping.forEach((v) => clearTimeout(v.timer));
    activeTyping.clear();
    leaveConversation(conversationId);
  };
}
