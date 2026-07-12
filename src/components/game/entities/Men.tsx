"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  COLORS,
  MAX_MEN,
  MEN_MODIFIERS,
  PHYSICS,
  type FighterRig,
} from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { sim } from "@/systems/simulation";
import { EntityState } from "@/types/simulation";
import { mulberry32 } from "@/utils/random";

const BODY_OFFSET = PHYSICS.manRadius; // centro físico → pés no chão

type SwingKind =
  | "none"
  | "armL"
  | "armR"
  | "legL"
  | "legR"
  | "legFL"
  | "legFR"
  | "legBL"
  | "legBR"
  | "tail";

type ColorRole = "shirt" | "pants" | "skin" | "fur" | "snout" | "steel" | "steelDark" | "glow";

interface PartDef {
  geometry: THREE.BufferGeometry;
  pivot: THREE.Vector3;
  swing: SwingKind;
  role: ColorRole;
  /** Material brilhante (visor de robô) */
  emissive?: boolean;
}

const box = (
  w: number,
  h: number,
  d: number,
  ty = 0,
): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ty !== 0) g.translate(0, ty, 0);
  return g;
};

function buildParts(rig: FighterRig): Record<string, PartDef> {
  if (rig === "dog") {
    const leg = box(0.09, 0.4, 0.09, -0.18);
    const tail = new THREE.BoxGeometry(0.07, 0.07, 0.34);
    tail.translate(0, 0.05, -0.17);
    return {
      body: { geometry: box(0.3, 0.32, 0.66), pivot: new THREE.Vector3(0, 0.46, -0.02), swing: "none", role: "fur" },
      head: { geometry: box(0.24, 0.24, 0.26), pivot: new THREE.Vector3(0, 0.64, 0.36), swing: "none", role: "fur" },
      snout: { geometry: box(0.12, 0.11, 0.16), pivot: new THREE.Vector3(0, 0.58, 0.52), swing: "none", role: "snout" },
      legFL: { geometry: leg, pivot: new THREE.Vector3(-0.13, 0.4, 0.24), swing: "legFL", role: "fur" },
      legFR: { geometry: leg.clone(), pivot: new THREE.Vector3(0.13, 0.4, 0.24), swing: "legFR", role: "fur" },
      legBL: { geometry: leg.clone(), pivot: new THREE.Vector3(-0.13, 0.4, -0.24), swing: "legBL", role: "fur" },
      legBR: { geometry: leg.clone(), pivot: new THREE.Vector3(0.13, 0.4, -0.24), swing: "legBR", role: "fur" },
      tail: { geometry: tail, pivot: new THREE.Vector3(0, 0.56, -0.34), swing: "tail", role: "fur" },
    };
  }

  if (rig === "robot") {
    const arm = box(0.15, 0.54, 0.15, -0.24);
    const leg = box(0.17, 0.56, 0.17, -0.26);
    return {
      torso: { geometry: box(0.48, 0.56, 0.32), pivot: new THREE.Vector3(0, 1.06, 0), swing: "none", role: "steel" },
      head: { geometry: box(0.28, 0.24, 0.28), pivot: new THREE.Vector3(0, 1.5, 0), swing: "none", role: "steelDark" },
      visor: {
        geometry: box(0.22, 0.06, 0.06),
        pivot: new THREE.Vector3(0, 1.52, 0.14),
        swing: "none",
        role: "glow",
        emissive: true,
      },
      armL: { geometry: arm, pivot: new THREE.Vector3(-0.34, 1.28, 0), swing: "armL", role: "steelDark" },
      armR: { geometry: arm.clone(), pivot: new THREE.Vector3(0.34, 1.28, 0), swing: "armR", role: "steelDark" },
      legL: { geometry: leg, pivot: new THREE.Vector3(-0.13, 0.56, 0), swing: "legL", role: "steelDark" },
      legR: { geometry: leg.clone(), pivot: new THREE.Vector3(0.13, 0.56, 0), swing: "legR", role: "steelDark" },
    };
  }

  const arm = box(0.11, 0.5, 0.11, -0.22);
  const leg = box(0.14, 0.56, 0.14, -0.26);
  return {
    torso: { geometry: box(0.4, 0.52, 0.24), pivot: new THREE.Vector3(0, 1.02, 0), swing: "none", role: "shirt" },
    head: { geometry: box(0.21, 0.23, 0.21), pivot: new THREE.Vector3(0, 1.42, 0), swing: "none", role: "skin" },
    armL: { geometry: arm, pivot: new THREE.Vector3(-0.27, 1.24, 0), swing: "armL", role: "skin" },
    armR: { geometry: arm.clone(), pivot: new THREE.Vector3(0.27, 1.24, 0), swing: "armR", role: "skin" },
    legL: { geometry: leg, pivot: new THREE.Vector3(-0.11, 0.56, 0), swing: "legL", role: "pants" },
    legR: { geometry: leg.clone(), pivot: new THREE.Vector3(0.11, 0.56, 0), swing: "legR", role: "pants" },
  };
}

