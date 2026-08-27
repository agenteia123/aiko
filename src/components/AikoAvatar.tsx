import { Suspense, useEffect, useRef, useState } from "react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import type { Group, Object3D } from "three";
import { loseXP, useAffection } from "@/lib/affection";

type Reaction = "idle" | "blush" | "hearts" | "angry";

interface AikoAvatarProps {
  onClick?: () => void;
  onAffectionChange?: (amount: number, reason: "head" | "body" | "chest" | "butt") => void;
  reactionOverride?: Reaction;
}

interface AikoModelProps {
  reaction: Reaction;
  onReady: () => void;
  dragRotation: MutableRefObject<{ x: number; y: number }>;
  onBodyHit: (part: "head" | "body" | "chest" | "butt") => void;
}

const MODEL_URL = "/models/aiko_proti.vrm";

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, size.width < 600 ? 1.05 : 1.08, size.width < 600 ? 3.15 : 2.78);
    camera.lookAt(0, 0.9, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function AikoModel({ reaction, onReady, dragRotation, onBodyHit }: AikoModelProps) {
  const modelRoot = useRef<Group>(null);
  const elapsed = useRef(0);
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });
  const vrm = gltf.userData.vrm as VRM;

  useEffect(() => {
    if (!vrm) return;
    vrm.scene.traverse((object: Object3D) => {
      object.frustumCulled = false;
    });
    // Los VRM 1.0 de VRoid ya miran hacia la cámara con esta orientación.
    // Girarlo PI mostraba la espalda del personaje.
    vrm.scene.rotation.y = 0;

    // Sustituye la pose T de edición por una postura relajada.
    const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
    const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");
    const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");
    if (leftUpperArm) leftUpperArm.rotation.z = -Math.PI * 0.38;
    if (rightUpperArm) rightUpperArm.rotation.z = Math.PI * 0.38;
    if (leftLowerArm) leftLowerArm.rotation.z = 0.1;
    if (rightLowerArm) rightLowerArm.rotation.z = -0.1;

    onReady();
  }, [onReady, vrm]);

  useFrame((state, delta) => {
    if (!vrm) return;
    elapsed.current += delta;
    const t = elapsed.current;

    if (modelRoot.current) {
      const happyBounce = reaction === "hearts" ? Math.abs(Math.sin(t * 4.5)) * 0.009 : 0;
      modelRoot.current.position.x = Math.sin(t * 0.38) * 0.006;
      modelRoot.current.position.y = -0.34 + Math.sin(t * 1.25) * 0.007 + happyBounce;
      modelRoot.current.rotation.x += (dragRotation.current.x - modelRoot.current.rotation.x) * 0.1;
      modelRoot.current.rotation.y += (dragRotation.current.y - modelRoot.current.rotation.y) * 0.1;
      modelRoot.current.rotation.z = Math.sin(t * 0.42) * 0.008;
    }

    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    const neck = vrm.humanoid?.getNormalizedBoneNode("neck");
    const chest = vrm.humanoid?.getNormalizedBoneNode("upperChest");
    const leftShoulder = vrm.humanoid?.getNormalizedBoneNode("leftShoulder");
    const rightShoulder = vrm.humanoid?.getNormalizedBoneNode("rightShoulder");
    const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
    const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");
    const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");
    const leftHand = vrm.humanoid?.getNormalizedBoneNode("leftHand");
    const rightHand = vrm.humanoid?.getNormalizedBoneNode("rightHand");
    const smooth = 1 - Math.exp(-delta * 7);
    const move = (current: number, target: number) =>
      current + (target - current) * smooth;

    let leftUpperX = 0;
    let rightUpperX = 0;
    let leftUpperZ = -Math.PI * 0.38;
    let rightUpperZ = Math.PI * 0.38;
    let leftLowerX = 0;
    let rightLowerX = 0;
    let leftLowerZ = 0.1;
    let rightLowerZ = -0.1;
    let leftHandZ = 0;
    let rightHandZ = 0;

    if (reaction === "blush") {
      // Postura tímida contenida: hombros cerrados, mirada baja y manos
      // ligeramente hacia delante. Evita forzar las manos hasta el rostro.
      leftUpperX = -0.16;
      rightUpperX = -0.16;
      leftUpperZ = -1.06;
      rightUpperZ = 1.06;
      leftLowerX = -0.22;
      rightLowerX = -0.22;
      leftLowerZ = 0.28;
      rightLowerZ = -0.28;
      leftHandZ = 0.1;
      rightHandZ = -0.1;
    } else if (reaction === "hearts") {
      // Saludo pequeño a la altura del hombro, sin abrir el brazo en T.
      rightUpperX = -0.16;
      rightUpperZ = 0.78;
      rightLowerX = -0.28;
      rightLowerZ = -0.36;
      rightHandZ = Math.sin(t * 7) * 0.14;
      leftUpperZ = -1.15 + Math.sin(t * 4) * 0.025;
    } else if (reaction === "angry") {
      // Postura firme y simétrica, manteniendo los codos cerca del cuerpo.
      leftUpperX = 0.05;
      rightUpperX = 0.05;
      leftUpperZ = -1.02;
      rightUpperZ = 1.02;
      leftLowerX = -0.08;
      rightLowerX = -0.08;
      leftLowerZ = 0.2;
      rightLowerZ = -0.2;
      leftHandZ = -0.08;
      rightHandZ = 0.08;
    } else {
      // Movimiento de reposo muy suave para evitar una pose rígida.
      leftUpperX = Math.sin(t * 0.72) * 0.018;
      rightUpperX = -Math.sin(t * 0.72) * 0.018;
      leftUpperZ += Math.sin(t * 0.58) * 0.018;
      rightUpperZ -= Math.sin(t * 0.58) * 0.018;
    }

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
    if (leftHand) leftHand.rotation.z = move(leftHand.rotation.z, leftHandZ);
    if (rightHand) rightHand.rotation.z = move(rightHand.rotation.z, rightHandZ);
    if (leftShoulder) leftShoulder.rotation.z = Math.sin(t * 0.9) * 0.012;
    if (rightShoulder) rightShoulder.rotation.z = -Math.sin(t * 0.9) * 0.012;
    if (head) {
      head.rotation.y += (state.pointer.x * 0.3 - head.rotation.y) * 0.08;
      const reactionHeadX = reaction === "blush" ? 0.12 : reaction === "angry" ? 0.045 : 0;
      head.rotation.x +=
        (reactionHeadX - state.pointer.y * 0.16 - head.rotation.x) * 0.08;
      const reactionHeadZ = reaction === "blush" ? 0.075 : 0;
      head.rotation.z +=
        (reactionHeadZ - state.pointer.x * 0.06 - head.rotation.z) * 0.06;
    }
    if (neck) neck.rotation.y += (state.pointer.x * 0.08 - neck.rotation.y) * 0.04;
    if (chest) {
      chest.rotation.y = Math.sin(t * 0.45) * 0.018;
      chest.rotation.x =
        Math.sin(t * 1.25) * 0.008 + (reaction === "hearts" ? Math.sin(t * 5) * 0.012 : 0);
    }

    const blinkCycle = t % 5.4;
    const blink = blinkCycle > 5.08 ? Math.sin(((blinkCycle - 5.08) / 0.32) * Math.PI) : 0;
    const expressions = vrm.expressionManager;
    if (expressions) {
      expressions.setValue("blink", blink);
      expressions.setValue("happy", reaction === "hearts" ? 0.82 : reaction === "blush" ? 0.28 : 0.08);
      expressions.setValue("angry", reaction === "angry" ? 0.72 : 0);
      expressions.setValue("relaxed", reaction === "idle" ? 0.12 : 0);
      expressions.setValue("surprised", reaction === "hearts" ? 0.08 : 0);
    }

    vrm.lookAt?.lookAt(state.camera.position);
    vrm.update(delta);
  });

  function identifyBodyPart(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const point = event.point;
    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    const chest = vrm.humanoid?.getNormalizedBoneNode("upperChest");
    const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
    const headPosition = head?.getWorldPosition(point.clone());
    const chestPosition = chest?.getWorldPosition(point.clone());
    const hipsPosition = hips?.getWorldPosition(point.clone());
    const facingBack = Math.cos(dragRotation.current.y) < -0.25;

    const insideHead = headPosition
      ? Math.abs(event.point.x - headPosition.x) < 0.3 && Math.abs(event.point.y - headPosition.y) < 0.36
      : false;
    const insideChest = chestPosition
      ? Math.abs(event.point.x - chestPosition.x) < 0.43 && Math.abs(event.point.y - chestPosition.y) < 0.46
      : false;
    const insideHips = hipsPosition
      ? Math.abs(event.point.x - hipsPosition.x) < 0.42 && Math.abs(event.point.y - hipsPosition.y) < 0.38
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

export function AikoAvatar({ onClick, onAffectionChange, reactionOverride }: AikoAvatarProps) {
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
  const effective = reaction !== "idle" ? reaction : reactionOverride ?? "idle";

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    if (thoughtTimer.current) window.clearTimeout(thoughtTimer.current);
  }, []);

  function handleClick(bodyPart: "head" | "body" | "chest" | "butt" = "body") {
    const inappropriateTouch = bodyPart === "chest" || bodyPart === "butt";
    const isFlirty = affection.level >= 5;
    const chestPenalty = isFlirty ? 6 : 15;
    const buttPenalty = isFlirty ? 12 : 25;
    const affectionAmount = bodyPart === "chest" ? -chestPenalty : bodyPart === "butt" ? -buttPenalty : 2;
    const messages = {
      head: isFlirty
        ? ["Mmm… sabes cómo consentirme.", "Sigue así y voy a malacostumbrarme."]
        : ["Eso sí me gusta…", "Je, je… gracias."],
      body: isFlirty
        ? ["¿Solo querías llamar mi atención? Ya la tienes.", "Hoy estás especialmente cariñoso… me agrada."]
        : ["¡Hola, Alejandro!", "Estoy aquí contigo."],
      chest: isFlirty
        ? ["Qué atrevido… no abuses de mi confianza.", "Vaya, cada vez tienes más confianza, ¿no?"]
        : ["¡Pervertido! No me toques ahí.", "¡Oye! Te dije que ahí no."],
      butt: isFlirty
        ? ["¡Descarado! Que sea cariñosa no significa que puedas hacer eso.", "Mira quién salió atrevido… compórtate."]
        : ["¡¿Qué estás haciendo?! No vuelvas a tocarme ahí.", "¡Pervertido! Eso te costará mucho cariño."],
    };

    setReaction(
      inappropriateTouch
        ? "angry"
        : isFlirty && bodyPart === "head"
          ? "blush"
          : "hearts",
    );
    const id = Date.now();
    setHearts(inappropriateTouch ? [] : [id, id + 1, id + 2, id + 3, id + 4]);
    const options = messages[bodyPart];
    const message = options[Math.floor(Math.random() * options.length)];
    setThought(message);
    if (thoughtTimer.current) window.clearTimeout(thoughtTimer.current);
    thoughtTimer.current = window.setTimeout(() => setThought(null), 2600);

    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setReaction("idle");
      setHearts([]);
    }, inappropriateTouch ? 2300 : isFlirty && bodyPart === "head" ? 2400 : 1800);
    if (bodyPart === "chest") loseXP(chestPenalty, "chestTouch");
    else if (bodyPart === "butt") loseXP(buttPenalty, "buttTouch");
    else onClick?.();

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
    drag.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
    if (!drag.current.moved) return;

    dragRotation.current.y += dx * 0.009;
    dragRotation.current.x = Math.max(-0.2, Math.min(0.2, dragRotation.current.x + dy * 0.003));
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
          <span className={ready ? "h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.9)]" : "h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300"} />
        </span>
        <span className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-white/90">AIKO</span>
          <span className="text-[10px] text-white/45">{ready ? "Modelo 3D · en línea" : "Cargando modelo 3D…"}</span>
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Haz clic para alegrar a Aiko o arrastra para girarla"
        onPointerDownCapture={() => { bodyHit.current = null; }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { drag.current.active = false; }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
        className="relative z-10 h-full w-full cursor-grab touch-none overflow-hidden rounded-2xl outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-pink-300/60"
      >
        <Canvas
          dpr={[1, 1.5]}
          camera={{ fov: 28, near: 0.1, far: 20, position: [0, 1.08, 2.78] }}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <CameraRig />
          <ambientLight intensity={1.35} />
          <directionalLight position={[2.5, 4, 3]} intensity={2.1} color="#ffe5f2" />
          <directionalLight position={[-2, 2, 1]} intensity={1.15} color="#8be7ff" />
          <pointLight position={[0, 0.8, 2]} intensity={0.75} color="#ffffff" />
          <Suspense fallback={null}>
            <AikoModel
              reaction={effective}
              onReady={() => setReady(true)}
              dragRotation={dragRotation}
              onBodyHit={(part) => { bodyHit.current = part; }}
            />
          </Suspense>
        </Canvas>
      </div>

      {!ready && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-pink-300" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">Preparando a Aiko</span>
        </div>
      )}

      {hearts.map((heart, index) => (
        <span key={heart} className="pointer-events-none absolute z-30 text-2xl text-pink-300 drop-shadow-[0_0_12px_rgba(249,168,212,.9)]" style={{ left: `${41 + index * 4.5}%`, top: "35%", animation: `aiko-float-heart ${1.25 + index * 0.12}s ease-out forwards`, animationDelay: `${index * 70}ms` }}>♥</span>
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
