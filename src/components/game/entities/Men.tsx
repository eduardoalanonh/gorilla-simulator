"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { COLORS, MAX_MEN, PHYSICS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { sim } from "@/systems/simulation";
import { EntityState } from "@/types/simulation";
import { mulberry32 } from "@/utils/random";

const BODY_OFFSET = PHYSICS.manRadius; // centro físico → pés no chão

interface PartDef {
  geometry: THREE.BufferGeometry;
  pivot: THREE.Vector3;
  swing: "armL" | "armR" | "legL" | "legR" | "none";
}

function buildParts(): Record<string, PartDef> {
  const torso = new THREE.BoxGeometry(0.4, 0.52, 0.24);
  const head = new THREE.BoxGeometry(0.21, 0.23, 0.21);
  const arm = new THREE.BoxGeometry(0.11, 0.5, 0.11);
  arm.translate(0, -0.22, 0); // origem no ombro
  const leg = new THREE.BoxGeometry(0.14, 0.56, 0.14);
  leg.translate(0, -0.26, 0); // origem no quadril

  return {
    torso: { geometry: torso, pivot: new THREE.Vector3(0, 1.02, 0), swing: "none" },
    head: { geometry: head, pivot: new THREE.Vector3(0, 1.42, 0), swing: "none" },
    armL: { geometry: arm, pivot: new THREE.Vector3(-0.27, 1.24, 0), swing: "armL" },
    armR: {
      geometry: arm.clone(),
      pivot: new THREE.Vector3(0.27, 1.24, 0),
      swing: "armR",
    },
    legL: { geometry: leg, pivot: new THREE.Vector3(-0.11, 0.56, 0), swing: "legL" },
    legR: {
      geometry: leg.clone(),
      pivot: new THREE.Vector3(0.11, 0.56, 0),
      swing: "legR",
    },
  };
}

const _root = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _quatPitch = new THREE.Quaternion();
const _swing = new THREE.Quaternion();
const _unit = new THREE.Vector3(1, 1, 1);
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _color = new THREE.Color();
const ZERO_MAT = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Todos os homens renderizados com InstancedMesh (6 partes = 6 draw calls).
 * Corrida, soco, morte e ragdoll são compostos por matriz, por frame.
 */
