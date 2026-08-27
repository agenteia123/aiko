import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAffection, titleFor } from "@/lib/affection";

interface AffectionHUDProps {
  expanded?: boolean;
  className?: string;
}

export function AffectionHUD({ expanded = true, className }: AffectionHUDProps) {
  const affection = useAffection();
  const [mounted, setMounted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const deltaTimer = useRef<number | null>(null);

  // Evita mismatch SSR: solo mostrar XP real después de montar en el cliente
  useEffect(() => {
    setMounted(true);
    const onXP = (event: Event) => {
      const amount = Number((event as CustomEvent).detail?.amount || 0);
      setPulse(false);
      window.requestAnimationFrame(() => setPulse(true));
      if (amount !== 0) setDelta(amount);

      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      if (deltaTimer.current) window.clearTimeout(deltaTimer.current);
      pulseTimer.current = window.setTimeout(() => setPulse(false), 650);
      deltaTimer.current = window.setTimeout(() => setDelta(null), 1500);
    };
    window.addEventListener("aiko:xp", onXP);
    return () => {
      window.removeEventListener("aiko:xp", onXP);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      if (deltaTimer.current) window.clearTimeout(deltaTimer.current);
    };
  }, []);

  const level = mounted ? affection.level : 1;
  const xp = mounted ? affection.into : 0;
  const xpToNext = mounted ? affection.needed : 40;
  const streak = mounted ? affection.streakDays : 0;
  const progress = mounted ? Math.max(0, Math.min(1, affection.progress)) : 0;

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = progress * circumference;

  const title = mounted
    ? `Nivel ${level} · ${titleFor(level)}\n${xp}/${xpToNext} XP\nRacha: ${streak} días`
    : "Nivel 1 · Curiosa";

  return (
    <div
      className={cn(
        "glass-panel relative flex items-center gap-2.5 overflow-visible rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.025] px-2.5 py-2.5 shadow-lg shadow-black/10 transition-all duration-300",
        pulse && "border-pink-300/35 shadow-[0_0_24px_rgba(244,114,182,.16)]",
        className,
      )}
      title={title}
    >
      {delta !== null && (
        <span
          className={cn(
            "pointer-events-none absolute -right-1 -top-3 z-20 rounded-full border px-2 py-0.5 text-[9px] font-bold shadow-lg backdrop-blur-md transition",
            delta > 0
              ? "border-emerald-300/25 bg-emerald-500/20 text-emerald-200"
              : "border-rose-300/25 bg-rose-500/20 text-rose-200",
          )}
        >
          {delta > 0 ? "+" : ""}{delta} XP
        </span>
      )}

      <div className={cn("relative h-11 w-11 shrink-0 transition-transform duration-300", pulse && "scale-110")}>
        {pulse && (
          <span className="absolute inset-1 animate-ping rounded-full bg-pink-400/20" />
        )}
        <svg viewBox="0 0 40 40" className="relative h-11 w-11 -rotate-90 drop-shadow-[0_0_7px_rgba(244,114,182,.22)]">
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-white/10"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="url(#affGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{
              strokeDashoffset: 0,
              transition: "stroke-dasharray 700ms cubic-bezier(.22,1,.36,1)",
            }}
          />
          <defs>
            <linearGradient id="affGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart
            className={cn(
              "h-4 w-4 fill-primary text-primary transition-transform duration-300 drop-shadow-[0_0_7px_rgba(244,114,182,.55)]",
              pulse && "scale-125",
            )}
          />
        </div>
      </div>

      {expanded && (
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1 truncate text-xs font-semibold text-foreground">
            <span>Nv.{level}</span>
            <span className="font-normal text-muted-foreground">
              {mounted ? titleFor(level) : "Curiosa"}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/[0.04]">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-pink-500 via-primary to-cyan-300 shadow-[0_0_9px_rgba(244,114,182,.45)] transition-[width] duration-700 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>
            {mounted ? `${xp}/${xpToNext} XP` : "— XP"}
            </span>
            {mounted && streak > 0 && (
              <span className="shrink-0 text-amber-300/80">🔥 {streak}d</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
