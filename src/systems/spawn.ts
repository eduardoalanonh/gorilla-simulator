import { HORDE, PHYSICS, SPAWN, type ArenaPreset } from "@/constants/config";
import { getBigRocks, rockColliderRadius } from "./rocks";

export interface SpawnPoint {
  x: number;
  z: number;
}

const ROCK_MARGIN = 0.5;

/**
 * Se o ponto cai dentro (ou perto) do colisor de uma pedra, empurra-o
 * radialmente para fora dela. Sem isso, um homem podia nascer sobreposto
 * a uma pedra e, no passo de física seguinte, ser arremessado com força
 * total — o "pulo" aleatório reportado ao trocar a quantidade de homens.
 */
function pushOutsideRocks(p: SpawnPoint, preset: ArenaPreset): SpawnPoint {
  let { x, z } = p;
  const rocks = getBigRocks(preset);
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const rock of rocks) {
      const minDist = rockColliderRadius(rock) + PHYSICS.manRadius + ROCK_MARGIN;
      const dx = x - rock.x;
      const dz = z - rock.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= minDist) continue;
      if (dist < 1e-4) {
        // ponto exatamente no centro da pedra: empurra em direção arbitrária
        x = rock.x + minDist;
        z = rock.z;
      } else {
        const push = minDist - dist;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return clampToArena({ x, z }, preset);
}

function clampToArena(p: SpawnPoint, preset: ArenaPreset): SpawnPoint {
  const maxR = preset.radius - 4;
  const dist = Math.sqrt(p.x * p.x + p.z * p.z);
  if (dist <= maxR) return p;
  const s = maxR / dist;
  return { x: p.x * s, z: p.z * s };
}

/** Ponto de reforço na borda da arena (modo horda). */
export function hordeSpawnPoint(preset: ArenaPreset): SpawnPoint {
  const a = Math.random() * Math.PI * 2;
  const margin = Math.min(HORDE.edgeMargin, preset.radius * 0.3);
  const r = preset.radius - margin + (Math.random() - 0.5) * 4;
  return pushOutsideRocks({ x: Math.cos(a) * r, z: Math.sin(a) * r }, preset);
}

/**
 * Distribui `count` homens em anéis concêntricos ao redor do centro.
 * Quanto mais homens, maior o raio inicial e mais anéis; em arenas
 * apertadas, o excedente é espalhado aleatoriamente dentro do espaço.
 */
export function computeSpawnRing(count: number, preset: ArenaPreset): SpawnPoint[] {
  const points: SpawnPoint[] = [];
  const maxRadius = preset.radius - 4;
  let radius = Math.min(
    SPAWN.baseRadius + Math.sqrt(count) * SPAWN.radiusPerSqrtMan,
    maxRadius,
  );
  let remaining = count;
  let clamped = false;

  while (remaining > 0) {
    if (clamped) {
      // Arena cheia: espalha o excedente em posições aleatórias
      for (let i = 0; i < remaining; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = SPAWN.baseRadius * 0.6 + Math.random() * (maxRadius - SPAWN.baseRadius * 0.6);
        points.push(pushOutsideRocks({ x: Math.cos(a) * r, z: Math.sin(a) * r }, preset));
      }
      break;
    }

    const circumference = Math.PI * 2 * radius;
    const ringCapacity = Math.max(4, Math.floor(circumference / SPAWN.arcSpacing));
    const inRing = Math.min(remaining, ringCapacity);
    const angleStep = (Math.PI * 2) / inRing;
    const angleBase = Math.random() * Math.PI * 2;

    for (let i = 0; i < inRing; i++) {
      const jitterA = (Math.random() - 0.5) * angleStep * 0.5;
      const jitterR = (Math.random() - 0.5) * SPAWN.ringSpacing * 0.5;
      const a = angleBase + i * angleStep + jitterA;
      const r = radius + jitterR;
      points.push(pushOutsideRocks({ x: Math.cos(a) * r, z: Math.sin(a) * r }, preset));
    }

    remaining -= inRing;
    radius += SPAWN.ringSpacing;
    if (radius > maxRadius) {
      radius = maxRadius;
      clamped = true;
    }
  }

  return points;
}