const DOG_FURS = [0x8a6a45, 0x5d4a33, 0x3a3230, 0xa88f6a, 0x6e6259, 0x4a3b2a];
const ROBOT_STEELS = [0x9aa2ad, 0x7d858f, 0x6a7178, 0x848b8f, 0xb0b6bd];
const ROBOT_GLOWS = [0x66e0ff, 0xff5f5f, 0x8aff80, 0xffd166];

/** Paletas temáticas por combatente (humanos): [peles, camisas, calças] */
const HUMAN_PALETTES: Record<
  string,
  { skins: number[]; shirts: number[]; pants: number[] }
> = {
  ninjas: {
    skins: [0x3a3438, 0x453d40, 0x2e2a2e],
    shirts: [0x1c1a20, 0x24202a, 0x191722, 0x2a1c1c],
    pants: [0x16141c, 0x1e1a22],
  },
  zumbis: {
    skins: [0x7da05a, 0x5e8a4a, 0x8fae6b, 0x6a9455],
    shirts: [0x4a4438, 0x3e3a30, 0x55503f, 0x39362c],
    pants: [0x33302a, 0x2b2924],
  },
  herois: {
    skins: [0xd9a066, 0xc68642, 0x8d5524, 0xe8b88a],
    shirts: [0xd42a2a, 0x2255cc, 0x1fa04a, 0x8a2acc, 0xe8801a, 0x11a0a8],
    pants: [0x20336b, 0x5a1c1c, 0x1c4a2a, 0x3a1c5a],
  },
  arqueiros: {
    skins: [0xd9a066, 0xc68642, 0x8d5524, 0xa46a3f],
    shirts: [0x3f5e3a, 0x50663a, 0x5a5030, 0x44583f],
    pants: [0x4a3b28, 0x3c3222, 0x51422e],
  },
  magos: {
    skins: [0xd9a066, 0xc68642, 0xe8b88a, 0x8d5524],
    shirts: [0x4a2a7a, 0x2a3a8a, 0x5a1f6e, 0x28206e],
    pants: [0x3a2160, 0x232a66],
  },
};

const CAPE_COLORS = [0xe8c520, 0xd42a2a, 0x2255cc, 0x1fa04a, 0xe8e8e8, 0x8a2acc];

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
const IDENTITY_QUAT = new THREE.Quaternion();

/**
 * Todos os combatentes renderizados com InstancedMesh — um conjunto de
 * partes por rig (humano, cão, robô), animação composta por matriz.
 */
