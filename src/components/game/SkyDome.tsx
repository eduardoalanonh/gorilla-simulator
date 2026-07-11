"use client";

import { useMemo } from "react";
import * as THREE from "three";

/** Céu de crepúsculo com gradiente, brilho do sol baixo e estrelas procedurais. */
export function SkyDome() {
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
          sunDir: { value: new THREE.Vector3(-0.62, 0.16, -0.42).normalize() },
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
          varying vec3 vDir;

          float hash(vec3 p) {
            return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          }

          void main() {
            vec3 dir = normalize(vDir);
            float h = clamp(dir.y, 0.0, 1.0);

            vec3 sky = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
            sky = mix(sky, topColor, smoothstep(0.18, 0.65, h));

            // Glow quente ao redor do sol poente
            float sunAmount = max(dot(dir, sunDir), 0.0);
            sky += vec3(1.0, 0.55, 0.25) * pow(sunAmount, 18.0) * 0.9;
            sky += vec3(1.0, 0.75, 0.4) * pow(sunAmount, 4.0) * 0.22;

            // Estrelas no alto
            vec3 grid = floor(dir * 220.0);
            float star = step(0.9985, hash(grid));
            float twinkle = 0.6 + 0.4 * hash(grid + 1.0);
            sky += vec3(star) * twinkle * smoothstep(0.25, 0.6, h) * 0.8;

            gl_FragColor = vec4(sky, 1.0);
          }
        `,
      }),
    [],
  );

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[450, 32, 20]} />
    </mesh>
  );
}
