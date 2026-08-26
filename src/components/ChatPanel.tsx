import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Send,
  Mic,
  Sparkles,
  Search,
  Paperclip,
  X,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Zap,
  Scale,
  Telescope,
  Heart,
  Download,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  type ChatMessage,
  type Conversation,
  loadActiveId,
  loadConversations,
  newConversation,
  saveActiveId,
  saveConversations,
} from "@/lib/conversations";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { API_BASE_URL, API_KEY } from "@/config/api";
import { parseReminderIntent } from "@/lib/parseReminder";
import { store } from "@/lib/productivity";

interface ChatPanelProps {
  onAikoSpeak?: (text: string) => void;
  registerActions?: (a: ChatActions) => void;
  language: string;
}

export interface ChatActions {
  newConversation: () => void;
  clearActive: () => void;
  focus: () => void;
  runQuickSearch: () => void;
  runDeepSearch: () => void;
  summarizeMemory: () => void;
  takeScreenshot: () => void;
  toggleVoice: () => void;
}

interface BackendChatResponse {
  success: boolean;
  message_id?: string;
  response?: string;
  conversation_id?: string;
  timestamp?: number;
  tool_calls?: unknown[];
  error?: string;
}

interface AttachmentItem {
  name: string;
  kind: "image" | "file";
  dataUrl?: string;
  path?: string;
}

const QUICK_REPLIES = [
  { label: "Algo lindo", text: "Cuéntame algo lindo, Aiko~" },
  { label: "Noticias tech", text: "Búsqueda profunda: últimas noticias tech" },
  { label: "Mi memoria", text: "Resume mi memoria" },
  { label: "Organizar el día", text: "Ayúdame a organizar mi día" },
  { label: "Guía PDF", text: "Crea un pdf con una guía de dieta saludable" },
];

const LANG_MAP: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  ja: "ja-JP",
};

function makeTitle(text: string): string {
  let t = text
    .replace(/\s+/g, " ")
    .replace(/^crea(r)? un (pdf|word|excel|archivo)\s*(con|de|sobre)?\s*/i, "")
    .trim();
  if (!t) return "Nueva conversación";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length > 42) t = t.slice(0, 42).trimEnd() + "…";
  return t;
}

function formatWhen(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Hoy";
  if (sameDay(d, yesterday)) return "Ayer";
  return d.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function filenameFromUrl(url: string, fallback = "documento.pdf"): string {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split("/").pop() || fallback);
    return last.split("?")[0] || fallback;
  } catch {
    const last = url.split("/").pop() || fallback;
    return last.split("?")[0] || fallback;
  }
}

function withDownloadName(url: string, fallback = "documento.pdf"): string {
  const name = filenameFromUrl(url, fallback);
  try {
    const u = new URL(url);
    u.searchParams.delete("");
    u.searchParams.set("download", name);
    return u.toString();
  } catch {
    const clean = url.replace(/\?+$/, "");
    const sep = clean.includes("?") ? "&" : "?";
    return `${clean}${sep}download=${encodeURIComponent(name)}`;
  }
}

