"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PHYSICS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { sim } from "@/systems/simulation";
import { fx } from "@/systems/fx";
import { EntityState } from "@/types/simulation";

const _target = new THREE.Vector3();
const _delta = new THREE.Vector3();

/** OrbitControls + modos: livre, seguir gorila, seguir homem, vista aérea. */
export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const mode = useSimulationStore((s) => s.cameraMode);
  const phase = useSimulationStore((s) => s.phase);
  const followIndex = useRef(-1);

  // Novo alvo aleatório ao entrar no modo "seguir homem"
  useEffect(() => {
    if (mode === "man") followIndex.current = sim.randomAliveIndex();
  }, [mode]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const lerpK = 1 - Math.exp(-5 * delta);

    if (mode === "gorilla" && sim.gorilla.body) {
      const p = sim.gorilla.body.translation();
      _target.set(p.x, p.y + 1.2, p.z);
      moveTargetKeepingOffset(controls, camera, _target, lerpK);
    } else if (mode === "man") {
      let i = followIndex.current;
      if (i < 0 || i >= sim.count || sim.state[i] === EntityState.Dead) {
        followIndex.current = sim.randomAliveIndex();
        i = followIndex.current;
      }
      if (i >= 0) {
        _target.set(
          sim.posX[i],
          sim.posY[i] - PHYSICS.manRadius + 1.3,
          sim.posZ[i],
        );
        moveTargetKeepingOffset(controls, camera, _target, lerpK);
      }
    } else if (mode === "aerial") {
      _target.set(0, 0, 0);
      controls.target.lerp(_target, lerpK);
      camera.position.lerp(new THREE.Vector3(0.01, 82, 6), lerpK);
    }

    // Cinemática de intro: órbita lenta enquanto no menu
    if (phase === "intro") {
      const t = performance.now() / 1000;
      const r = 30;
      camera.position.lerp(
        new THREE.Vector3(Math.cos(t * 0.08) * r, 11, Math.sin(t * 0.08) * r),
        0.02,
      );
      controls.target.lerp(new THREE.Vector3(0, 1.6, 0), 0.05);
    }

    // Screen shake (rugidos, slams)
    if (fx.shake > 0.002) {
      const s = fx.shake;
      camera.position.x += (Math.random() - 0.5) * s * 0.35;
      camera.position.y += (Math.random() - 0.5) * s * 0.25;
      camera.position.z += (Math.random() - 0.5) * s * 0.35;
      fx.shake *= Math.exp(-4.5 * delta);
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={140}
      maxPolarAngle={Math.PI * 0.49}
      enablePan
      target={[0, 1.5, 0]}
    />
  );
}

function moveTargetKeepingOffset(
  controls: OrbitControlsImpl,
  camera: THREE.Camera,
  target: THREE.Vector3,
  k: number,
) {
  _delta.copy(target).sub(controls.target).multiplyScalar(k);
  controls.target.add(_delta);
  camera.position.add(_delta);
}
