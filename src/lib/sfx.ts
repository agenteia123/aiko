// Tiny WebAudio-based sound effects. No assets, no network. All synthesized
// on demand. Kept intentionally short and quiet so they feel "delightful"
// instead of intrusive. Users can disable in settings.

const KEY = "aiko.sfx.enabled.v1";

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ||= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

export function isSfxEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(KEY);
  return v === null ? true : v === "1";
}

export function setSfxEnabled(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function tone(
  freq: number,
  duration: number,
  opts: {
    type?: OscillatorType;
    volume?: number;
    slideTo?: number;
    delay?: number;
  } = {},
) {
  if (!isSfxEnabled()) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);
  const vol = opts.volume ?? 0.06;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  send() {
    tone(660, 0.14, { type: "triangle", slideTo: 990, volume: 0.05 });
  },
  receive() {
    tone(520, 0.18, { type: "sine", slideTo: 740, volume: 0.05 });
    tone(880, 0.14, { type: "sine", volume: 0.03, delay: 0.06 });
  },
  click() {
    tone(880, 0.08, { type: "triangle", volume: 0.04 });
  },
  pop() {
    tone(1200, 0.06, { type: "sine", slideTo: 1600, volume: 0.05 });
  },
  chime() {
    tone(880, 0.22, { type: "sine", volume: 0.05 });
    tone(1318, 0.28, { type: "sine", volume: 0.045, delay: 0.08 });
    tone(1760, 0.34, { type: "sine", volume: 0.04, delay: 0.16 });
  },
  levelUp() {
    tone(660, 0.14, { type: "triangle", volume: 0.06 });
    tone(880, 0.14, { type: "triangle", volume: 0.06, delay: 0.09 });
    tone(1320, 0.32, { type: "triangle", volume: 0.07, delay: 0.18 });
  },
  toggle() {
    tone(500, 0.06, { type: "square", volume: 0.03 });
  },
};
