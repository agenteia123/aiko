import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the vendor-prefixed Web Speech API.
type SRResult = { transcript: string; isFinal: boolean };
interface SRLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<SRResult>> & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getRecognitionCtor(): (new () => SRLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SRLike;
    webkitSpeechRecognition?: new () => SRLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  onFinal?: (text: string) => void;
}

/**
 * Wrapper around the browser Web Speech API for STT.
 * Works offline on Chrome/Edge/Safari with system voices.
 */
export function useSpeechRecognition(opts: UseSpeechRecognitionOptions = {}) {
  const { lang = "es-ES", continuous = false, onFinal } = opts;
  const [supported] = useState(() => !!getRecognitionCtor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SRLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (ref.current) {
      try {
        ref.current.abort();
      } catch {
        /* ignore */
      }
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      let finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i][0];
        if (e.results[i] && (e.results[i] as unknown as { isFinal?: boolean }).isFinal) {
          finalText += r.transcript;
        } else {
          interimText += r.transcript;
        }
      }
      setInterim(interimText);
      if (finalText) {
        onFinalRef.current?.(finalText.trim());
        setInterim("");
      }
    };
    rec.onerror = (e) => setError(e.error ?? "error");
    rec.onend = () => setListening(false);
    ref.current = rec;
    setError(null);
    setInterim("");
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      setError(String(err));
    }
  }, [lang, continuous]);

  const stop = useCallback(() => {
    try {
      ref.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  useEffect(() => () => {
    try {
      ref.current?.abort();
    } catch {
      /* ignore */
    }
  }, []);

  return { supported, listening, interim, error, start, stop };
}
