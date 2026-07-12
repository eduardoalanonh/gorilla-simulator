"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sim } from "@/systems/simulation";
import { fx } from "@/systems/fx";

const MAX_PROJECTILES = 400;

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const FORWARD = new THREE.Vector3(0, 0, 1);

/** Flechas e bolas de fogo em voo — dois InstancedMesh + rastro de fagulhas. */
export function ProjectilesRenderer() {
  const arrowRef = useRef<THREE.InstancedMesh>(null);
  const fireRef = useRef<THREE.InstancedMesh>(null);
  const trailTick = useRef(0);

  const arrowGeometry = useMemo(() => {
    // Haste + ponta apontando para +Z
    const shaft = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5);
    shaft.rotateX(Math.PI / 2);
    return shaft;
  }, []);

  useFrame((_, delta) => {
    const arrows = arrowRef.current;
    const fires = fireRef.current;
    if (!arrows || !fires) return;

    trailTick.current += delta;
    const spawnTrail = trailTick.current > 0.05;
    if (spawnTrail) trailTick.current = 0;

    let ai = 0;
    let fi = 0;
    for (const p of sim.projectiles) {
      if (!p.active) continue;
      _pos.set(p.x, p.y, p.z);

      if (p.kind === "arrow") {
        if (ai >= MAX_PROJECTILES) continue;
        _dir.set(p.x - p.px, p.y - p.py, p.z - p.pz);
        if (_dir.lengthSq() > 1e-8) _dir.normalize();
        else _dir.copy(FORWARD);
        _quat.setFromUnitVectors(FORWARD, _dir);
        _scale.setScalar(1);
        _mat.compose(_pos, _quat, _scale);
        arrows.setMatrixAt(ai++, _mat);
      } else {
        if (fi >= MAX_PROJECTILES) continue;
        _quat.identity();
        _scale.setScalar(1 + Math.sin(p.t * 40) * 0.2);
        _mat.compose(_pos, _quat, _scale);
        fires.setMatrixAt(fi++, _mat);
        // Rastro de fagulhas
        if (spawnTrail && fx.pool) {
          fx.pool.spawn(p.x, p.y, p.z, {
            count: 1,
            speed: 0.3,
            up: 0.4,
            spread: 0.08,
            size: 0.14,
            life: 0.45,
            gravity: -0.2,
            color: 0xff8a2a,
            colorJitter: 0.2,
          });
        }
      }
    }

    // count limita o draw range — slots antigos além dele não renderizam
    arrows.count = ai;
    fires.count = fi;
    arrows.instanceMatrix.needsUpdate = true;
    fires.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={arrowRef}
        args={[arrowGeometry, undefined, MAX_PROJECTILES]}
        frustumCulled={false}
      >
        <meshStandardMaterial color="#8a6a42" roughness={0.8} />
      </instancedMesh>
      <instancedMesh
        ref={fireRef}
        args={[undefined, undefined, MAX_PROJECTILES]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshBasicMaterial color="#ffb050" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
