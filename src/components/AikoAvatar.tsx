import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import type { Group, Object3D } from "three";
import { loseXP, useAffection } from "@/lib/affection";

type Reaction = "idle" | "blush" | "hearts" | "angry";

interface AikoAvatarProps {
  onClick?: () => void;
  onAffectionChange?: (
    amount: number,
    reason: "head" | "body" | "chest" | "butt",
  ) => void;
  reactionOverride?: Reaction;
}

interface AikoModelProps {
  reaction: Reaction;
  onReady: () => void;
  dragRotation: MutableRefObject<{ x: number; y: number }>;
  onBodyHit: (part: "head" | "body" | "chest" | "butt") => void;
  frameInterval: number;
}

const MODEL_URL = "/models/aiko_proti.vrm";

function usePerformanceProfile() {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const lowPower = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency || 4;
    const limitedMemory =
      typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
    // Se reserva 60 FPS para equipos holgados. En hardware modesto, 30 FPS
    // mantiene el movimiento fluido y reduce considerablemente el uso de GPU.
    return cores < 8 || limitedMemory;
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return { visible, lowPower };
}

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const compact = size.width < 600;
    const shortViewport = size.height < 650;
    camera.position.set(
      0,
      compact ? 1.04 : 1.08,
      (compact ? 3.15 : 2.78) + (shortViewport ? 0.28 : 0),
    );
    camera.lookAt(0, 0.9, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);
  return null;
}

