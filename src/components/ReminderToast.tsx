import { useEffect, useState } from "react";
import { Bell, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

export interface FloatingReminder {
  id: string;
  text: string;
  at: number;
}

interface ReminderToastProps {
  reminder: FloatingReminder | null;
  onDismiss: (id: string) => void;
  onSnooze?: (id: string, minutes: number) => void;
}

export function ReminderToast({
  reminder,
  onDismiss,
  onSnooze,
}: ReminderToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reminder) {
      setVisible(true);
      try {
        sfx.chime?.();
      } catch {
        /* ignore */
      }
    } else {
      setVisible(false);
    }
  }, [reminder]);

  if (!reminder || !visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-primary/30",
          "bg-[#161822] shadow-2xl shadow-black/50 ring-1 ring-primary/20",
          "animate-in fade-in slide-in-from-top-3 duration-300",
        )}
        role="alert"
      >
        {/* Barra superior */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-primary/10 px-4 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
            <Bell className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">
              Recordatorio de Aiko
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(reminder.at).toLocaleTimeString("es-PE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <button
            onClick={() => onDismiss(reminder.id)}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-foreground">
            {reminder.text}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 border-t border-white/10 px-4 py-3">
          {onSnooze && (
            <button
              onClick={() => onSnooze(reminder.id, 10)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              Posponer 10 min
            </button>
          )}
          <button
            onClick={() => onDismiss(reminder.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-95"
          >
            <Check className="h-3.5 w-3.5" />
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}