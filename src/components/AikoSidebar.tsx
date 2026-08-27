import { useEffect, useState } from "react";
import {
  MessageCircle,
  Mic2,
  Brain,
  Cpu,
  Wrench,
  Settings as SettingsIcon,
  Heart,
  Command,
  Plus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AffectionHUD } from "@/components/AffectionHUD";
import { sfx } from "@/lib/sfx";

export type TabId =
  | "chat"
  | "voice"
  | "models"
  | "memory"
  | "tools"
  | "productivity"
  | "settings";

const PRIMARY_TABS: { id: TabId; label: string; icon: typeof Heart; hint?: string }[] = [
  { id: "chat", label: "Chat", icon: MessageCircle, hint: "Habla con Aiko" },
  { id: "productivity", label: "Productividad", icon: Sparkles, hint: "Tareas y hábitos" },
];

const SECONDARY_TABS: { id: TabId; label: string; icon: typeof Heart }[] = [
  { id: "voice", label: "Voz", icon: Mic2 },
  { id: "models", label: "Modelos AI", icon: Cpu },
  { id: "memory", label: "Memoria", icon: Brain },
  { id: "tools", label: "Herramientas", icon: Wrench },
  { id: "settings", label: "Ajustes", icon: SettingsIcon },
];

interface AikoSidebarProps {
  active: TabId;
  onChange: (t: TabId) => void;
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  onOpenCommandPalette: () => void;
  onNewConversation: () => void;
}

