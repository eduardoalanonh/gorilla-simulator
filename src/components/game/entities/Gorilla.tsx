"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { COLORS, PHYSICS } from "@/constants/config";
import { sim } from "@/systems/simulation";
import { damp, lerp } from "@/utils/random";

const FUR = new THREE.MeshStandardMaterial({
  color: COLORS.gorillaFur,
  roughness: 0.92,
  metalness: 0.05,
});
const SILVER = new THREE.MeshStandardMaterial({
  color: COLORS.gorillaSilver,
  roughness: 0.95,
});
const SKIN = new THREE.MeshStandardMaterial({
  color: COLORS.gorillaSkin,
  roughness: 0.6,
});
const EYE = new THREE.MeshStandardMaterial({
  color: "#1a0f0a",
  roughness: 0.2,
  emissive: "#4a1808",
  emissiveIntensity: 0.35,
});

/**
 * Gorila procedural (sem assets externos) com animação por pose:
 * idle, galope, swipe, slam, rugido com batida no peito e morte.
 */
export function Gorilla() {
  const root = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const gallop = useRef(0);

  useFrame((state, delta) => {
    const g = sim.gorilla;
    const body = g.body;
    if (!body || !root.current) return;

    const p = body.translation();
    root.current.position.set(p.x, p.y - PHYSICS.gorillaRadius, p.z);
    root.current.rotation.y = g.facing;

    const clock = state.clock.elapsedTime;
    const v = body.linvel();
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    gallop.current += delta * (4 + speed * 1.6);

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

  return (
    <group ref={root} scale={1.18}>
      <group ref={tilt}>
        {/* Quadril + pernas curtas */}
        <mesh position={[0, 0.78, -0.18]} castShadow material={FUR}>
          <sphereGeometry args={[0.55, 20, 16]} />
        </mesh>
        <mesh position={[-0.32, 0.38, -0.18]} castShadow material={FUR}>
          <cylinderGeometry args={[0.19, 0.23, 0.75, 10]} />
        </mesh>
        <mesh position={[0.32, 0.38, -0.18]} castShadow material={FUR}>
          <cylinderGeometry args={[0.19, 0.23, 0.75, 10]} />
        </mesh>
        <mesh position={[-0.34, 0.08, -0.08]} castShadow material={SKIN}>
          <boxGeometry args={[0.3, 0.14, 0.42]} />
        </mesh>
        <mesh position={[0.34, 0.08, -0.08]} castShadow material={SKIN}>
          <boxGeometry args={[0.3, 0.14, 0.42]} />
        </mesh>

        {/* Peito enorme */}
        <group ref={chest} position={[0, 1.32, 0.12]}>
          <mesh castShadow material={FUR}>
            <sphereGeometry args={[0.78, 24, 18]} />
          </mesh>
          {/* Peitoral de pele */}
          <mesh position={[0, -0.05, 0.52]} castShadow material={SKIN}>
            <sphereGeometry args={[0.42, 16, 12]} />
          </mesh>
          {/* Costas prateadas (silverback) */}
          <mesh
            position={[0, -0.02, -0.32]}
            scale={[0.95, 0.72, 0.62]}
            material={SILVER}
          >
            <sphereGeometry args={[0.66, 20, 14]} />
          </mesh>

          {/* Cabeça */}
          <group ref={head} position={[0, 0.62, 0.42]}>
            <mesh castShadow material={FUR}>
              <sphereGeometry args={[0.36, 20, 16]} />
            </mesh>
            {/* Crista sagital */}
            <mesh position={[0, 0.28, -0.05]} castShadow material={FUR}>
              <sphereGeometry args={[0.2, 12, 10]} />
            </mesh>
            {/* Face */}
            <mesh position={[0, -0.02, 0.28]} material={SKIN}>
              <sphereGeometry args={[0.22, 16, 12]} />
            </mesh>
            {/* Focinho */}
            <mesh position={[0, -0.14, 0.34]} castShadow material={SKIN}>
              <boxGeometry args={[0.26, 0.18, 0.18]} />
            </mesh>
            {/* Sobrancelha */}
            <mesh position={[0, 0.12, 0.3]} material={FUR}>
              <boxGeometry args={[0.34, 0.1, 0.12]} />
            </mesh>
            <mesh position={[-0.09, 0.04, 0.42]} material={EYE}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
            <mesh position={[0.09, 0.04, 0.42]} material={EYE}>
              <sphereGeometry args={[0.035, 8, 6]} />
            </mesh>
          </group>

          {/* Braços longos — pivô no ombro */}
          <group ref={armL} position={[-0.72, 0.28, 0.08]}>
            <mesh position={[0, -0.55, 0]} castShadow material={FUR}>
              <cylinderGeometry args={[0.17, 0.24, 1.15, 10]} />
            </mesh>
            <mesh position={[0, -1.18, 0]} castShadow material={SKIN}>
              <sphereGeometry args={[0.24, 12, 10]} />
            </mesh>
          </group>
          <group ref={armR} position={[0.72, 0.28, 0.08]}>
            <mesh position={[0, -0.55, 0]} castShadow material={FUR}>
              <cylinderGeometry args={[0.17, 0.24, 1.15, 10]} />
            </mesh>
            <mesh position={[0, -1.18, 0]} castShadow material={SKIN}>
              <sphereGeometry args={[0.24, 12, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
