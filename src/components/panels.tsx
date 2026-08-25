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
  Check,
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

/* -------------------------------- Shell -------------------------------- */

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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12141c]/95 shadow-xl">
      <header className="shrink-0 border-b border-white/10 px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
      {children}
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-medium text-foreground">{label}</div>
        {description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}

function CardButton({
  active,
  onClick,
  icon: Icon,
  label,
  desc,
}: {
  active?: boolean;
  onClick: () => void;
  icon: typeof Heart;
  label: string;
  desc?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition",
        active
          ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
          : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary/20 text-primary" : "bg-white/5 text-accent",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {desc && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{desc}</div>
        )}
      </div>
      {active && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

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

  const feminineHints =
    /(mónica|monica|paulina|marisol|helena|sofia|lucia|elena|female|mujer)/i;
  const sorted = [...voices].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      const es = v.lang.toLowerCase().startsWith("es") ? 0 : 2;
      const fem = feminineHints.test(v.name) ? 0 : 1;
      return es + fem;
    };
    return score(a) - score(b);
  });

  return (
    <PanelShell
      title="Voz"
      subtitle="Cómo suena Aiko cuando te responde"
    >
      <Row label="Voz del sistema" description="Se priorizan voces en español">
        <select
          value={voiceURI ?? ""}
          onChange={(e) => setVoiceURI(e.target.value || null)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-primary/40"
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-95"
      >
        <Volume2 className="h-4 w-4" /> Escuchar vista previa
      </button>

      <Hint>
        Para voz más natural (Piper, ElevenLabs, etc.) se conecta desde el
        backend. Este panel guarda tus preferencias locales.
      </Hint>
    </PanelShell>
  );
}

/* -------------------------------- Models -------------------------------- */

