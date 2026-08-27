// Affection / gamification — Aiko gets happier the more you interact.
// XP curve: each level requires 25% more XP than the previous.
// Interactions dispatch a global "aiko:xp" event so any UI can react (toast,
// avatar glow, level-up burst).
import { useEffect, useState } from "react";

const KEY = "aiko.affection.v2";
const BASE = 40;

export interface AffectionState {
  xp: number;
  totalXp: number;
  streakDays: number;
  lastActive: string; // ISO date YYYY-MM-DD
}

export const XP_REWARDS = {
  avatarClick: 2,
  message: 4,
  todoDone: 5,
  habitCheck: 6,
  reminderSet: 3,
  noteSaved: 3,
} as const;

export type XPReason = keyof typeof XP_REWARDS;
export type AffectionPenaltyReason = "chestTouch" | "buttTouch";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function xpForLevel(level: number) {
  // total XP required to REACH `level` from 0
  let total = 0;
  let step = BASE;
  for (let i = 1; i < level; i++) {
    total += step;
    step = Math.round(step * 1.25);
  }
  return total;
}

function levelInfo(totalXp: number) {
  let level = 1;
  let step = BASE;
  let acc = 0;
  while (acc + step <= totalXp) {
    acc += step;
    level++;
    step = Math.round(step * 1.25);
  }
  const into = totalXp - acc;
  return { level, into, needed: step, progress: into / step };
}

export const AFFECTION_TITLES: Record<number, string> = {
  1: "Curiosa",
  3: "Amistosa",
  6: "Cariñosa",
  10: "Devota",
  15: "Enamorada",
  20: "Inseparable",
};

export function titleFor(level: number) {
  const keys = Object.keys(AFFECTION_TITLES)
    .map(Number)
    .sort((a, b) => b - a);
  for (const k of keys) if (level >= k) return AFFECTION_TITLES[k];
  return "Curiosa";
}

function read(): AffectionState {
  if (typeof window === "undefined")
    return { xp: 0, totalXp: 0, streakDays: 0, lastActive: todayISO() };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AffectionState;
  } catch {
    /* ignore */
  }
  return { xp: 0, totalXp: 0, streakDays: 0, lastActive: todayISO() };
}

function write(s: AffectionState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const EVT = "aiko:xp";
const LEVEL_EVT = "aiko:levelup";

export function gainXP(reason: XPReason) {
  if (typeof window === "undefined") return;
  const amount = XP_REWARDS[reason];
  const cur = read();
  const today = todayISO();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  let streak = cur.streakDays;
  if (cur.lastActive === today) {
    // same day, keep streak
  } else if (cur.lastActive === yesterday) {
    streak = streak + 1;
  } else {
    streak = 1;
  }
  const beforeLevel = levelInfo(cur.totalXp).level;
  const next: AffectionState = {
    ...cur,
    totalXp: cur.totalXp + amount,
    xp: cur.totalXp + amount,
    streakDays: streak,
    lastActive: today,
  };
  write(next);
  const afterLevel = levelInfo(next.totalXp).level;
  window.dispatchEvent(
    new CustomEvent(EVT, { detail: { reason, amount, state: next } }),
  );
  if (afterLevel > beforeLevel) {
    window.dispatchEvent(
      new CustomEvent(LEVEL_EVT, { detail: { level: afterLevel } }),
    );
  }
}

// Removes affection without ever allowing XP to become negative.
// It emits the same event as gainXP so every counter, glow and progress bar
// refreshes immediately.
export function loseXP(amount: number, reason: AffectionPenaltyReason) {
  if (typeof window === "undefined") return;
  const penalty = Math.max(0, Math.abs(Math.round(amount)));
  if (penalty === 0) return;

  const cur = read();
  const nextTotal = Math.max(0, cur.totalXp - penalty);
  const appliedAmount = cur.totalXp - nextTotal;
  const next: AffectionState = {
    ...cur,
    totalXp: nextTotal,
    xp: nextTotal,
  };

  write(next);
  window.dispatchEvent(
    new CustomEvent(EVT, {
      detail: { reason, amount: -appliedAmount, state: next },
    }),
  );
}

export function useAffection() {
  const [state, setState] = useState<AffectionState>(read);
  useEffect(() => {
    const onXP = () => setState(read());
    window.addEventListener(EVT, onXP);
    window.addEventListener("storage", onXP);
    return () => {
      window.removeEventListener(EVT, onXP);
      window.removeEventListener("storage", onXP);
    };
  }, []);
  const info = levelInfo(state.totalXp);
  return {
    ...state,
    level: info.level,
    into: info.into,
    needed: info.needed,
    progress: info.progress,
    title: titleFor(info.level),
  };
}

export function onLevelUp(cb: (level: number) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail.level);
  window.addEventListener(LEVEL_EVT, h);
  return () => window.removeEventListener(LEVEL_EVT, h);
}

export { xpForLevel };
