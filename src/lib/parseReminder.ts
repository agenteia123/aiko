/**
 * Detecta recordatorios / alarmas en español (texto o voz)
 */
export function parseReminderIntent(
  raw: string,
): { text: string; at: number } | null {
  const input = raw.trim();
  if (!input) return null;

  const lower = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes para matching

  // ¿Es un pedido de alarma / recordatorio / temporizador?
  const trigger =
    /\b(recuerdame|recordame|recuerda(?:me)?|haz(?:me)? un recordatorio|crea(?:r)? un recordatorio|agrega(?:r)? un recordatorio|pon(?:me)? un recordatorio|avisame|notifica(?:me)?|pon(?:me)? una alarma|crea(?:r)? una alarma|haz(?:me)? una alarma|alarma|temporizador|timer|avisa(?:me)?)\b/i;

  if (!trigger.test(lower) && !trigger.test(input.toLowerCase())) {
    return null;
  }

  const now = Date.now();

  // --- "en 5 minutos" / "dentro de 5 minutos" / "en 5 mins" ---
  const mMin = lower.match(
    /\b(?:en|dentro de)\s+(\d+)\s*(minutos?|mins?|m)\b/,
  );
  if (mMin) {
    const n = parseInt(mMin[1], 10);
    return {
      text: cleanReminderText(input),
      at: now + Math.max(1, n) * 60 * 1000,
    };
  }

  // --- "en 2 horas" / "dentro de 1 hora" ---
  const mHour = lower.match(
    /\b(?:en|dentro de)\s+(\d+)\s*(horas?|hrs?|h)\b/,
  );
  if (mHour) {
    const n = parseInt(mHour[1], 10);
    return {
      text: cleanReminderText(input),
      at: now + Math.max(1, n) * 60 * 60 * 1000,
    };
  }

  // media hora / un rato
  if (/\b(?:en|dentro de)\s+media\s+hora\b/.test(lower)) {
    return { text: cleanReminderText(input), at: now + 30 * 60 * 1000 };
  }
  if (/\ben un rato\b/.test(lower)) {
    return { text: cleanReminderText(input), at: now + 15 * 60 * 1000 };
  }

  // --- "a las 15:30" / "a las 3 de la tarde" ---
  const mClock = lower.match(
    /\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la manana|de la tarde|de la noche)?/,
  );
  if (mClock) {
    let h = parseInt(mClock[1], 10);
    const min = mClock[2] ? parseInt(mClock[2], 10) : 0;
    const suffix = (mClock[3] || "").toLowerCase();

    if (
      suffix.includes("pm") ||
      suffix.includes("tarde") ||
      suffix.includes("noche")
    ) {
      if (h < 12) h += 12;
    }
    if (suffix.includes("am") || suffix.includes("manana")) {
      if (h === 12) h = 0;
    }

    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(h, min, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return { text: cleanReminderText(input), at: d.getTime() };
  }

  // mañana
  if (/\bmanana\b/.test(lower)) {
    const m = lower.match(/\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?/);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setSeconds(0, 0);
    if (m) {
      d.setHours(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 9, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    return { text: cleanReminderText(input), at: d.getTime() };
  }

  // Fallback: 5 minutos si solo dijo "pon una alarma" sin tiempo
  return {
    text: cleanReminderText(input),
    at: now + 5 * 60 * 1000,
  };
}

function cleanReminderText(input: string): string {
  return input
    .replace(/^(oye\s+)?aiko[,:]?\s*/i, "")
    .replace(
      /\b(recuerdame|recordame|recuerda(?:me)?|haz(?:me)? un recordatorio|crea(?:r)? un recordatorio|agrega(?:r)? un recordatorio|pon(?:me)? un recordatorio|avisame|notifica(?:me)?|pon(?:me)? una alarma|crea(?:r)? una alarma|haz(?:me)? una alarma|una alarma|alarma|temporizador|timer)\b/gi,
      "",
    )
    .replace(
      /\b((?:en|dentro de)\s+\d+\s*(minutos?|mins?|m|horas?|hrs?|h)|(?:en|dentro de)\s+media\s+hora|en un rato|a\s+las?\s+\d{1,2}(?::\d{2})?\s*(am|pm|de la mañana|de la tarde|de la noche)?|mañana(\s+a\s+las?\s+\d{1,2}(?::\d{2})?)?)\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim() || "Alarma";
}