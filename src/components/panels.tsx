import { useEffect, useState } from "react";
import {
  Cpu,
  Cloud,
  HardDrive,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Folder,
  Search,
  ShieldCheck,
  FileText,
  Wand2,
  Palette,
  Database,
  Mic2,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Zap,
  Scale,
  Telescope,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/lib/useTheme";
import {
  LEVEL_META,
  useAnalysisLevel,
  type AnalysisLevel,
} from "@/lib/analysisLevel";
import { isSfxEnabled, setSfxEnabled, sfx } from "@/lib/sfx";
import { useAffection } from "@/lib/affection";


/* -------------------------------- Voice -------------------------------- */

export function VoicePanel({
  voiceURI,
  setVoiceURI,
  rate,
  setRate,
  pitch,
  setPitch,
  volume,
  setVolume,
  onPreview,
}: {
  voiceURI: string | null;
  setVoiceURI: (v: string | null) => void;
  rate: number;
  setRate: (n: number) => void;
  pitch: number;
  setPitch: (n: number) => void;
  volume: number;
  setVolume: (n: number) => void;
  onPreview: () => void;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const feminineHints = /(mónica|monica|paulina|marisol|helena|sofia|lucia|elena|female|mujer)/i;
  const sorted = [...voices].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      const es = v.lang.toLowerCase().startsWith("es") ? 0 : 2;
      const fem = feminineHints.test(v.name) ? 0 : 1;
      return es + fem;
    };
    return score(a) - score(b);
  });

  return (
    <PanelShell title="Voz" subtitle="Aiko habla con voz mimada y madura">
      <Row label="Voz TTS (recomendadas primero)">
        <select
          value={voiceURI ?? ""}
          onChange={(e) => setVoiceURI(e.target.value || null)}
          className="glass-panel w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        >
          <option value="">Automática (femenina · español)</option>
          {sorted.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {feminineHints.test(v.name) ? "♀ " : ""}
              {v.name} — {v.lang}
            </option>
          ))}
        </select>
      </Row>
      <Row label={`Velocidad · ${rate.toFixed(2)}x`}>
        <input
          type="range"
          min={0.7}
          max={1.3}
          step={0.05}
          value={rate}
          onChange={(e) => setRate(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </Row>
      <Row label={`Tono · ${pitch.toFixed(2)}`}>
        <input
          type="range"
          min={0.8}
          max={1.6}
          step={0.05}
          value={pitch}
          onChange={(e) => setPitch(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </Row>
      <Row label={`Volumen · ${Math.round(volume * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </Row>
      <button
        onClick={onPreview}
        className="mt-2 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground neon-pink"
      >
        <Volume2 className="h-4 w-4" /> Escuchar a Aiko
      </button>
      <Hint>
        Para voz anime realmente expresiva (Piper/Coqui/ElevenLabs), conecta
        tu backend Python. Este panel ya guarda tus preferencias.
      </Hint>
    </PanelShell>
  );
}

/* -------------------------------- Models -------------------------------- */

const PROVIDERS = [
  { id: "ollama", label: "Ollama (local)", icon: HardDrive, models: ["llama3.1", "qwen2.5", "mistral"] },
  { id: "openai", label: "OpenAI", icon: Cloud, models: ["gpt-5.5", "gpt-5-mini"] },
  { id: "anthropic", label: "Claude", icon: Cloud, models: ["claude-sonnet-4", "claude-haiku-4"] },
  { id: "google", label: "Gemini", icon: Cloud, models: ["gemini-3-pro", "gemini-3-flash"] },
  { id: "xai", label: "Grok", icon: Cloud, models: ["grok-4"] },
];

export function ModelsPanel({
  provider,
  setProvider,
  model,
  setModel,
}: {
  provider: string;
  setProvider: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
}) {
  const current = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  return (
    <PanelShell title="Modelos AI" subtitle="Elige el cerebro de Aiko — online u offline">
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((p) => {
          const Icon = p.icon;
          const active = provider === p.id;
          return (
            <button
              key={p.id}
              onClick={() => {
                setProvider(p.id);
                setModel(p.models[0]);
              }}
              className={`glass-panel flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm transition ${
                active
                  ? "border-primary/50 text-foreground neon-pink"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-accent"}`} />
              {p.label}
            </button>
          );
        })}
      </div>

      <Row label="Modelo">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="glass-panel w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        >
          {current.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Row>

      <div className="glass-panel mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground">
        <Cpu className="h-4 w-4 text-accent" />
        Este selector guarda tu preferencia. La conexión real se realiza
        desde el backend (LangGraph).
      </div>
    </PanelShell>
  );
}

/* -------------------------------- Memory -------------------------------- */

export function MemoryPanel() {
  const [items, setItems] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("aiko.memory.v1");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return [
      "Le gusta el color rosa 💗",
      "Estudia programación en las noches",
      "Prefiere respuestas cortas y cariñosas",
    ];
  });
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("aiko.memory.v1", JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  return (
    <PanelShell title="Memoria a largo plazo" subtitle="Aiko recuerda lo importante (se conectará a Chroma)">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              setItems((x) => [draft.trim(), ...x]);
              setDraft("");
            }
          }}
          placeholder="Agregar un recuerdo..."
          className="glass-panel flex-1 rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button
          onClick={() => {
            if (!draft.trim()) return;
            setItems((x) => [draft.trim(), ...x]);
            setDraft("");
          }}
          className="rounded-lg bg-primary px-3 text-sm text-primary-foreground"
        >
          Guardar
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="glass-panel group flex items-center justify-between rounded-lg px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-accent" />
              {it}
            </span>
            <button
              onClick={() => setItems((x) => x.filter((_, j) => j !== i))}
              className="opacity-0 transition group-hover:opacity-100"
              aria-label="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