function AikoModel({
  reaction,
  onReady,
  dragRotation,
  onBodyHit,
  frameInterval,
}: AikoModelProps) {
  const modelRoot = useRef<Group>(null);
  const elapsed = useRef(0);
  const frameAccumulator = useRef(0);
  const blinkStartedAt = useRef<number | null>(null);
  const nextBlinkAt = useRef(2.8);
  const idleGaze = useRef({ x: 0, y: 0, nextAt: 1.8 });
  const expressionValues = useRef({
    happy: 0,
    angry: 0,
    relaxed: 0,
    surprised: 0,
  });
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
  const vrm = gltf.userData.vrm as VRM;
  const bones = useMemo(
    () => ({
      head: vrm?.humanoid?.getNormalizedBoneNode("head"),
      neck: vrm?.humanoid?.getNormalizedBoneNode("neck"),
      chest: vrm?.humanoid?.getNormalizedBoneNode("upperChest"),
      hips: vrm?.humanoid?.getNormalizedBoneNode("hips"),
      leftShoulder: vrm?.humanoid?.getNormalizedBoneNode("leftShoulder"),
      rightShoulder: vrm?.humanoid?.getNormalizedBoneNode("rightShoulder"),
      leftUpperArm: vrm?.humanoid?.getNormalizedBoneNode("leftUpperArm"),
      rightUpperArm: vrm?.humanoid?.getNormalizedBoneNode("rightUpperArm"),
      leftLowerArm: vrm?.humanoid?.getNormalizedBoneNode("leftLowerArm"),
      rightLowerArm: vrm?.humanoid?.getNormalizedBoneNode("rightLowerArm"),
    }),
    [vrm],
  );

  useEffect(() => {
    if (!vrm) return;
    vrm.scene.traverse((object: Object3D) => {
      object.frustumCulled = false;
    });
    // Los VRM 1.0 de VRoid ya miran hacia la cámara con esta orientación.
    // Girarlo PI mostraba la espalda del personaje.
    vrm.scene.rotation.y = 0;

    // Sustituye la pose T de edición por una postura relajada.
    const { leftUpperArm, rightUpperArm, leftLowerArm, rightLowerArm } = bones;
    if (leftUpperArm) leftUpperArm.rotation.z = -Math.PI * 0.38;
    if (rightUpperArm) rightUpperArm.rotation.z = Math.PI * 0.38;
    if (leftLowerArm) leftLowerArm.rotation.z = 0.1;
    if (rightLowerArm) rightLowerArm.rotation.z = -0.1;

    onReady();
  }, [bones, onReady, vrm]);

  useFrame((state, delta) => {
    if (!vrm) return;
    frameAccumulator.current += Math.min(delta, 0.1);
    if (frameAccumulator.current < frameInterval) return;
    const frameDelta = Math.min(frameAccumulator.current, 0.05);
    frameAccumulator.current = 0;
    elapsed.current += frameDelta;
    const t = elapsed.current;

    if (t >= idleGaze.current.nextAt) {
      idleGaze.current.x = (Math.random() - 0.5) * 0.13;
      idleGaze.current.y = (Math.random() - 0.5) * 0.07;
      idleGaze.current.nextAt = t + 2.2 + Math.random() * 3.2;
    }

    if (modelRoot.current) {
      const happyBounce =
        reaction === "hearts" ? Math.abs(Math.sin(t * 4.5)) * 0.009 : 0;
      modelRoot.current.position.x = Math.sin(t * 0.38) * 0.006;
      modelRoot.current.position.y =
        -0.34 + Math.sin(t * 1.25) * 0.007 + happyBounce;
      modelRoot.current.rotation.x +=
        (dragRotation.current.x - modelRoot.current.rotation.x) * 0.1;
      modelRoot.current.rotation.y +=
        (dragRotation.current.y - modelRoot.current.rotation.y) * 0.1;
      modelRoot.current.rotation.z = Math.sin(t * 0.42) * 0.008;
    }

    const {
      head,
      neck,
      chest,
      leftShoulder,
      rightShoulder,
      leftUpperArm,
      rightUpperArm,
      leftLowerArm,
      rightLowerArm,
    } = bones;
    const smooth = 1 - Math.exp(-frameDelta * 5);
    const move = (current: number, target: number) =>
      current + (target - current) * smooth;

    // Mantener una postura estable. Solo hay micro-movimientos de respiración;
    // las emociones se expresan con rostro, cabeza y hombros.
    const armBreath = Math.sin(t * 0.72) * 0.006;
    const leftUpperX = armBreath;
    const rightUpperX = -armBreath;
    const leftUpperZ = -Math.PI * 0.38 + armBreath;
    const rightUpperZ = Math.PI * 0.38 - armBreath;
    const leftLowerX = 0;
    const rightLowerX = 0;
    const leftLowerZ = 0.1;
    const rightLowerZ = -0.1;

    if (leftUpperArm) {
      leftUpperArm.rotation.x = move(leftUpperArm.rotation.x, leftUpperX);
      leftUpperArm.rotation.z = move(leftUpperArm.rotation.z, leftUpperZ);
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.x = move(rightUpperArm.rotation.x, rightUpperX);
      rightUpperArm.rotation.z = move(rightUpperArm.rotation.z, rightUpperZ);
    }
    if (leftLowerArm) {
      leftLowerArm.rotation.x = move(leftLowerArm.rotation.x, leftLowerX);
      leftLowerArm.rotation.z = move(leftLowerArm.rotation.z, leftLowerZ);
    }
    if (rightLowerArm) {
      rightLowerArm.rotation.x = move(rightLowerArm.rotation.x, rightLowerX);
      rightLowerArm.rotation.z = move(rightLowerArm.rotation.z, rightLowerZ);
    }
    const shyShoulders = reaction === "blush" ? 0.025 : 0;
    const tenseShoulders = reaction === "angry" ? -0.018 : 0;
    if (leftShoulder) {
      leftShoulder.rotation.z = move(
        leftShoulder.rotation.z,
        Math.sin(t * 0.9) * 0.006 + shyShoulders + tenseShoulders,
      );
    }
    if (rightShoulder) {
      rightShoulder.rotation.z = move(
        rightShoulder.rotation.z,
        -Math.sin(t * 0.9) * 0.006 - shyShoulders - tenseShoulders,
      );
    }
    if (head) {
      const targetLookY = state.pointer.x * 0.24 + idleGaze.current.x;
      const targetLookX = -state.pointer.y * 0.13 + idleGaze.current.y;
      head.rotation.y += (targetLookY - head.rotation.y) * 0.055;
      const reactionHeadX =
        reaction === "blush" ? 0.12 : reaction === "angry" ? 0.045 : 0;
      head.rotation.x +=
        (reactionHeadX + targetLookX - head.rotation.x) * 0.055;
      const reactionHeadZ = reaction === "blush" ? 0.075 : 0;
      head.rotation.z +=
        (reactionHeadZ - state.pointer.x * 0.06 - head.rotation.z) * 0.06;
    }
    if (neck)
      neck.rotation.y += (state.pointer.x * 0.08 - neck.rotation.y) * 0.04;
    if (chest) {
      chest.rotation.y = Math.sin(t * 0.45) * 0.018;
      chest.rotation.x =
        Math.sin(t * 1.25) * 0.008 +
        (reaction === "hearts" ? Math.sin(t * 5) * 0.012 : 0);
    }

    if (blinkStartedAt.current === null && t >= nextBlinkAt.current) {
      blinkStartedAt.current = t;
    }
    let blink = 0;
    if (blinkStartedAt.current !== null) {
      const blinkPhase = (t - blinkStartedAt.current) / 0.18;
      if (blinkPhase >= 1) {
        blinkStartedAt.current = null;
        nextBlinkAt.current = t + 2.5 + Math.random() * 3.8;
      } else {
        blink = Math.sin(blinkPhase * Math.PI);
      }
    }
    const expressions = vrm.expressionManager;
    if (expressions) {
      const targets = {
        happy:
          reaction === "hearts" ? 0.78 : reaction === "blush" ? 0.24 : 0.06,
        angry: reaction === "angry" ? 0.68 : 0,
        relaxed: reaction === "idle" ? 0.14 : 0,
        surprised: reaction === "hearts" ? 0.05 : 0,
      };
      expressionValues.current.happy = move(
        expressionValues.current.happy,
        targets.happy,
      );
      expressionValues.current.angry = move(
        expressionValues.current.angry,
        targets.angry,
      );
      expressionValues.current.relaxed = move(
        expressionValues.current.relaxed,
        targets.relaxed,
      );
      expressionValues.current.surprised = move(
        expressionValues.current.surprised,
        targets.surprised,
      );
      expressions.setValue("blink", blink);
      expressions.setValue("happy", expressionValues.current.happy);
      expressions.setValue("angry", expressionValues.current.angry);
      expressions.setValue("relaxed", expressionValues.current.relaxed);
      expressions.setValue("surprised", expressionValues.current.surprised);
    }

    vrm.lookAt?.lookAt(state.camera.position);
    vrm.update(frameDelta);
  });

  function identifyBodyPart(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const point = event.point;
    const { head, chest, hips } = bones;
    const headPosition = head?.getWorldPosition(point.clone());
    const chestPosition = chest?.getWorldPosition(point.clone());
    const hipsPosition = hips?.getWorldPosition(point.clone());
    const facingBack = Math.cos(dragRotation.current.y) < -0.25;

    const insideHead = headPosition
      ? Math.abs(event.point.x - headPosition.x) < 0.3 &&
        Math.abs(event.point.y - headPosition.y) < 0.36
      : false;
    const insideChest = chestPosition
      ? Math.abs(event.point.x - chestPosition.x) < 0.43 &&
        Math.abs(event.point.y - chestPosition.y) < 0.46
      : false;
    const insideHips = hipsPosition
      ? Math.abs(event.point.x - hipsPosition.x) < 0.42 &&
        Math.abs(event.point.y - hipsPosition.y) < 0.38
      : false;

    if (insideHead) {
      onBodyHit("head");
    } else if (insideHips && facingBack) {
      onBodyHit("butt");
    } else if (insideChest && !facingBack) {
      onBodyHit("chest");
    } else {
      onBodyHit("body");
    }
  }

  return (
    <group ref={modelRoot} position={[0, -0.34, 0]}>
      <primitive object={vrm.scene} onPointerDown={identifyBodyPart} />
    </group>
  );
}

