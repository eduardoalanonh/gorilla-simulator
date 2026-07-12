"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, BallCollider, RigidBody } from "@react-three/rapier";
import { makeDirtTexture } from "@/utils/textures";
import { mulberry32 } from "@/utils/random";
import { getArenaPreset, getBigRocks } from "@/systems/rocks";
import { useSimulationStore } from "@/store/simulationStore";

function deformedRock(seed: number, detail = 1) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const rng = mulberry32(seed);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 0.75 + rng() * 0.5;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * (0.6 + rng() * 0.5), pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Arena circular: terra batida, pedras, muralha rochosa, vegetação e tochas. */
export function Arena() {
  const arenaId = useSimulationStore((s) => s.arenaId);
  const preset = getArenaPreset(arenaId);
  const dirtTexture = useMemo(() => makeDirtTexture(1024, 42), []);
  const R = preset.radius;

  const bigRocks = getBigRocks(preset);

  const rockGeos = useMemo(
    () => bigRocks.map((_, i) => deformedRock(100 + i, 1)),
    [bigRocks],
  );

  // Muralha: blocos de rocha formando o perímetro (0 = campo aberto)
  const wallBlocks = useMemo(() => {
    const rng = mulberry32(777);
    const blocks: { x: number; z: number; ry: number; s: [number, number, number] }[] = [];
    const n = preset.wallSegments;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      blocks.push({
        x: Math.cos(a) * (R + 2.5),
        z: Math.sin(a) * (R + 2.5),
        ry: a + (rng() - 0.5) * 0.4,
        s: [
          4.5 + rng() * 3 + (R > 60 ? 2 : 0),
          preset.wallHeight + rng() * 3.5,
          3 + rng() * 2,
        ],
      });
    }
    return blocks;
  }, [R, preset.wallSegments, preset.wallHeight]);

  const wallGeo = useMemo(() => deformedRock(555, 1), []);

  // Tufos de vegetação seca
  const grassMesh = useMemo(() => {
    const rng = mulberry32(2024);
    const geo = new THREE.ConeGeometry(0.16, 0.55, 5, 1, true);
    geo.translate(0, 0.24, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: "#6d6a3a",
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, preset.grassTufts);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const c = new THREE.Color();
    for (let i = 0; i < preset.grassTufts; i++) {
      const a = rng() * Math.PI * 2;
      const dist = 10 + Math.sqrt(rng()) * (R - 13);
      eul.set((rng() - 0.5) * 0.35, rng() * Math.PI, (rng() - 0.5) * 0.35);
      q.setFromEuler(eul);
      m.compose(
        new THREE.Vector3(Math.cos(a) * dist, 0, Math.sin(a) * dist),
        q,
        new THREE.Vector3(
          0.7 + rng() * 1.1,
          0.6 + rng() * 1.3,
          0.7 + rng() * 1.1,
        ),
      );
      mesh.setMatrixAt(i, m);
      c.setHSL(0.13 + rng() * 0.06, 0.32, 0.24 + rng() * 0.14);
      mesh.setColorAt(i, c);
    }
    mesh.receiveShadow = true;
    return mesh;
  }, [R, preset.grassTufts]);

  // Pedrinhas espalhadas (sem colisor)
  const pebbleMesh = useMemo(() => {
    const rng = mulberry32(31415);
    const geo = deformedRock(9, 0);
    const mat = new THREE.MeshStandardMaterial({ color: "#5d554b", roughness: 0.95 });
    const mesh = new THREE.InstancedMesh(geo, mat, preset.smallRocks);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < preset.smallRocks; i++) {
      const a = rng() * Math.PI * 2;
      const dist = 8 + Math.sqrt(rng()) * (R - 11);
      const s = 0.15 + rng() * 0.4;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
      m.compose(
        new THREE.Vector3(Math.cos(a) * dist, s * 0.3, Math.sin(a) * dist),
        q,
        new THREE.Vector3(s, s * 0.7, s),
      );
      mesh.setMatrixAt(i, m);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, [R, preset.smallRocks]);

  const torches = useMemo(() => {
    const list: { x: number; z: number; withLight: boolean }[] = [];
    for (let i = 0; i < preset.torches; i++) {
      const a = (i / preset.torches) * Math.PI * 2 + 0.31;
      list.push({
        x: Math.cos(a) * (R - 2.2),
        z: Math.sin(a) * (R - 2.2),
        withLight: i % 3 === 0,
      });
    }
    return list;
  }, [R, preset.torches]);

  return (
    <group key={preset.id}>
      {/* Chão + colisor */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[R + 30, 1, R + 30]} position={[0, -1, 0]} />
        {/* Colisores da muralha */}
        {wallBlocks.map((b, i) => (
          <CuboidCollider
            key={i}
            args={[b.s[0] / 2 + 0.5, b.s[1], b.s[2] / 2 + 0.5]}
            position={[b.x, b.s[1] / 2, b.z]}
            rotation={[0, -b.ry, 0]}
          />
        ))}
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[R + 1.5, 72]} />
        <meshStandardMaterial
          map={dirtTexture}
          color={preset.groundTint}
          roughness={0.96}
          metalness={0}
        />
      </mesh>

      {/* Terreno externo escuro (horizonte) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[420, 48]} />
        <meshStandardMaterial color="#241c14" roughness={1} />
      </mesh>

      {/* Muralha de rocha */}
      {wallBlocks.map((b, i) => (
        <mesh
          key={i}
          geometry={wallGeo}
          position={[b.x, b.s[1] * 0.32, b.z]}
          rotation={[0, b.ry, 0]}
          scale={[b.s[0], b.s[1], b.s[2]]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#4a423c" roughness={0.95} />
        </mesh>
      ))}

      {/* Pedras grandes com física */}
      {bigRocks.map((rock, i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <BallCollider
            args={[rock.r * 0.85]}
            position={[rock.x, rock.r * 0.4, rock.z]}
          />
          <mesh
            geometry={rockGeos[i]}
            position={[rock.x, rock.r * 0.35, rock.z]}
            rotation={[0, rock.ry, 0]}
            scale={[rock.r, rock.r * rock.squash, rock.r]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#57504a" roughness={0.92} />
          </mesh>
        </RigidBody>
      ))}

      <primitive object={grassMesh} />
      <primitive object={pebbleMesh} />

      {torches.map((t, i) => (
        <Torch key={i} x={t.x} z={t.z} withLight={t.withLight} index={i} />
      ))}
    </group>
  );
}

function Torch({
  x,
  z,
  withLight,
  index,
}: {
  x: number;
  z: number;
  withLight: boolean;
  index: number;
}) {
  const flameRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + index * 3.7;
    const flicker = 0.85 + Math.sin(t) * 0.08 + Math.sin(t * 2.3) * 0.07;
    if (flameRef.current) {
      flameRef.current.scale.setScalar(flicker);
      flameRef.current.rotation.y = t * 0.5;
    }
    if (lightRef.current) lightRef.current.intensity = 26 * flicker;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 3, 6]} />
        <meshStandardMaterial color="#3d2c1c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <cylinderGeometry args={[0.14, 0.09, 0.35, 6]} />
        <meshStandardMaterial color="#211710" roughness={0.9} />
      </mesh>
      <mesh ref={flameRef} position={[0, 3.4, 0]}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial
          color="#ffb23d"
          emissive="#ff7a1a"
          emissiveIntensity={7}
          toneMapped={false}
        />
      </mesh>
      {withLight && (
        <pointLight
          ref={lightRef}
          position={[0, 3.5, 0]}
          color="#ff9540"
          intensity={26}
          distance={22}
          decay={1.8}
        />
      )}
    </group>
  );
}
