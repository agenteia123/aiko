import { useState } from "react";
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
        onClick={() => {
          sfx.click();
          onChange(id);
        }}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
          isActive
            ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
        title={hint || label}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive ? "text-primary" : "group-hover:text-foreground",
          )}
        />
        {expanded && (
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="truncate leading-tight">{label}</span>
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
        "relative flex h-full flex-col rounded-2xl border border-white/10 bg-[#14161f]/95 shadow-xl transition-all duration-300",
        expanded ? "w-56" : "w-[4.25rem]",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 pt-4 pb-3",
          !expanded && "justify-center px-2",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Heart className="h-4 w-4 fill-current" />
        </div>
        {expanded && (
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight text-foreground">
              Aiko
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              companion · v0.2
            </div>
          </div>
        )}
      </div>

      {/* Acciones rápidas */}
      <div className={cn("space-y-1.5 px-2", !expanded && "px-1.5")}>
        <button
          onClick={onNewConversation}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-95",
            expanded ? "px-3 py-2.5" : "justify-center px-0 py-2.5",
          )}
          title="Nueva conversación"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {expanded && <span>Nueva conversación</span>}
        </button>

        <button
          onClick={onOpenCommandPalette}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground",
            expanded ? "px-3 py-2" : "justify-center px-0 py-2",
          )}
          title="Paleta de comandos (Ctrl+K)"
        >
          <Command className="h-3.5 w-3.5 shrink-0" />
          {expanded && (
            <>
              <span className="flex-1 text-left">Comandos</span>
              <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px]">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Navegación principal */}
      <nav className="mt-4 flex-1 space-y-4 overflow-y-auto px-2 pb-2">
        <div className="space-y-0.5">
          {expanded && (
            <div className="mb-1 px-2 text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Principal
            </div>
          )}
          {PRIMARY_TABS.map((t) => (
            <NavButton key={t.id} {...t} />
          ))}
        </div>

        <div className="space-y-0.5">
          {expanded && (
            <div className="mb-1 px-2 text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Sistema
            </div>
          )}
          {SECONDARY_TABS.map((t) => (
            <NavButton key={t.id} {...t} />
          ))}
        </div>
      </nav>

      {/* Footer: afecto + pin + colapsar */}
      <div className="space-y-2 border-t border-white/10 p-2">
        <AffectionHUD expanded={expanded} />

        <button
          onClick={onToggleAlwaysOnTop}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs transition",
            alwaysOnTop
              ? "bg-accent/15 text-accent ring-1 ring-accent/25"
              : "text-muted-foreground hover:bg-white/5",
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
                "h-2 w-2 rounded-full",
                alwaysOnTop ? "bg-accent" : "bg-muted-foreground/30",
              )}
            />
          )}
        </button>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
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