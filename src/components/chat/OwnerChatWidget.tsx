"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  ChevronDown,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getEffectiveOwnerChatId,
  markOwnerChatRead,
  resolveOwnerChatSenderSchedule,
  sendOwnerChatMessage,
  setOwnerChatMuted,
  subscribeOwnerChatMessages,
  subscribeOwnerChatReadState,
  type OwnerChatMessage,
  type OwnerChatReadState,
  type OwnerChatScheduleInfo,
} from "@/services/owner-chat";
import { UsersService } from "@/services/users";
import type { User } from "@/types/firestore";

type OwnerOption = {
  id: string;
  label: string;
};

function deferStateUpdate(update: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(update);
    return;
  }
  void Promise.resolve().then(update);
}

function formatMessageTime(message: OwnerChatMessage): string {
  const date = message.createdAt?.toDate?.();
  if (!date) return "";

  return new Intl.DateTimeFormat("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isPrimaryAdmin(user: User): boolean {
  return user.role === "admin" && user.eliminate === false && Boolean(user.id);
}

function compareTimestamp(
  left: OwnerChatMessage["createdAt"],
  right: OwnerChatReadState["lastReadAt"],
): number {
  const leftMs = left?.toMillis?.() ?? 0;
  const rightMs = right?.toMillis?.() ?? 0;
  return leftMs - rightMs;
}

function buildOwnerLabel(
  user: User | null,
  selectedOwnerLabel: string,
): string {
  if (!user) return "Chat";
  if (user.role === "superadmin")
    return selectedOwnerLabel || "Selecciona admin";
  return user.ownercompanie || user.fullName || user.name || "Chat del equipo";
}

export default function OwnerChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<OwnerChatMessage[]>([]);
  const [readState, setReadState] = useState<OwnerChatReadState>({
    lastReadAt: null,
    muted: false,
  });
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [error, setError] = useState("");
  const [resolvedSchedulesByMessageId, setResolvedSchedulesByMessageId] =
    useState<Record<string, OwnerChatScheduleInfo | null>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const latestMessageIdRef = useRef<string>("");
  const senderUserCacheRef = useRef<Map<string, User | null>>(new Map());

  const userOwnerId = useMemo(() => getEffectiveOwnerChatId(user), [user]);
  const isSuperAdmin = user?.role === "superadmin";
  const activeOwnerId = isSuperAdmin ? selectedOwnerId : userOwnerId;
  const currentUserId = user?.id || "";
  const activeOwnerLabel = buildOwnerLabel(
    user,
    ownerOptions.find((option) => option.id === selectedOwnerId)?.label || "",
  );
  const latestMessageKey = useMemo(() => {
    const latest = messages[messages.length - 1];
    if (!latest) return "";
    return `${latest.id}:${latest.createdAt?.toMillis?.() ?? 0}`;
  }, [messages]);

  const unreadCount = useMemo(() => {
    if (!currentUserId) return 0;
    return messages.filter(
      (message) =>
        message.senderId !== currentUserId &&
        compareTimestamp(message.createdAt, readState.lastReadAt) > 0,
    ).length;
  }, [currentUserId, messages, readState.lastReadAt]);

  const playIncomingSound = useCallback(() => {
    if (readState.muted || typeof window === "undefined") return;

    const audio = new Audio("/arrival-sound.mp3");
    audio.volume = 0.6;
    void audio.play().catch(() => {
      // Browsers can block autoplay until the user interacts with the page.
    });
  }, [readState.muted]);

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;

    let active = true;
    deferStateUpdate(() => {
      if (active) setLoadingOwners(true);
    });
    UsersService.getAllUsers()
      .then((users) => {
        if (!active) return;
        const options = users
          .filter(isPrimaryAdmin)
          .map((admin) => ({
            id: String(admin.id),
            label: admin.fullName || admin.name || String(admin.id),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "es"));
        setOwnerOptions(options);
        setSelectedOwnerId((current) => current || options[0]?.id || "");
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Error loading chat owners:", loadError);
        setError("No se pudieron cargar los admins.");
      })
      .finally(() => {
        if (active) setLoadingOwners(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isSuperAdmin]);

  useEffect(() => {
    let active = true;

    if (!activeOwnerId) {
      deferStateUpdate(() => {
        if (!active) return;
        setMessages([]);
        setResolvedSchedulesByMessageId({});
      });
      latestMessageIdRef.current = "";
      return () => {
        active = false;
      };
    }

    deferStateUpdate(() => {
      if (active) setError("");
    });
    const unsubscribe = subscribeOwnerChatMessages(
      activeOwnerId,
      (nextMessages) => {
        const latest = nextMessages[nextMessages.length - 1];
        const previousLatestId = latestMessageIdRef.current;

        setMessages(nextMessages);

        if (!latest) {
          latestMessageIdRef.current = "";
          return;
        }

        if (!previousLatestId) {
          latestMessageIdRef.current = latest.id;
          return;
        }

        if (latest.id !== previousLatestId) {
          latestMessageIdRef.current = latest.id;
          if (latest.senderId !== user?.id) {
            playIncomingSound();
          }
        }
      },
      (listenError) => {
        console.error("Error listening owner chat:", listenError);
        setError("No se pudo conectar el chat.");
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeOwnerId, playIncomingSound, user?.id]);

  useEffect(() => {
    let active = true;
    deferStateUpdate(() => {
      if (active) setResolvedSchedulesByMessageId({});
    });
    senderUserCacheRef.current.clear();
    return () => {
      active = false;
    };
  }, [activeOwnerId]);

  useEffect(() => {
    const candidates = messages.filter(
      (message) =>
        message.senderRole === "user" &&
        !message.senderScheduleManager &&
        !Object.prototype.hasOwnProperty.call(
          resolvedSchedulesByMessageId,
          message.id,
        ) &&
        Boolean(message.createdAt?.toDate?.()),
    );
    if (candidates.length === 0) return;

    let active = true;

    void Promise.all(
      candidates.map(async (message) => {
        const senderId = String(message.senderId || "").trim();
        if (!senderId) return [message.id, null] as const;

        let sender = senderUserCacheRef.current.get(senderId);
        if (!senderUserCacheRef.current.has(senderId)) {
          try {
            sender = await UsersService.getUserById(senderId);
          } catch (loadError) {
            console.warn("Error loading chat sender:", loadError);
            sender = null;
          }
          senderUserCacheRef.current.set(senderId, sender);
        }

        const messageDate = message.createdAt?.toDate?.() || new Date();
        const schedule = sender
          ? await resolveOwnerChatSenderSchedule(sender, messageDate)
          : null;
        return [message.id, schedule] as const;
      }),
    ).then((resolvedEntries) => {
      if (!active) return;
      setResolvedSchedulesByMessageId((current) => {
        const next = { ...current };
        resolvedEntries.forEach(([messageId, schedule]) => {
          next[messageId] = schedule;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [messages, resolvedSchedulesByMessageId]);

  useEffect(() => {
    if (!activeOwnerId || !user?.id) {
      let active = true;
      deferStateUpdate(() => {
        if (active) setReadState({ lastReadAt: null, muted: false });
      });
      return () => {
        active = false;
      };
    }

    const unsubscribe = subscribeOwnerChatReadState(
      activeOwnerId,
      user.id,
      setReadState,
      (listenError) => {
        console.warn("Error listening chat read state:", listenError);
      },
    );

    return () => unsubscribe();
  }, [activeOwnerId, user?.id]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  useEffect(() => {
    if (!open || !activeOwnerId || !user?.id || !latestMessageKey) return;

    const id = window.setTimeout(() => {
      void markOwnerChatRead(activeOwnerId, user).catch((markError) => {
        console.warn("Error marking chat as read:", markError);
      });
    }, 300);

    return () => window.clearTimeout(id);
  }, [activeOwnerId, latestMessageKey, open, user]);

  if (!isAuthenticated || !user) return null;

  const sendMessage = async () => {
    if (!activeOwnerId || !messageText.trim()) return;
    const textToSend = messageText;
    setMessageText("");
    setError("");

    try {
      await sendOwnerChatMessage(activeOwnerId, user, textToSend);
      await markOwnerChatRead(activeOwnerId, user);
    } catch (sendError) {
      console.error("Error sending owner chat message:", sendError);
      setMessageText(textToSend);
      setError("No se pudo enviar el mensaje.");
    }
  };

  const toggleMuted = async () => {
    if (!activeOwnerId) return;
    try {
      await setOwnerChatMuted(activeOwnerId, user, !readState.muted);
      setReadState((current) => ({ ...current, muted: !current.muted }));
    } catch (muteError) {
      console.warn("Error updating chat sound preference:", muteError);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Abrir chat"
        onClick={() => setOpen(true)}
        className="fixed bottom-44 right-5 z-[99980] flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[var(--primary)] text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[99990] pointer-events-none">
          <button
            type="button"
            aria-label="Cerrar chat"
            className="absolute inset-0 cursor-default bg-black/20 pointer-events-auto"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute bottom-5 right-5 top-5 flex w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-2xl pointer-events-auto">
            <div className="flex items-start gap-3 border-b border-[var(--input-border)] px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">
                    Chat del equipo
                  </h2>
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Beta
                  </span>
                </div>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {activeOwnerLabel}
                </p>
              </div>
              <button
                type="button"
                aria-label={readState.muted ? "Activar sonido" : "Silenciar"}
                onClick={toggleMuted}
                className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-black/10 hover:text-[var(--foreground)]"
              >
                {readState.muted ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-black/10 hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isSuperAdmin && (
              <label className="relative border-b border-[var(--input-border)] px-4 py-3">
                <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                  Admin principal
                </span>
                <select
                  value={selectedOwnerId}
                  onChange={(event) => {
                    setMessages([]);
                    latestMessageIdRef.current = "";
                    setSelectedOwnerId(event.target.value);
                  }}
                  className="w-full appearance-none rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 pr-9 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  disabled={loadingOwners}
                >
                  {ownerOptions.length === 0 ? (
                    <option value="">
                      {loadingOwners ? "Cargando..." : "Sin admins"}
                    </option>
                  ) : (
                    ownerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute bottom-5 right-7 h-4 w-4 text-[var(--muted-foreground)]" />
              </label>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!activeOwnerId && (
                <div className="rounded-md border border-[var(--input-border)] p-3 text-sm text-[var(--muted-foreground)]">
                  Selecciona un admin para ver su chat.
                </div>
              )}

              {activeOwnerId && messages.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--input-border)] p-4 text-center text-sm text-[var(--muted-foreground)]">
                  Aun no hay mensajes.
                </div>
              )}

              {messages.map((message) => {
                const mine = message.senderId === user.id;
                const scheduleInfo = message.senderScheduleManager
                  ? {
                      company: message.senderScheduleCompany || "",
                      manager: message.senderScheduleManager,
                    }
                  : resolvedSchedulesByMessageId[message.id];
                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 text-sm shadow-sm ${
                        mine
                          ? "rounded-2xl rounded-br-md bg-[var(--primary)] text-white"
                          : "rounded-2xl rounded-bl-md border border-[var(--input-border)] bg-[var(--background)] text-[var(--foreground)]"
                      }`}
                    >
                      {/* Remitente */}
                      <div
                        className={`mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold ${
                          mine
                            ? "text-white/80"
                            : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          {mine ? "Tú" : message.senderName}
                        </span>

                        {message.senderRole === "user" &&
                          scheduleInfo?.manager && (
                            <>
                              <span className="shrink-0 opacity-70">•</span>

                              <span className="min-w-0 truncate">
                                {scheduleInfo.manager}
                              </span>
                            </>
                          )}
                      </div>

                      {/* Mensaje y hora */}
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3">
                        <p className="min-w-0 whitespace-pre-wrap break-words leading-relaxed">
                          {message.text}
                        </p>

                        <span
                          className={`shrink-0 translate-y-[3px] whitespace-nowrap text-[10px] ${
                            mine
                              ? "text-white/65"
                              : "text-[var(--muted-foreground)]"
                          }`}
                        >
                          {formatMessageTime(message)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {error && (
              <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-500">
                {error}
              </div>
            )}

            {isSuperAdmin ? (
              <div className="border-t border-[var(--input-border)] px-4 py-3 text-xs text-[var(--muted-foreground)]">
                Vista solo lectura para superadmin.
              </div>
            ) : (
              <form
                className="flex gap-2 border-t border-[var(--input-border)] p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
              >
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="Escribe un mensaje"
                  disabled={!activeOwnerId}
                  className="max-h-28 min-h-10 flex-1 resize-none rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="submit"
                  aria-label="Enviar"
                  disabled={!activeOwnerId || !messageText.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