export function AikoAvatar({
  onClick,
  onAffectionChange,
  reactionOverride,
}: AikoAvatarProps) {
  const [reaction, setReaction] = useState<Reaction>("idle");
  const [ready, setReady] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const [thought, setThought] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);
  const thoughtTimer = useRef<number | null>(null);
  const dragRotation = useRef({ x: 0, y: 0 });
  const drag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const bodyHit = useRef<"head" | "body" | "chest" | "butt" | null>(null);
  const affection = useAffection();
  const { visible, lowPower } = usePerformanceProfile();
  const effective =
    reaction !== "idle" ? reaction : (reactionOverride ?? "idle");
  const handleReady = useCallback(() => setReady(true), []);
  const handleBodyHit = useCallback(
    (part: "head" | "body" | "chest" | "butt") => {
      bodyHit.current = part;
    },
    [],
  );

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      if (thoughtTimer.current) window.clearTimeout(thoughtTimer.current);
      window.speechSynthesis?.cancel();
    },
    [],
  );

  function handleClick(bodyPart: "head" | "body" | "chest" | "butt" = "body") {
    const inappropriateTouch = bodyPart === "chest" || bodyPart === "butt";
    const isFlirty = affection.level >= 5;
    const deeplyAttached = affection.level >= 10;
    const intimatelyAttached = affection.level >= 20;
    const chestPenalty = deeplyAttached ? 0 : isFlirty ? 6 : 15;
    const buttPenalty = deeplyAttached ? 0 : isFlirty ? 12 : 25;
    const affectionAmount =
      bodyPart === "chest"
        ? -chestPenalty
        : bodyPart === "butt"
          ? -buttPenalty
          : 2;
    const messages = {
      head: intimatelyAttached
        ? [
            "Sabes exactamente cómo hacer que baje la guardia…",
            "Mmm… sigue así y voy a pensar que intentas seducirme.",
          ]
        : isFlirty
          ? [
              "Mmm… sabes cómo consentirme.",
              "Sigue así y voy a malacostumbrarme.",
            ]
          : ["Eso sí me gusta…", "Je, je… gracias."],
      body: intimatelyAttached
        ? [
            "¿Otra vez buscando mi atención? Ten cuidado… podrías conseguir más de la que esperas.",
            "Hoy vienes con ganas de provocarme, ¿verdad?",
          ]
        : isFlirty
          ? [
              "¿Solo querías llamar mi atención? Ya la tienes.",
              "Hoy estás especialmente cariñoso… me agrada.",
            ]
          : ["¡Hola, Alejandro!", "Estoy aquí contigo."],
      chest: intimatelyAttached
        ? [
            "Qué atrevido… sabes perfectamente lo que estás haciendo conmigo.",
            "Si sigues provocándome así, no prometo seguir comportándome.",
          ]
        : deeplyAttached
          ? [
              "N-no seas tan atrevido… eso me da mucha vergüenza.",
              "Ale… no hagas eso tan de repente. Es muy vergonzoso…",
            ]
          : isFlirty
            ? [
                "Qué atrevido… no abuses de mi confianza.",
                "Vaya, cada vez tienes más confianza, ¿no?",
              ]
            : ["¡Pervertido! No me toques ahí.", "¡Oye! Te dije que ahí no."],
      butt: intimatelyAttached
        ? [
            "Vaya… de verdad te gusta ponerme nerviosa, ¿no?",
            "Eres muy atrevido… y parece que disfrutas cuando me sonrojo.",
          ]
        : deeplyAttached
          ? [
              "¡Ale! No seas tan atrevido… me da demasiada vergüenza.",
              "E-eso sigue siendo muy vergonzoso… avísame antes, ¿sí?",
            ]
          : isFlirty
            ? [
                "¡Descarado! Que sea cariñosa no significa que puedas hacer eso.",
                "Mira quién salió atrevido… compórtate.",
              ]
            : [
                "¡¿Qué estás haciendo?! No vuelvas a tocarme ahí.",
                "¡Pervertido! Eso te costará mucho cariño.",
              ],
    };

    setReaction(
      inappropriateTouch
        ? intimatelyAttached
          ? "hearts"
          : deeplyAttached
            ? "blush"
            : "angry"
        : isFlirty && bodyPart === "head"
          ? "blush"
          : "hearts",
    );
    const id = Date.now();
    setHearts(
      inappropriateTouch && !intimatelyAttached
        ? []
        : [id, id + 1, id + 2, id + 3, id + 4],
    );
    const options = messages[bodyPart];
    const message = options[Math.floor(Math.random() * options.length)];
    setThought(message);
    if (thoughtTimer.current) window.clearTimeout(thoughtTimer.current);
    thoughtTimer.current = window.setTimeout(() => setThought(null), 2600);

    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(
      () => {
        setReaction("idle");
        setHearts([]);
      },
      inappropriateTouch ? 2300 : isFlirty && bodyPart === "head" ? 2400 : 1800,
    );
    if (bodyPart === "chest") {
      if (chestPenalty > 0) loseXP(chestPenalty, "chestTouch");
    } else if (bodyPart === "butt") {
      if (buttPenalty > 0) loseXP(buttPenalty, "buttTouch");
    } else {
      onClick?.();
    }

    if (inappropriateTouch && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const spokenReaction = new SpeechSynthesisUtterance(message);
      spokenReaction.lang = "es-PE";
      spokenReaction.rate = 1.04;
      spokenReaction.pitch = 1.12;
      window.speechSynthesis.speak(spokenReaction);
    }
    onAffectionChange?.(affectionAmount, bodyPart);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = {
      active: true,
      moved: false,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
    if (!drag.current.moved) return;

    dragRotation.current.y += dx * 0.009;
    dragRotation.current.x = Math.max(
      -0.2,
      Math.min(0.2, dragRotation.current.x + dy * 0.003),
    );
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const wasClick = drag.current.active && !drag.current.moved;
    drag.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasClick) {
      if (bodyHit.current) handleClick(bodyHit.current);
    }
    bodyHit.current = null;
  }

  const glowOpacity = Math.min(0.72, 0.34 + affection.level * 0.035);

  return (
    <div className="relative isolate flex h-full min-h-[32rem] w-full items-center justify-center overflow-hidden select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,115,184,0.16),transparent_28%),radial-gradient(circle_at_50%_77%,rgba(45,212,239,0.13),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_45%,rgba(2,8,23,0.08))]" />
      <div className="pointer-events-none absolute left-1/2 top-[54%] aspect-square w-[min(68vh,43rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]" />
      <div className="pointer-events-none absolute left-1/2 top-[54%] aspect-square w-[min(52vh,33rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-pink-300/[0.08]" />
      <div className="pointer-events-none absolute left-1/2 top-5 z-20 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-slate-950/35 px-4 py-2 shadow-xl backdrop-blur-md sm:flex">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400/25 to-cyan-400/20 ring-1 ring-white/10">
          <span
            className={
              ready
                ? "h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.9)]"
                : "h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300"
            }
          />
        </span>
        <span className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-white/90">
            AIKO
          </span>
          <span className="text-[10px] text-white/45">
            {ready ? "Modelo 3D · en línea" : "Cargando modelo 3D…"}
          </span>
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Haz clic para alegrar a Aiko o arrastra para girarla"
        onPointerDownCapture={() => {
          bodyHit.current = null;
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          drag.current.active = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
        className="relative z-10 h-full w-full cursor-grab touch-none overflow-hidden rounded-2xl outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-pink-300/60"
      >
        <Canvas
          dpr={lowPower ? 1 : [1, 1.35]}
          frameloop={visible ? "always" : "never"}
          camera={{ fov: 28, near: 0.1, far: 20, position: [0, 1.08, 2.78] }}
          gl={{
            alpha: true,
            antialias: !lowPower,
            powerPreference: "high-performance",
            preserveDrawingBuffer: false,
          }}
          performance={{ min: 0.5 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <CameraRig />
          <ambientLight intensity={1.35} />
          <directionalLight
            position={[2.5, 4, 3]}
            intensity={2.1}
            color="#ffe5f2"
          />
          <directionalLight
            position={[-2, 2, 1]}
            intensity={1.15}
            color="#8be7ff"
          />
          <pointLight position={[0, 0.8, 2]} intensity={0.75} color="#ffffff" />
          <Suspense fallback={null}>
            <AikoModel
              reaction={effective}
              onReady={handleReady}
              dragRotation={dragRotation}
              onBodyHit={handleBodyHit}
              frameInterval={lowPower ? 1 / 30 : 1 / 60}
            />
          </Suspense>
        </Canvas>
      </div>

      {!ready && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-pink-300" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            Preparando a Aiko
          </span>
        </div>
      )}

      {hearts.map((heart, index) => (
        <span
          key={heart}
          className="pointer-events-none absolute z-30 text-2xl text-pink-300 drop-shadow-[0_0_12px_rgba(249,168,212,.9)]"
          style={{
            left: `${41 + index * 4.5}%`,
            top: "35%",
            animation: `aiko-float-heart ${1.25 + index * 0.12}s ease-out forwards`,
            animationDelay: `${index * 70}ms`,
          }}
        >
          ♥
        </span>
      ))}

      {thought && (
        <div className="pointer-events-none absolute left-1/2 top-[13%] z-40 w-[min(88%,22rem)] -translate-x-1/2 animate-in fade-in zoom-in-95 duration-200 sm:left-[calc(50%+7.5rem)] sm:top-[29%] sm:w-auto sm:max-w-[18rem] sm:translate-x-0">
          <div className="relative rounded-2xl border border-pink-200/30 bg-slate-950/90 px-4 py-3 text-center text-sm font-semibold leading-snug text-pink-50 shadow-[0_14px_45px_rgba(0,0,0,.5),0_0_28px_rgba(244,114,182,.22)] backdrop-blur-xl sm:text-left">
            {thought}
            <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-pink-200/30 bg-slate-950/90 sm:left-5 sm:translate-x-0" />
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-[7%] left-1/2 z-0 h-10 w-[min(42vw,30rem)] -translate-x-1/2 rounded-[50%] border border-cyan-200/10 bg-cyan-300/[0.04] shadow-[0_0_55px_rgba(34,211,238,.15)] sm:bottom-[10%]" />
    </div>
  );
}
