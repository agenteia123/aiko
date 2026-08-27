import { Suspense, useEffect, useRef, useState } from "react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import type { Group, Object3D } from "three";
import { useAffection } from "@/lib/affection";

type Reaction = "idle" | "blush" | "hearts";

interface AikoAvatarProps {
  onClick?: () => void;
  reactionOverride?: Reaction;
}

interface AikoModelProps {
  reaction: Reaction;
  onReady: () => void;
  dragRotation: MutableRefObject<{ x: number; y: number }>;
}

const MODEL_URL = "/models/aiko_proti.vrm";

function CameraRig() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0, size.width < 600 ? 1.03 : 1.08, size.width < 600 ? 3.45 : 3.05);
    camera.lookAt(0, 0.82, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function AikoModel({ reaction, onReady, dragRotation }: AikoModelProps) {
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
      modelRoot.current.position.y = -0.76 + Math.sin(t * 1.25) * 0.008;
      modelRoot.current.rotation.x += (dragRotation.current.x - modelRoot.current.rotation.x) * 0.1;
      modelRoot.current.rotation.y += (dragRotation.current.y - modelRoot.current.rotation.y) * 0.1;
      modelRoot.current.rotation.z = Math.sin(t * 0.42) * 0.008;
    }

    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    const neck = vrm.humanoid?.getNormalizedBoneNode("neck");
    const chest = vrm.humanoid?.getNormalizedBoneNode("upperChest");
    if (head) {
      head.rotation.y += (state.pointer.x * 0.3 - head.rotation.y) * 0.08;
      head.rotation.x += (-state.pointer.y * 0.16 - head.rotation.x) * 0.08;
      head.rotation.z += (-state.pointer.x * 0.06 - head.rotation.z) * 0.06;
    }
    if (neck) neck.rotation.y += (state.pointer.x * 0.08 - neck.rotation.y) * 0.04;
    if (chest) chest.rotation.y = Math.sin(t * 0.45) * 0.018;

    const blinkCycle = t % 5.4;
    const blink = blinkCycle > 5.08 ? Math.sin(((blinkCycle - 5.08) / 0.32) * Math.PI) : 0;
    const expressions = vrm.expressionManager;
    if (expressions) {
      expressions.setValue("blink", blink);
      expressions.setValue("happy", reaction === "hearts" ? 0.82 : reaction === "blush" ? 0.28 : 0.08);
      expressions.setValue("relaxed", reaction === "idle" ? 0.12 : 0);
      expressions.setValue("surprised", reaction === "hearts" ? 0.08 : 0);
    }

    vrm.lookAt?.lookAt(state.camera.position);
    vrm.update(delta);
  });

  return (
    <group ref={modelRoot} position={[0, -0.76, 0]}>
      <primitive object={vrm.scene} />
    </group>
  );
}

export function AikoAvatar({ onClick, reactionOverride }: AikoAvatarProps) {
  const [reaction, setReaction] = useState<Reaction>("idle");
  const [ready, setReady] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const resetTimer = useRef<number | null>(null);
  const dragRotation = useRef({ x: 0, y: 0 });
  const drag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const affection = useAffection();
  const effective = reactionOverride ?? reaction;

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  function handleClick() {
    setReaction("hearts");
    const id = Date.now();
    setHearts([id, id + 1, id + 2, id + 3, id + 4]);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setReaction("idle");
      setHearts([]);
    }, 1700);
    onClick?.();
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
    if (wasClick) handleClick();
  }

  const glowOpacity = Math.min(0.72, 0.34 + affection.level * 0.035);

  return (
    <div className="relative isolate flex h-full min-h-[32rem] w-full items-center justify-center overflow-hidden select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,91,164,0.14),transparent_31%),radial-gradient(circle_at_50%_76%,rgba(34,211,238,0.11),transparent_34%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(72vh,46rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(56vh,35rem)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-pink-300/[0.08]" />
      <div className="pointer-events-none absolute left-5 top-5 z-20 hidden items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-2.5 shadow-xl backdrop-blur-md sm:flex">
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
          camera={{ fov: 28, near: 0.1, far: 20, position: [0, 1.08, 3.05] }}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <CameraRig />
          <ambientLight intensity={1.35} />
          <directionalLight position={[2.5, 4, 3]} intensity={2.1} color="#ffe5f2" />
          <directionalLight position={[-2, 2, 1]} intensity={1.15} color="#8be7ff" />
          <pointLight position={[0, 0.8, 2]} intensity={0.75} color="#ffffff" />
          <Suspense fallback={null}>
            <AikoModel reaction={effective} onReady={() => setReady(true)} dragRotation={dragRotation} />
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

      <div className="pointer-events-none absolute bottom-[7%] left-1/2 z-0 h-10 w-[min(42vw,30rem)] -translate-x-1/2 rounded-[50%] border border-cyan-200/10 bg-cyan-300/[0.04] shadow-[0_0_55px_rgba(34,211,238,.15)] sm:bottom-[10%]" />
      <div className="pointer-events-none absolute bottom-5 right-5 z-20 hidden rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[9px] uppercase tracking-[0.16em] text-white/40 backdrop-blur-md md:block">Clic: alegrar · Arrastrar: girar</div>
    </div>
  );
}
