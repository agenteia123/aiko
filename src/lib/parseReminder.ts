/**
 * Detecta intenciones de recordatorio en español (texto o voz)
 * y devuelve { text, at } o null.
 */
export function parseReminderIntent(
  raw: string,
): { text: string; at: number } | null {
  const input = raw.trim();
  if (!input) return null;

  const lower = input.toLowerCase();

  // ¿Parece un pedido de recordatorio?
  const trigger =
    /\b(recu[eé]rdame|recordame|recuerda(?:me)?|haz(?:me)? un recordatorio|crea(?:r)? un recordatorio|agrega(?:r)? un recordatorio|pon(?:me)? un recordatorio|av[ií]same|notifica(?:me)?)\b/i;

  if (!trigger.test(lower)) return null;

  const now = Date.now();

  // --- Tiempo relativo: en X minutos / horas ---
  const mMin = lower.match(
    /\ben\s+(\d+)\s*(minutos?|mins?|m)\b/,
  );
  if (mMin) {
    const n = parseInt(mMin[1], 10);
    return {
      text: cleanReminderText(input),
      at: now + n * 60 * 1000,
    };
  }

  const mHour = lower.match(
    /\ben\s+(\d+)\s*(horas?|hrs?|h)\b/,
  );
  if (mHour) {
    const n = parseInt(mHour[1], 10);
    return {
      text: cleanReminderText(input),
      at: now + n * 60 * 60 * 1000,
    };
  }

  // en media hora / en un rato
  if (/\ben media hora\b/.test(lower)) {
    return {
      text: cleanReminderText(input),
      at: now + 30 * 60 * 1000,
    };
  }
  if (/\ben un rato\b/.test(lower)) {
    return {
      text: cleanReminderText(input),
      at: now + 15 * 60 * 1000,
    };
  }

  // --- Hora absoluta: a las 15:30 / a las 3 de la tarde ---
  const mClock = lower.match(
    /\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la mañana|de la tarde|de la noche)?/,
  );
  if (mClock) {
    let h = parseInt(mClock[1], 10);
    const min = mClock[2] ? parseInt(mClock[2], 10) : 0;
    const suffix = (mClock[3] || "").toLowerCase();

    if (suffix.includes("pm") || suffix.includes("tarde") || suffix.includes("noche")) {
      if (h < 12) h += 12;
    }
    if (suffix.includes("am") || suffix.includes("mañana")) {
      if (h === 12) h = 0;
    }

    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(h, min, 0, 0);
    if (d.getTime() <= now) {
      d.setDate(d.getDate() + 1); // si ya pasó, mañana
    }
    return {
      text: cleanReminderText(input),
      at: d.getTime(),
    };
  }

  // mañana a las X
  if (/\bmañana\b/.test(lower)) {
    const m = lower.match(
      /\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?/,
    );
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setSeconds(0, 0);
    if (m) {
      d.setHours(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 9, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    return {
      text: cleanReminderText(input),
      at: d.getTime(),
    };
  }

  // Fallback: en 10 minutos si solo dijo "recuérdame X" sin hora
  return {
    text: cleanReminderText(input),
    at: now + 10 * 60 * 1000,
  };
}

function cleanReminderText(input: string): string {
  return input
    .replace(
      /^(oye\s+)?aiko[,:]?\s*/i,
      "",
    )
    .replace(
      /\b(recu[eé]rdame|recordame|recuerda(?:me)?|haz(?:me)? un recordatorio|crea(?:r)? un recordatorio|agrega(?:r)? un recordatorio|pon(?:me)? un recordatorio|av[ií]same|notifica(?:me)?)\b/gi,
      "",
    )
    .replace(
      /\b(en\s+\d+\s*(minutos?|mins?|m|horas?|hrs?|h)|en media hora|en un rato|a\s+las?\s+\d{1,2}(?::\d{2})?\s*(am|pm|de la mañana|de la tarde|de la noche)?|mañana(\s+a\s+las?\s+\d{1,2}(?::\d{2})?)?)\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim() || "Recordatorio";
}