import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Sparkles,
  MessageSquarePlus,
  Trash2,
  Mic2,
  Settings as SettingsIcon,
  Brain,
  Cpu,
  Wrench,
  Camera,
  FileUp,
  MoonStar,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`
        .toLowerCase()
        .includes(s),
    );
  }, [q, commands]);

  useEffect(() => {
    if (idx >= filtered.length) setIdx(0);
  }, [filtered, idx]);

  // Scroll item activo a la vista
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtered[idx];
      if (c) {
        onClose();
        setTimeout(() => c.run(), 0);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#14161f] shadow-2xl shadow-black/50"
        style={{ animation: "aiko-fade-in 0.14s ease-out" }}
      >
        {/* Search */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={onKey}
            placeholder="Buscar comando o acción…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <ul ref={listRef} className="max-h-[min(50vh,22rem)] overflow-y-auto py-1.5">
          {filtered.map((c, i) => {
            const Icon = c.icon;
            const active = i === idx;
            return (
              <li key={c.id}>
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => {
                    onClose();
                    setTimeout(() => c.run(), 0);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition",
                    active
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.03]",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      active
                        ? "bg-primary/20 text-primary"
                        : "bg-white/5 text-accent",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {c.label}
                  </span>
                  {c.hint && (
                    <span className="hidden shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
                      {c.hint}
                    </span>
                  )}
                  {active && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                  )}
                </button>
              </li>
            );
          })}

          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Nada coincide con “{q}”
              </p>
            </li>
          )}
        </ul>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-white/10 bg-white/[0.02] px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            ejecutar
          </span>
          <span className="ml-auto">Esc cerrar</span>
        </div>
      </div>
    </div>
  );
}

export const CommandIcons = {
  Search,
  Sparkles,
  NewChat: MessageSquarePlus,
  Delete: Trash2,
  Voice: Mic2,
  Settings: SettingsIcon,
  Memory: Brain,
  Models: Cpu,
  Tools: Wrench,
  Screenshot: Camera,
  Upload: FileUp,
  Sleep: MoonStar,
};