export function Men() {
  const runId = useSimulationStore((s) => s.runId);
  const menCount = useSimulationStore((s) => s.menCount);
  const menModifierId = useSimulationStore((s) => s.menModifierId);
  const debugMode = useSimulationStore((s) => s.debugMode);

  const parts = useMemo(buildParts, []);
  const partNames = useMemo(() => Object.keys(parts), [parts]);
  const meshRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const weaponRef = useRef<THREE.InstancedMesh | null>(null);
  const tinted = useRef(new Uint8Array(MAX_MEN));
  const skinColors = useRef(new Float32Array(MAX_MEN * 3));
  const frozen = useRef(new Uint8Array(MAX_MEN));

  const hasWeapon = menModifierId === "bastoes" || menModifierId === "medieval";

  const weaponGeometry = useMemo(() => {
    if (menModifierId === "medieval") {
      const g = new THREE.BoxGeometry(0.05, 0.85, 0.14);
      g.translate(0, -0.45, 0.1);
      return g;
    }
    const g = new THREE.CylinderGeometry(0.035, 0.045, 1.05, 6);
    g.translate(0, -0.5, 0.1);
    return g;
  }, [menModifierId]);

  // Cores por instância — refeitas a cada respawn
  useEffect(() => {
    const rng = mulberry32(runId * 7919 + 13);
    for (const name of partNames) {
      const mesh = meshRefs.current[name];
      if (!mesh) continue;
      for (let i = 0; i < MAX_MEN; i++) {
        const skin = COLORS.skinTones[Math.floor(rng() * COLORS.skinTones.length)];
        const shirt = COLORS.shirts[Math.floor(rng() * COLORS.shirts.length)];
        const pants = COLORS.pants[Math.floor(rng() * COLORS.pants.length)];
        if (name === "torso") _color.setHex(shirt);
        else if (name === "legL" || name === "legR") _color.setHex(pants);
        else _color.setHex(skin);
        if (name === "head") {
          skinColors.current[i * 3] = _color.r;
          skinColors.current[i * 3 + 1] = _color.g;
          skinColors.current[i * 3 + 2] = _color.b;
        }
        mesh.setColorAt(i, _color);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    tinted.current.fill(0);
    frozen.current.fill(0);
  }, [runId, menCount, partNames, menModifierId]);

  useFrame((state) => {
    const clock = state.clock.elapsedTime;
    const count = sim.count;
    const meshes = partNames.map((n) => meshRefs.current[n]);
    if (meshes.some((m) => !m)) return;
    const weapon = weaponRef.current;

    for (const m of meshes) m!.count = count;
    if (weapon) weapon.count = hasWeapon ? count : 0;

    for (let i = 0; i < count; i++) {
      const dead = sim.state[i] === EntityState.Dead;

      // Cadáver assentado: matriz congelada, nada a fazer
      if (dead && sim.settled[i]) {
        if (frozen.current[i]) continue;
        frozen.current[i] = 1;
      } else if (!dead) {
        frozen.current[i] = 0;
      }

      const x = sim.posX[i];
      const y = sim.posY[i] - BODY_OFFSET;
      const z = sim.posZ[i];

      if (dead) {
        // Ragdoll: segue a rotação do rigid body + tomba
        const body = sim.bodies[i];
        const t = Math.min(sim.deathT[i] / 0.45, 1);
        if (body && !sim.settled[i]) {
          const rot = body.rotation();
          _quat.set(rot.x, rot.y, rot.z, rot.w);
        } else {
          _quat.setFromAxisAngle(_axisY, sim.deathYaw[i]);
        }
        _quatPitch.setFromAxisAngle(_axisX, t * (Math.PI / 2) * 0.96);
        _quat.multiply(_quatPitch);
        _pos.set(x, Math.max(y, -0.18) + 0.12, z);

        // Escurece o corpo uma única vez
        if (!tinted.current[i]) {
          tinted.current[i] = 1;
          for (const name of partNames) {
            const mesh = meshRefs.current[name]!;
            mesh.getColorAt(i, _color);
            _color.multiplyScalar(0.5);
            mesh.setColorAt(i, _color);
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          }
        }
      } else {
        const hSpeed = Math.sqrt(sim.velX[i] ** 2 + sim.velZ[i] ** 2);
        const lean = Math.min(hSpeed / 9, 0.3);
        _quat.setFromAxisAngle(_axisY, sim.facing[i]);
        if (lean > 0.02) {
          _quatPitch.setFromAxisAngle(_axisX, lean);
          _quat.multiply(_quatPitch);
        }
        const bob = Math.abs(Math.sin(sim.gaitPhase[i])) * Math.min(hSpeed / 6, 1) * 0.06;
        _pos.set(x, y + bob, z);

        // Tinta de debug por estado da IA
        if (debugMode && !tinted.current[i]) {
          const st = sim.state[i];
          const torso = meshRefs.current.torso!;
          _color.setHex(
            st === EntityState.Attacking
              ? 0xff4444
              : st === EntityState.Recovering
                ? 0xffcc33
                : st === EntityState.Running
                  ? 0x44a2ff
                  : 0x999999,
          );
          torso.setColorAt(i, _color);
          if (torso.instanceColor) torso.instanceColor.needsUpdate = true;
        }
      }

      _root.compose(_pos, _quat, _unit);

      const gait = sim.gaitPhase[i];
      const hSpeed = dead
        ? 0
        : Math.sqrt(sim.velX[i] ** 2 + sim.velZ[i] ** 2);
      const amp = dead ? 0 : Math.min(hSpeed / 5, 1) * 0.85 + 0.06;
      const idleSway = dead ? 0 : Math.sin(clock * 1.7 + i) * 0.05;
      const punch = sim.punchAnim[i];

      for (let p = 0; p < partNames.length; p++) {
        const name = partNames[p];
        const part = parts[name];
        const mesh = meshes[p]!;

        let swingAngle = 0;
        if (part.swing === "armL") swingAngle = Math.sin(gait) * amp + idleSway;
        else if (part.swing === "armR")
          swingAngle = -Math.sin(gait) * amp - punch * 1.9 - idleSway;
        else if (part.swing === "legL") swingAngle = -Math.sin(gait) * amp;
        else if (part.swing === "legR") swingAngle = Math.sin(gait) * amp;

        if (swingAngle !== 0) {
          _swing.setFromAxisAngle(_axisX, swingAngle);
          _local.compose(part.pivot, _swing, _unit);
        } else {
          _local.compose(part.pivot, IDENTITY_QUAT, _unit);
        }
        _out.multiplyMatrices(_root, _local);
        mesh.setMatrixAt(i, _out);

        // Arma acompanha o braço direito
        if (weapon && hasWeapon && name === "armR") {
          _swing.setFromAxisAngle(_axisX, swingAngle - 0.5);
          _local.compose(part.pivot, _swing, _unit);
          _out.multiplyMatrices(_root, _local);
          weapon.setMatrixAt(i, _out);
        }
      }
    }

    // Zera instâncias além do count atual
    for (const m of meshes) {
      for (let i = count; i < Math.min(count + 4, MAX_MEN); i++)
        m!.setMatrixAt(i, ZERO_MAT);
      m!.instanceMatrix.needsUpdate = true;
    }
    if (weapon && hasWeapon) weapon.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {partNames.map((name) => (
        <instancedMesh
          key={name}
          ref={(m) => {
            meshRefs.current[name] = m;
          }}
          args={[parts[name].geometry, undefined, MAX_MEN]}
          castShadow
          receiveShadow
          frustumCulled={false}
        >
          <meshStandardMaterial roughness={0.85} metalness={0.02} />
        </instancedMesh>
      ))}
      {hasWeapon && (
        <instancedMesh
          key={`weapon-${menModifierId}`}
          ref={weaponRef}
          args={[weaponGeometry, undefined, MAX_MEN]}
          castShadow
          frustumCulled={false}
        >
          <meshStandardMaterial
            color={menModifierId === "medieval" ? "#b8bec9" : "#7a5a38"}
            roughness={menModifierId === "medieval" ? 0.35 : 0.9}
            metalness={menModifierId === "medieval" ? 0.7 : 0}
          />
        </instancedMesh>
      )}
    </group>
  );
}

const IDENTITY_QUAT = new THREE.Quaternion();
