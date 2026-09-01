import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Square, X, Pin } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AikoAvatar } from "@/components/AikoAvatar";
import { AikoSidebar, type TabId } from "@/components/AikoSidebar";
import { ChatPanel, type ChatActions } from "@/components/ChatPanel";
import {
  CommandPalette,
  CommandIcons,
  type Command,
} from "@/components/CommandPalette";
import {
  MemoryPanel,
  ModelsPanel,
  SettingsPanel,
  ToolsPanel,
  VoicePanel,
} from "@/components/panels";
import { ProductivityPanel } from "@/components/ProductivityPanel";
import {
  ReminderToast,
  type FloatingReminder,
} from "@/components/ReminderToast";
import { randomVoiceLine } from "@/lib/aiko-lines";
import { useHotkeys } from "@/lib/useHotkeys";
import { useTheme } from "@/lib/useTheme";
import {
  requestNotificationPermission,
  useReminderScheduler,
} from "@/lib/useReminders";
import { store, type Reminder } from "@/lib/productivity";
import { gainXP, onLevelUp, titleFor } from "@/lib/affection";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/")({
  component: AikoApp,
});

function AikoApp() {
  const [tab, setTab] = useState<TabId>("chat");
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [reaction, setReaction] = useState<"idle" | "hearts">("idle");
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showAvatarStage, setShowAvatarStage] = useState(false);
  const [floatingReminder, setFloatingReminder] =
    useState<FloatingReminder | null>(null);

  useTheme();
  useEffect(() => {
    requestNotificationPermission();
    const off = onLevelUp((level) => {
      sfx.levelUp();
      toast.success(`¡Nivel ${level} — ${titleFor(level)}!`, {
        description: "Tu vínculo con Aiko se hace más fuerte.",
        duration: 4200,
      });
    });
    return off;
  }, []);

  useEffect(() => {
    // En celular Aiko se muestra encima del chat. En tablet se prioriza el
    // espacio de trabajo y en escritorio vuelve a la distribución de 3 paneles.
    const query = window.matchMedia(
      "(max-width: 639px), (min-width: 1180px)",
    );
    const sync = (event: MediaQueryList | MediaQueryListEvent) =>
      setShowAvatarStage(event.matches);
    sync(query);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Persisted settings
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [rate, setRate] = useState(0.95);
  const [pitch, setPitch] = useState(1.15);
  const [volume, setVolume] = useState(1);
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("llama3.1");
  const [modelFolder, setModelFolder] = useState("");
  const [language, setLanguage] = useState("es");

  const actionsRef = useRef<ChatActions | null>(null);
  const subtitleTimerRef = useRef<number | null>(null);
  const reactionTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (subtitleTimerRef.current)
        window.clearTimeout(subtitleTimerRef.current);
      if (reactionTimerRef.current)
        window.clearTimeout(reactionTimerRef.current);
      window.speechSynthesis?.cancel();
    },
    [],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("aiko.settings.v1");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.voiceURI) setVoiceURI(s.voiceURI);
        if (typeof s.rate === "number") setRate(s.rate);
        if (typeof s.pitch === "number") setPitch(s.pitch);
        if (typeof s.volume === "number") setVolume(s.volume);
        if (s.provider) setProvider(s.provider);
        if (s.model) setModel(s.model);
        if (s.modelFolder) setModelFolder(s.modelFolder);
        if (s.language) setLanguage(s.language);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "aiko.settings.v1",
      JSON.stringify({
        voiceURI,
        rate,
        pitch,
        volume,
        provider,
        model,
        modelFolder,
        language,
      }),
    );
  }, [voiceURI, rate, pitch, volume, provider, model, modelFolder, language]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      const voices = window.speechSynthesis.getVoices();
      const feminineHints =
        /(mónica|monica|paulina|marisol|helena|sofia|lucia|elena|female|mujer)/i;
      const chosen =
        (voiceURI && voices.find((v) => v.voiceURI === voiceURI)) ||
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith("es") && feminineHints.test(v.name),
        ) ||
        voices.find((v) => v.lang.toLowerCase().startsWith("es")) ||
        voices[0];
      if (chosen) u.voice = chosen;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [voiceURI, rate, pitch, volume],
  );

  const showSubtitle = useCallback((text: string) => {
    setSubtitle(text);
    if (subtitleTimerRef.current) window.clearTimeout(subtitleTimerRef.current);
    subtitleTimerRef.current = window.setTimeout(
      () => setSubtitle((cur) => (cur === text ? null : cur)),
      3500,
    );
  }, []);

  // Cuando un recordatorio vence → ventana flotante + voz + subtítulo
  useReminderScheduler(
    useCallback(
      (r: { id: string; text: string; at: number }) => {
        setFloatingReminder({
          id: r.id,
          text: r.text,
          at: r.at,
        });
        const line = `Recordatorio, Ale... ${r.text}`;
        showSubtitle(line);
        speak(line);
        try {
          sfx.chime?.();
        } catch {
          /* ignore */
        }
      },
      [showSubtitle, speak],
    ),
  );

  const dismissReminder = useCallback((id: string) => {
    const items = store.loadReminders();
    const item = items.find((r) => r.id === id);

    if (item && item.repeat !== "none") {
      const next: Reminder = {
        ...item,
        fired: false,
        at:
          item.repeat === "weekly"
            ? item.at + 7 * 24 * 60 * 60 * 1000
            : item.at + 24 * 60 * 60 * 1000,
      };
      store.saveReminders([...items.filter((r) => r.id !== id), next]);
    } else {
      store.saveReminders(
        items.map((r) => (r.id === id ? { ...r, fired: true } : r)),
      );
    }
    setFloatingReminder((cur) => (cur?.id === id ? null : cur));
  }, []);

  const snoozeReminder = useCallback((id: string, minutes: number) => {
    const items = store.loadReminders();
    store.saveReminders(
      items.map((r) =>
        r.id === id
          ? {
              ...r,
              at: Date.now() + minutes * 60 * 1000,
              fired: false,
            }
          : r,
      ),
    );
    setFloatingReminder((cur) => (cur?.id === id ? null : cur));
    toast.message("Recordatorio pospuesto", {
      description: `Te aviso en ${minutes} minutos.`,
      duration: 2500,
    });
  }, []);

  function onAvatarClick() {
    const line = randomVoiceLine();
    setReaction("hearts");
    showSubtitle(line);
    speak(line);
    sfx.pop();
    gainXP("avatarClick");
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = window.setTimeout(
      () => setReaction("idle"),
      1500,
    );
  }

  function clearActiveChat() {
    actionsRef.current?.clearActive();
  }

  function clearAllHistory() {
    if (
      !confirm(
        "¿Borrar TODO el historial de conversaciones? Esto no se puede deshacer.",
      )
    )
      return;
    localStorage.removeItem("aiko.conversations.v1");
    localStorage.removeItem("aiko.conversations.active.v1");
    localStorage.removeItem("aiko.chat.v1");
    window.location.reload();
  }

  useHotkeys(
    useMemo(
      () => [
        {
          combo: "mod+k",
          handler: () => setPaletteOpen((v) => !v),
          allowInInput: true,
        },
        {
          combo: "esc",
          handler: () => {
            if (floatingReminder) {
              dismissReminder(floatingReminder.id);
            } else {
              setPaletteOpen(false);
            }
          },
          allowInInput: true,
        },
        {
          combo: "mod+shift+n",
          handler: () => actionsRef.current?.newConversation(),
          allowInInput: true,
        },
        {
          combo: "mod+/",
          handler: () => {
            setTab("chat");
            setTimeout(() => actionsRef.current?.focus(), 20);
          },
          allowInInput: true,
        },
        {
          combo: "mod+m",
          handler: () => actionsRef.current?.toggleVoice(),
          allowInInput: true,
        },
      ],
      [floatingReminder, dismissReminder],
    ),
  );

  const voiceProps = {
    voiceURI,
    setVoiceURI,
    rate,
    setRate,
    pitch,
    setPitch,
    volume,
    setVolume,
    onPreview: () =>
      speak("Mmm... hola, Ale. Soy Aiko. ¿Te gusta cómo suena mi voz?"),
  };
  const modelProps = { provider, setProvider, model, setModel };

  const commands: Command[] = useMemo(
    () => [
      {
        id: "new-chat",
        label: "Nueva conversación",
        hint: "⌘⇧N",
        icon: CommandIcons.NewChat,
        run: () => actionsRef.current?.newConversation(),
      },
      {
        id: "focus-chat",
        label: "Ir al chat",
        hint: "⌘/",
        icon: CommandIcons.Sparkles,
        run: () => {
          setTab("chat");
          setTimeout(() => actionsRef.current?.focus(), 20);
        },
      },
      {
        id: "quick-search",
        label: "Búsqueda rápida en internet",
        icon: CommandIcons.Search,
        keywords: "web google buscar",
        run: () => actionsRef.current?.runQuickSearch(),
      },
      {
        id: "deep-search",
        label: "Búsqueda profunda",
        icon: CommandIcons.Search,
        keywords: "investigar research",
        run: () => actionsRef.current?.runDeepSearch(),
      },
      {
        id: "summarize-memory",
        label: "Resumir memoria",
        icon: CommandIcons.Memory,
        run: () => actionsRef.current?.summarizeMemory(),
      },
      {
        id: "screenshot",
        label: "Captura de pantalla",
        icon: CommandIcons.Screenshot,
        run: () => actionsRef.current?.takeScreenshot(),
      },
      {
        id: "toggle-voice",
        label: "Activar / detener micrófono",
        hint: "⌘M",
        icon: CommandIcons.Voice,
        run: () => actionsRef.current?.toggleVoice(),
      },
      {
        id: "open-voice",
        label: "Abrir ajustes de voz",
        icon: CommandIcons.Voice,
        run: () => setTab("voice"),
      },
      {
        id: "open-models",
        label: "Abrir modelos AI",
        icon: CommandIcons.Models,
        run: () => setTab("models"),
      },
      {
        id: "open-tools",
        label: "Abrir herramientas",
        icon: CommandIcons.Tools,
        run: () => setTab("tools"),
      },
      {
        id: "open-settings",
        label: "Abrir ajustes",
        icon: CommandIcons.Settings,
        run: () => setTab("settings"),
      },
      {
        id: "open-productivity",
        label: "Abrir productividad",
        icon: CommandIcons.Sparkles,
        keywords: "tareas recordatorios hábitos",
        run: () => setTab("productivity"),
      },
      {
        id: "clear-active",
        label: "Vaciar conversación activa",
        icon: CommandIcons.Delete,
        run: clearActiveChat,
      },
      {
        id: "clear-all",
        label: "Borrar TODO el historial",
        icon: CommandIcons.Delete,
        run: clearAllHistory,
      },
      {
        id: "toggle-pin",
        label: alwaysOnTop ? "Desactivar siempre visible" : "Siempre visible",
        icon: CommandIcons.Sleep,
        run: () => setAlwaysOnTop((v) => !v),
      },
    ],
    [alwaysOnTop],
  );

  return (
    <div className="aiko-app-shell h-[100dvh] min-h-[100svh] w-full overflow-hidden sm:p-2 lg:p-3">
      <div className="glass-panel flex h-full w-full flex-col overflow-hidden rounded-none sm:rounded-3xl">
        <TitleBar
          alwaysOnTop={alwaysOnTop}
          onToggleAlwaysOnTop={() => setAlwaysOnTop((v) => !v)}
        />

        <div className="aiko-mobile-shell flex min-h-0 min-w-0 flex-1 flex-col gap-1 p-1 sm:flex-row sm:gap-2 sm:p-2 lg:gap-3 lg:p-3">
          <AikoSidebar
            active={tab}
            onChange={setTab}
            alwaysOnTop={alwaysOnTop}
            onToggleAlwaysOnTop={() => setAlwaysOnTop((v) => !v)}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onNewConversation={() => actionsRef.current?.newConversation()}
          />

          {/* Stage — avatar */}
          <section
            className={`aiko-mobile-stage glass-panel relative order-1 h-[clamp(11.5rem,30dvh,16rem)] min-h-0 min-w-0 flex-none items-center justify-center overflow-hidden rounded-2xl sm:hidden min-[1180px]:order-none min-[1180px]:flex min-[1180px]:h-auto min-[1180px]:flex-1 min-[1180px]:basis-0 ${
              tab === "chat" ? "flex" : "hidden"
            }`}
          >
            {showAvatarStage && (
              <AikoAvatar
                onClick={onAvatarClick}
                reactionOverride={reaction === "hearts" ? "hearts" : undefined}
              />
            )}
            {subtitle && (
              <div
                className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 sm:top-10"
                style={{
                  animation: "aiko-float-heart 3.4s ease-out forwards",
                }}
              >
                <div className="glass-panel neon-pink max-w-[82vw] rounded-2xl rounded-bl-sm px-3 py-1.5 text-center text-xs font-medium sm:max-w-none sm:px-4 sm:py-2 sm:text-left sm:text-sm">
                  {subtitle}
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 text-center sm:bottom-4">
              <div className="glass-panel inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent neon-teal" />
                {provider} · {model}
              </div>
            </div>
          </section>

          {/* Right pane */}
          <section className="order-2 flex min-h-0 min-w-0 flex-1 flex-col transition-[width] duration-300 sm:order-none min-[1180px]:w-[clamp(26rem,30vw,36rem)] min-[1180px]:flex-none">
            {tab === "chat" && (
              <ChatPanel
                onAikoSpeak={speak}
                language={language}
                registerActions={(a) => {
                  actionsRef.current = a;
                }}
              />
            )}
            {tab === "productivity" && <ProductivityPanel />}
            {tab === "voice" && <VoicePanel {...voiceProps} />}
            {tab === "models" && <ModelsPanel {...modelProps} />}
            {tab === "memory" && <MemoryPanel />}
            {tab === "tools" && (
              <ToolsPanel
                onRunQuickSearch={() => {
                  setTab("chat");
                  setTimeout(() => actionsRef.current?.runQuickSearch(), 20);
                }}
                onRunDeepSearch={() => {
                  setTab("chat");
                  setTimeout(() => actionsRef.current?.runDeepSearch(), 20);
                }}
                onSummarizeMemory={() => {
                  setTab("chat");
                  setTimeout(() => actionsRef.current?.summarizeMemory(), 20);
                }}
                onScreenshot={() => {
                  setTab("chat");
                  setTimeout(() => actionsRef.current?.takeScreenshot(), 20);
                }}
              />
            )}
            {tab === "settings" && (
              <SettingsPanel
                modelFolder={modelFolder}
                setModelFolder={setModelFolder}
                language={language}
                setLanguage={setLanguage}
                voiceProps={voiceProps}
                modelProps={modelProps}
                onClearChat={clearActiveChat}
                onClearAll={clearAllHistory}
              />
            )}
          </section>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      {/* Ventana flotante de recordatorios */}
      <ReminderToast
        reminder={floatingReminder}
        onDismiss={dismissReminder}
        onSnooze={snoozeReminder}
      />

      <Toaster />
    </div>
  );
}

function TitleBar({
  alwaysOnTop,
  onToggleAlwaysOnTop,
}: {
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
}) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-white/5 px-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary neon-pink" />
        aiko · <span className="hidden sm:inline">desktop&nbsp;</span>companion
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        <button
          onClick={onToggleAlwaysOnTop}
          title="Siempre visible"
          className={`flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/5 ${
            alwaysOnTop ? "text-accent text-glow-teal" : ""
          }`}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          title="Minimizar"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/5"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          title="Maximizar"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/5"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          title="Cerrar"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/60 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
