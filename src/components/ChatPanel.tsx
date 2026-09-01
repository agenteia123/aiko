import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
  Copy,
  Check,
  Clock3,
  Square,
  ChevronDown,
  PanelRightClose,
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
  onCollapse?: () => void;
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
  metadata?: {
    intent?: string;
    reminder?: {
      text: string;
      minutes?: number;
      at: string;
    };
  };
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

function formatHistoryDate(ts?: number): string {
  if (!ts) return "Sin fecha";
  return new Date(ts).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatHistoryTime(ts?: number): string {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function looksLikeReminderRefusal(text: string): boolean {
  const t = (text || "").toLowerCase();
  return (
    t.includes("no puedo crear recordatorio") ||
    t.includes("no puedo crear recordatorios") ||
    t.includes("no puedo programar") ||
    t.includes("aplicación de recordatorios") ||
    t.includes("asistente de voz") ||
    t.includes("no puedo crear recordatorios directamente")
  );
}

function normalizeReminderAt(at: number | string): number {
  if (typeof at === "number") {
    // Algunos backends envían segundos Unix y otros milisegundos.
    return at > 0 && at < 10_000_000_000 ? at * 1000 : at;
  }
  const value = at.trim();
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const numeric = Number(value);
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const hasTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`).getTime();
}

function formatReminderWhen(at: number | string): string {
  const d = new Date(normalizeReminderAt(at));
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Lima",
  });
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

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function ChatPanel({
  onAikoSpeak,
  onCollapse,
  registerActions,
  language,
}: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editedMessageIds, setEditedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [analysisLevel, setAnalysisLevel] = useState<
    "fast" | "balanced" | "deep"
  >("balanced");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [visibleMessageCount, setVisibleMessageCount] = useState(50);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendTextRef = useRef<
    (text: string, options?: { replaceMessageId?: string }) => void
  >(() => {});
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestSerialRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    [],
  );

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
          if (firstUser?.text)
            return { ...c, title: makeTitle(firstUser.text) };
        }
        return c;
      });
      saveConversations(list);
    }
    setConversations(list);
    const prev = loadActiveId();
    setActiveId(prev && list.find((c) => c.id === prev) ? prev : list[0].id);
    // En celular no se abre el teclado automáticamente: hacerlo reduce el
    // viewport, oculta el avatar y retrasa la primera interacción visual.
    if (!window.matchMedia("(pointer: coarse)").matches) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
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
    if (el && shouldAutoScrollRef.current) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
        setShowScrollButton(false);
      }, 0);
    }
  }, [active?.messages, typing]);

  const handleChatScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    shouldAutoScrollRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    shouldAutoScrollRef.current = true;
    setShowScrollButton(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

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

  const uploadFile = useCallback(
    async (file: File): Promise<AttachmentItem> => {
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
      if (!data?.path)
        throw new Error("El backend no devolvió path del archivo");

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
    },
    [],
  );

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

  const applyReminder = useCallback(
    (payload: { text: string; at: number | string }) => {
      const atMs = normalizeReminderAt(payload.at);
      if (!payload.text || !Number.isFinite(atMs)) return false;

      const items = store.loadReminders();
      const already = items.some(
        (r) => r.text === payload.text && Math.abs((r.at || 0) - atMs) < 30_000,
      );
      if (already) return true;

      store.saveReminders([
        {
          id: crypto.randomUUID(),
          text: payload.text,
          at: atMs,
          repeat: "none",
          fired: false,
        },
        ...items,
      ]);

      try {
        toast.success("Recordatorio creado", {
          description: `${payload.text} · ${formatReminderWhen(atMs)}`,
          duration: 4000,
        });
      } catch {
        /* ignore */
      }
      return true;
    },
    [],
  );

  const sendText = useCallback(
    async (rawText: string, options?: { replaceMessageId?: string }) => {
      const text = rawText.trim();
      if (!text || !active) return;
      const replaceMessageId = options?.replaceMessageId;
      if ((typing && !replaceMessageId) || uploading) return;
      const localReminder = parseReminderIntent(text);

      if (replaceMessageId) {
        requestControllerRef.current?.abort();
        setRegenerating(true);
        setEditedMessageIds((previous) => {
          const next = new Set(previous);
          next.add(replaceMessageId);
          return next;
        });
      } else {
        setRegenerating(false);
      }

      setError(null);

      const originalMessage = replaceMessageId
        ? active.messages.find((m) => m.id === replaceMessageId)
        : undefined;
      const currentAttachments = replaceMessageId
        ? [...(originalMessage?.attachments || [])]
        : [...attachments];

      const userMsg: ChatMessage = {
        id: replaceMessageId || crypto.randomUUID(),
        role: "user",
        text,
        at: Date.now(),
        attachments: currentAttachments.length ? currentAttachments : undefined,
      };

      updateActive((c) => {
        const replaceIndex = replaceMessageId
          ? c.messages.findIndex((m) => m.id === replaceMessageId)
          : -1;
        const baseMessages =
          replaceIndex >= 0 ? c.messages.slice(0, replaceIndex) : c.messages;
        const isFirstUser =
          baseMessages.filter((m) => m.role === "user").length === 0;
        return {
          ...c,
          messages: [...baseMessages, userMsg],
          title:
            isFirstUser || !c.title || c.title === "Nueva conversación"
              ? makeTitle(text)
              : c.title,
        };
      });

      setInput("");
      setAttachments([]);
      setTyping(true);
      shouldAutoScrollRef.current = true;
      setShowScrollButton(false);

      if (localReminder) {
        applyReminder({ text: localReminder.text, at: localReminder.at });
      }

      const requestSerial = ++requestSerialRef.current;
      const controller = new AbortController();
      requestControllerRef.current = controller;

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
            replace_message_id: replaceMessageId || undefined,
            attachments: currentAttachments.length
              ? currentAttachments.map((a) => ({
                  name: a.name,
                  kind: a.kind,
                  path: a.path,
                }))
              : undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Backend error: ${response.status} ${response.statusText}`,
          );
        }

        const data: BackendChatResponse = await response.json();
        if (requestSerial !== requestSerialRef.current) return;
        if (!data.success) throw new Error(data.error || "Backend error");

        const backendReminder = data.metadata?.reminder;
        let replyText =
          data.response || "No pude procesar tu mensaje correctamente.";

        // Para frases relativas manda el cálculo local: evita que la zona
        // horaria del servidor cambie "dentro de 5 minutos".
        const reminder = localReminder
          ? { text: localReminder.text, at: localReminder.at }
          : backendReminder?.at
            ? {
                text: backendReminder.text || "Recordatorio",
                at: backendReminder.at,
              }
            : null;

        if (reminder) {
          applyReminder(reminder);
          const prefix = looksLikeReminderRefusal(replyText)
            ? "Sí puedo hacerlo. Listo"
            : "Listo";
          replyText = `${prefix}, Ale. Te avisaré: ${reminder.text} · ${formatReminderWhen(reminder.at)} ⏰`;
        }

        const reply: ChatMessage = {
          id: data.message_id || crypto.randomUUID(),
          role: "aiko",
          text: replyText,
          at: data.timestamp || Date.now(),
          tool: data.tool_calls ? { calls: data.tool_calls } : undefined,
        };

        updateActive((c) => ({
          ...c,
          messages: [...c.messages, reply],
        }));

        if (onAikoSpeak && reply.text) onAikoSpeak(reply.text);
      } catch (err) {
        if (
          controller.signal.aborted ||
          requestSerial !== requestSerialRef.current ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Error al conectar con el backend";
        if (localReminder) {
          const confirmation = `Listo, Ale. El recordatorio quedó guardado en este dispositivo: ${localReminder.text} · ${formatReminderWhen(localReminder.at)} ⏰`;
          updateActive((c) => ({
            ...c,
            messages: [
              ...c.messages,
              {
                id: crypto.randomUUID(),
                role: "aiko",
                text: confirmation,
                at: Date.now(),
              },
            ],
          }));
          if (onAikoSpeak) onAikoSpeak(confirmation);
          return;
        }
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
        if (requestSerial === requestSerialRef.current) {
          requestControllerRef.current = null;
          setTyping(false);
          setRegenerating(false);
        }
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
      applyReminder,
    ],
  );

  useEffect(() => {
    sendTextRef.current = sendText;
  }, [sendText]);

  const editAndResend = useCallback((messageId: string, newText: string) => {
    sendTextRef.current(newText, { replaceMessageId: messageId });
  }, []);

  function send() {
    if (input.trim() && !uploading && !typing) sendText(input);
  }

  const stopGenerating = useCallback(() => {
    if (!requestControllerRef.current) return;
    requestControllerRef.current.abort();
    requestControllerRef.current = null;
    requestSerialRef.current += 1;
    setTyping(false);
    setRegenerating(false);
    toast.message("Respuesta detenida");
  }, []);

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

  useEffect(() => {
    setVisibleMessageCount(50);
  }, [activeId]);

  const timeline = useMemo(() => {
    const allMessages = active?.messages || [];
    const msgs = allMessages.slice(-visibleMessageCount);
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
  }, [active?.messages, visibleMessageCount]);

  const hasEarlierMessages =
    (active?.messages.length || 0) > visibleMessageCount;

  return (
    <div className="relative flex h-full w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f1117]/95 shadow-2xl sm:rounded-2xl">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-2.5 sm:h-14 sm:px-4">
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

          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted-foreground transition hover:bg-primary/15 hover:text-primary"
              title="Convertir el chat en burbuja"
              aria-label="Minimizar chat"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}

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
          onScroll={handleChatScroll}
          className="min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-2 py-3 overscroll-contain sm:space-y-5 sm:px-6 sm:py-5 lg:px-8"
        >
          {hasEarlierMessages && (
            <div className="flex justify-center pb-1">
              <button
                type="button"
                onClick={() => setVisibleMessageCount((count) => count + 50)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              >
                Cargar mensajes anteriores
              </button>
            </div>
          )}

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
                <MessageBubble
                  key={item.msg!.id}
                  msg={item.msg!}
                  edited={editedMessageIds.has(item.msg!.id)}
                  onEdit={item.msg!.role === "user" ? editAndResend : undefined}
                />
              ),
            )
          )}
          {typing && (
            <TypingBubble regenerating={regenerating} onStop={stopGenerating} />
          )}
        </div>

        {showScrollButton && !historyOpen && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-[#20232e]/95 px-3 py-2 text-[11px] font-medium text-foreground shadow-xl shadow-black/30 backdrop-blur transition hover:border-primary/35 hover:bg-[#292d3a] sm:bottom-28"
            title="Ir al mensaje más reciente"
          >
            <ChevronDown className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Ir al final</span>
          </button>
        )}

        <div className="border-t border-white/10 bg-[#0f1117]/80 p-2 sm:p-4">
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

          <div className="mx-auto flex max-w-3xl items-end gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 sm:gap-2 sm:p-2">
            <button
              onClick={() => (stt.listening ? stt.stop() : stt.start())}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition sm:h-10 sm:w-10",
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
                "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl transition sm:h-10 sm:w-10",
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
              className="aiko-chat-input max-h-36 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-0.5 py-2 text-base outline-none placeholder:text-muted-foreground/60 sm:min-h-[40px] sm:px-1 sm:py-2.5 sm:text-sm"
              rows={1}
            />

            <button
              onClick={typing ? stopGenerating : send}
              disabled={typing ? false : !input.trim() || uploading}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition sm:h-10 sm:w-10",
                typing
                  ? "bg-red-500/15 text-red-300 ring-1 ring-red-400/25 hover:bg-red-500/25"
                  : input.trim() && !uploading
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "cursor-not-allowed bg-white/5 text-muted-foreground",
              )}
              title={typing ? "Detener respuesta" : "Enviar"}
            >
              {typing ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 hidden text-center text-[10px] text-muted-foreground/70 sm:block">
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
          <aside className="absolute inset-0 z-30 flex w-full flex-col bg-[#12151e]/98 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 pb-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Historial de conversaciones
                  </h2>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Busca, renombra o abre un chat anterior
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                  aria-label="Cerrar historial"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar chats..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.045] py-2.5 pl-8 pr-3 text-xs outline-none transition focus:border-primary/40 focus:ring-1 focus:ring-primary/15"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
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

