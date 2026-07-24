import { Heart, Flame } from "lucide-react";
import { useAffection } from "@/lib/affection";
import { cn } from "@/lib/utils";

interface Props {
  expanded: boolean;
}

export function AffectionHUD({ expanded }: Props) {
  const a = useAffection();
  const circumference = 2 * Math.PI * 16;
  const dash = circumference * a.progress;

  return (
    <div
      className={cn(
        "glass-panel relative flex items-center gap-2 rounded-xl px-2 py-2 transition-all",
        expanded ? "" : "justify-center",
      )}
      title={`Nivel ${a.level} · ${a.title}\n${a.into}/${a.needed} XP\nRacha: ${a.streakDays} día${a.streakDays === 1 ? "" : "s"}`}
    >
      <div className="relative h-10 w-10 shrink-0">
        <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="oklch(0.4 0.05 285 / 0.35)"
            strokeWidth="3"
          />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="url(#affGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 500ms ease" }}
          />
          <defs>
            <linearGradient id="affGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.82 0.17 355)" />
              <stop offset="100%" stopColor="oklch(0.82 0.14 195)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart className="h-4 w-4 fill-primary text-primary text-glow-pink" />
        </div>
      </div>
      {expanded && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-foreground">
              Nv. {a.level}
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-accent">
              <Flame className="h-2.5 w-2.5" />
              {a.streakDays}
            </div>
          </div>
          <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            {a.title}
          </div>
        </div>
      )}
    </div>
  );
}