const PROVIDERS = [
  {
    id: "ollama",
    label: "Ollama",
    desc: "Local · sin internet",
    icon: HardDrive,
    models: ["llama3.1", "qwen2.5", "mistral"],
  },
  {
    id: "openai",
    label: "OpenAI",
    desc: "GPT en la nube",
    icon: Cloud,
    models: ["gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "anthropic",
    label: "Claude",
    desc: "Anthropic",
    icon: Cloud,
    models: ["claude-sonnet-4", "claude-haiku-4"],
  },
  {
    id: "google",
    label: "Gemini",
    desc: "Google AI",
    icon: Cloud,
    models: ["gemini-2.0-flash", "gemini-1.5-pro"],
  },
  {
    id: "xai",
    label: "Grok",
    desc: "xAI",
    icon: Cloud,
    models: ["grok-2"],
  },
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
    <PanelShell
      title="Modelos AI"
      subtitle="Preferencia de proveedor (la lógica real está en el backend)"
    >
      <div>
        <SectionLabel>Proveedor</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <CardButton
              key={p.id}
              active={provider === p.id}
              onClick={() => {
                setProvider(p.id);
                setModel(p.models[0]);
              }}
              icon={p.icon}
              label={p.label}
              desc={p.desc}
            />
          ))}
        </div>
      </div>

      <Row label="Modelo" description={`Opciones de ${current.label}`}>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-primary/40"
        >
          {current.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Row>

      <Hint>
        <div className="flex items-start gap-2">
          <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            En producción Aiko usa el cascade del backend (Groq → Gemini → …).
            Este selector guarda tu preferencia para cuando conectes control
            manual.
          </span>
        </div>
      </Hint>
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
      "Prefiere respuestas claras y cariñosas",
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

  function add() {
    const t = draft.trim();
    if (!t) return;
    setItems((x) => [t, ...x]);
    setDraft("");
  }

  return (
    <PanelShell
      title="Memoria"
      subtitle="Datos que Aiko recuerda de ti (local por ahora)"
    >
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Agregar un recuerdo..."
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-primary/40"
        />
        <button
          onClick={add}
          className="rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20"
        >
          Guardar
        </button>
      </div>

      <div>
        <SectionLabel>{items.length} recuerdos</SectionLabel>
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span className="min-w-0 flex-1 text-foreground">{it}</span>
              <button
                onClick={() => setItems((x) => x.filter((_, j) => j !== i))}
                className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-muted-foreground">
              Sin recuerdos todavía
            </li>
          )}
        </ul>
      </div>

      <Hint>
        Más adelante estos datos se sincronizan con Chroma/Supabase del backend.
      </Hint>
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
    {
      icon: Search,
      label: "Búsqueda rápida",
      desc: "Consulta breve en internet",
      run: onRunQuickSearch,
    },
    {
      icon: Wand2,
      label: "Búsqueda profunda",
      desc: "Investigación más detallada",
      run: onRunDeepSearch,
    },
    {
      icon: Sparkles,
      label: "Resumir memoria",
      desc: "Compacta lo que recuerdo de ti",
      run: onSummarizeMemory,
    },
    {
      icon: FileText,
      label: "Captura",
      desc: "Describe la pantalla (Tauri)",
      run: onScreenshot,
    },
  ];

  const capabilities = [
    { icon: Search, label: "Búsqueda en internet", desc: "Con fallback DuckDuckGo" },
    { icon: Folder, label: "Carpetas autorizadas", desc: "Solo rutas que permitas" },
    { icon: FileText, label: "Leer documentos", desc: "PDF, Word, texto" },
    { icon: Wand2, label: "Crear archivos", desc: "PDF y documentos generados" },
    { icon: ShieldCheck, label: "Acciones sensibles", desc: "Siempre con confirmación" },
  ];

  return (
    <PanelShell
      title="Herramientas"
      subtitle="Acciones rápidas y capacidades del agente"
    >
      <div>
        <SectionLabel>Acciones rápidas</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {quick.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                onClick={q.run}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-left transition hover:border-primary/30 hover:bg-primary/10"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {q.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {q.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Capacidades</SectionLabel>
        <ul className="space-y-2">
          {capabilities.map((t) => {
            const Icon = t.icon;
            return (
              <li
                key={t.label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {t.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.desc}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Activo
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </PanelShell>
  );
}

/* -------------------------------- Settings -------------------------------- */

type SettingsTab = "appearance" | "voice" | "models" | "data" | "advanced";

const SETTINGS_TABS: {
  id: SettingsTab;
  label: string;
  icon: typeof Palette;
}[] = [
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
    return (
      (localStorage.getItem("aiko.ui.density") as "cozy" | "compact") ?? "cozy"
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem("aiko.ui.density", density);
    } catch {
      /* ignore */
    }
  }, [density]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12141c]/95 shadow-xl">
      <header className="shrink-0 border-b border-white/10 px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Ajustes
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Personaliza la experiencia de Aiko
        </p>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
        {SETTINGS_TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                active
                  ? "bg-primary/15 text-foreground ring-1 ring-primary/25"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-3.5 w-3.5", active ? "text-primary" : "")}
              />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {tab === "appearance" && (
          <>
            <Row label="Tema">
              <div className="grid grid-cols-3 gap-2">
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
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs transition",
                      theme === id
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-white/10 text-muted-foreground hover:bg-white/5",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Idioma">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-primary/40"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </Row>

            <Row label="Densidad de la interfaz">
              <div className="grid grid-cols-2 gap-2">
                {(["cozy", "compact"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-xs transition",
                      density === d
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-white/10 text-muted-foreground hover:bg-white/5",
                    )}
                  >
                    {d === "cozy" ? "Acogedora" : "Compacta"}
                  </button>
                ))}
              </div>
            </Row>

            <Row
              label="Carpeta del modelo Live2D"
              description="Ruta local del modelo waifu (opcional)"
            >
              <input
                value={modelFolder}
                onChange={(e) => setModelFolder(e.target.value)}
                placeholder="/ruta/a/tu/modelo"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm outline-none focus:border-primary/40"
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
              Los datos de esta app se guardan en el navegador. Al empaquetar
              con Tauri puedes migrarlos a un almacén local más seguro.
            </Hint>
            <button
              onClick={onClearChat}
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" /> Borrar conversación activa
            </button>
            <button
              onClick={onClearAll}
              className="flex w-full items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm text-destructive transition hover:bg-destructive/10"
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
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition",
                      level === id
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-white/10 text-muted-foreground hover:bg-white/5",
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
              <div className="space-y-1.5">
                <div className="font-medium text-foreground/90">Atajos</div>
                <ul className="space-y-1">
                  <li>
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                      Ctrl+K
                    </kbd>{" "}
                    · Paleta de comandos
                  </li>
                  <li>
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                      Ctrl+Shift+N
                    </kbd>{" "}
                    · Nueva conversación
                  </li>
                  <li>
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                      Ctrl+/
                    </kbd>{" "}
                    · Enfocar el chat
                  </li>
                  <li>
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
                      Ctrl+M
                    </kbd>{" "}
                    · Micrófono
                  </li>
                </ul>
              </div>
            </Hint>
          </>
        )}
      </div>
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
          "flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm transition",
          enabled ? "bg-white/[0.04] text-foreground" : "text-muted-foreground",
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
              enabled && "translate-x-4",
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <Heart className="h-4 w-4 fill-primary text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">
            Nivel {a.level} · {a.title}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {a.into}/{a.needed} XP · racha {a.streakDays}d
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