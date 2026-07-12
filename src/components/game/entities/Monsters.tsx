"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { GORILLA_MODIFIERS, type GorillaVariant } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { sim } from "@/systems/simulation";
import { lerp } from "@/utils/random";
import { Gorilla } from "./Gorilla";

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Escolhe o modelo 3D do monstro conforme a variante selecionada. */
export function Monster() {
  const gorillaModifierId = useSimulationStore((s) => s.gorillaModifierId);
  const variant =
    GORILLA_MODIFIERS.find((m) => m.id === gorillaModifierId) ??
    GORILLA_MODIFIERS[0];

  switch (variant.monsterRig) {
    case "bear":
      return <Bear key={variant.id} variant={variant} />;
    case "trex":
      return <TRex key={variant.id} variant={variant} />;
    case "bull":
      return <Bull key={variant.id} variant={variant} />;
    case "duck":
      return <Duck key={variant.id} variant={variant} />;
    default:
      return <Gorilla key={variant.id} />;
  }
}

/** Materiais básicos do monstro a partir das cores da variante. */
function useMonsterMats(variant: GorillaVariant) {
  return useMemo(() => {
    const fur = new THREE.MeshStandardMaterial({
      color: variant.fur,
      roughness: 0.9,
    });
    const back = new THREE.MeshStandardMaterial({
      color: variant.back,
      roughness: 0.92,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: variant.skin,
      roughness: 0.65,
    });
    const eye = new THREE.MeshStandardMaterial({
      color: "#141210",
      roughness: 0.25,
      emissive: variant.eyeGlow,
      emissiveIntensity: variant.eyeIntensity,
    });
    return { fur, back, skin, eye };
  }, [variant]);
}