export function AikoSidebar({
  active,
  onChange,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  onOpenCommandPalette,
  onNewConversation,
}: AikoSidebarProps) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 1099px)");
    const syncWithViewport = (event: MediaQueryList | MediaQueryListEvent) => {
      setExpanded(!event.matches);
    };
    syncWithViewport(compact);
    compact.addEventListener("change", syncWithViewport);
    return () => compact.removeEventListener("change", syncWithViewport);
  }, []);

  function NavButton({
    id,
    label,
    icon: Icon,
    hint,
  }: {
    id: TabId;
    label: string;
    icon: typeof Heart;
    hint?: string;
  }) {
    const isActive = id === active;
    return (
      <button
        type="button"
        aria-current={isActive ? "page" : undefined}
        onClick={() => {
          sfx.click();
          onChange(id);
        }}
        className={cn(
          "group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 text-sm transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent text-foreground ring-1 ring-primary/25 shadow-[0_8px_24px_rgba(0,0,0,.12)]"
            : "text-muted-foreground hover:bg-white/[0.055] hover:text-foreground",
          !expanded && "justify-center px-0",
        )}
        title={hint || label}
      >
        {isActive && (
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-gradient-to-b from-pink-300 via-primary to-cyan-300 shadow-[0_0_10px_rgba(244,114,182,.8)]" />
        )}
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200",
            isActive
              ? "border-primary/25 bg-primary/15 text-primary shadow-[0_0_16px_rgba(244,114,182,.12)]"
              : "border-white/[0.055] bg-white/[0.025] text-muted-foreground group-hover:border-white/10 group-hover:bg-white/[0.06] group-hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {expanded && (
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="truncate text-[13px] font-medium leading-tight">{label}</span>
            {hint && isActive && (
              <span className="truncate text-[10px] text-muted-foreground">
                {hint}
              </span>
            )}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      className={cn(
        "relative isolate flex h-full shrink-0 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#11131b]/95 shadow-[0_18px_60px_rgba(0,0,0,.28)] backdrop-blur-xl transition-[width] duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-40 before:bg-[radial-gradient(circle_at_50%_0%,rgba(244,114,182,.13),transparent_68%)] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gradient-to-b after:from-transparent after:via-white/[0.07] after:to-transparent",
        expanded ? "w-60" : "w-[4.5rem]",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "relative z-10 flex items-center gap-3 px-3.5 pb-3 pt-4",
          !expanded && "justify-center px-2",
        )}
      >
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-pink-300 via-primary to-cyan-300 p-px shadow-[0_8px_24px_rgba(244,114,182,.18)]">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#171923]">
            <Heart className="h-4 w-4 fill-pink-300 text-pink-300 drop-shadow-[0_0_9px_rgba(249,168,212,0.7)]" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#14161f] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        </div>
        {expanded && (
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-foreground">
              Aiko
              <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                online
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              companion · v0.2
            </div>
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className={cn("relative z-10 space-y-1.5 px-2.5", !expanded && "px-2")}>
        <button
          onClick={onNewConversation}
          className={cn(
            "group flex w-full items-center gap-2 rounded-xl border border-pink-200/15 bg-gradient-to-r from-[#ff4d9a] via-primary to-[#d93f91] text-sm font-semibold text-primary-foreground shadow-[0_10px_25px_rgba(244,63,148,.18)] transition-all duration-200 hover:-translate-y-px hover:brightness-105",
            expanded ? "px-3 py-2.5" : "justify-center px-0 py-2.5",
          )}
          title="Nueva conversación"
        >
          <Plus className="h-4 w-4 shrink-0 transition-transform group-hover:rotate-90" />
          {expanded && <span>Nueva conversación</span>}
        </button>

        <button
          onClick={onOpenCommandPalette}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-white/[0.075] bg-white/[0.025] text-xs text-muted-foreground transition-all hover:border-white/10 hover:bg-white/[0.055] hover:text-foreground",
            expanded ? "px-3 py-2" : "justify-center px-0 py-2",
          )}
          title="Paleta de comandos (Ctrl+K)"
        >
          <Command className="h-3.5 w-3.5 shrink-0" />
          {expanded && (
            <>
              <span className="flex-1 text-left">Comandos</span>
              <kbd className="rounded-md border border-white/[0.07] bg-black/20 px-1.5 py-0.5 text-[9px] text-foreground/55">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Navegación principal */}
      <nav className="relative z-10 mt-4 flex-1 space-y-4 overflow-y-auto px-2.5 pb-3 [scrollbar-width:none]">
        <div className="space-y-1">
          {expanded && (
            <div className="mb-1.5 flex items-center gap-2 px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/55">
              <span>Principal</span><span className="h-px flex-1 bg-white/[0.055]" />
            </div>
          )}
          {PRIMARY_TABS.map((t) => (
            <NavButton key={t.id} {...t} />
          ))}
        </div>

        <div className="space-y-1">
          {expanded && (
            <div className="mb-1.5 flex items-center gap-2 px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/55">
              <span>Sistema</span><span className="h-px flex-1 bg-white/[0.055]" />
            </div>
          )}
          {SECONDARY_TABS.map((t) => (
            <NavButton key={t.id} {...t} />
          ))}
        </div>
      </nav>

      {/* Footer: afecto + pin + colapsar */}
      <div className="relative z-10 space-y-2 border-t border-white/[0.07] bg-black/10 p-2.5 backdrop-blur-sm">
        <AffectionHUD expanded={expanded} className="bg-white/[0.025]" />

        <button
          onClick={onToggleAlwaysOnTop}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition-all duration-200",
            alwaysOnTop
              ? "border-accent/20 bg-accent/12 text-accent shadow-[0_0_18px_rgba(34,211,238,.08)]"
              : "border-transparent text-muted-foreground hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-foreground",
            !expanded && "justify-center",
          )}
          title="Mantener ventana siempre visible (Tauri)"
        >
          <Pin className={cn("h-3.5 w-3.5", alwaysOnTop && "fill-current")} />
          {expanded && (
            <span className="flex-1 text-left">
              {alwaysOnTop ? "Siempre visible" : "Fijar ventana"}
            </span>
          )}
          {expanded && (
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                alwaysOnTop ? "bg-accent shadow-[0_0_9px_currentColor]" : "bg-muted-foreground/25",
              )}
            />
          )}
        </button>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70 transition hover:bg-white/[0.04] hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronLeft className="h-3 w-3" /> Colapsar
            </>
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </aside>
  );
}
