import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import type { ApiNotification } from "@/lib/api-types";
import { timeAgo } from "@/lib/format";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, string> = {
  APPLICATION_ACCEPTED: "✅",
  APPLICATION_REJECTED: "❌",
  NEW_APPLICATION: "📥",
  NEW_MESSAGE: "💬",
  JOB_REMINDER: "⏰",
  RATING_RECEIVED: "⭐",
};

export default function Notifications() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await fetchNotifications();
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bildirimler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClick = async (n: ApiNotification) => {
    if (!n.isRead) {
      markNotificationRead(n.id).then(load);
    }
    const data = n.data ?? {};
    if (data.conversationId) {
      navigate("/messages");
    } else if (data.jobId) {
      navigate(`/jobs/${data.jobId}`);
    } else if (n.type === "NEW_APPLICATION") {
      navigate("/applications");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Bildirimler</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} okunmamış bildirimin var` : "Tüm bildirimler okundu"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="bg-card" onClick={markAll}>
              <CheckCheck className="size-4" />
              Tümünü okundu işaretle
            </Button>
          )}
        </div>

        <div className="mt-6 space-y-2.5">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-soft">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="size-5" />
              </div>
              <p className="text-base font-semibold">Bildirim yok</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Başvuru durumu, yeni mesaj ve iş hatırlatmaları burada görünür.
              </p>
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={
                  n.isRead
                    ? "group flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft transition-colors"
                    : "group flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 shadow-soft transition-colors"
                }
              >
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-base">
                    {TYPE_ICONS[n.type] ?? <Bell className="size-4 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      {n.title}
                      {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-rose-500" />}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="shrink-0 rounded-full p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  aria-label="Bildirimi sil"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
