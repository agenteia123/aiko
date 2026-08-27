import { useEffect, useId, useRef, useState } from "react";
import { Flame, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAffection, titleFor } from "@/lib/affection";

interface AffectionHUDProps {
  expanded?: boolean;
  className?: string;
}

export function AffectionHUD({
  expanded = true,
  className,
}: AffectionHUDProps) {
  const affection = useAffection();
  const [mounted, setMounted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const deltaTimer = useRef<number | null>(null);
  const levelTimer = useRef<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

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
    const onLevel = (event: Event) => {
      const nextLevel = Number((event as CustomEvent).detail?.level);
      if (!Number.isFinite(nextLevel)) return;
      setLevelUp(nextLevel);
      if (levelTimer.current) window.clearTimeout(levelTimer.current);
      levelTimer.current = window.setTimeout(() => setLevelUp(null), 2600);
    };
    window.addEventListener("aiko:xp", onXP);
    window.addEventListener("aiko:levelup", onLevel);
    return () => {
      window.removeEventListener("aiko:xp", onXP);
      window.removeEventListener("aiko:levelup", onLevel);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      if (deltaTimer.current) window.clearTimeout(deltaTimer.current);
      if (levelTimer.current) window.clearTimeout(levelTimer.current);
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
  const percent = Math.round(progress * 100);

  const title = mounted
    ? `Nivel ${level} · ${titleFor(level)}\n${xp}/${xpToNext} XP\nRacha: ${streak} días`
    : "Nivel 1 · Curiosa";

  return (
    <div
      className={cn(
        "glass-panel group relative flex items-center gap-2.5 overflow-visible rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-primary/[0.035] px-2.5 py-2.5 shadow-lg shadow-black/15 transition-all duration-300",
        pulse && "border-pink-300/35 shadow-[0_0_24px_rgba(244,114,182,.16)]",
        className,
      )}
      title={title}
    >
      {levelUp !== null && (
        <div className="pointer-events-none absolute inset-x-0 -top-10 z-30 flex justify-center">
          <div className="flex animate-bounce items-center gap-1.5 rounded-full border border-amber-300/25 bg-[#25202d]/95 px-3 py-1.5 text-[10px] font-semibold text-amber-200 shadow-[0_8px_28px_rgba(251,191,36,.2)] backdrop-blur-xl">
            <Sparkles className="h-3 w-3" /> Nivel {levelUp} alcanzado
          </div>
        </div>
      )}
      {delta !== null && (
        <span
          className={cn(
            "pointer-events-none absolute -right-1 -top-3 z-20 rounded-full border px-2 py-0.5 text-[9px] font-bold shadow-lg backdrop-blur-md transition",
            delta > 0
              ? "border-emerald-300/25 bg-emerald-500/20 text-emerald-200"
              : "border-rose-300/25 bg-rose-500/20 text-rose-200",
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta} XP
        </span>
      )}

      <div
        className={cn(
          "relative h-11 w-11 shrink-0 transition-transform duration-300",
          pulse && "scale-110",
        )}
      >
        {pulse && (
          <span className="absolute inset-1 animate-ping rounded-full bg-pink-400/20" />
        )}
        <svg
          viewBox="0 0 40 40"
          className="relative h-11 w-11 -rotate-90 drop-shadow-[0_0_7px_rgba(244,114,182,.22)]"
        >
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
            stroke={`url(#${gradientId})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{
              strokeDashoffset: circumference - dash,
              transition: "stroke-dashoffset 700ms cubic-bezier(.22,1,.36,1)",
            }}
          />
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-1 truncate text-xs font-semibold text-foreground">
              <span>Nv.{level}</span>
              <span className="font-normal text-muted-foreground">
                {mounted ? titleFor(level) : "Curiosa"}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-semibold text-foreground/55">
              {percent}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/[0.055]">
            <div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-pink-500 via-primary to-cyan-300 shadow-[0_0_9px_rgba(244,114,182,.45)] transition-[width] duration-700 ease-out after:absolute after:inset-y-0 after:w-8 after:animate-[pulse_1.4s_ease-in-out_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/50 after:to-transparent"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>{mounted ? `${xp}/${xpToNext} XP` : "— XP"}</span>
            {mounted && streak > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-amber-300/80">
                <Flame className="h-2.5 w-2.5 fill-current" /> {streak}d
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
