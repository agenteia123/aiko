/**
 * API Configuration
 * Configuración centralizada para conectar con el backend FastAPI
 * 
 * Las credenciales de proveedor y el secreto de firma viven únicamente en el backend.
 */

/**
 * URL base del backend FastAPI
 * En desarrollo: http://localhost:8000
 * Configura VITE_API_URL en .env.local solo si el backend está en otra URL.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .replace(/\/+$/, "");

const SESSION_KEY = "aiko.session.v1";

export interface AikoSession {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user_id: string;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AikoSession;
    return session.access_token || null;
  } catch {
    return null;
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function getAuthorizationHeader(): string | null {
  const token = getAccessToken();
  return token ? `Bearer ${token}` : null;
}

function handleUnauthorized(response: Response, url: string): void {
  if (
    response.status === 401 &&
    !url.includes("/api/auth/login") &&
    typeof window !== "undefined"
  ) {
    clearAccessToken();
    window.dispatchEvent(new Event("aiko-auth-expired"));
  }
}

/** Fetch with the active session and expire the UI session on 401. */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, { ...options, headers });
  handleUnauthorized(response, url);
  return response;
}

export async function loginToAiko(
  username: string,
  password: string,
): Promise<AikoSession> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `No se pudo iniciar sesión (${response.status}).`);
  }

  const session = payload as AikoSession;
  if (!session.access_token || session.token_type !== "bearer") {
    throw new Error("El backend devolvió una sesión inválida.");
  }
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("aiko-authenticated"));
  return session;
}

/**
 * Análisis nivel
 */
export const DEFAULT_ANALYSIS_LEVEL = "balanced" as const;
export const ANALYSIS_LEVELS = ["fast", "balanced", "deep"] as const;

/**
 * Compatibility ID for older helpers; the backend takes identity from the JWT.
 */
export const DEFAULT_USER_ID = "user-123";

/**
 * Configuración de timeouts
 */
export const REQUEST_TIMEOUT_MS = 30000; // 30 segundos

/**
 * Interfaz para respuesta de chat del backend
 */
export interface ChatResponse {
  success: boolean;
  message_id?: string;
  response?: string;
  conversation_id?: string;
  timestamp?: number;
  tool_calls?: ToolCall[];
  analysis_metadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: string;
}

/**
 * Interfaz para tool calls
 */
export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "done" | "error";
  error?: string;
}

/**
 * Crear cliente HTTP con configuración por defecto
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await authenticatedFetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Hacer llamada a API de chat
 */
export async function callChatAPI(
  message: string,
  conversationId: string,
  userId: string = DEFAULT_USER_ID,
  analysisLevel: "fast" | "balanced" | "deep" = DEFAULT_ANALYSIS_LEVEL,
  attachments?: unknown[],
  provider?: string,
  model?: string,
): Promise<ChatResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/chat/message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        user_id: userId,
        analysis_level: analysisLevel,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        provider,
        model,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Backend error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Hacer llamada a API de voz (TTS)
 */
export async function callTTSAPI(
  text: string,
  voice: string = "default",
  language: string = "es"
): Promise<{ success: boolean; audio_url: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/voice/tts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voice, language }),
    }
  );

  if (!response.ok) {
    throw new Error(`TTS error: ${response.status}`);
  }

  return response.json();
}

/**
 * Hacer llamada a API de voz (STT)
 */
export async function callSTTAPI(
  audioFile: Blob,
  language: string = "es"
): Promise<{ success: boolean; text: string }> {
  const formData = new FormData();
  formData.append("file", audioFile);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/voice/stt?language=${language}`,
    {
      method: "POST",
      headers: {
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`STT error: ${response.status}`);
  }

  return response.json();
}

/**
 * Obtener historial de conversación
 */
export async function getChatHistory(
  conversationId: string
): Promise<{ success: boolean; messages: unknown[] }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/chat/history/${conversationId}`,
    {
      method: "GET",
      headers: {
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Get history error: ${response.status}`);
  }

  return response.json();
}

/**
 * Limpiar historial de conversación
 */
export async function clearChatHistory(
  conversationId: string
): Promise<{ success: boolean }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/chat/history/${conversationId}`,
    {
      method: "DELETE",
      headers: {
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Clear history error: ${response.status}`);
  }

  return response.json();
}

/**
 * Obtener configuración del backend
 */
export async function getBackendSettings(): Promise<{
  success: boolean;
  app_name: string;
  version: string;
  llm_provider: string;
  analysis_level: string;
  features: Record<string, boolean>;
}> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/settings/`,
    {
      method: "GET",
      headers: {
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Settings error: ${response.status}`);
  }

  return response.json();
}

/**
 * Cambiar nivel de análisis
 */
export async function setAnalysisLevel(
  level: "fast" | "balanced" | "deep"
): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/settings/analysis-level`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ level }),
    }
  );

  if (!response.ok) {
    throw new Error(`Set analysis level error: ${response.status}`);
  }

  return response.json();
}

/**
 * Verificar salud del backend
 */
export async function checkBackendHealth(): Promise<{
  status: string;
  version: string;
  app: string;
}> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/health`,
      {
        method: "GET",
      },
      5000 // timeout más corto para health check
    );

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    console.error("Backend health check failed:", err);
    throw err;
  }
}

/**
 * Buscar en memoria del usuario
 */
export async function searchMemory(
  query: string,
  userId: string = DEFAULT_USER_ID,
  limit: number = 5
): Promise<{ success: boolean; results: unknown[] }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/memory/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        query,
        limit,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Search memory error: ${response.status}`);
  }

  return response.json();
}

/**
 * Guardar un hecho sobre el usuario
 */
export async function saveUserFact(
  fact: string,
  userId: string = DEFAULT_USER_ID,
  category: string = "general"
): Promise<{ success: boolean; fact_id: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/memory/facts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        fact,
        category,
        confidence: 0.8,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Save fact error: ${response.status}`);
  }

  return response.json();
}

/**
 * Realizar búsqueda en internet
 */
export async function searchInternet(
  query: string,
  maxResults: number = 5
): Promise<{ success: boolean; results: unknown[] }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/tools/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Search error: ${response.status}`);
  }

  return response.json();
}