function extractDocLinks(text: string): { url: string; label: string }[] {
  const links: { url: string; label: string }[] = [];
  const re = /(https?:\/\/[^\s<>"']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1].replace(/[),.;]+$/, "");
    const lower = raw.toLowerCase();
    if (
      lower.includes("supabase.co") ||
      lower.endsWith(".pdf") ||
      lower.includes("/storage/") ||
      lower.includes(".docx") ||
      lower.includes(".xlsx")
    ) {
      const label = filenameFromUrl(raw);
      links.push({
        url: withDownloadName(raw, label),
        label: label.length > 36 ? `${label.slice(0, 36)}…` : label,
      });
    }
  }
  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

export function ChatPanel({
  onAikoSpeak,
  registerActions,
  language,
}: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [analysisLevel, setAnalysisLevel] = useState<
    "fast" | "balanced" | "deep"
  >("balanced");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendTextRef = useRef<(text: string) => void>(() => {});

  const stt = useSpeechRecognition({
    lang: LANG_MAP[language] ?? "es-ES",
    continuous: false,
    onFinal: (text) => {
      const t = text.trim();
      if (!t) return;
      sendTextRef.current(t);
    },
  });

  useEffect(() => {
    let list = loadConversations();
    if (list.length === 0) {
      const c = newConversation();
      c.messages = [
        {
          id: crypto.randomUUID(),
          role: "aiko",
          text: "¡Hola Ale! Estoy lista para charlar contigo 💕\n\nPrueba enviándome un mensaje, usa el micrófono o elige una sugerencia.",
          at: Date.now(),
        },
      ];
      c.title = "Bienvenida";
      list = [c];
      saveConversations(list);
    } else {
      list = list.map((c) => {
        if (
          (!c.title || c.title === "Nueva conversación") &&
          c.messages?.length
        ) {
          const firstUser = c.messages.find((m) => m.role === "user");
          if (firstUser?.text) return { ...c, title: makeTitle(firstUser.text) };
        }
        return c;
      });
      saveConversations(list);
    }
    setConversations(list);
    const prev = loadActiveId();
    setActiveId(prev && list.find((c) => c.id === prev) ? prev : list[0].id);
    setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    if (conversations.length) saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (activeId) saveActiveId(activeId);
  }, [activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) setTimeout(() => (el.scrollTop = el.scrollHeight), 0);
  }, [active?.messages, typing]);

  const updateActive = useCallback(
    (updater: (c: Conversation) => Conversation) => {
      setConversations((list) =>
        list.map((c) =>
          c.id === activeId ? updater({ ...c, updatedAt: Date.now() }) : c,
        ),
      );
    },
    [activeId],
  );

  const createNew = useCallback(() => {
    const c = newConversation();
    c.title = "Nueva conversación";
    setConversations((list) => [c, ...list]);
    setActiveId(c.id);
    setInput("");
    setAttachments([]);
    setError(null);
    setHistoryOpen(false);
    setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  const clearActive = useCallback(() => {
    updateActive((c) => ({
      ...c,
      messages: [],
      title: "Nueva conversación",
    }));
  }, [updateActive]);

  const uploadFile = useCallback(async (file: File): Promise<AttachmentItem> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      headers: { "X-API-Key": API_KEY },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Error al subir (${res.status}): ${text || res.statusText}`,
      );
    }
    const data = await res.json();
    if (!data?.path) throw new Error("El backend no devolvió path del archivo");

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

    return {
      name: file.name,
      kind:
        data.kind === "image" || file.type.startsWith("image/")
          ? "image"
          : "file",
      path: data.path as string,
      dataUrl,
    };
  }, []);

  const onPickFiles = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.currentTarget.files || []);
      e.currentTarget.value = "";
      if (!files.length) return;
      setError(null);
      setUploading(true);
      try {
        for (const file of files) {
          const item = await uploadFile(file);
          setAttachments((prev) => [...prev, item]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo subir el archivo",
        );
      } finally {
        setUploading(false);
      }
    },
    [uploadFile],
  );

  const tryCreateReminder = useCallback((text: string) => {
    const intent = parseReminderIntent(text);
    if (!intent) return false;

    const items = store.loadReminders();
    store.saveReminders([
      {
        id: crypto.randomUUID(),
        text: intent.text,
        at: intent.at,
        repeat: "none",
        fired: false,
      },
      ...items,
    ]);

    const when = new Date(intent.at).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      toast.success("Recordatorio creado", {
        description: `${intent.text} · ${when}`,
        duration: 4000,
      });
    } catch {
      /* ignore */
    }
    return true;
  }, []);

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || !active) return;
      if (typing || uploading) return;

      setError(null);
      tryCreateReminder(text);

      const currentAttachments = [...attachments];

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        at: Date.now(),
        attachments: currentAttachments.length ? currentAttachments : undefined,
      };

      updateActive((c) => {
        const isFirstUser =
          c.messages.filter((m) => m.role === "user").length === 0;
        return {
          ...c,
          messages: [...c.messages, userMsg],
          title:
            isFirstUser || !c.title || c.title === "Nueva conversación"
              ? makeTitle(text)
              : c.title,
        };
      });

      setInput("");
      setAttachments([]);
      setTyping(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
          },
          body: JSON.stringify({
            message: text,
            conversation_id: active.id,
            user_id: "user-123",
            analysis_level: analysisLevel,
            attachments: currentAttachments.length
              ? currentAttachments.map((a) => ({
                  name: a.name,
                  kind: a.kind,
                  path: a.path,
                }))
              : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Backend error: ${response.status} ${response.statusText}`,
          );
        }

        const data: BackendChatResponse = await response.json();
        if (!data.success) throw new Error(data.error || "Backend error");

        const reply: ChatMessage = {
          id: data.message_id || crypto.randomUUID(),
          role: "aiko",
          text: data.response || "No pude procesar tu mensaje correctamente.",
          at: data.timestamp || Date.now(),
          tool: data.tool_calls ? { calls: data.tool_calls } : undefined,
        };

        updateActive((c) => ({
          ...c,
          messages: [...c.messages, reply],
        }));

        if (onAikoSpeak && reply.text) onAikoSpeak(reply.text);
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Error al conectar con el backend";
        setError(errorMsg);
        updateActive((c) => ({
          ...c,
          messages: [
            ...c.messages,
            {
              id: crypto.randomUUID(),
              role: "aiko",
              text: `Lo siento Ale, tuve un problema: ${errorMsg}. ¿Puedes intentarlo de nuevo?`,
              at: Date.now(),
            },
          ],
        }));
      } finally {
        setTyping(false);
      }
    },
    [
      active,
      updateActive,
      onAikoSpeak,
      attachments,
      analysisLevel,
      typing,
      uploading,
      tryCreateReminder,
    ],
  );

  useEffect(() => {
    sendTextRef.current = sendText;
  }, [sendText]);

  function send() {
    if (input.trim() && !uploading && !typing) sendText(input);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((list) => {
        const next = list.filter((c) => c.id !== id);
        if (activeId === id) {
          if (next.length > 0) {
            setActiveId(next[0].id);
          } else {
            const c = newConversation();
            c.title = "Nueva conversación";
            setActiveId(c.id);
            return [c];
          }
        }
        return next;
      });
    },
    [activeId],
  );

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations((list) =>
      list.map((c) =>
        c.id === id ? { ...c, title: newTitle.trim() || c.title } : c,
      ),
    );
  }, []);

  useEffect(() => {
    registerActions?.({
      newConversation: createNew,
      clearActive,
      focus: () => inputRef.current?.focus(),
      runQuickSearch: () => sendText("Búsqueda rápida: últimas noticias"),
      runDeepSearch: () => sendText("Búsqueda profunda: IA 2026"),
      summarizeMemory: () => sendText("Resume mi memoria"),
      takeScreenshot: () => sendText("Describe lo que ves en pantalla"),
      toggleVoice: () => (stt.listening ? stt.stop() : stt.start()),
    });
  }, [registerActions, createNew, clearActive, sendText, stt]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...conversations].sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    );
    if (!q) return list;
    return list.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const timeline = useMemo(() => {
    const msgs = active?.messages || [];
    const items: { type: "day" | "msg"; label?: string; msg?: ChatMessage }[] =
      [];
    let lastDay = "";
    for (const m of msgs) {
      const label = dayLabel(m.at || Date.now());
      if (label !== lastDay) {
        items.push({ type: "day", label });
        lastDay = label;
      }
      items.push({ type: "msg", msg: m });
    }
    return items;
  }, [active?.messages]);

  return (
    <div className="relative flex h-full overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/95 shadow-2xl">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 sm:px-4">
          <button
            onClick={createNew}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            title="Nueva conversación"
          >
            <Plus className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[13px] font-semibold text-foreground">
              {active?.title || "Nueva conversación"}
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {stt.listening ? (
                <span className="text-accent">Escuchando… habla ahora</span>
              ) : (
                "Chat con Aiko"
              )}
            </p>
          </div>

          <div className="hidden items-center rounded-full bg-white/5 p-0.5 sm:flex">
            {(
              [
                { id: "fast", label: "Rápido", Icon: Zap },
                { id: "balanced", label: "Medio", Icon: Scale },
                { id: "deep", label: "Profundo", Icon: Telescope },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setAnalysisLevel(id)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition",
                  analysisLevel === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
              historyOpen
                ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
            )}
            title="Historial"
          >
            <Search className="h-4 w-4" />
          </button>
        </header>

        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="rounded-md p-1 text-red-300 hover:bg-red-500/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div
          ref={scrollRef}
          className="min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-2.5 py-5 sm:px-6 lg:px-8"
        >
          {timeline.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/15 ring-1 ring-primary/20">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                ¿En qué te ayudo hoy?
              </h2>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Escribe, usa el micrófono o elige una sugerencia. La voz se
                envía sola al terminar de hablar.
              </p>
              <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => sendText(q.text)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-xs text-muted-foreground transition hover:border-primary/35 hover:bg-primary/10 hover:text-foreground"
                  >
                    <span className="block font-medium text-foreground/90">
                      {q.label}
                    </span>
                    <span className="mt-0.5 line-clamp-1 opacity-70">
                      {q.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            timeline.map((item, i) =>
              item.type === "day" ? (
                <div key={`day-${i}`} className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-white/8" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </span>
                  <div className="h-px flex-1 bg-white/8" />
                </div>
              ) : (
                <MessageBubble key={item.msg!.id} msg={item.msg!} />
              ),
            )
          )}
          {typing && <TypingBubble />}
        </div>

        <div className="border-t border-white/10 bg-[#0f1117]/80 p-3 sm:p-4">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div
                  key={`${att.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                >
                  {att.kind === "image" && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="h-6 w-6 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="max-w-[100px] truncate">{att.name}</span>
                  <button
                    onClick={() =>
                      setAttachments((a) => a.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
            <button
              onClick={() => (stt.listening ? stt.stop() : stt.start())}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                stt.listening
                  ? "bg-accent/25 text-accent ring-2 ring-accent/40 animate-pulse"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
              title={
                stt.listening
                  ? "Detener (al terminar se envía solo)"
                  : "Hablar — se envía al terminar"
              }
            >
              <Mic className="h-4 w-4" />
            </button>

            <label
              className={cn(
                "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition",
                uploading
                  ? "text-accent"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
              title="Adjuntar"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={onPickFiles}
                className="hidden"
                disabled={uploading}
              />
            </label>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={
                stt.listening
                  ? "Escuchando… suelta cuando termines"
                  : "Mensaje a Aiko… o usa el micrófono"
              }
              className="max-h-36 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
              rows={1}
            />

            <button
              onClick={send}
              disabled={!input.trim() || typing || uploading}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                input.trim() && !typing && !uploading
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "cursor-not-allowed bg-white/5 text-muted-foreground",
              )}
              title="Enviar"
            >
              {typing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
            Enter envía · Micrófono envía solo al terminar de hablar
          </p>
        </div>
      </div>

      {historyOpen && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-20 bg-black/40"
            onClick={() => setHistoryOpen(false)}
            aria-label="Cerrar historial"
          />
          <aside className="absolute inset-y-0 right-0 z-30 flex w-[min(100%,20rem)] flex-col border-l border-white/10 bg-[#151821] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar chats..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs outline-none focus:border-primary/40"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {filteredConversations.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No hay conversaciones
                </p>
              ) : (
                filteredConversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conv={c}
                    active={c.id === activeId}
                    onClick={() => {
                      setActiveId(c.id);
                      setHistoryOpen(false);
                    }}
                    onDelete={() => deleteConversation(c.id)}
                    onRename={(title) => renameConversation(c.id, title)}
                  />
                ))
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const docs = !isUser ? extractDocLinks(msg.text) : [];

  let displayText = msg.text;
  if (docs.length) {
    for (const d of docs) {
      displayText = displayText.replace(d.url.split("?")[0], "").trim();
      displayText = displayText.replace(d.url, "").trim();
    }
    displayText = displayText
      .replace(/✅\s*PDF listo\.?\s*Descárgalo aquí:\s*/gi, "")
      .replace(/https?:\/\/[^\s]+/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return (
    <div
      className={cn(
        "flex min-w-0 gap-2 sm:gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/25">
          <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
        </div>
      )}

      <div
        className={cn(
          "min-w-0 space-y-3 rounded-2xl text-[13.5px] leading-6 sm:text-sm",
          isUser
            ? "max-w-[88%] rounded-br-md bg-[#ff4d9a] px-4 py-3 text-white shadow-md shadow-pink-500/15 sm:max-w-[75%]"
            : "w-full max-w-4xl rounded-bl-md border border-white/10 bg-[#1a1d27] px-3.5 py-4 text-foreground shadow-lg shadow-black/10 sm:px-5",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        ) : (
          <>
            {displayText && (
              <div className="min-w-0 max-w-none overflow-hidden break-words text-[13.5px] leading-6 text-foreground/90 sm:text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-3 mt-5 border-b border-white/10 pb-2 text-xl font-bold tracking-tight text-foreground first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-2.5 mt-5 text-lg font-bold tracking-tight text-foreground first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="my-2.5 whitespace-pre-wrap leading-6 first:mt-0 last:mb-0">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="text-foreground/80">{children}</em>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sky-400 underline decoration-sky-400/40 underline-offset-4 transition hover:text-sky-300"
                      >
                        {children}
                      </a>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-primary">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-primary">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="pl-1 leading-6">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="my-3 rounded-r-xl border-l-2 border-primary/60 bg-primary/[0.08] px-4 py-2 text-foreground/80">
                        {children}
                      </blockquote>
                    ),
                    hr: () => <hr className="my-4 border-white/10" />,
                    code: ({ children, className }) => {
                      const isBlock = Boolean(className);
                      return isBlock ? (
                        <code className="block min-w-max font-mono text-xs leading-5 text-slate-200">
                          {children}
                        </code>
                      ) : (
                        <code className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[0.9em] text-pink-200">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="my-3 max-w-full overflow-x-auto rounded-xl border border-white/10 bg-black/35 p-3.5">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="my-4 max-w-full overflow-x-auto rounded-xl border border-white/10 bg-black/15 shadow-inner [scrollbar-color:rgba(255,77,154,.45)_transparent] [scrollbar-width:thin]">
                        <table className="w-full min-w-[34rem] table-auto border-collapse text-left text-[12px] leading-5 sm:text-[13px]">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-white/[0.07] text-foreground">
                        {children}
                      </thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-white/[0.07]">
                        {children}
                      </tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="transition-colors hover:bg-white/[0.035]">
                        {children}
                      </tr>
                    ),
                    th: ({ children }) => (
                      <th className="border-r border-white/[0.07] px-3 py-2.5 align-top font-semibold text-foreground last:border-r-0">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border-r border-white/[0.06] px-3 py-2.5 align-top text-foreground/80 last:border-r-0">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {displayText}
                </ReactMarkdown>
              </div>
            )}

            {docs.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">
                {docs.map((d) => (
                  <a
                    key={d.url}
                    href={d.url}
                    download={d.label || "documento.pdf"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-xs transition hover:bg-primary/20"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        Descargar {d.label}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        Se guardará con ese nombre
                      </div>
                    </div>
                    <Download className="h-4 w-4 shrink-0 text-primary" />
                  </a>
                ))}
              </div>
            )}
          </>
        )}

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {msg.attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-md bg-black/20 px-2 py-1 text-xs"
              >
                <Paperclip className="h-3 w-3" />
                {att.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/25">
        <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-[#1a1d27] px-4 py-3">
        <span className="text-xs text-muted-foreground">
          Aiko está escribiendo
        </span>
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80" />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80"
            style={{ animationDelay: "0.15s" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80"
            style={{ animationDelay: "0.3s" }}
          />
        </span>
      </div>
    </div>
  );
}

interface ConversationRowProps {
  conv: Conversation;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

function ConversationRow({
  conv,
  active,
  onClick,
  onDelete,
  onRename,
}: ConversationRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(conv.title);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer flex-col gap-0.5 rounded-xl px-3 py-2.5 transition",
        active
          ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            if (editValue.trim()) onRename(editValue);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (editValue.trim()) onRename(editValue);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-foreground">
              {conv.title || "Sin título"}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {formatWhen(conv.updatedAt)}
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditValue(conv.title);
                setEditing(true);
              }}
              className="rounded-md p-1 hover:bg-white/10"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-md p-1 hover:bg-white/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