export function Men() {
  const runId = useSimulationStore((s) => s.runId);
  const menCount = useSimulationStore((s) => s.menCount);
  const menModifierId = useSimulationStore((s) => s.menModifierId);
  const debugMode = useSimulationStore((s) => s.debugMode);

  const rig: FighterRig =
    MEN_MODIFIERS.find((m) => m.id === menModifierId)?.rig ?? "human";

  const parts = useMemo(() => buildParts(rig), [rig]);
  const partNames = useMemo(() => Object.keys(parts), [parts]);
  const meshRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const weaponRef = useRef<THREE.InstancedMesh | null>(null);
  const shieldRef = useRef<THREE.InstancedMesh | null>(null);
  const tinted = useRef(new Uint8Array(MAX_MEN));
  const frozen = useRef(new Uint8Array(MAX_MEN));
  // Cores base por instância (restauradas quando um cadáver é reciclado)
  const baseColors = useRef<Record<string, Float32Array>>({});

  const hatRef = useRef<THREE.InstancedMesh | null>(null);
  const capeRef = useRef<THREE.InstancedMesh | null>(null);

  // Acessórios por combatente: mão direita (arma), mão esquerda, cabeça, costas
  const hasWeapon =
    rig === "human" &&
    (menModifierId === "bastoes" ||
      menModifierId === "medieval" ||
      menModifierId === "magos");
  const hasShield =
    rig === "human" &&
    (menModifierId === "medieval" || menModifierId === "arqueiros");
  const hasHat = menModifierId === "magos";
  const hasCape = menModifierId === "herois";

  const weaponGeometry = useMemo(() => {
    if (menModifierId === "medieval") {
      const g = new THREE.BoxGeometry(0.05, 0.85, 0.14);
      g.translate(0, -0.45, 0.1);
      return g;
    }
    if (menModifierId === "magos") {
      // Cajado longo com ponta
      const g = new THREE.CylinderGeometry(0.03, 0.04, 1.5, 6);
      g.translate(0, -0.35, 0.12);
      return g;
    }
    const g = new THREE.CylinderGeometry(0.035, 0.045, 1.05, 6);
    g.translate(0, -0.5, 0.1);
    return g;
  }, [menModifierId]);

  const shieldGeometry = useMemo(() => {
    if (menModifierId === "arqueiros") {
      // Arco: arco de torus vertical na mão esquerda
      const g = new THREE.TorusGeometry(0.42, 0.025, 6, 14, Math.PI);
      g.rotateZ(-Math.PI / 2);
      g.translate(0, -0.42, 0.14);
      return g;
    }
    const g = new THREE.CylinderGeometry(0.32, 0.32, 0.05, 14);
    g.rotateX(Math.PI / 2);
    g.translate(0, -0.3, 0.16);
    return g;
  }, [menModifierId]);

  const hatGeometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.2, 0.42, 8);
    g.translate(0, 0.21, 0);
    return g;
  }, []);

  const capeGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.52, 0.75);
    g.translate(0, -0.36, 0);
    return g;
  }, []);

  // Paleta por instância — refeita a cada respawn / troca de rig
  useEffect(() => {
    const rng = mulberry32(runId * 7919 + 13);
    const palette: Record<ColorRole, THREE.Color[]> = {
      shirt: [],
      pants: [],
      skin: [],
      fur: [],
      snout: [],
      steel: [],
      steelDark: [],
      glow: [],
    };
    const humanPalette = HUMAN_PALETTES[menModifierId];
    const skinPool = humanPalette?.skins ?? COLORS.skinTones;
    const shirtPool = humanPalette?.shirts ?? COLORS.shirts;
    const pantsPool = humanPalette?.pants ?? COLORS.pants;

    for (let i = 0; i < MAX_MEN; i++) {
      const skin = new THREE.Color(
        skinPool[Math.floor(rng() * skinPool.length)],
      );
      const shirt = new THREE.Color(
        shirtPool[Math.floor(rng() * shirtPool.length)],
      );
      const pants = new THREE.Color(
        pantsPool[Math.floor(rng() * pantsPool.length)],
      );
      const fur = new THREE.Color(DOG_FURS[Math.floor(rng() * DOG_FURS.length)]);
      const steel = new THREE.Color(
        ROBOT_STEELS[Math.floor(rng() * ROBOT_STEELS.length)],
      );
      const glow = new THREE.Color(
        ROBOT_GLOWS[Math.floor(rng() * ROBOT_GLOWS.length)],
      );
      palette.skin.push(skin);
      palette.shirt.push(shirt);
      palette.pants.push(pants);
      palette.fur.push(fur);
      palette.snout.push(fur.clone().multiplyScalar(0.55));
      palette.steel.push(steel);
      palette.steelDark.push(steel.clone().multiplyScalar(0.72));
      palette.glow.push(glow);
    }

    baseColors.current = {};
    for (const name of partNames) {
      const mesh = meshRefs.current[name];
      if (!mesh) continue;
      const store = new Float32Array(MAX_MEN * 3);
      const colors = palette[parts[name].role];
      for (let i = 0; i < MAX_MEN; i++) {
        const c = colors[i];
        mesh.setColorAt(i, c);
        store[i * 3] = c.r;
        store[i * 3 + 1] = c.g;
        store[i * 3 + 2] = c.b;
      }
      baseColors.current[name] = store;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Capas dos heróis: cores vivas por instância
    const cape = capeRef.current;
    if (cape) {
      const rng2 = mulberry32(runId * 511 + 77);
      for (let i = 0; i < MAX_MEN; i++) {
        _color.setHex(CAPE_COLORS[Math.floor(rng2() * CAPE_COLORS.length)]);
        cape.setColorAt(i, _color);
      }
      if (cape.instanceColor) cape.instanceColor.needsUpdate = true;
    }

    tinted.current.fill(0);
    frozen.current.fill(0);
  }, [runId, menCount, partNames, parts, menModifierId]);

  useFrame((state) => {
    const clock = state.clock.elapsedTime;
    const count = sim.count;
    const meshes = partNames.map((n) => meshRefs.current[n]);
    if (meshes.some((m) => !m)) return;
    const weapon = weaponRef.current;
    const shield = shieldRef.current;
    const hat = hatRef.current;
    const cape = capeRef.current;

    for (const m of meshes) m!.count = count;
    if (weapon) weapon.count = hasWeapon ? count : 0;
    if (shield) shield.count = hasShield ? count : 0;
    if (hat) hat.count = hasHat ? count : 0;
    if (cape) cape.count = hasCape ? count : 0;

    for (let i = 0; i < count; i++) {
      const dead = sim.state[i] === EntityState.Dead;

      // Cadáver assentado: matriz congelada, nada a fazer
      if (dead && sim.settled[i]) {
        if (frozen.current[i]) continue;
        frozen.current[i] = 1;
      } else if (!dead) {
        frozen.current[i] = 0;
        // Reciclado no modo horda: restaura as cores originais
        if (tinted.current[i]) {
          tinted.current[i] = 0;
          for (const name of partNames) {
            const mesh = meshRefs.current[name]!;
            const store = baseColors.current[name];
            if (!store) continue;
            _color.setRGB(store[i * 3], store[i * 3 + 1], store[i * 3 + 2]);
            mesh.setColorAt(i, _color);
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          }
        }
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
        const bob =
          Math.abs(Math.sin(sim.gaitPhase[i])) * Math.min(hSpeed / 6, 1) * 0.06;
        _pos.set(x, y + bob, z);

        // Tinta de debug por estado da IA
        if (debugMode && !tinted.current[i]) {
          const st = sim.state[i];
          const first = meshes[0]!;
          _color.setHex(
            st === EntityState.Attacking
              ? 0xff4444
              : st === EntityState.Recovering
                ? 0xffcc33
                : st === EntityState.Running
                  ? 0x44a2ff
                  : 0x999999,
          );
          first.setColorAt(i, _color);
          if (first.instanceColor) first.instanceColor.needsUpdate = true;
        }
      }

      _root.compose(_pos, _quat, _unit);

      const gait = sim.gaitPhase[i];
      const hSpeed = dead ? 0 : Math.sqrt(sim.velX[i] ** 2 + sim.velZ[i] ** 2);
      const amp = dead ? 0 : Math.min(hSpeed / 5, 1) * 0.85 + 0.06;
      const idleSway = dead ? 0 : Math.sin(clock * 1.7 + i) * 0.05;
      const punch = sim.punchAnim[i];

      for (let p = 0; p < partNames.length; p++) {
        const name = partNames[p];
        const part = parts[name];
        const mesh = meshes[p]!;

        let swingAngle = 0;
        let axis = _axisX;
        switch (part.swing) {
          case "armL":
            swingAngle = Math.sin(gait) * amp + idleSway;
            break;
          case "armR":
            swingAngle = -Math.sin(gait) * amp - punch * 1.9 - idleSway;
            break;
          case "legL":
            swingAngle = -Math.sin(gait) * amp;
            break;
          case "legR":
            swingAngle = Math.sin(gait) * amp;
            break;
          // Trote: pares diagonais em sincronia
          case "legFL":
          case "legBR":
            swingAngle = Math.sin(gait) * amp * 0.9;
            break;
          case "legFR":
          case "legBL":
            swingAngle = -Math.sin(gait) * amp * 0.9;
            break;
          case "tail":
            axis = _axisY;
            swingAngle = dead ? 0 : Math.sin(clock * 10 + i) * 0.4;
            break;
        }

        if (swingAngle !== 0) {
          _swing.setFromAxisAngle(axis, swingAngle);
          _local.compose(part.pivot, _swing, _unit);
        } else {
          _local.compose(part.pivot, IDENTITY_QUAT, _unit);
        }
        _out.multiplyMatrices(_root, _local);
        mesh.setMatrixAt(i, _out);

        // Arma acompanha o braço direito; escudo, o esquerdo
        if (weapon && hasWeapon && part.swing === "armR") {
          _swing.setFromAxisAngle(_axisX, swingAngle - 0.5);
          _local.compose(part.pivot, _swing, _unit);
          _out.multiplyMatrices(_root, _local);
          weapon.setMatrixAt(i, _out);
        }
        if (shield && hasShield && part.swing === "armL") {
          _swing.setFromAxisAngle(_axisX, swingAngle);
          _local.compose(part.pivot, _swing, _unit);
          _out.multiplyMatrices(_root, _local);
          shield.setMatrixAt(i, _out);
        }
      }

      // Chapéu de mago (segue a cabeça) e capa de herói (ondula ao correr)
      if (hat && hasHat) {
        _pos.set(0, 1.56, 0);
        _local.compose(_pos, IDENTITY_QUAT, _unit);
        _out.multiplyMatrices(_root, _local);
        hat.setMatrixAt(i, _out);
      }
      if (cape && hasCape) {
        const wave = 0.28 + Math.min(hSpeed * 0.07, 0.85) + Math.sin(gait) * 0.07;
        _swing.setFromAxisAngle(_axisX, wave);
        _pos.set(0, 1.3, -0.15);
        _local.compose(_pos, _swing, _unit);
        _out.multiplyMatrices(_root, _local);
        cape.setMatrixAt(i, _out);
      }
    }

    // Zera instâncias além do count atual
    for (const m of meshes) {
      for (let i = count; i < Math.min(count + 4, MAX_MEN); i++)
        m!.setMatrixAt(i, ZERO_MAT);
      m!.instanceMatrix.needsUpdate = true;
    }
    if (weapon && hasWeapon) weapon.instanceMatrix.needsUpdate = true;
    if (shield && hasShield) shield.instanceMatrix.needsUpdate = true;
    if (hat && hasHat) hat.instanceMatrix.needsUpdate = true;
    if (cape && hasCape) cape.instanceMatrix.needsUpdate = true;
  });

  return (
    <group key={rig}>
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
          {parts[name].emissive ? (
            <meshBasicMaterial toneMapped={false} />
          ) : (
            <meshStandardMaterial
              roughness={rig === "robot" ? 0.4 : 0.85}
              metalness={rig === "robot" ? 0.75 : 0.02}
            />
          )}
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
      {hasShield && (
        <instancedMesh
          key={`shield-${menModifierId}`}
          ref={shieldRef}
          args={[shieldGeometry, undefined, MAX_MEN]}
          castShadow
          frustumCulled={false}
        >
          <meshStandardMaterial
            color={menModifierId === "arqueiros" ? "#6e502e" : "#5b4a2f"}
            roughness={0.75}
            metalness={menModifierId === "arqueiros" ? 0 : 0.25}
          />
        </instancedMesh>
      )}
      {hasHat && (
        <instancedMesh
          key="hat"
          ref={hatRef}
          args={[hatGeometry, undefined, MAX_MEN]}
          castShadow
          frustumCulled={false}
        >
          <meshStandardMaterial color="#3a2178" roughness={0.85} />
        </instancedMesh>
      )}
      {hasCape && (
        <instancedMesh
          key="cape"
          ref={capeRef}
          args={[capeGeometry, undefined, MAX_MEN]}
          frustumCulled={false}
        >
          <meshStandardMaterial roughness={0.8} side={THREE.DoubleSide} />
        </instancedMesh>
      )}
    </group>
  );
}