/** Posição/rotação comuns + fase de galope; retorna dados p/ pose. */
function useMonsterFrame(
  root: React.RefObject<THREE.Group | null>,
  mats: ReturnType<typeof useMonsterMats>,
  variant: GorillaVariant,
  pose: (ctx: {
    action: string;
    t: number;
    deathT: number;
    speed: number;
    gallop: number;
    clock: number;
    damp: number;
  }) => void,
) {
  const gallop = useRef(0);
  useFrame((state, delta) => {
    const g = sim.gorilla;
    const body = g.body;
    if (!body || !root.current) return;
    const p = body.translation();
    root.current.position.set(p.x, p.y - sim.gorillaRadius, p.z);
    root.current.rotation.y = g.facing;

    mats.eye.emissiveIntensity = g.enraged
      ? 3 + Math.sin(state.clock.elapsedTime * 10)
      : variant.eyeIntensity;

    const v = body.linvel();
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    gallop.current += delta * (4 + speed * 1.7);

    pose({
      action: g.action,
      t: g.actionT,
      deathT: g.deathT,
      speed,
      gallop: gallop.current,
      clock: state.clock.elapsedTime,
      damp: 1 - Math.exp(-13 * delta),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Urso Pardo 🐻                                                       */
/* ------------------------------------------------------------------ */

function Bear({ variant }: { variant: GorillaVariant }) {
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legFL = useRef<THREE.Group>(null);
  const legFR = useRef<THREE.Group>(null);
  const legBL = useRef<THREE.Group>(null);
  const legBR = useRef<THREE.Group>(null);
  const mats = useMonsterMats(variant);

  useMonsterFrame(root, mats, variant, ({ action, t, deathT, speed, gallop, clock, damp }) => {
    let tiltX = 0;
    let tiltZ = 0;
    let headX = 0;
    let legAmp = Math.min(speed / 6, 1) * 0.7;
    let rear = 0; // 0 = quatro patas, 1 = empinado

    if (action === "die") {
      const k = Math.min(Math.max(deathT, 0) / 1.2, 1);
      tiltZ = easeOut(k) * 1.35;
      legAmp = 0;
    } else if (action === "roar") {
      rear = Math.min(t / 0.3, 1);
      headX = -0.5 * rear;
    } else if (action === "swipe" || action === "slam") {
      const k = Math.min(t / 0.6, 1);
      rear = Math.sin(k * Math.PI) * 0.85;
      headX = 0.2;
    } else if (speed < 0.8) {
      headX = Math.sin(clock * 0.7) * 0.15;
      legAmp = 0.04;
    }
    tiltX = -rear * 0.9;

    if (tilt.current) {
      tilt.current.rotation.x = lerp(tilt.current.rotation.x, tiltX, damp);
      tilt.current.rotation.z = lerp(tilt.current.rotation.z, tiltZ, damp);
      tilt.current.position.y = lerp(tilt.current.position.y, rear * 0.5, damp);
    }
    if (head.current) head.current.rotation.x = lerp(head.current.rotation.x, headX, damp);
    const s = Math.sin(gallop);
    if (legFL.current) legFL.current.rotation.x = s * legAmp - rear * 1.2;
    if (legBR.current) legBR.current.rotation.x = s * legAmp;
    if (legFR.current) legFR.current.rotation.x = -s * legAmp - rear * 1.2;
    if (legBL.current) legBL.current.rotation.x = -s * legAmp;
  });

  const leg = (
    ref: React.RefObject<THREE.Group | null>,
    x: number,
    z: number,
  ) => (
    <group ref={ref} position={[x, 0.72, z]}>
      <mesh position={[0, -0.34, 0]} castShadow material={mats.fur}>
        <cylinderGeometry args={[0.16, 0.2, 0.72, 8]} />
      </mesh>
    </group>
  );

  return (
    <group ref={root} scale={1.25 * variant.scale}>
      <group ref={tilt}>
        {/* Corpo comprido */}
        <mesh position={[0, 1.0, -0.1]} scale={[0.85, 0.78, 1.35]} castShadow material={mats.fur}>
          <sphereGeometry args={[0.75, 20, 16]} />
        </mesh>
        {/* Corcova */}
        <mesh position={[0, 1.35, -0.35]} material={mats.back}>
          <sphereGeometry args={[0.42, 14, 10]} />
        </mesh>
        {/* Cabeça */}
        <group ref={head} position={[0, 1.25, 0.85]}>
          <mesh castShadow material={mats.fur}>
            <sphereGeometry args={[0.36, 16, 12]} />
          </mesh>
          <mesh position={[0, -0.08, 0.3]} castShadow material={mats.skin}>
            <boxGeometry args={[0.24, 0.18, 0.26]} />
          </mesh>
          <mesh position={[-0.2, 0.28, 0]} material={mats.fur}>
            <sphereGeometry args={[0.11, 8, 6]} />
          </mesh>
          <mesh position={[0.2, 0.28, 0]} material={mats.fur}>
            <sphereGeometry args={[0.11, 8, 6]} />
          </mesh>
          <mesh position={[-0.12, 0.06, 0.3]} material={mats.eye}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
          <mesh position={[0.12, 0.06, 0.3]} material={mats.eye}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        </group>
        {leg(legFL, -0.35, 0.5)}
        {leg(legFR, 0.35, 0.5)}
        {leg(legBL, -0.38, -0.6)}
        {leg(legBR, 0.38, -0.6)}
        {/* Rabinho */}
        <mesh position={[0, 1.05, -1.05]} material={mats.fur}>
          <sphereGeometry args={[0.13, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* T-Rex 🦖 — braços decorativos de fábrica                            */
/* ------------------------------------------------------------------ */

function TRex({ variant }: { variant: GorillaVariant }) {
  const root = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const mats = useMonsterMats(variant);

  useMonsterFrame(root, mats, variant, ({ action, t, deathT, speed, gallop, clock, damp }) => {
    let bodyX = 0.15;
    let bodyY = 0;
    let headX = 0;
    let jawOpen = 0.08;
    const legAmp = Math.min(speed / 6, 1) * 0.8;

    if (action === "die") {
      const k = Math.min(Math.max(deathT, 0) / 1.2, 1);
      bodyX = 0.15 + easeOut(k) * 1.25;
      bodyY = -k * 0.5;
      jawOpen = 0.5 * k;
    } else if (action === "roar") {
      const rise = Math.min(t / 0.25, 1);
      bodyX = 0.15 - rise * 0.35;
      headX = -0.6 * rise;
      jawOpen = 0.75 * rise + Math.max(0, Math.sin(t * 14)) * 0.1;
    } else if (action === "swipe" || action === "slam") {
      // Mordida: cabeça mergulha e a bocarra fecha no impacto
      const k = Math.min(t / 0.6, 1);
      const lunge = Math.sin(k * Math.PI);
      bodyX = 0.15 + lunge * 0.45;
      headX = lunge * 0.7;
      jawOpen = k < 0.4 ? 0.9 : Math.max(0.05, 0.9 - (k - 0.4) * 3);
    } else if (speed > 0.8) {
      bodyY = Math.abs(Math.sin(gallop)) * 0.12;
      headX = 0.1;
      jawOpen = 0.18;
    } else {
      headX = Math.sin(clock * 0.6) * 0.12;
    }

    if (bodyG.current) {
      bodyG.current.rotation.x = lerp(bodyG.current.rotation.x, bodyX, damp);
      bodyG.current.position.y = lerp(bodyG.current.position.y, bodyY, damp);
    }
    if (head.current) head.current.rotation.x = lerp(head.current.rotation.x, headX, damp);
    if (jaw.current) jaw.current.rotation.x = lerp(jaw.current.rotation.x, jawOpen, damp);
    if (tail.current)
      tail.current.rotation.y = Math.sin(gallop * 0.5 + 1) * 0.25 + Math.sin(clock * 1.3) * 0.08;
    const s = Math.sin(gallop);
    if (legL.current) legL.current.rotation.x = s * legAmp;
    if (legR.current) legR.current.rotation.x = -s * legAmp;
  });

  return (
    <group ref={root} scale={1.15 * variant.scale}>
      <group ref={bodyG} position={[0, 1.15, 0]}>
        {/* Tronco */}
        <mesh scale={[0.72, 0.8, 1.25]} castShadow material={mats.fur}>
          <sphereGeometry args={[0.7, 20, 16]} />
        </mesh>
        {/* Barriga clara */}
        <mesh position={[0, -0.25, 0.25]} scale={[0.55, 0.55, 0.9]} material={mats.skin}>
          <sphereGeometry args={[0.6, 14, 10]} />
        </mesh>
        {/* Pescoço + cabeça enorme */}
        <group ref={head} position={[0, 0.55, 0.75]}>
          <mesh position={[0, 0.15, 0.25]} scale={[0.62, 0.6, 1.05]} castShadow material={mats.fur}>
            <sphereGeometry args={[0.5, 16, 12]} />
          </mesh>
          {/* Mandíbula */}
          <group ref={jaw} position={[0, -0.02, 0.2]}>
            <mesh position={[0, -0.1, 0.32]} scale={[0.5, 0.28, 0.85]} castShadow material={mats.back}>
              <sphereGeometry args={[0.42, 12, 8]} />
            </mesh>
          </group>
          {/* Dentes (fileira) */}
          <mesh position={[0, 0.0, 0.62]} rotation={[Math.PI, 0, 0]} material={mats.skin}>
            <coneGeometry args={[0.16, 0.14, 6]} />
          </mesh>
          <mesh position={[-0.14, 0.32, 0.35]} material={mats.eye}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
          <mesh position={[0.14, 0.32, 0.35]} material={mats.eye}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
        </group>
        {/* Bracinhos ridículos (a piada é essa) */}
        <mesh position={[-0.42, 0.05, 0.55]} rotation={[0.6, 0, 0.3]} castShadow material={mats.fur}>
          <cylinderGeometry args={[0.05, 0.06, 0.28, 6]} />
        </mesh>
        <mesh position={[0.42, 0.05, 0.55]} rotation={[0.6, 0, -0.3]} castShadow material={mats.fur}>
          <cylinderGeometry args={[0.05, 0.06, 0.28, 6]} />
        </mesh>
        {/* Cauda grossa */}
        <group ref={tail} position={[0, 0, -0.85]}>
          <mesh position={[0, 0, -0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow material={mats.fur}>
            <coneGeometry args={[0.4, 1.5, 10]} />
          </mesh>
        </group>
      </group>
      {/* Pernonas */}
      <group ref={legL} position={[-0.4, 1.0, -0.15]}>
        <mesh position={[0, -0.5, 0]} castShadow material={mats.fur}>
          <cylinderGeometry args={[0.2, 0.26, 1.0, 8]} />
        </mesh>
        <mesh position={[0, -1.0, 0.12]} castShadow material={mats.back}>
          <boxGeometry args={[0.34, 0.14, 0.5]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.4, 1.0, -0.15]}>
        <mesh position={[0, -0.5, 0]} castShadow material={mats.fur}>
          <cylinderGeometry args={[0.2, 0.26, 1.0, 8]} />
        </mesh>
        <mesh position={[0, -1.0, 0.12]} castShadow material={mats.back}>
          <boxGeometry args={[0.34, 0.14, 0.5]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Touro Furioso 🐂                                                    */
/* ------------------------------------------------------------------ */

function Bull({ variant }: { variant: GorillaVariant }) {
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legFL = useRef<THREE.Group>(null);
  const legFR = useRef<THREE.Group>(null);
  const legBL = useRef<THREE.Group>(null);
  const legBR = useRef<THREE.Group>(null);
  const mats = useMonsterMats(variant);
  const horn = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xd9cba8, roughness: 0.5 }),
    [],
  );

  useMonsterFrame(root, mats, variant, ({ action, t, deathT, speed, gallop, clock, damp }) => {
    let tiltX = 0;
    let tiltZ = 0;
    let headX = 0;
    let legAmp = Math.min(speed / 6, 1) * 0.75;

    if (action === "die") {
      const k = Math.min(Math.max(deathT, 0) / 1.2, 1);
      tiltZ = easeOut(k) * 1.4;
      legAmp = 0;
    } else if (action === "beam") {
      // Investida: cabeça baixa, patear furioso antes do bote
      const charging = t < 0.85;
      headX = charging ? 0.65 : 0.3;
      tiltX = charging ? 0.12 : -0.1;
      legAmp = charging ? 0.9 : 0.3;
    } else if (action === "roar") {
      headX = -0.5 * Math.min(t / 0.25, 1);
    } else if (action === "swipe" || action === "slam") {
      // Chifrada: cabeça varre de baixo pra cima
      const k = Math.min(t / 0.55, 1);
      headX = 0.5 - Math.sin(k * Math.PI) * 1.0;
    } else if (speed < 0.8) {
      headX = Math.sin(clock * 0.8) * 0.1 + 0.1;
      legAmp = 0.04;
    }

    if (tilt.current) {
      tilt.current.rotation.x = lerp(tilt.current.rotation.x, tiltX, damp);
      tilt.current.rotation.z = lerp(tilt.current.rotation.z, tiltZ, damp);
    }
    if (head.current) head.current.rotation.x = lerp(head.current.rotation.x, headX, damp);
    const s = Math.sin(gallop);
    if (legFL.current) legFL.current.rotation.x = s * legAmp;
    if (legBR.current) legBR.current.rotation.x = s * legAmp;
    if (legFR.current) legFR.current.rotation.x = -s * legAmp;
    if (legBL.current) legBL.current.rotation.x = -s * legAmp;
  });

  const leg = (
    ref: React.RefObject<THREE.Group | null>,
    x: number,
    z: number,
  ) => (
    <group ref={ref} position={[x, 0.78, z]}>
      <mesh position={[0, -0.38, 0]} castShadow material={mats.fur}>
        <cylinderGeometry args={[0.11, 0.13, 0.78, 8]} />
      </mesh>
      <mesh position={[0, -0.78, 0]} material={mats.back}>
        <cylinderGeometry args={[0.13, 0.14, 0.1, 8]} />
      </mesh>
    </group>
  );

  return (
    <group ref={root} scale={1.3 * variant.scale}>
      <group ref={tilt}>
        {/* Corpo musculoso */}
        <mesh position={[0, 1.05, -0.1]} scale={[0.8, 0.75, 1.3]} castShadow material={mats.fur}>
          <sphereGeometry args={[0.72, 20, 16]} />
        </mesh>
        {/* Cupim */}
        <mesh position={[0, 1.5, 0.25]} material={mats.back}>
          <sphereGeometry args={[0.34, 12, 10]} />
        </mesh>
        {/* Cabeça + chifres */}
        <group ref={head} position={[0, 1.25, 0.85]}>
          <mesh castShadow material={mats.fur}>
            <sphereGeometry args={[0.32, 16, 12]} />
          </mesh>
          <mesh position={[0, -0.12, 0.24]} castShadow material={mats.skin}>
            <boxGeometry args={[0.26, 0.2, 0.24]} />
          </mesh>
          <mesh position={[-0.28, 0.18, 0]} rotation={[0, 0, 1.0]} castShadow material={horn}>
            <coneGeometry args={[0.07, 0.5, 8]} />
          </mesh>
          <mesh position={[0.28, 0.18, 0]} rotation={[0, 0, -1.0]} castShadow material={horn}>
            <coneGeometry args={[0.07, 0.5, 8]} />
          </mesh>
          <mesh position={[-0.13, 0.05, 0.26]} material={mats.eye}>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
          <mesh position={[0.13, 0.05, 0.26]} material={mats.eye}>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
        </group>
        {leg(legFL, -0.32, 0.55)}
        {leg(legFR, 0.32, 0.55)}
        {leg(legBL, -0.34, -0.65)}
        {leg(legBR, 0.34, -0.65)}
        {/* Rabo */}
        <mesh position={[0, 1.15, -1.05]} rotation={[0.5, 0, 0]} material={mats.fur}>
          <cylinderGeometry args={[0.03, 0.05, 0.6, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Pato Gigante 🦆                                                     */
/* ------------------------------------------------------------------ */

function Duck({ variant }: { variant: GorillaVariant }) {
  const root = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const billTop = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const mats = useMonsterMats(variant);
  const bill = useMemo(
    () => new THREE.MeshStandardMaterial({ color: variant.skin, roughness: 0.5 }),
    [variant],
  );

  useMonsterFrame(root, mats, variant, ({ action, t, deathT, speed, gallop, clock, damp }) => {
    let roll = 0;
    let headX = 0;
    let billOpen = 0.05;
    let wing = 0.15;
    let bodyX = 0;
    const legAmp = Math.min(speed / 6, 1) * 0.85;

    if (action === "die") {
      const k = Math.min(Math.max(deathT, 0) / 1.2, 1);
      bodyX = -easeOut(k) * 1.3; // cai de costas, patas pro alto
      billOpen = 0.4 * k;
      wing = 0.9 * k;
    } else if (action === "roar") {
      // QUACK: bico escancarado + bater de asas
      const rise = Math.min(t / 0.2, 1);
      headX = -0.4 * rise;
      billOpen = 0.8 * rise;
      wing = 0.3 + Math.abs(Math.sin(t * 16)) * 0.9;
    } else if (action === "swipe" || action === "slam") {
      // Bicada fulminante
      const k = Math.min(t / 0.55, 1);
      const lunge = Math.sin(k * Math.PI);
      headX = lunge * 0.9;
      billOpen = k < 0.4 ? 0.7 : 0.1;
      wing = 0.3 + lunge * 0.4;
    } else if (speed > 0.8) {
      // Marcha de pato: rebola
      roll = Math.sin(gallop) * 0.16;
      headX = 0.1;
    } else {
      headX = Math.sin(clock * 0.9) * 0.12;
    }

    if (bodyG.current) {
      bodyG.current.rotation.z = lerp(bodyG.current.rotation.z, roll, damp);
      bodyG.current.rotation.x = lerp(bodyG.current.rotation.x, bodyX, damp);
    }
    if (head.current) head.current.rotation.x = lerp(head.current.rotation.x, headX, damp);
    if (billTop.current)
      billTop.current.rotation.x = lerp(billTop.current.rotation.x, -billOpen, damp);
    if (wingL.current) wingL.current.rotation.z = lerp(wingL.current.rotation.z, wing, damp);
    if (wingR.current) wingR.current.rotation.z = lerp(wingR.current.rotation.z, -wing, damp);
    const s = Math.sin(gallop);
    if (legL.current) legL.current.rotation.x = s * legAmp;
    if (legR.current) legR.current.rotation.x = -s * legAmp;
  });

  return (
    <group ref={root} scale={1.1 * variant.scale}>
      <group ref={bodyG} position={[0, 0.95, 0]}>
        {/* Corpanzil */}
        <mesh scale={[0.85, 0.8, 1.1]} castShadow material={mats.fur}>
          <sphereGeometry args={[0.72, 20, 16]} />
        </mesh>
        {/* Peito */}
        <mesh position={[0, -0.1, 0.4]} scale={[0.7, 0.65, 0.7]} material={mats.back}>
          <sphereGeometry args={[0.6, 14, 10]} />
        </mesh>
        {/* Rabinho arrebitado */}
        <mesh position={[0, 0.25, -0.75]} rotation={[-0.7, 0, 0]} castShadow material={mats.fur}>
          <coneGeometry args={[0.22, 0.5, 8]} />
        </mesh>
        {/* Asas */}
        <group ref={wingL} position={[-0.65, 0.15, 0]}>
          <mesh position={[-0.15, 0, -0.1]} scale={[0.35, 0.12, 0.8]} castShadow material={mats.back}>
            <sphereGeometry args={[0.6, 10, 8]} />
          </mesh>
        </group>
        <group ref={wingR} position={[0.65, 0.15, 0]}>
          <mesh position={[0.15, 0, -0.1]} scale={[0.35, 0.12, 0.8]} castShadow material={mats.back}>
            <sphereGeometry args={[0.6, 10, 8]} />
          </mesh>
        </group>
        {/* Pescoço + cabeça */}
        <group ref={head} position={[0, 0.7, 0.45]}>
          <mesh position={[0, 0.3, 0]} castShadow material={mats.fur}>
            <cylinderGeometry args={[0.16, 0.2, 0.6, 10]} />
          </mesh>
          <mesh position={[0, 0.72, 0.05]} castShadow material={mats.fur}>
            <sphereGeometry args={[0.3, 16, 12]} />
          </mesh>
          {/* Bico (metade de cima abre) */}
          <group ref={billTop} position={[0, 0.68, 0.28]}>
            <mesh position={[0, 0.04, 0.2]} scale={[1, 0.45, 1]} castShadow material={bill}>
              <boxGeometry args={[0.3, 0.16, 0.42]} />
            </mesh>
          </group>
          <mesh position={[0, 0.58, 0.44]} scale={[1, 0.4, 1]} castShadow material={bill}>
            <boxGeometry args={[0.28, 0.14, 0.38]} />
          </mesh>
          <mesh position={[-0.13, 0.8, 0.2]} material={mats.eye}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
          <mesh position={[0.13, 0.8, 0.2]} material={mats.eye}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
        </group>
      </group>
      {/* Pernas laranjas */}
      <group ref={legL} position={[-0.25, 0.62, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow material={bill}>
          <cylinderGeometry args={[0.06, 0.07, 0.55, 6]} />
        </mesh>
        <mesh position={[0, -0.56, 0.1]} material={bill}>
          <boxGeometry args={[0.24, 0.06, 0.34]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.25, 0.62, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow material={bill}>
          <cylinderGeometry args={[0.06, 0.07, 0.55, 6]} />
        </mesh>
        <mesh position={[0, -0.56, 0.1]} material={bill}>
          <boxGeometry args={[0.24, 0.06, 0.34]} />
        </mesh>
      </group>
    </group>
  );
}
