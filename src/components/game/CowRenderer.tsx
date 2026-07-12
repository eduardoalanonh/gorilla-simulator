"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sim } from "@/systems/simulation";
import { damp } from "@/utils/random";

const WHITE = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.85 });
const BLACK = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.9 });
const PINK = new THREE.MeshStandardMaterial({ color: 0xd89aa0, roughness: 0.7 });

/** A vaca que cai do céu (evento de arena). Não faça perguntas. */
export function CowRenderer() {
  const root = useRef<THREE.Group>(null);
  const squash = useRef(1);

  const legs = useMemo(
    () =>
      [
        [-0.3, 0.35],
        [0.3, 0.35],
        [-0.3, -0.35],
        [0.3, -0.35],
      ] as const,
    [],
  );

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const cow = sim.cow;
    g.visible = cow.active;
    if (!cow.active) return;

    g.position.set(cow.x, cow.y, cow.z);
    if (!cow.landed) {
      // Girando levemente na queda, mugindo para o além
      g.rotation.x = Math.sin(state.clock.elapsedTime * 3) * 0.3;
      g.rotation.z = Math.cos(state.clock.elapsedTime * 2.2) * 0.25;
      squash.current = 1;
    } else {
      g.rotation.x = damp(g.rotation.x, 0, 8, delta);
      g.rotation.z = damp(g.rotation.z, 0.08, 8, delta);
      // Amassa na aterrissagem e volta
      const target = cow.timer > 11 ? 0.62 : 1;
      squash.current = damp(squash.current, target, 10, delta);
    }
    g.scale.set(1, squash.current, 1);
  });

  return (
    <group ref={root} visible={false}>
      {/* Corpo */}
      <mesh castShadow material={WHITE} scale={[0.75, 0.7, 1.15]}>
        <sphereGeometry args={[0.75, 16, 12]} />
      </mesh>
      {/* Manchas */}
      <mesh position={[0.3, 0.25, 0.3]} material={BLACK} scale={[0.4, 0.3, 0.5]}>
        <sphereGeometry args={[0.6, 10, 8]} />
      </mesh>
      <mesh position={[-0.35, 0.1, -0.4]} material={BLACK} scale={[0.35, 0.3, 0.4]}>
        <sphereGeometry args={[0.6, 10, 8]} />
      </mesh>
      {/* Cabeça */}
      <group position={[0, 0.35, 0.85]}>
        <mesh castShadow material={WHITE}>
          <boxGeometry args={[0.42, 0.4, 0.45]} />
        </mesh>
        <mesh position={[0, -0.1, 0.2]} material={PINK}>
          <boxGeometry args={[0.34, 0.2, 0.14]} />
        </mesh>
        <mesh position={[-0.28, 0.18, 0]} rotation={[0, 0, 0.9]} material={WHITE}>
          <coneGeometry args={[0.05, 0.22, 6]} />
        </mesh>
        <mesh position={[0.28, 0.18, 0]} rotation={[0, 0, -0.9]} material={WHITE}>
          <coneGeometry args={[0.05, 0.22, 6]} />
        </mesh>
        <mesh position={[-0.12, 0.08, 0.24]} material={BLACK}>
          <sphereGeometry args={[0.045, 6, 6]} />
        </mesh>
        <mesh position={[0.12, 0.08, 0.24]} material={BLACK}>
          <sphereGeometry args={[0.045, 6, 6]} />
        </mesh>
      </group>
      {/* Pernas */}
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.6, z]} castShadow material={WHITE}>
          <cylinderGeometry args={[0.09, 0.1, 0.5, 6]} />
        </mesh>
      ))}
    </group>
  );
}