/* -------------------------------- Tools -------------------------------- */

export function ToolsPanel({
  onRunQuickSearch,
  onRunDeepSearch,
  onSummarizeMemory,
  onScreenshot,
}: {
  onRunQuickSearch: () => void;
  onRunDeepSearch: () => void;
  onSummarizeMemory: () => void;
  onScreenshot: () => void;
}) {
  const quick = [
    { icon: Search, label: "Búsqueda rápida", desc: "Consulta al buscador", run: onRunQuickSearch },
    { icon: Wand2, label: "Búsqueda profunda", desc: "Investigación detallada", run: onRunDeepSearch },
    { icon: Sparkles, label: "Resumir memoria", desc: "Compacta lo que recuerdo", run: onSummarizeMemory },
    { icon: FileText, label: "Captura de pantalla", desc: "(Tauri) captura la ventana", run: onScreenshot },
  ];

  const capabilities = [
    { icon: Search, label: "Búsqueda en internet", desc: "Con caché inteligente" },
    { icon: Folder, label: "Acceso a carpetas", desc: "Sólo carpetas que autorices" },
    { icon: FileText, label: "Buscar archivos", desc: "Por nombre o contenido" },
    { icon: Wand2, label: "Abrir aplicaciones", desc: "Con permiso explícito" },
    { icon: ShieldCheck, label: "Acciones sensibles", desc: "Siempre pide confirmación" },
  ];

  return (
    <PanelShell title="Herramientas del agente" subtitle="Acciones rápidas y capacidades">
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          Acciones rápidas
        </div>
        <div className="grid grid-cols-2 gap-2">
          {quick.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                onClick={q.run}
                className="glass-panel flex items-start gap-2 rounded-xl px-3 py-3 text-left text-xs transition hover:border-primary/40 neon-pink-hover"
              >
                <Icon className="h-4 w-4 shrink-0 text-accent" />
                <div>
                  <div className="text-sm font-medium">{q.label}</div>
                  <div className="text-[11px] text-muted-foreground">{q.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          Capacidades
        </div>
        <ul className="space-y-2">
          {capabilities.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.label} className="glass-panel flex items-start gap-3 rounded-xl px-3 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
                <label className="ml-auto inline-flex cursor-pointer items-center">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <span className="h-5 w-9 rounded-full bg-muted transition peer-checked:bg-primary" />
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </PanelShell>
  );
}

/* -------------------------------- Settings (tabbed) -------------------------------- */

type SettingsTab = "appearance" | "voice" | "models" | "data" | "advanced";

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Apariencia", icon: Palette },
  { id: "voice", label: "Voz", icon: Mic2 },
  { id: "models", label: "Modelos", icon: Cpu },
  { id: "data", label: "Datos", icon: Database },
  { id: "advanced", label: "Avanzado", icon: SettingsIcon },
];

export function SettingsPanel({
  modelFolder,
  setModelFolder,
  language,
  setLanguage,
  voiceProps,
  modelProps,
  onClearChat,
  onClearAll,
}: {
  modelFolder: string;
  setModelFolder: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  voiceProps: React.ComponentProps<typeof VoicePanel>;
  modelProps: React.ComponentProps<typeof ModelsPanel>;
  onClearChat: () => void;
  onClearAll: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const { mode: theme, setMode: setTheme } = useTheme();
  const { level, setLevel } = useAnalysisLevel();
  const [density, setDensity] = useState<"cozy" | "compact">(() => {
    if (typeof window === "undefined") return "cozy";
    return (localStorage.getItem("aiko.ui.density") as "cozy" | "compact") ?? "cozy";
  });
  useEffect(() => {
    try {
      localStorage.setItem("aiko.ui.density", density);
    } catch {
      /* ignore */
    }
  }, [density]);

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-2xl">
      <header className="border-b border-white/5 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-glow-pink">Ajustes</h2>
        <p className="text-xs text-muted-foreground">Personaliza a Aiko a tu gusto</p>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-white/5 px-3 py-2">
        {SETTINGS_TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                active
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-accent")} />
              {t.label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {tab === "appearance" && (
          <>
            <Row label="Tema">
              <div className="flex gap-2">
                {(
                  [
                    { id: "dark", label: "Oscuro", Icon: Moon },
                    { id: "light", label: "Claro", Icon: Sun },
                    { id: "system", label: "Sistema", Icon: Monitor },
                  ] as { id: ThemeMode; label: string; Icon: typeof Sun }[]
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className={cn(
                      "glass-panel flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs transition",
                      theme === id
                        ? "border-primary/50 text-foreground neon-pink"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Idioma predeterminado">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="glass-panel w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </Row>
            <Row label="Densidad de la interfaz">
              <div className="flex gap-2">
                {(["cozy", "compact"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={cn(
                      "glass-panel flex-1 rounded-lg px-3 py-2 text-xs capitalize transition",
                      density === d ? "border-primary/50 text-foreground neon-pink" : "text-muted-foreground",
                    )}
                  >
                    {d === "cozy" ? "Acogedora" : "Compacta"}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Carpeta del modelo waifu (Live2D)">
              <input
                value={modelFolder}
                onChange={(e) => setModelFolder(e.target.value)}
                placeholder="/Users/tu-usuario/AikoModels/aiko-default"
                className="glass-panel w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
              />
            </Row>
            <SfxRow />
            <AffectionCard />
          </>
        )}

        {tab === "voice" && (
          <div className="-m-5">
            <VoicePanel {...voiceProps} />
          </div>
        )}
        {tab === "models" && (
          <div className="-m-5">
            <ModelsPanel {...modelProps} />
          </div>
        )}
        {tab === "data" && (
          <>
            <Hint>
              Todos los datos se guardan localmente en tu navegador. Cuando
              empaquetes con Tauri, migra a un almacén local seguro.
            </Hint>
            <button
              onClick={onClearChat}
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-muted-foreground hover:bg-white/5"
            >
              <Trash2 className="h-4 w-4" /> Borrar conversación activa
            </button>
            <button
              onClick={onClearAll}
              className="flex w-full items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Borrar TODO el historial
            </button>
          </>
        )}
        {tab === "advanced" && (
          <>
            <Row label="Nivel de análisis global">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "fast", Icon: Zap },
                    { id: "balanced", Icon: Scale },
                    { id: "deep", Icon: Telescope },
                  ] as { id: AnalysisLevel; Icon: typeof Zap }[]
                ).map(({ id, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setLevel(id)}
                    className={cn(
                      "glass-panel flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs transition",
                      level === id
                        ? "border-primary/50 text-foreground neon-pink"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {LEVEL_META[id].label}
                  </button>
                ))}
              </div>
            </Row>
            <p className="text-xs text-muted-foreground">
              {LEVEL_META[level].desc}
            </p>
            <Hint>
              Atajos de teclado:
              <ul className="mt-2 space-y-1 text-xs">
                <li><kbd className="rounded bg-white/10 px-1">Ctrl+K</kbd> · Paleta de comandos</li>
                <li><kbd className="rounded bg-white/10 px-1">Ctrl+Shift+N</kbd> · Nueva conversación</li>
                <li><kbd className="rounded bg-white/10 px-1">Ctrl+/</kbd> · Enfocar el chat</li>
                <li><kbd className="rounded bg-white/10 px-1">Ctrl+M</kbd> · Micrófono</li>
              </ul>
            </Hint>
            <Hint>
              Este proyecto está preparado para empaquetarse como app de
              escritorio con Tauri. Todo funciona en local — sin llamadas
              externas por defecto.
            </Hint>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Shared -------------------------------- */

function PanelShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-2xl">
      <header className="border-b border-white/5 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-glow-pink">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function SfxRow() {
  const [enabled, setEnabled] = useState<boolean>(() => isSfxEnabled());
  return (
    <Row label="Sonidos de interfaz">
      <button
        onClick={() => {
          const v = !enabled;
          setEnabled(v);
          setSfxEnabled(v);
          if (v) sfx.chime();
        }}
        className={cn(
          "glass-panel flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
          enabled ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="flex items-center gap-2">
          {enabled ? (
            <Volume2 className="h-4 w-4 text-accent" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          Efectos suaves de UI
        </span>
        <span
          className={cn(
            "h-5 w-9 rounded-full p-0.5 transition",
            enabled ? "bg-primary" : "bg-white/10",
          )}
        >
          <span
            className={cn(
              "block h-4 w-4 rounded-full bg-white transition-transform",
              enabled ? "translate-x-4" : "",
            )}
          />
        </span>
      </button>
    </Row>
  );
}

function AffectionCard() {
  const a = useAffection();
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 fill-primary text-primary text-glow-pink" />
          <div>
            <div className="text-sm font-semibold">
              Nivel {a.level} · {a.title}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {a.into}/{a.needed} XP · racha {a.streakDays}d
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${Math.round(a.progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

