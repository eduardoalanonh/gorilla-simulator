"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getArenaPreset } from "@/systems/rocks";
import { useSimulationStore } from "@/store/simulationStore";

const SUN_DIR = new THREE.Vector3(-0.62, 0.16, -0.42).normalize();

/** Céu por cenário: gradiente, brilho do sol/lua e estrelas procedurais. */
export function SkyDome() {
  const arenaId = useSimulationStore((s) => s.arenaId);
  const preset = getArenaPreset(arenaId);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new THREE.Color("#0d1026") },
          midColor: { value: new THREE.Color("#3b2544") },
          horizonColor: { value: new THREE.Color("#c96a3a") },
          sunDir: { value: SUN_DIR.clone() },
          starBoost: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 horizonColor;
          uniform vec3 sunDir;
          uniform float starBoost;
          varying vec3 vDir;

          float hash(vec3 p) {
            return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          }

          void main() {
            vec3 dir = normalize(vDir);
            float h = clamp(dir.y, 0.0, 1.0);

            vec3 sky = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
            sky = mix(sky, topColor, smoothstep(0.18, 0.65, h));

            // Glow quente ao redor do sol poente (ou frio, na lua)
            float sunAmount = max(dot(dir, sunDir), 0.0);
            sky += horizonColor * pow(sunAmount, 18.0) * 0.9;
            sky += horizonColor * pow(sunAmount, 4.0) * 0.22;

            // Estrelas no alto
            vec3 grid = floor(dir * 220.0);
            float star = step(1.0 - 0.0015 * starBoost, hash(grid));
            float twinkle = 0.6 + 0.4 * hash(grid + 1.0);
            sky += vec3(star) * twinkle * smoothstep(0.25, 0.6, h) * 0.8;

            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  );

  useEffect(() => {
    material.uniforms.topColor.value.set(preset.sky.top);
    material.uniforms.midColor.value.set(preset.sky.mid);
    material.uniforms.horizonColor.value.set(preset.sky.horizon);
    material.uniforms.starBoost.value = preset.sky.moon ? 3 : 1;
  }, [material, preset]);

  // Posição da lua: na direção do "sol" (fonte de luz), alto no céu
  const moonPos = useMemo(() => {
    const d = SUN_DIR.clone();
    d.y = 0.42;
    d.normalize().multiplyScalar(400);
    return d;
  }, []);

  return (
    <group>
      <mesh material={material} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[450, 32, 20]} />
      </mesh>
      {preset.sky.moon && (
        <mesh position={moonPos} frustumCulled={false} renderOrder={-9}>
          <sphereGeometry args={[26, 24, 18]} />
          <meshBasicMaterial color="#e8ecff" toneMapped={false} fog={false} />
        </mesh>
      )}
    </group>
  );
}