const MessageBubble = memo(function MessageBubble({
  msg,
  onEdit,
  edited = false,
}: {
  msg: ChatMessage;
  onEdit?: (messageId: string, newText: string) => void;
  edited?: boolean;
}) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const docs = !isUser ? extractDocLinks(msg.text) : [];

  const saveEdit = () => {
    const next = editText.trim();
    if (!next || next === msg.text) {
      setEditing(false);
      setEditText(msg.text);
      return;
    }
    setEditing(false);
    onEdit?.(msg.id, next);
  };

  const copyMessage = async () => {
    try {
      await copyToClipboard(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar la respuesta");
    }
  };

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
        "aiko-message-in flex min-w-0 gap-2 sm:gap-3",
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
            ? editing
              ? "w-full max-w-2xl rounded-br-md border border-pink-300/20 bg-gradient-to-br from-[#c82f73] to-[#9f255f] px-3.5 py-3.5 text-white shadow-xl shadow-pink-950/25 sm:px-4"
              : "max-w-[88%] rounded-br-md bg-[#ff4d9a] px-4 py-3 text-white shadow-md shadow-pink-500/15 sm:max-w-[78%]"
            : "w-full max-w-4xl rounded-bl-md border border-white/10 bg-[#1a1d27] px-3.5 py-4 text-foreground shadow-lg shadow-black/10 sm:px-5",
        )}
      >
        {isUser ? (
          editing ? (
            <div className="min-w-0 space-y-3">
              <div className="flex items-start justify-between gap-3 border-b border-white/15 pb-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/15">
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight">
                      Editar mensaje
                    </div>
                    <div className="truncate text-[10px] leading-tight text-white/60">
                      Aiko generará una respuesta nueva
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditText(msg.text);
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white"
                  title="Cancelar edición"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                autoFocus
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    saveEdit();
                  }
                  if (event.key === "Escape") {
                    setEditing(false);
                    setEditText(msg.text);
                  }
                }}
                rows={Math.min(6, Math.max(2, editText.split("\n").length))}
                className="min-h-[6rem] w-full min-w-0 resize-y rounded-xl border border-white/20 bg-[#16151f]/55 px-3.5 py-3 text-sm leading-6 text-white shadow-inner outline-none placeholder:text-white/45 transition focus:border-pink-100/45 focus:bg-[#16151f]/70 focus:ring-2 focus:ring-white/10"
              />
              <div className="flex flex-col gap-2 border-t border-white/10 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] leading-4 text-white/55">
                  La respuesta anterior y los mensajes posteriores serán
                  reemplazados.
                </p>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setEditText(msg.text);
                    }}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={!editText.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-pink-700 shadow-md shadow-black/10 transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" /> Guardar y enviar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="group/user">
              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              <div className="mt-1.5 flex items-center justify-end gap-2 text-[10px] text-white/65">
                {edited && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-medium text-white/75">
                    Editado
                  </span>
                )}
                <span>{formatHistoryTime(msg.at)}</span>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditText(msg.text);
                      setEditing(true);
                    }}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-white/75 opacity-70 transition hover:bg-white/15 hover:text-white group-hover/user:opacity-100"
                    title="Editar este mensaje y generar otra respuesta"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/75">
                <Clock3 className="h-3 w-3" />
                {formatHistoryTime(msg.at)}
              </span>
              <button
                type="button"
                onClick={copyMessage}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition",
                  copied
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                )}
                title="Copiar toda la respuesta"
                aria-label="Copiar toda la respuesta"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? "Copiado" : "Copiar respuesta"}</span>
              </button>
            </div>

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
                      <MarkdownTable>{children}</MarkdownTable>
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
});

