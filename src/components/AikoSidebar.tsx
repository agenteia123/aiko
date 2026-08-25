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

const TABS: { id: TabId; label: string; icon: typeof Heart }[] = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "productivity", label: "Productividad", icon: Sparkles },
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

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col rounded-2xl border border-white/10 bg-card/50 shadow-xl backdrop-blur-md transition-all duration-300",
        expanded ? "w-56" : "w-16",
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/90 text-primary-foreground shadow-md shadow-primary/20">
          <Heart className="h-4 w-4 fill-current" />
        </div>
        {expanded && (
          <div className="min-w-0">
            <div className="font-display text-base font-semibold tracking-tight text-foreground">
              Aiko
            </div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              companion · v0.2
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mx-2 mb-3 space-y-1.5">
        <button
          onClick={onNewConversation}
          className="flex w-full items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-95"
          title="Nueva conversación (Ctrl+Shift+N)"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {expanded && <span>Nueva conversación</span>}
        </button>
        <button
          onClick={onOpenCommandPalette}
          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          title="Paleta de comandos (Ctrl+K)"
        >
          <Command className="h-3.5 w-3.5 shrink-0" />
          {expanded && (
            <>
              <span className="flex-1 text-left">Comandos</span>
              <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {TABS.map((t) => {
          const isActive = t.id === active;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                sfx.click();
                onChange(t.id);
              }}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                isActive
                  ? "bg-primary/15 text-foreground ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
              title={t.label}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-primary" : "group-hover:text-foreground",
                )}
              />
              {expanded && <span className="truncate">{t.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mx-2 mb-2">
        <AffectionHUD expanded={expanded} />
      </div>

      <div className="space-y-2 border-t border-white/8 px-3 py-3">
        <button
          onClick={onToggleAlwaysOnTop}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition",
            alwaysOnTop
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:bg-white/5",
          )}
          title="Siempre visible (requiere Tauri)"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              alwaysOnTop ? "bg-accent" : "bg-muted-foreground/40",
            )}
          />
          {expanded && <span>Siempre visible</span>}
        </button>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              <ChevronLeft className="h-3 w-3" /> Colapsar
            </>
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      </div>
    </aside>
  );
}