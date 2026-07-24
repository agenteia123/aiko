// Local productivity store — todos, reminders, calendar events, habits, notes.
// All data lives in localStorage so Aiko stays 100% local-first.
// Ready to migrate to Tauri's fs / SQLite when packaged.

export type Priority = "low" | "med" | "high";

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
  due?: number; // epoch ms
  createdAt: number;
  tags?: string[];
}

export interface Reminder {
  id: string;
  text: string;
  at: number; // epoch ms
  fired?: boolean;
  repeat?: "none" | "daily" | "weekly";
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  notes?: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji?: string;
  createdAt: number;
  // ISO date strings YYYY-MM-DD marking completion
  checks: string[];
}

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  pinned?: boolean;
}

const K = {
  todos: "aiko.todos.v1",
  reminders: "aiko.reminders.v1",
  events: "aiko.events.v1",
  habits: "aiko.habits.v1",
  notes: "aiko.notes.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const store = {
  loadTodos: () => read<Todo[]>(K.todos, []),
  saveTodos: (v: Todo[]) => write(K.todos, v),
  loadReminders: () => read<Reminder[]>(K.reminders, []),
  saveReminders: (v: Reminder[]) => write(K.reminders, v),
  loadEvents: () => read<CalendarEvent[]>(K.events, []),
  saveEvents: (v: CalendarEvent[]) => write(K.events, v),
  loadHabits: () => read<Habit[]>(K.habits, []),
  saveHabits: (v: Habit[]) => write(K.habits, v),
  loadNotes: () => read<Note[]>(K.notes, []),
  saveNotes: (v: Note[]) => write(K.notes, v),
};

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Streak counter for a habit (consecutive days ending today)
export function habitStreak(h: Habit): number {
  const set = new Set(h.checks);
  let n = 0;
  const d = new Date();
  while (set.has(todayISO(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
