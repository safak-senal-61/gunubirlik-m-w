import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiAuth } from "@/hooks/use-api-auth";
import {
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/api";
import type { ApiConversation, ApiMessage } from "@/lib/api-types";
import { timeAgo } from "@/lib/format";
import { ArrowLeft, MessagesSquare, SendHorizonal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function Messages() {
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApiConversation | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchConversations();
      setConversations(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konuşmalar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const handleSelect = (conv: ApiConversation) => {
    setSelected(conv);
    if (conv.unreadCount > 0) {
      markConversationRead(conv.id).then(load);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Mesajlar</h1>
        <p className="text-sm text-muted-foreground">
          İşverenler ve işçilerle mesajlaş; detayları konuş.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MessagesSquare className="size-5" />
            </div>
            <p className="text-base font-semibold">Henüz mesajın yok</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Bir ilana başvurduğunda ya da başvuru aldığında konuşmalar burada başlar.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: list or thread */}
            <div className="mt-6 grid gap-4 md:hidden">
              {selected ? (
                <ThreadView conversation={selected} onBack={() => setSelected(null)} onChanged={load} />
              ) : (
                conversations.map((conv) => (
                  <ConversationRow key={conv.id} conv={conv} onClick={() => handleSelect(conv)} />
                ))
              )}
            </div>

            {/* Desktop: split view */}
            <div className="mt-6 hidden gap-4 md:grid md:grid-cols-[320px_1fr]">
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    active={selected?.id === conv.id}
                    onClick={() => handleSelect(conv)}
                  />
                ))}
              </div>
              <div>
                {selected ? (
                  <ThreadView conversation={selected} onBack={() => setSelected(null)} onChanged={load} />
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
                    Bir konuşma seç
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ConversationRow({
  conv,
  active,
  onClick,
}: {
  conv: ApiConversation;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-card p-4 text-left shadow-soft"
          : "flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-soft transition-all hover:border-primary/40"
      }
    >
      <Avatar className="size-11 border border-border/70">
        {conv.participant.avatarUrl && <AvatarImage src={conv.participant.avatarUrl} />}
        <AvatarFallback className="bg-accent text-sm font-bold text-accent-foreground">
          {conv.participant.fullName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold">
            {conv.participant.companyName ?? conv.participant.fullName}
          </p>
          {conv.lastMessage && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {timeAgo(conv.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {conv.lastMessage?.content ?? "Henüz mesaj yok"}
        </p>
        {conv.job && (
          <p className="mt-0.5 truncate text-[11px] text-primary">
            📋 {conv.job.title}
          </p>
        )}
      </div>
      {conv.unreadCount > 0 && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
          {conv.unreadCount}
        </span>
      )}
    </button>
  );
}

function ThreadView({
  conversation,
  onBack,
  onChanged,
}: {
  conversation: ApiConversation;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { user } = useApiAuth();
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchMessages(conversation.id);
      setMessages(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mesajlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mesaj gönderilemedi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border border-border/70 bg-card shadow-soft">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 p-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Avatar className="size-9 border border-border/70">
          {conversation.participant.avatarUrl && (
            <AvatarImage src={conversation.participant.avatarUrl} />
          )}
          <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">
            {conversation.participant.fullName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            {conversation.participant.companyName ?? conversation.participant.fullName}
          </p>
          {conversation.job && (
            <p className="truncate text-xs text-muted-foreground">{conversation.job.title}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            İlk mesajı sen yaz 👋
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    mine
                      ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                      : "max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm text-foreground"
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={mine ? "mt-1 text-right text-[10px] text-primary-foreground/70" : "mt-1 text-[10px] text-muted-foreground"}>
                    {new Date(msg.createdAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="flex gap-2 border-t border-border/60 p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Mesaj yaz…"
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
