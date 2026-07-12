"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MAX_MEN, MEN_MODIFIERS, PHYSICS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { sim } from "@/systems/simulation";
import { EntityState } from "@/types/simulation";

const BAR_HEIGHT = { human: 1.92, dog: 1.1, robot: 2.05 } as const;

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Barras de vida instanciadas (billboards) acima dos homens vivos. */
export function HealthBars() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const show = useSimulationStore((s) => s.showHealthBars);
  const menModifierId = useSimulationStore((s) => s.menModifierId);
  const rig = MEN_MODIFIERS.find((m) => m.id === menModifierId)?.rig ?? "human";
  const barHeight = BAR_HEIGHT[rig];

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!show) {
      mesh.count = 0;
      return;
    }
    mesh.count = sim.count;
    const maxHp = sim.manStats.maxHealth;

    for (let i = 0; i < sim.count; i++) {
      if (sim.state[i] === EntityState.Dead) {
        mesh.setMatrixAt(i, ZERO);
        continue;
      }
      const frac = Math.max(sim.hp[i] / maxHp, 0.02);
      _pos.set(
        sim.posX[i],
        sim.posY[i] - PHYSICS.manRadius + barHeight,
        sim.posZ[i],
      );
      _scale.set(0.68 * frac, 0.07, 1);
      _mat.compose(_pos, camera.quaternion, _scale);
      mesh.setMatrixAt(i, _mat);

      _color.setHSL(frac * 0.33, 0.9, 0.5);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_MEN]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}
