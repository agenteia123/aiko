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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  type ChatMessage,
  type Conversation,
  deriveTitle,
  loadActiveId,
  loadConversations,
  newConversation,
  saveActiveId,
  saveConversations,
} from "@/lib/conversations";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { API_BASE_URL, API_KEY } from "@/config/api";

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
  "Cuéntame algo lindo, Aiko~",
  "búsqueda profunda: últimas noticias tech",
  "Resume mi memoria",
  "Ayúdame a organizar mi día",
];

const LANG_MAP: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  ja: "ja-JP",
};

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
  const [continuousVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stt = useSpeechRecognition({
    lang: LANG_MAP[language] ?? "es-ES",
    continuous: continuousVoice,
    onFinal: (text) => {
      if (continuousVoice) {
        sendText(text);
      } else {
        setInput((v) => (v ? v + " " : "") + text);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
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
          text: "¡Hola Ale! Estoy lista para charlar contigo 💕\n\nPrueba enviándome mensajes.",
          at: Date.now(),
        },
      ];
      list = [c];
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
    if (el) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 0);
    }
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
    setConversations((list) => [c, ...list]);
    setActiveId(c.id);
    setInput("");
    setAttachments([]);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  const clearActive = useCallback(() => {
    updateActive((c) => ({
      ...c,
      messages: [],
      title: "Nueva conversación",
    }));
  }, [updateActive]);

  /** Sube archivo al backend y obtiene path real */
  const uploadFile = useCallback(async (file: File): Promise<AttachmentItem> => {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY,
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Error al subir (${res.status}): ${text || res.statusText}`,
      );
    }

    const data = await res.json();
    if (!data?.path) {
      throw new Error("El backend no devolvió path del archivo");
    }

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
        console.error("Upload error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo subir el archivo al backend",
        );
      } finally {
        setUploading(false);
      }
    },
    [uploadFile],
  );

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || !active) return;

      setError(null);
      const currentAttachments = [...attachments];

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        at: Date.now(),
        attachments: currentAttachments.length
          ? currentAttachments
          : undefined,
      };

      updateActive((c) => ({
        ...c,
        messages: [...c.messages, userMsg],
        title: c.messages.length === 0 ? deriveTitle(text) : c.title,
      }));

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

        if (!data.success) {
          throw new Error(data.error || "Backend returned an error");
        }

        const reply: ChatMessage = {
          id: data.message_id || crypto.randomUUID(),
          role: "aiko",
          text:
            data.response ||
            "No pude procesar tu mensaje correctamente.",
          at: data.timestamp || Date.now(),
          tool: data.tool_calls ? { calls: data.tool_calls } : undefined,
        };

        updateActive((c) => ({
          ...c,
          messages: [...c.messages, reply],
        }));

        if (onAikoSpeak && reply.text) {
          onAikoSpeak(reply.text);
        }
      } catch (err) {
        console.error("Chat error:", err);
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Error desconocido al conectar con el backend";
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
    [active, updateActive, onAikoSpeak, attachments, analysisLevel],
  );

  function send() {
    if (input.trim() && !uploading) {
      sendText(input);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((list) => list.filter((c) => c.id !== id));
      if (activeId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveId(remaining[0].id);
        } else {
          createNew();
        }
      }
    },
    [activeId, conversations, createNew],
  );

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations((list) =>
      list.map((c) => (c.id === id ? { ...c, title: newTitle } : c)),
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

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={createNew}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 transition"
              title="Nueva conversación"
            >
              <Plus className="h-4 w-4" />
            </button>
            <h1 className="text-sm font-semibold">
              {active?.title || "Chat"}
            </h1>
          </div>

          <div className="flex gap-1">
            {(["fast", "balanced", "deep"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setAnalysisLevel(level)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition",
                  analysisLevel === level
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-white/5",
                )}
                title={
                  level === "fast"
                    ? "Rápido"
                    : level === "balanced"
                      ? "Balanceado"
                      : "Profundo"
                }
              >
                {level === "fast" ? "⚡" : level === "balanced" ? "⚖️" : "🔍"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 transition"
            title="Historial"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {active?.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Sin mensajes aún. ¡Empieza a charlar!
              </p>
            </div>
          </div>
        ) : (
          active?.messages.map((m) => <MessageBubble key={m.id} msg={m} />)
        )}
        {typing && <TypingBubble />}
      </div>

      <div className="border-t border-white/5 p-3 space-y-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2">
            {attachments.map((att, i) => (
              <div
                key={`${att.name}-${i}`}
                className="flex items-center gap-1 bg-white/5 rounded px-2 py-1 text-xs"
                title={att.path || att.name}
              >
                {att.kind === "image" && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="h-6 w-6 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="h-3 w-3" />
                )}
                <span className="truncate max-w-[100px]">{att.name}</span>
                {att.path ? (
                  <span className="text-[9px] text-emerald-400">✓</span>
                ) : (
                  <span className="text-[9px] text-amber-400">…</span>
                )}
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

        <div className="glass-panel flex items-end gap-2 rounded-xl p-2">
          <button
            onClick={() => (stt.listening ? stt.stop() : stt.start())}
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition",
              stt.listening
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-white/5",
            )}
            title={stt.listening ? "Detener grabación" : "Iniciar grabación"}
          >
            <Mic className="h-4 w-4" />
          </button>

          <label
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg cursor-pointer transition",
              uploading
                ? "text-accent"
                : "text-muted-foreground hover:bg-white/5",
            )}
            title="Adjuntar archivo o imagen"
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
            placeholder="Mensaje a Aiko..."
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none max-h-32"
            rows={1}
          />

          <button
            onClick={send}
            disabled={!input.trim() || typing || uploading}
            className={cn(
              "h-9 w-9 flex items-center justify-center rounded-lg transition",
              input.trim() && !typing && !uploading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary/50 text-primary-foreground/50 cursor-not-allowed",
            )}
            title="Enviar mensaje (Enter)"
          >
            {typing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        {active?.messages.length === 0 && (
          <div className="flex flex-wrap gap-1 px-2">
            {QUICK_REPLIES.map((reply, i) => (
              <button
                key={i}
                onClick={() => sendText(reply)}
                className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground"
              >
                {reply.slice(0, 30)}
                {reply.length > 30 ? "..." : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {historyOpen && (
        <div className="border-l border-white/5 w-64 bg-black/20 flex flex-col">
          <div className="border-b border-white/5 px-3 py-2">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-white/5 rounded px-2 py-1 outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 p-2">
            {conversations
              .filter(
                (c) =>
                  !search ||
                  c.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((c) => (
                <ConversationRow
                  key={c.id}
                  conv={c}
                  active={c.id === activeId}
                  onClick={() => setActiveId(c.id)}
                  onDelete={() => deleteConversation(c.id)}
                  onRename={(title) => renameConversation(c.id, title)}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "max-w-[90%] text-foreground",
        )}
      >
        {isUser ? (
          <p className="break-words">{msg.text}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {children}
                  </a>
                ),
                code: ({ className, children, ...props }: any) => {
                  const isBlock = Boolean(className);
                  if (!isBlock) {
                    return (
                      <code
                        className="bg-white/10 rounded px-1 py-0.5"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="block bg-white/5 rounded p-2 overflow-x-auto"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        )}

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1 bg-white/10 rounded px-2 py-1 text-xs"
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
    <div className="flex items-center gap-1.5 text-accent">
      <span className="text-xs">Aiko está escribiendo</span>
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: "0.15s" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: "0.3s" }}
        />
      </span>
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
        "group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition",
        active ? "bg-primary text-primary-foreground" : "hover:bg-white/5",
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
          className="flex-1 bg-white/10 rounded px-1 text-xs outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="flex-1 truncate text-xs">{conv.title}</span>
          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="p-1 hover:bg-white/20 rounded"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 hover:bg-white/20 rounded"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}