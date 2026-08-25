import { useEffect, useState } from "react";
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

  // Evita mismatch SSR: solo mostrar XP real después de montar en el cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  const level = mounted ? affection.level : 1;
  const xp = mounted ? affection.xp : 0;
  const xpToNext = mounted ? affection.xpToNext : 40;
  const streak = mounted ? affection.streak : 0;
  const progress = mounted && xpToNext > 0 ? Math.min(1, xp / xpToNext) : 0;

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = progress * circumference;

  const title = mounted
    ? `Nivel ${level} · ${titleFor(level)}\n${xp}/${xpToNext} XP\nRacha: ${streak} días`
    : "Nivel 1 · Curiosa";

  return (
    <div
      className={cn(
        "glass-panel relative flex items-center gap-2 rounded-xl px-2 py-2 transition",
        className,
      )}
      title={title}
    >
      <div className="relative h-10 w-10 shrink-0">
        <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
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
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
          <defs>
            <linearGradient id="affGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
        </div>
      </div>

      {expanded && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-foreground">
            Nv.{level}{" "}
            <span className="font-normal text-muted-foreground">
              {mounted ? titleFor(level) : "Curiosa"}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {mounted ? `${xp}/${xpToNext} XP` : "— XP"}
            {mounted && streak > 0 ? ` · 🔥 ${streak}d` : ""}
          </div>
        </div>
      )}
    </div>
  );
}