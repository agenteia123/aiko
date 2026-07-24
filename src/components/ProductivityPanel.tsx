// Productivity suite — Todos, Reminders, Calendar/Agenda, Habits, Notes.
// Each sub-tab is intentionally compact and keyboard-friendly.
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellPlus,
  CalendarDays,
  CheckSquare,
  Flame,
  ListTodo,
  Pin,
  PinOff,
  Plus,
  Repeat,
  StickyNote,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  habitStreak,
  store,
  todayISO,
  type CalendarEvent,
  type Habit,
  type Note,
  type Priority,
  type Reminder,
  type Todo,
} from "@/lib/productivity";
import { requestNotificationPermission } from "@/lib/useReminders";
import { gainXP } from "@/lib/affection";
import { sfx } from "@/lib/sfx";


type Sub = "todo" | "reminders" | "agenda" | "habits" | "notes";

const SUBS: { id: Sub; label: string; icon: typeof ListTodo }[] = [
  { id: "todo", label: "Tareas", icon: ListTodo },
  { id: "reminders", label: "Recordatorios", icon: Bell },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "habits", label: "Hábitos", icon: Flame },
  { id: "notes", label: "Notas", icon: StickyNote },
];

export function ProductivityPanel() {
  const [sub, setSub] = useState<Sub>("todo");

  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-2xl">
      <header className="border-b border-white/5 px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-glow-pink">
          Productividad
        </h2>
        <p className="text-xs text-muted-foreground">
          Aiko te ayuda a ordenar tu día, Ale 💗
        </p>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-white/5 px-3 py-2">
        {SUBS.map((s) => {
          const Icon = s.icon;
          const active = s.id === sub;
          return (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                active
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  active ? "text-primary" : "text-accent",
                )}
              />
              {s.label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 overflow-y-auto p-4">
        {sub === "todo" && <TodoSection />}
        {sub === "reminders" && <RemindersSection />}
        {sub === "agenda" && <AgendaSection />}
        {sub === "habits" && <HabitsSection />}
        {sub === "notes" && <NotesSection />}
      </div>
    </div>
  );
}

/* ------------------------------- Todos ------------------------------- */

function TodoSection() {
  const [items, setItems] = useState<Todo[]>(() => store.loadTodos());
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState<Priority>("med");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

  useEffect(() => store.saveTodos(items), [items]);

  function add() {
    const text = draft.trim();
    if (!text) return;
    setItems((x) => [
      {
        id: crypto.randomUUID(),
        text,
        done: false,
        priority,
        createdAt: Date.now(),
      },
      ...x,
    ]);
    setDraft("");
  }

  const visible = items.filter((t) =>
    filter === "all" ? true : filter === "open" ? !t.done : t.done,
  );
  const openCount = items.filter((t) => !t.done).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nueva tarea..."
          className="glass-panel flex-1 rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="glass-panel rounded-lg bg-transparent px-2 text-xs outline-none"
          title="Prioridad"
        >
          <option value="low">Baja</option>
          <option value="med">Media</option>
          <option value="high">Alta</option>
        </select>
        <button
          onClick={add}
          className="rounded-lg bg-primary px-3 text-sm text-primary-foreground neon-pink"
          aria-label="Agregar"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{openCount} pendientes</span>
        <div className="flex gap-1">
          {(["open", "all", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded px-2 py-1",
                filter === f ? "bg-primary/15 text-foreground" : "hover:text-foreground",
              )}
            >
              {f === "open" ? "Activas" : f === "done" ? "Hechas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-1.5">
        {visible.map((t) => (
          <li
            key={t.id}
            className="glass-panel group flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <button
              onClick={() => {
                if (!t.done) {
                  sfx.pop();
                  gainXP("todoDone");
                } else {
                  sfx.click();
                }
                setItems((x) =>
                  x.map((it) => (it.id === t.id ? { ...it, done: !it.done } : it)),
                );
              }}

              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                t.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/20 hover:border-primary",
              )}
              aria-label="Marcar"
            >
              {t.done && <CheckSquare className="h-3.5 w-3.5" />}
            </button>
            <span
              className={cn(
                "flex-1 truncate",
                t.done && "text-muted-foreground line-through",
              )}
            >
              {t.text}
            </span>
            <PriorityDot p={t.priority} />
            <button
              onClick={() => setItems((x) => x.filter((it) => it.id !== t.id))}
              className="opacity-0 transition group-hover:opacity-100"
              aria-label="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted-foreground">
            Sin tareas por aquí. Aiko está orgullosa de ti ✨
          </li>
        )}
      </ul>
    </div>
  );
}

function PriorityDot({ p }: { p: Priority }) {
  const c =
    p === "high"
      ? "bg-destructive"
      : p === "med"
        ? "bg-primary"
        : "bg-accent/60";
  return <span className={cn("h-2 w-2 rounded-full", c)} title={`Prioridad ${p}`} />;
}

/* ------------------------------ Reminders ------------------------------ */

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function RemindersSection() {
  const [items, setItems] = useState<Reminder[]>(() => store.loadReminders());
  const [text, setText] = useState("");
  const [when, setWhen] = useState(() =>
    toLocalInput(Date.now() + 30 * 60 * 1000),
  );
  const [repeat, setRepeat] = useState<Reminder["repeat"]>("none");
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => store.saveReminders(items), [items]);

  function add() {
    const t = text.trim();
    if (!t) return;
    const at = new Date(when).getTime();
    if (isNaN(at)) return;
    setItems((x) => [
      { id: crypto.randomUUID(), text: t, at, repeat, fired: false },
      ...x,
    ]);
    setText("");
  }

  const upcoming = [...items]
    .filter((r) => !r.fired)
    .sort((a, b) => a.at - b.at);
  const past = items.filter((r) => r.fired);

  return (
    <div className="space-y-3">
      {perm !== "granted" && (
        <button
          onClick={async () => {
            const p = await Notification.requestPermission();
            setPerm(p);
          }}
          className="glass-panel flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-accent hover:bg-white/5"
        >
          <BellPlus className="h-4 w-4" /> Activar notificaciones de escritorio
        </button>
      )}
      <div className="space-y-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="¿Qué te recuerdo?"
          className="glass-panel w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="glass-panel flex-1 rounded-lg bg-transparent px-3 py-2 text-xs outline-none"
          />
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as Reminder["repeat"])}
            className="glass-panel rounded-lg bg-transparent px-2 text-xs outline-none"
            title="Repetición"
          >
            <option value="none">Una vez</option>
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
          </select>
          <button
            onClick={add}
            className="rounded-lg bg-primary px-3 text-sm text-primary-foreground neon-pink"
            aria-label="Agregar recordatorio"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Section title={`Próximos · ${upcoming.length}`}>
        {upcoming.map((r) => (
          <li
            key={r.id}
            className="glass-panel group flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <Bell className="h-3.5 w-3.5 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{r.text}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(r.at).toLocaleString()}
                {r.repeat !== "none" && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Repeat className="h-2.5 w-2.5" />
                    {r.repeat}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setItems((x) => x.filter((it) => it.id !== r.id))}
              className="opacity-0 transition group-hover:opacity-100"
              aria-label="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
        {upcoming.length === 0 && <Empty>Nada agendado. Respira 💆‍♀️</Empty>}
      </Section>

      {past.length > 0 && (
        <Section title={`Ya sonaron · ${past.length}`}>
          {past.slice(0, 5).map((r) => (
            <li
              key={r.id}
              className="glass-panel group flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
            >
              <span className="flex-1 truncate">{r.text}</span>
              <button
                onClick={() => setItems((x) => x.filter((it) => it.id !== r.id))}
                aria-label="Eliminar"
              >
                <Trash2 className="h-3 w-3 hover:text-destructive" />
              </button>
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

/* ------------------------------- Agenda ------------------------------- */

function AgendaSection() {
  const [items, setItems] = useState<CalendarEvent[]>(() => store.loadEvents());
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => store.saveEvents(items), [items]);

  function add() {
    const t = title.trim();
    if (!t) return;
    setItems((x) => [...x, { id: crypto.randomUUID(), title: t, date, time }]);
    setTitle("");
    setTime("");
  }

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of items) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([d]) => d >= todayISO())
      .slice(0, 14);
  }, [items]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del evento"
          className="glass-panel w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="glass-panel flex-1 rounded-lg bg-transparent px-3 py-2 text-xs outline-none"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="glass-panel w-28 rounded-lg bg-transparent px-3 py-2 text-xs outline-none"
          />
          <button
            onClick={add}
            className="rounded-lg bg-primary px-3 text-sm text-primary-foreground neon-pink"
            aria-label="Agregar evento"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {grouped.length === 0 && (
        <Empty>Tu agenda de las próximas 2 semanas está libre.</Empty>
      )}
      {grouped.map(([d, evts]) => (
        <div key={d}>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {formatDay(d)}
          </div>
          <ul className="space-y-1.5">
            {evts
              .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
              .map((e) => (
                <li
                  key={e.id}
                  className="glass-panel group flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-accent" />
                  <span className="flex-1 truncate">{e.title}</span>
                  {e.time && (
                    <span className="text-xs text-muted-foreground">{e.time}</span>
                  )}
                  <button
                    onClick={() => setItems((x) => x.filter((it) => it.id !== e.id))}
                    className="opacity-0 transition group-hover:opacity-100"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = todayISO();
  if (iso === today) return "Hoy";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === todayISO(tomorrow)) return "Mañana";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/* -------------------------------- Habits -------------------------------- */

function HabitsSection() {
  const [items, setItems] = useState<Habit[]>(() => store.loadHabits());
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✨");

  useEffect(() => store.saveHabits(items), [items]);

  function add() {
    const n = name.trim();
    if (!n) return;
    setItems((x) => [
      ...x,
      {
        id: crypto.randomUUID(),
        name: n,
        emoji,
        createdAt: Date.now(),
        checks: [],
      },
    ]);
    setName("");
  }

  function toggleToday(id: string) {
    const today = todayISO();
    let awarded = false;
    setItems((x) =>
      x.map((h) => {
        if (h.id !== id) return h;
        const has = h.checks.includes(today);
        if (!has) awarded = true;
        return {
          ...h,
          checks: has ? h.checks.filter((d) => d !== today) : [...h.checks, today],
        };
      }),
    );
    if (awarded) {
      sfx.pop();
      gainXP("habitCheck");
    } else {
      sfx.click();
    }
  }


  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
          className="glass-panel w-12 rounded-lg bg-transparent px-2 py-2 text-center text-sm outline-none"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nuevo hábito (ej. Leer 20 min)"
          className="glass-panel flex-1 rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
        />
        <button
          onClick={add}
          className="rounded-lg bg-primary px-3 text-sm text-primary-foreground neon-pink"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-1.5">
        {items.map((h) => {
          const today = todayISO();
          const doneToday = h.checks.includes(today);
          const streak = habitStreak(h);
          return (
            <li
              key={h.id}
              className="glass-panel group flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
            >
              <button
                onClick={() => toggleToday(h.id)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-lg transition",
                  doneToday
                    ? "bg-primary text-primary-foreground neon-pink"
                    : "bg-white/5 hover:bg-white/10",
                )}
                aria-label="Marcar hoy"
              >
                {h.emoji || "✨"}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate">{h.name}</div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Flame
                    className={cn(
                      "h-3 w-3",
                      streak > 0 ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {streak} día{streak === 1 ? "" : "s"} de racha
                </div>
              </div>
              <HabitDots checks={h.checks} />
              <button
                onClick={() => setItems((x) => x.filter((it) => it.id !== h.id))}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          );
        })}
        {items.length === 0 && (
          <Empty>Añade un hábito y vamos por él, Ale 🔥</Empty>
        )}
      </ul>
    </div>
  );
}

function HabitDots({ checks }: { checks: string[] }) {
  const set = new Set(checks);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { iso: todayISO(d), label: d.toLocaleDateString(undefined, { weekday: "narrow" }) };
  });
  return (
    <div className="flex gap-0.5">
      {days.map((d) => (
        <span
          key={d.iso}
          title={d.iso}
          className={cn(
            "h-4 w-2 rounded-sm",
            set.has(d.iso) ? "bg-primary" : "bg-white/10",
          )}
        />
      ))}
    </div>
  );
}

/* --------------------------------- Notes --------------------------------- */

function NotesSection() {
  const [items, setItems] = useState<Note[]>(() => store.loadNotes());
  const [activeId, setActiveId] = useState<string | null>(() => items[0]?.id ?? null);
  useEffect(() => store.saveNotes(items), [items]);

  const active = items.find((n) => n.id === activeId) ?? null;

  function create() {
    const n: Note = {
      id: crypto.randomUUID(),
      title: "Nueva nota",
      body: "",
      updatedAt: Date.now(),
    };
    setItems((x) => [n, ...x]);
    setActiveId(n.id);
  }

  function patch(patch: Partial<Note>) {
    if (!active) return;
    setItems((x) =>
      x.map((n) =>
        n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    );
  }

  const sorted = [...items].sort((a, b) => {
    if ((a.pinned ? 1 : 0) !== (b.pinned ? 1 : 0)) return b.pinned ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="flex h-full min-h-[380px] gap-3">
      <div className="flex w-40 flex-col gap-2">
        <button
          onClick={create}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground neon-pink"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva
        </button>
        <ul className="space-y-1 overflow-y-auto">
          {sorted.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => setActiveId(n.id)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition",
                  activeId === n.id
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-white/5",
                )}
              >
                {n.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                <span className="truncate">{n.title || "Sin título"}</span>
              </button>
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="rounded-lg border border-dashed border-white/10 px-2 py-4 text-center text-[10px] text-muted-foreground">
              Sin notas
            </li>
          )}
        </ul>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {active ? (
          <>
            <div className="flex gap-2">
              <input
                value={active.title}
                onChange={(e) => patch({ title: e.target.value })}
                className="glass-panel flex-1 rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={() => patch({ pinned: !active.pinned })}
                className="glass-panel rounded-lg px-2 text-muted-foreground hover:text-foreground"
                title={active.pinned ? "Desfijar" : "Fijar"}
              >
                {active.pinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => {
                  setItems((x) => x.filter((n) => n.id !== active.id));
                  setActiveId(null);
                }}
                className="glass-panel rounded-lg px-2 text-muted-foreground hover:text-destructive"
                aria-label="Eliminar nota"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={active.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="Escribe aquí. Aiko no leerá si no le pides..."
              className="glass-panel flex-1 resize-none rounded-lg bg-transparent p-3 text-sm outline-none"
            />
            <div className="text-right text-[10px] uppercase tracking-widest text-muted-foreground">
              Guardado · {new Date(active.updatedAt).toLocaleString()}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-muted-foreground">
            Selecciona o crea una nota
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Shared --------------------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted-foreground">
      {children}
    </li>
  );
}

// Re-export so index can wire it up next to the other panels.
export { requestNotificationPermission };
