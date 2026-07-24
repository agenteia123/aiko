// Theme controller — dark (default), light, or system.
// Applies `.dark` / `.light` on <html> and persists to localStorage.
import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "light" | "system";
const KEY = "aiko.theme.v1";

function systemPrefersDark() {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

function apply(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  const html = document.documentElement;
  html.classList.toggle("dark", dark);
  html.classList.toggle("light", !dark);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(KEY) as ThemeMode) ?? "dark";
  });

  useEffect(() => {
    apply(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply("system");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [mode]);

  return { mode, setMode };
}