function MarkdownTable({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const copyTable = async () => {
    const table = tableRef.current;
    if (!table) return;

    const rows = Array.from(table.rows).map((row) =>
      Array.from(row.cells)
        .map((cell) => cell.innerText.replace(/\s+/g, " ").trim())
        .join("\t"),
    );

    try {
      await copyToClipboard(rows.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar el cuadro");
    }
  };

  return (
    <div className="my-4 max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/15 shadow-inner">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.035] px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Cuadro
        </span>
        <button
          type="button"
          onClick={copyTable}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition",
            copied
              ? "bg-emerald-500/15 text-emerald-300"
              : "text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
          )}
          title="Copiar este cuadro"
          aria-label="Copiar este cuadro"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copiado" : "Copiar cuadro"}
        </button>
      </div>
      <div className="max-w-full overflow-x-auto [scrollbar-color:rgba(255,77,154,.45)_transparent] [scrollbar-width:thin]">
        <table
          ref={tableRef}
          className="w-full min-w-[34rem] table-auto border-collapse text-left text-[12px] leading-5 sm:text-[13px]"
        >
          {children}
        </table>
      </div>
    </div>
  );
}

function TypingBubble({
  regenerating,
  onStop,
}: {
  regenerating: boolean;
  onStop: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/25">
        <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-[#1a1d27] px-4 py-2.5 shadow-lg shadow-black/10">
        <span className="text-xs text-muted-foreground">
          {regenerating
            ? "Aiko está preparando una respuesta nueva"
            : "Aiko está escribiendo"}
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
        <button
          type="button"
          onClick={onStop}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
          title="Detener respuesta"
          aria-label="Detener respuesta"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
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
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{formatHistoryDate(conv.updatedAt)}</span>
              <span className="text-white/15">•</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground/65">
                <Clock3 className="h-2.5 w-2.5" />
                {formatHistoryTime(conv.updatedAt)}
              </span>
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
