import { useEffect, useRef } from "react";
import { store, type Reminder } from "@/lib/productivity";

export function requestNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return Promise.resolve("denied" as NotificationPermission);
  }
  if (Notification.permission === "granted") {
    return Promise.resolve("granted" as NotificationPermission);
  }
  if (Notification.permission !== "denied") {
    return Notification.requestPermission();
  }
  return Promise.resolve(Notification.permission);
}

function playAlertSound() {
  try {
    // Beep corto con Web Audio (suele funcionar mejor que <audio> en background)
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
    window.setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    /* ignore */
  }
}

function showSystemNotification(r: Reminder) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  try {
    // Cierra posibles notificaciones previas con el mismo tag
    const n = new Notification("Aiko · Recordatorio", {
      body: r.text,
      tag: `aiko-reminder-${r.id}`, // evita duplicados
      requireInteraction: true, // se queda hasta que el usuario la cierre
      silent: false, // pide sonido al SO
    });

    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export type ReminderFirePayload = {
  id: string;
  text: string;
  at: number;
};

/**
 * Revisa recordatorios de forma periódica.
 * También revisa al volver a la pestaña (visibilitychange).
 * Cuando uno vence: notificación del sistema + sonido + callback (UI flotante).
 */
export function useReminderScheduler(
  onFire: (r: ReminderFirePayload) => void,
) {
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function check() {
      const now = Date.now();
      const items = store.loadReminders();
      const due = items
        .filter(
          (r) =>
            !r.fired &&
            r.at <= now &&
            !shownRef.current.has(r.id),
        )
        .sort((a, b) => a.at - b.at);

      for (const r of due) {
        shownRef.current.add(r.id);

        // 1) Notificación del sistema (se ve aunque estés en otra ventana)
        showSystemNotification(r);

        // 2) Sonido (si el navegador lo permite en background)
        playAlertSound();

        // 3) UI interna de Aiko (tarjeta flotante + voz)
        onFireRef.current({
          id: r.id,
          text: r.text,
          at: r.at,
        });
      }
    }

    // Primera pasada
    check();

    // Intervalo: en pestaña visible cada 10s; el navegador lo ralentiza en background
    const intervalId = window.setInterval(check, 10_000);

    // Al volver a la app, revisar al instante
    function onVisible() {
      if (document.visibilityState === "visible") {
        check();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
}