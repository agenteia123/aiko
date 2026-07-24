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
} from "lucide-react";

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

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
      `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(s),
    );
  }, [q, commands]);

  useEffect(() => {
    if (idx >= filtered.length) setIdx(0);
  }, [filtered, idx]);

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[15vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        style={{ animation: "aiko-fade-in 0.14s ease-out" }}
      >
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <Search className="h-4 w-4 text-accent" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Escribe un comando o busca…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
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
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                    active ? "bg-primary/15 text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-accent"}`} />
                  <span className="flex-1">{c.label}</span>
                  {c.hint && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {c.hint}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nada por aquí, Ale.
            </li>
          )}
        </ul>
        <div className="border-t border-white/5 bg-white/[0.02] px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          ↑ ↓ para navegar · ↵ para ejecutar
        </div>
      </div>
    </div>
  );
}

// Handy default icons re-export for callers building commands.
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
