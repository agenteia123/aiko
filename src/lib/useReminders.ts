import { useCallback, useEffect, useRef, useState } from "react";
import { store, type Reminder } from "@/lib/productivity";
import type { FloatingReminder } from "@/components/ReminderToast";

export function requestNotificationPermission() {
  if (typeof Notification === "undefined") {
    return Promise.resolve("denied" as NotificationPermission);
  }
  return Notification.requestPermission();
}

/**
 * Revisa recordatorios cada 15s.
 * Devuelve el recordatorio activo para mostrar la ventana flotante.
 */
export function useReminders() {
  const [active, setActive] = useState<FloatingReminder | null>(null);
  const shownRef = useRef<Set<string>>(new Set());

  const load = useCallback(() => store.loadReminders(), []);

  const save = useCallback((items: Reminder[]) => {
    store.saveReminders(items);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const items = load().map((r) =>
        r.id === id ? { ...r, fired: true } : r,
      );
      // Si es recurrente, programa el siguiente
      const item = load().find((r) => r.id === id);
      if (item && item.repeat !== "none") {
        const next = { ...item, fired: false };
        if (item.repeat === "daily") {
          next.at = item.at + 24 * 60 * 60 * 1000;
        } else if (item.repeat === "weekly") {
          next.at = item.at + 7 * 24 * 60 * 60 * 1000;
        }
        const rest = load().filter((r) => r.id !== id);
        save([...rest, next]);
      } else {
        save(items);
      }
      shownRef.current.delete(id);
      setActive((cur) => (cur?.id === id ? null : cur));
    },
    [load, save],
  );

  const snooze = useCallback(
    (id: string, minutes: number) => {
      const items = load().map((r) =>
        r.id === id
          ? { ...r, at: Date.now() + minutes * 60 * 1000, fired: false }
          : r,
      );
      save(items);
      shownRef.current.delete(id);
      setActive((cur) => (cur?.id === id ? null : cur));
    },
    [load, save],
  );

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const items = load();
      // El más antiguo vencido y no mostrado
      const due = items
        .filter((r) => !r.fired && r.at <= now && !shownRef.current.has(r.id))
        .sort((a, b) => a.at - b.at)[0];

      if (due) {
        shownRef.current.add(due.id);
        setActive({ id: due.id, text: due.text, at: due.at });

        // Notificación del sistema (si hay permiso)
        try {
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification("Aiko · Recordatorio", {
              body: due.text,
              tag: due.id,
            });
          }
        } catch {
          /* ignore */
        }
      }
    }

    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  return { active, dismiss, snooze };
}