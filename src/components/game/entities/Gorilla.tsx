"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { GORILLA_MODIFIERS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { sim } from "@/systems/simulation";
import { fx } from "@/systems/fx";
import { damp, lerp } from "@/utils/random";

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Gorila procedural com variantes (normal, gigante, Macaco Lendário com
 * cauda + rajada de energia, dourado com aura) e animação por pose.
 */
export function Gorilla() {
  const gorillaModifierId = useSimulationStore((s) => s.gorillaModifierId);
  const variant =
    GORILLA_MODIFIERS.find((m) => m.id === gorillaModifierId) ??
    GORILLA_MODIFIERS[0];

  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const mouthGlow = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const gallop = useRef(0);
  const auraTimer = useRef(0);

  const mats = useMemo(() => {
    const fur = new THREE.MeshStandardMaterial({
      color: variant.fur,
      roughness: 0.92,
      metalness: variant.aura ? 0.35 : 0.05,
    });
    const back = new THREE.MeshStandardMaterial({
      color: variant.back,
      roughness: 0.95,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: variant.skin,
      roughness: 0.6,
    });
    const eye = new THREE.MeshStandardMaterial({
      color: "#1a0f0a",
      roughness: 0.2,
      emissive: variant.eyeGlow,
      emissiveIntensity: variant.eyeIntensity,
    });
    const energy = new THREE.MeshBasicMaterial({
      color: "#aee6ff",
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    });
    return { fur, back, skin, eye, energy };
  }, [variant]);

  useEffect(() => {
    const created = mats;
    return () => {
      Object.values(created).forEach((m) => m.dispose());
    };
  }, [mats]);

  useFrame((state, delta) => {
    const g = sim.gorilla;
    const body = g.body;
    if (!body || !root.current) return;

    const p = body.translation();
    root.current.position.set(p.x, p.y - sim.gorillaRadius, p.z);
    root.current.rotation.y = g.facing;

    // Fúria: olhos em brasa (soma ao brilho base da variante)
    mats.eye.emissiveIntensity = g.enraged
      ? 3 + Math.sin(state.clock.elapsedTime * 10) * 0.8
      : variant.eyeIntensity;

    const clock = state.clock.elapsedTime;
    const v = body.linvel();
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    gallop.current += delta * (4 + speed * 1.6);

    // Aura de energia (Gorila Dourado)
    if (variant.aura && fx.pool && sim.running && g.hp > 0) {
      auraTimer.current -= delta;
      if (auraTimer.current <= 0) {
        auraTimer.current = 0.07;
        const a = Math.random() * Math.PI * 2;
        const r = sim.gorillaRadius * (0.5 + Math.random() * 0.7);
        fx.pool.spawn(p.x + Math.cos(a) * r, p.y - sim.gorillaRadius + 0.3, p.z + Math.sin(a) * r, {
          count: 1,
          speed: 0.3,
          up: 2.6,
          spread: 0.1,
          size: 0.16,
          life: 0.7,
          gravity: -0.4,
          color: variant.aura,
          colorJitter: 0.25,
        });
      }
    }

    // Pose alvo
    let tiltX = 0.12;
    let rootY = 0;
    let armLX = -0.35;
    let armLZ = 0.12;
    let armRX = -0.35;
    let armRZ = -0.12;
    let headX = 0;
    let chestScale = 1 + Math.sin(clock * 1.8) * 0.018;

    const t = g.actionT;

    if (g.action === "die") {
      const dt01 = Math.min((g.deathT >= 0 ? g.deathT : 0) / 1.2, 1);
      tiltX = lerp(0.12, 1.35, easeOut(dt01));
      rootY = -dt01 * 0.55;
      armLX = armRX = lerp(-0.35, 0.6, dt01);
      armLZ = 0.7 * dt01;
      armRZ = -0.7 * dt01;
      headX = 0.5 * dt01;
    } else if (g.action === "beam") {
      // Carrega com a cabeça erguida, dispara com recuo
      const charging = t < 0.85;
      const chargeK = Math.min(t / 0.85, 1);
      tiltX = charging ? lerp(0.12, -0.25, easeOut(chargeK)) : 0.05;
      armLX = armRX = -1.1;
      armLZ = 0.5;
      armRZ = -0.5;
      headX = charging ? -0.5 * chargeK : 0.18;
      chestScale = 1 + chargeK * 0.08;
    } else if (g.action === "roar") {
      // Empina, cabeça pra cima, bate no peito alternando os punhos
      const rise = Math.min(t / 0.25, 1);
      tiltX = lerp(0.12, -0.42, easeOut(rise));
      const beat = Math.sin(t * 22);
      armLX = -1.65 + Math.max(0, beat) * 0.55;
      armRX = -1.65 + Math.max(0, -beat) * 0.55;
      armLZ = 0.55;
      armRZ = -0.55;
      headX = -0.55 * rise;
      chestScale = 1.06 + Math.sin(t * 22) * 0.02;
    } else if (g.action === "swipe") {
      // Braço direito varre na horizontal
      const k = Math.min(t / 0.55, 1);
      const arc = Math.sin(k * Math.PI);
      tiltX = 0.25 + arc * 0.15;
      armRX = -0.35 - arc * 1.5;
      armRZ = lerp(1.1, -1.3, k);
      armLX = -0.5;
      headX = 0.1;
    } else if (g.action === "slam") {
      // Os dois braços sobem e esmagam o chão
      const k = Math.min(t / 0.8, 1);
      const raise = k < 0.45 ? easeOut(k / 0.45) : 1 - easeOut((k - 0.45) / 0.3);
      tiltX = 0.1 + (k > 0.4 ? 0.45 : 0);
      armLX = armRX = -0.35 - raise * 2.3;
      armLZ = 0.35;
      armRZ = -0.35;
      headX = -0.2 * raise;
    } else if (speed > 0.8) {
      // Galope de quadrúpede
      const ph = gallop.current;
      const stride = Math.sin(ph);
      tiltX = 0.32 + Math.abs(Math.cos(ph)) * 0.06;
      rootY = Math.abs(Math.sin(ph)) * 0.16;
      armLX = -0.7 + stride * 0.75;
      armRX = -0.7 - stride * 0.75;
      headX = 0.15;
    } else {
      // Idle: respira, olha em volta, ajeita os punhos
      armLX = -0.35 + Math.sin(clock * 1.3) * 0.05;
      armRX = -0.35 - Math.sin(clock * 1.3) * 0.05;
      headX = Math.sin(clock * 0.6) * 0.12;
    }

    // Visual da rajada: brilho na boca (carga) + feixe (disparo)
    if (mouthGlow.current && beam.current) {
      if (g.action === "beam") {
        const chargeK = Math.min(t / 0.85, 1);
        const firing = t >= 0.85 && t < 1.7;
        mouthGlow.current.visible = true;
        mouthGlow.current.scale.setScalar(
          firing ? 1.4 + Math.sin(clock * 40) * 0.2 : 0.2 + chargeK * 1.1,
        );
        beam.current.visible = firing;
        if (firing) {
          const pulse = 1 + Math.sin(clock * 50) * 0.18;
          beam.current.scale.set(pulse, 1, pulse);
          const fade = t > 1.45 ? 1 - (t - 1.45) / 0.25 : 1;
          mats.energy.opacity = 0.9 * fade;
        }
      } else {
        mouthGlow.current.visible = false;
        beam.current.visible = false;
      }
    }

    // Cauda: balanço constante, chicoteia quando corre
    if (tail.current) {
      tail.current.rotation.y = Math.sin(clock * 3.2) * 0.5;
      tail.current.rotation.x = -0.6 + Math.sin(clock * 2.1) * 0.2 + speed * 0.03;
    }

    const d = 1 - Math.exp(-14 * delta);
    if (tilt.current) {
      tilt.current.rotation.x = lerp(tilt.current.rotation.x, tiltX, d);
      tilt.current.position.y = lerp(tilt.current.position.y, rootY, d);
    }
    if (armL.current) {
      armL.current.rotation.x = lerp(armL.current.rotation.x, armLX, d);
      armL.current.rotation.z = lerp(armL.current.rotation.z, armLZ, d);
    }
    if (armR.current) {
      armR.current.rotation.x = lerp(armR.current.rotation.x, armRX, d);
      armR.current.rotation.z = lerp(armR.current.rotation.z, armRZ, d);
    }
    if (head.current)
      head.current.rotation.x = lerp(head.current.rotation.x, headX, d);
    if (chest.current) {
      const s = damp(chest.current.scale.x, chestScale, 12, delta);
      chest.current.scale.setScalar(s);
    }
  });

  const scale = 1.18 * variant.scale;
  // Comprimento do feixe em unidades locais (36m no mundo)
  const beamLen = 36 / scale;

  return (
    <group ref={root} scale={scale} key={variant.id}>
      <group ref={tilt}>
        {/* Quadril + pernas curtas */}
        <mesh position={[0, 0.78, -0.18]} castShadow material={mats.fur}>
          <sphereGeometry args={[0.55, 20, 16]} />
        </mesh>
        <mesh position={[-0.32, 0.38, -0.18]} castShadow material={mats.fur}>
          <cylinderGeometry args={[0.19, 0.23, 0.75, 10]} />
        </mesh>
        <mesh position={[0.32, 0.38, -0.18]} castShadow material={mats.fur}>
          <cylinderGeometry args={[0.19, 0.23, 0.75, 10]} />
        </mesh>
        <mesh position={[-0.34, 0.08, -0.08]} castShadow material={mats.skin}>
          <boxGeometry args={[0.3, 0.14, 0.42]} />
        </mesh>
        <mesh position={[0.34, 0.08, -0.08]} castShadow material={mats.skin}>
          <boxGeometry args={[0.3, 0.14, 0.42]} />
        </mesh>

        {/* Cauda (Macaco Lendário) */}
        {variant.tail && (
          <group ref={tail} position={[0, 0.85, -0.62]}>
            <mesh position={[0, 0.25, -0.28]} rotation={[0.7, 0, 0]} castShadow material={mats.fur}>
              <cylinderGeometry args={[0.06, 0.11, 0.9, 8]} />
            </mesh>
            <mesh position={[0, 0.62, -0.52]} castShadow material={mats.fur}>
              <sphereGeometry args={[0.11, 8, 6]} />
            </mesh>
          </group>
        )}

        {/* Peito enorme */}
        <group ref={chest} position={[0, 1.32, 0.12]}>
          <mesh castShadow material={mats.fur}>
            <sphereGeometry args={[0.78, 24, 18]} />
          </mesh>
          {/* Peitoral de pele */}
          <mesh position={[0, -0.05, 0.52]} castShadow material={mats.skin}>
            <sphereGeometry args={[0.42, 16, 12]} />
          </mesh>
          {/* Costas prateadas (silverback) */}
          <mesh
            position={[0, -0.02, -0.32]}
            scale={[0.95, 0.72, 0.62]}
            material={mats.back}
          >
            <sphereGeometry args={[0.66, 20, 14]} />
          </mesh>

          {/* Cabeça */}
          <group ref={head} position={[0, 0.62, 0.42]}>
            <mesh castShadow material={mats.fur}>
              <sphereGeometry args={[0.36, 20, 16]} />
            </mesh>
            {/* Crista sagital */}
            <mesh position={[0, 0.28, -0.05]} castShadow material={mats.fur}>
              <sphereGeometry args={[0.2, 12, 10]} />
            </mesh>
            {/* Face */}
            <mesh position={[0, -0.02, 0.28]} material={mats.skin}>
              <sphereGeometry args={[0.22, 16, 12]} />
            </mesh>
            {/* Focinho */}
            <mesh position={[0, -0.14, 0.34]} castShadow material={mats.skin}>
              <boxGeometry args={[0.26, 0.18, 0.18]} />
            </mesh>
            {/* Sobrancelha */}
            <mesh position={[0, 0.12, 0.3]} material={mats.fur}>
              <boxGeometry args={[0.34, 0.1, 0.12]} />
            </mesh>
            <mesh position={[-0.09, 0.04, 0.42]} material={mats.eye}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
            <mesh position={[0.09, 0.04, 0.42]} material={mats.eye}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
            {/* Brilho na boca (carga da rajada) */}
            <mesh ref={mouthGlow} position={[0, -0.16, 0.48]} visible={false} material={mats.energy}>
              <sphereGeometry args={[0.14, 10, 8]} />
            </mesh>
          </group>

          {/* Feixe de energia — horizontal, a partir da boca */}
          <mesh
            ref={beam}
            position={[0, 0.45, 0.6 + beamLen / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            visible={false}
            material={mats.energy}
          >
            <cylinderGeometry args={[0.32, 0.45, beamLen, 12, 1, true]} />
          </mesh>

          {/* Braços longos — pivô no ombro */}
          <group ref={armL} position={[-0.72, 0.28, 0.08]}>
            <mesh position={[0, -0.55, 0]} castShadow material={mats.fur}>
              <cylinderGeometry args={[0.17, 0.24, 1.15, 10]} />
            </mesh>
            <mesh position={[0, -1.18, 0]} castShadow material={mats.skin}>
              <sphereGeometry args={[0.24, 12, 10]} />
            </mesh>
          </group>
          <group ref={armR} position={[0.72, 0.28, 0.08]}>
            <mesh position={[0, -0.55, 0]} castShadow material={mats.fur}>
              <cylinderGeometry args={[0.17, 0.24, 1.15, 10]} />
            </mesh>
            <mesh position={[0, -1.18, 0]} castShadow material={mats.skin}>
              <sphereGeometry args={[0.24, 12, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
