import { useEffect } from "react";

export type Hotkey = {
  /** e.g. "mod+k", "mod+shift+n", "esc", "/" */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** allow when typing in inputs (default false) */
  allowInInput?: boolean;
};

function matches(e: KeyboardEvent, combo: string) {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const key = parts[parts.length - 1];
  const need = new Set(parts.slice(0, -1));
  const mod = e.metaKey || e.ctrlKey;
  if (need.has("mod") && !mod) return false;
  if (need.has("shift") && !e.shiftKey) return false;
  if (need.has("alt") && !e.altKey) return false;
  const k = e.key.toLowerCase();
  if (key === "esc") return k === "escape";
  if (key === "space") return k === " ";
  return k === key;
}

export function useHotkeys(hotkeys: Hotkey[]) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const isInput =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      for (const h of hotkeys) {
        if (!matches(e, h.combo)) continue;
        if (isInput && !h.allowInInput) continue;
        e.preventDefault();
        h.handler(e);
        break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys]);
}
