// Conversation storage — multi-thread, localStorage backed.
// Aiko keeps every conversation locally so you can rename / search / delete.

export interface ChatMessage {
  id: string;
  role: "user" | "aiko";
  text: string;
  at: number;
  /** attached image/file previews (data URLs, small) */
  attachments?: { name: string; kind: "image" | "file"; dataUrl?: string }[];
  /** transient tool activity trace */
  tool?: { name: string; status: "running" | "done" | "error"; note?: string };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

const STORAGE_KEY = "aiko.conversations.v1";
const ACTIVE_KEY = "aiko.conversations.active.v1";
const LEGACY_KEY = "aiko.chat.v1";

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Conversation[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
    // Migrate legacy single-thread history
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const msgs = JSON.parse(legacy) as ChatMessage[];
      if (Array.isArray(msgs) && msgs.length) {
        const c: Conversation = {
          id: crypto.randomUUID(),
          title: deriveTitle(msgs),
          createdAt: msgs[0]?.at ?? Date.now(),
          updatedAt: msgs.at(-1)?.at ?? Date.now(),
          messages: msgs,
        };
        saveConversations([c]);
        return [c];
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveConversations(list: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveId(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function newConversation(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Nueva conversación",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function deriveTitle(msgs: ChatMessage[] | undefined | null): string {
  if (!msgs || !Array.isArray(msgs) || msgs.length === 0) {
    return "Nueva conversación";
  }
  
  const firstUser = msgs.find((m) => m.role === "user");
  if (firstUser?.text) {
    return firstUser.text.slice(0, 40).trim() + (firstUser.text.length > 40 ? "..." : "");
  }
  
  return "Nueva conversación";
}
