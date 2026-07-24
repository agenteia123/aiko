import { useEffect, useRef, useState } from "react";
import { useAffection } from "@/lib/affection";

type Reaction = "idle" | "blush" | "hearts";

interface AikoAvatarProps {
  onClick?: () => void;
  reactionOverride?: Reaction;
}

/**
 * AikoAvatar — rig SVG detallado de Aiko con seguimiento suave del cursor
 * mediante interpolación (lerp) sobre requestAnimationFrame. La intensidad
 * del brillo aumenta con el nivel de afecto.
 */
export function AikoAvatar({ onClick, reactionOverride }: AikoAvatarProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);
  const [reaction, setReaction] = useState<Reaction>("idle");
  const [hearts, setHearts] = useState<number[]>([]);
  const [wink, setWink] = useState<"none" | "left" | "right">("none");
  const affection = useAffection();

  // Smoothed cursor tracking via rAF lerp — feels natural and elastic.
  useEffect(() => {
    let raf = 0;
    let current = { x: 0, y: 0 };
    function onMove(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2.4;
      const dx = (e.clientX - cx) / (r.width / 2.6);
      const dy = (e.clientY - cy) / (r.height / 2.4);
      targetRef.current = {
        x: Math.max(-1, Math.min(1, dx)),
        y: Math.max(-1, Math.min(1, dy)),
      };
    }
    function tick() {
      const t = targetRef.current;
      // Elastic lerp — snappy but never twitchy.
      current = {
        x: current.x + (t.x - current.x) * 0.12,
        y: current.y + (t.y - current.y) * 0.12,
      };
      setLook({ x: current.x, y: current.y });
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Occasional playful wink when idle.
  useEffect(() => {
    const id = window.setInterval(
      () => {
        if (reaction !== "idle") return;
        const which = Math.random() > 0.5 ? "left" : "right";
        setWink(which);
        window.setTimeout(() => setWink("none"), 260);
      },
      9000 + Math.random() * 6000,
    );
    return () => window.clearInterval(id);
  }, [reaction]);

  const effective: Reaction = reactionOverride ?? reaction;

  function handleClick() {
    setReaction("hearts");
    const id = Date.now();
    setHearts((h) => [...h, id, id + 1, id + 2, id + 3]);
    setTimeout(() => setHearts((h) => h.filter((x) => x < id)), 1800);
    setTimeout(() => setReaction("idle"), 1500);
    onClick?.();
  }

  // Head tilt + shifts — stronger for a lively feel
  const headTilt = look.x * 6;
  const headShift = look.x * 10;
  const headBob = look.y * 4;
  const eyeX = look.x * 4.5;
  const eyeY = look.y * 3.5;

  const showBlush = hovering || effective !== "idle";
  const heartEyes = effective === "hearts";
  // Backlight intensity grows softly with affection level (caps at ~lvl 10).
  const glow = Math.min(1, 0.55 + affection.level * 0.05);

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full items-end justify-center select-none"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Cinematic backlight — intensity scales with affection */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-[55%] rounded-full blur-3xl transition-opacity duration-700"
        style={{
          opacity: glow,
          background:
            "radial-gradient(circle, oklch(0.72 0.22 22 / 0.28), oklch(0.82 0.17 355 / 0.35) 40%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 translate-y-[10%] rounded-full blur-3xl transition-opacity duration-700"
        style={{
          opacity: glow * 0.85,
          background:
            "radial-gradient(circle, oklch(0.82 0.14 195 / 0.35), transparent 60%)",
        }}
      />


      {/* Pulse ring on click */}
      {heartEyes && (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{
            borderColor: "oklch(0.82 0.17 355 / 0.6)",
            animation: "aiko-pulse-ring 1.1s ease-out",
          }}
        />
      )}

      {/* Floating hearts */}
      {hearts.map((h, i) => (
        <span
          key={h}
          className="pointer-events-none absolute text-2xl"
          style={{
            left: `${44 + i * 5}%`,
            top: "26%",
            color: "oklch(0.78 0.19 355)",
            animation: `aiko-float-heart ${1.3 + i * 0.18}s ease-out forwards`,
            animationDelay: `${i * 90}ms`,
            filter: "drop-shadow(0 0 10px oklch(0.82 0.17 355 / 0.9))",
          }}
        >
          ♥
        </span>
      ))}

      {/* Ambient sparkles */}
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
          style={{
            left: `${15 + i * 17}%`,
            top: `${12 + (i % 2) * 60}%`,
            background: "oklch(0.9 0.09 355)",
            animation: `aiko-sparkle ${2 + i * 0.35}s ease-in-out infinite`,
            animationDelay: `${i * 0.28}s`,
            boxShadow: "0 0 10px oklch(0.82 0.17 355 / 0.9)",
          }}
        />
      ))}

      <button
        type="button"
        onClick={handleClick}
        aria-label="Interactuar con Aiko"
        className="relative h-[560px] w-[400px] cursor-pointer outline-none"
        style={{ animation: "aiko-breathe 5s ease-in-out infinite" }}
      >
        <svg
          viewBox="0 0 400 560"
          className="h-full w-full drop-shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
        >
          <defs>
            {/* Hair — richer pink with rose gold shine */}
            <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.9 0.11 355)" />
              <stop offset="45%" stopColor="oklch(0.76 0.19 355)" />
              <stop offset="100%" stopColor="oklch(0.5 0.2 355)" />
            </linearGradient>
            <linearGradient id="hairShine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.85" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.97 0.02 40)" />
              <stop offset="100%" stopColor="oklch(0.88 0.05 25)" />
            </linearGradient>
            <linearGradient id="coat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.3 0.06 265)" />
              <stop offset="100%" stopColor="oklch(0.14 0.05 265)" />
            </linearGradient>
            <linearGradient id="coatEdge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.85 0.14 85)" />
              <stop offset="100%" stopColor="oklch(0.6 0.13 70)" />
            </linearGradient>
            <linearGradient id="bow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.9 0.12 195)" />
              <stop offset="100%" stopColor="oklch(0.65 0.16 200)" />
            </linearGradient>
            {/* Teal eye */}
            <radialGradient id="eyeTeal" cx="0.5" cy="0.5" r="0.55">
              <stop offset="0%" stopColor="oklch(0.96 0.12 195)" />
              <stop offset="60%" stopColor="oklch(0.6 0.16 200)" />
              <stop offset="100%" stopColor="oklch(0.3 0.1 220)" />
            </radialGradient>
            {/* Red eye (heterochromia) */}
            <radialGradient id="eyeRed" cx="0.5" cy="0.5" r="0.55">
              <stop offset="0%" stopColor="oklch(0.92 0.13 25)" />
              <stop offset="55%" stopColor="oklch(0.6 0.22 22)" />
              <stop offset="100%" stopColor="oklch(0.32 0.18 22)" />
            </radialGradient>
            <linearGradient id="horn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.24 22)" />
              <stop offset="100%" stopColor="oklch(0.4 0.2 22)" />
            </linearGradient>
            <radialGradient id="hornGlow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="oklch(0.75 0.22 22 / 0.9)" />
              <stop offset="100%" stopColor="oklch(0.6 0.2 22 / 0)" />
            </radialGradient>
            <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>

          {/* --- BACK HAIR (long, flowing behind body) --- */}
          <g style={{ animation: "aiko-hair-sway 7s ease-in-out infinite", transformOrigin: "200px 180px" }}>
            <path
              d="M70 220 Q60 400 90 540 L180 540 Q140 420 130 300 Z"
              fill="url(#hair)"
              opacity="0.95"
            />
            <path
              d="M330 220 Q340 400 310 540 L220 540 Q260 420 270 300 Z"
              fill="url(#hair)"
              opacity="0.95"
            />
          </g>

          {/* --- BODY / MILITARY COAT --- */}
          <g>
            {/* Neck */}
            <rect x="180" y="310" width="40" height="30" fill="url(#skin)" />
            {/* Collar (high military) */}
            <path
              d="M130 340 L200 320 L270 340 L275 372 L200 358 L125 372 Z"
              fill="oklch(0.22 0.05 265)"
              stroke="url(#coatEdge)"
              strokeWidth="1.5"
            />
            {/* Coat body */}
            <path
              d="M100 358 Q200 335 300 358 L322 540 L78 540 Z"
              fill="url(#coat)"
              stroke="url(#coatEdge)"
              strokeWidth="2.5"
            />
            {/* Lapel accents */}
            <path
              d="M140 360 L180 400 L200 372 L220 400 L260 360"
              stroke="url(#coatEdge)"
              strokeWidth="2.2"
              fill="none"
              strokeLinejoin="round"
            />
            {/* Gold buttons */}
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <circle cx="170" cy={400 + i * 34} r="4" fill="oklch(0.82 0.14 85)" />
                <circle cx="230" cy={400 + i * 34} r="4" fill="oklch(0.82 0.14 85)" />
              </g>
            ))}
            {/* Teal bow at collar */}
            <g transform="translate(200 348)">
              <path d="M-42 0 Q-26 -20 0 0 Q-26 20 -42 0 Z" fill="url(#bow)" />
              <path d="M42 0 Q26 -20 0 0 Q26 20 42 0 Z" fill="url(#bow)" />
              <circle cx="0" cy="0" r="8" fill="oklch(0.55 0.14 200)" />
              <circle cx="0" cy="0" r="3" fill="oklch(0.82 0.14 85)" />
            </g>
          </g>

          {/* --- HEAD GROUP (follows cursor) --- */}
          <g
            style={{
              transform: `translate(${headShift}px, ${headBob}px) rotate(${headTilt}deg)`,
              transformOrigin: "200px 280px",
              transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {/* Face */}
            <ellipse cx="200" cy="220" rx="80" ry="94" fill="url(#skin)" />

            {/* Cheek shadow for maturity */}
            <ellipse cx="200" cy="270" rx="60" ry="30" fill="oklch(0.75 0.06 25 / 0.15)" filter="url(#soft)" />

            {/* Blush */}
            <g style={{ opacity: showBlush ? 0.8 : 0, transition: "opacity 300ms ease" }}>
              <ellipse cx="156" cy="240" rx="20" ry="10" fill="oklch(0.78 0.15 20 / 0.6)" />
              <ellipse cx="244" cy="240" rx="20" ry="10" fill="oklch(0.78 0.15 20 / 0.6)" />
            </g>

            {/* Eye whites and irises */}
            <g>
              {/* LEFT eye (viewer left) — RED iris */}
              <g
                style={{
                  transformOrigin: "166px 220px",
                  animation: heartEyes ? undefined : "aiko-blink 6s infinite",
                  transform: wink === "left" ? "scaleY(0.08)" : undefined,
                  transition: "transform 120ms ease",
                }}
              >
                <ellipse cx="166" cy="220" rx="17" ry="21" fill="white" />
                {heartEyes ? (
                  <text x="166" y="230" textAnchor="middle" fontSize="28" fill="oklch(0.78 0.19 355)">♥</text>
                ) : (
                  <>
                    <ellipse cx={166 + eyeX} cy={220 + eyeY} rx="11" ry="16" fill="url(#eyeRed)" />
                    <circle cx={166 + eyeX} cy={220 + eyeY} r="4" fill="oklch(0.2 0.1 22)" />
                    <circle cx={163 + eyeX} cy={214 + eyeY} r="3.5" fill="white" />
                    <circle cx={170 + eyeX} cy={227 + eyeY} r="1.7" fill="white" opacity="0.9" />
                  </>
                )}
              </g>
              {/* RIGHT eye — TEAL iris */}
              <g
                style={{
                  transformOrigin: "234px 220px",
                  animation: heartEyes ? undefined : "aiko-blink 6s infinite",
                  animationDelay: "0.06s",
                  transform: wink === "right" ? "scaleY(0.08)" : undefined,
                  transition: "transform 120ms ease",
                }}
              >
                <ellipse cx="234" cy="220" rx="17" ry="21" fill="white" />
                {heartEyes ? (
                  <text x="234" y="230" textAnchor="middle" fontSize="28" fill="oklch(0.78 0.19 355)">♥</text>
                ) : (
                  <>
                    <ellipse cx={234 + eyeX} cy={220 + eyeY} rx="11" ry="16" fill="url(#eyeTeal)" />
                    <circle cx={234 + eyeX} cy={220 + eyeY} r="4" fill="oklch(0.18 0.06 220)" />
                    <circle cx={231 + eyeX} cy={214 + eyeY} r="3.5" fill="white" />
                    <circle cx={238 + eyeX} cy={227 + eyeY} r="1.7" fill="white" opacity="0.9" />
                  </>
                )}
              </g>
            </g>


            {/* Sharp eyebrows */}
            <path d="M148 192 Q166 186 182 194" stroke="oklch(0.5 0.16 355)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M218 194 Q234 186 252 192" stroke="oklch(0.5 0.16 355)" strokeWidth="3.2" fill="none" strokeLinecap="round" />

            {/* Eyelash accents */}
            <path d="M150 208 L149 202 M158 205 L157 199 M175 205 L176 199 M183 208 L184 202" stroke="oklch(0.3 0.05 20)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M217 208 L216 202 M225 205 L224 199 M242 205 L243 199 M250 208 L251 202" stroke="oklch(0.3 0.05 20)" strokeWidth="1.5" strokeLinecap="round" />

            {/* Nose hint */}
            <path d="M200 248 Q198 258 202 260" stroke="oklch(0.72 0.06 30 / 0.65)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

            {/* Mouth — subtle, slightly curled */}
            <path
              d={showBlush ? "M186 278 Q200 290 214 278" : "M188 278 Q200 283 212 278"}
              stroke="oklch(0.5 0.16 20)"
              strokeWidth="2.3"
              fill="oklch(0.68 0.16 15 / 0.4)"
              strokeLinecap="round"
              style={{ transition: "d 300ms ease" }}
            />
            {/* Lip highlight */}
            <path d="M195 279 Q200 281 205 279" stroke="white" strokeWidth="0.8" fill="none" opacity="0.6" />

            {/* Front hair — long parted bangs */}
            <path
              d="M110 190 Q118 100 200 82 Q282 100 290 190 Q262 148 232 158 L214 128 Q200 172 186 128 L168 158 Q138 148 110 190 Z"
              fill="url(#hair)"
            />
            {/* Long side locks framing the face */}
            <path d="M96 190 Q78 330 108 420 Q120 340 122 240 Z" fill="url(#hair)" />
            <path d="M304 190 Q322 330 292 420 Q280 340 278 240 Z" fill="url(#hair)" />

            {/* Hair shine highlight */}
            <path
              d="M138 128 Q200 108 262 128 Q244 148 200 138 Q156 148 138 128 Z"
              fill="url(#hairShine)"
              opacity="0.55"
            />

            {/* --- HORNS with glow --- */}
            <ellipse cx="163" cy="98" rx="18" ry="14" fill="url(#hornGlow)" style={{ animation: "aiko-horn-glow 3.2s ease-in-out infinite" }} />
            <ellipse cx="237" cy="98" rx="18" ry="14" fill="url(#hornGlow)" style={{ animation: "aiko-horn-glow 3.2s ease-in-out infinite", animationDelay: "0.4s" }} />
            <path
              d="M158 108 Q152 72 172 78 Q172 96 168 116 Z"
              fill="url(#horn)"
              stroke="oklch(0.28 0.18 22)"
              strokeWidth="1"
            />
            <path
              d="M242 108 Q248 72 228 78 Q228 96 232 116 Z"
              fill="url(#horn)"
              stroke="oklch(0.28 0.18 22)"
              strokeWidth="1"
            />
            {/* Horn highlight */}
            <path d="M162 84 Q164 92 166 100" stroke="oklch(0.9 0.1 25)" strokeWidth="1.2" fill="none" opacity="0.7" />
            <path d="M238 84 Q236 92 234 100" stroke="oklch(0.9 0.1 25)" strokeWidth="1.2" fill="none" opacity="0.7" />
          </g>
        </svg>

        {/* Ground shadow */}
        <div
          className="pointer-events-none absolute bottom-2 left-1/2 h-4 w-56 -translate-x-1/2 rounded-full opacity-45 blur-md"
          style={{ background: "black" }}
        />
      </button>
    </div>
  );
}
