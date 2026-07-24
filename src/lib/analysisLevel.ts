// Global "Analysis Level" — controls how Aiko searches, reads and responds.
// Fast → superficial + rápido · Balanced → default · Deep → investigación exhaustiva.
import { useEffect, useState } from "react";

export type AnalysisLevel = "fast" | "balanced" | "deep";
const KEY = "aiko.analysisLevel.v1";

export const LEVEL_META: Record<
  AnalysisLevel,
  { label: string; desc: string; color: string }
> = {
  fast: {
    label: "Rápido",
    desc: "Respuestas cortas, sin buscar. Máxima velocidad.",
    color: "var(--aiko-teal)",
  },
  balanced: {
    label: "Balanceado",
    desc: "Buen equilibrio entre profundidad y velocidad. Por defecto.",
    color: "var(--aiko-pink)",
  },
  deep: {
    label: "Profundo",
    desc: "Investigación exhaustiva, múltiples fuentes, análisis detallado.",
    color: "var(--aiko-red)",
  },
};

export function useAnalysisLevel() {
  const [level, setLevel] = useState<AnalysisLevel>(() => {
    if (typeof window === "undefined") return "balanced";
    return (localStorage.getItem(KEY) as AnalysisLevel) ?? "balanced";
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, level);
    } catch {
      /* ignore */
    }
  }, [level]);
  return { level, setLevel };
}
