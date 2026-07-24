// Reminder scheduler — checks every 20s, fires desktop Notifications,
// and calls a callback so Aiko can also speak the reminder aloud.
import { useEffect } from "react";
import { store, type Reminder } from "./productivity";

export function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function fireDesktopNotification(r: Reminder) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Aiko 💗", {
      body: r.text,
      tag: r.id,
      silent: false,
    });
  } catch {
    /* ignore */
  }
}

function nextOccurrence(r: Reminder): number {
  if (r.repeat === "daily") return r.at + 24 * 3600 * 1000;
  if (r.repeat === "weekly") return r.at + 7 * 24 * 3600 * 1000;
  return 0;
}

export function useReminderScheduler(onFire?: (r: Reminder) => void) {
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      const list = store.loadReminders();
      let changed = false;
      for (const r of list) {
        if (r.fired) continue;
        if (r.at <= now) {
          fireDesktopNotification(r);
          onFire?.(r);
          const next = nextOccurrence(r);
          if (next) {
            r.at = next;
          } else {
            r.fired = true;
          }
          changed = true;
        }
      }
      if (changed) store.saveReminders(list);
    };
    tick();
    const id = window.setInterval(tick, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [onFire]);
}
