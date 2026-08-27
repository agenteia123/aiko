export interface ReminderIntent {
  text: string;
  at: number;
  source: "relative" | "absolute";
}

const LIMA_OFFSET_HOURS = 5;

function cleanReminderText(input: string, timing: RegExp): string {
  const withoutCommand = input
    .replace(
      /^(?:aiko[,:]?\s*)?(?:(?:pon(?:me)?|crea(?:me)?|programa(?:me)?|agrega(?:me)?|configura(?:me)?)\s+(?:un\s+)?recordatorio\s*(?:(?:para|de|que)\b\s*)?|(?:recu[eé]rda(?:me)?|avisame|av[ií]same)\s+(?:que\s+)?)/i,
      "",
    )
    .replace(timing, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.:;\-\s]+|[,.:;\-\s]+$/g, "")
    .trim();

  return withoutCommand || "Recordatorio";
}

function parseHour(rawHour: string, rawMinute?: string, period?: string) {
  let hour = Number(rawHour);
  const minute = Number(rawMinute || 0);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59)
    return null;

  const normalizedPeriod = period?.toLowerCase().replace(/\s|\./g, "");
  if (normalizedPeriod === "pm" && hour < 12) hour += 12;
  if (normalizedPeriod === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;
  return { hour, minute };
}

function limaDateToEpoch(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
) {
  // Perú usa UTC-5 durante todo el año, sin horario de verano.
  return Date.UTC(
    year,
    monthIndex,
    day,
    hour + LIMA_OFFSET_HOURS,
    minute,
    0,
    0,
  );
}

export function parseReminderIntent(
  input: string,
  now = Date.now(),
): ReminderIntent | null {
  const text = input.trim();
  if (!/recordatorio|recu[eé]rdame|av[ií]same/i.test(text)) return null;

  const relativePattern =
    /\b(?:dentro\s+de|en)\s+(\d+(?:[.,]\d+)?)\s*(minutos?|mins?|horas?|hrs?|d[ií]as?)\b/i;
  const relative = text.match(relativePattern);
  if (relative) {
    const value = Number(relative[1].replace(",", "."));
    const unit = relative[2].toLowerCase();
    const multiplier = unit.startsWith("d")
      ? 86_400_000
      : unit.startsWith("h")
        ? 3_600_000
        : 60_000;
    const at = now + value * multiplier;
    if (!Number.isFinite(at) || at <= now) return null;
    return {
      text: cleanReminderText(text, relativePattern),
      at: Math.round(at),
      source: "relative",
    };
  }

  const absolutePattern =
    /\b(hoy|ma[nñ]ana)(?:\s+(?:a\s+las?|a\s+la))?\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?\b/i;
  const absolute = text.match(absolutePattern);
  if (absolute) {
    const time = parseHour(absolute[2], absolute[3], absolute[4]);
    if (!time) return null;

    // La fecha base se obtiene en hora de Lima, no en la zona del servidor.
    const limaNow = new Date(now - LIMA_OFFSET_HOURS * 3_600_000);
    const dayOffset = /ma[nñ]ana/i.test(absolute[1]) ? 1 : 0;
    const at = limaDateToEpoch(
      limaNow.getUTCFullYear(),
      limaNow.getUTCMonth(),
      limaNow.getUTCDate() + dayOffset,
      time.hour,
      time.minute,
    );
    if (at <= now) return null;
    return {
      text: cleanReminderText(text, absolutePattern),
      at,
      source: "absolute",
    };
  }

  return null;
}
