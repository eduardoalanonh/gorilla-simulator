import { ARENA, HORDE, PHYSICS, SPAWN } from "@/constants/config";
import { BIG_ROCKS, rockColliderRadius } from "./rocks";

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
function pushOutsideRocks(p: SpawnPoint): SpawnPoint {
  let { x, z } = p;
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const rock of BIG_ROCKS) {
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
  return clampToArena({ x, z });
}

function clampToArena(p: SpawnPoint): SpawnPoint {
  const maxR = ARENA.radius - 4;
  const dist = Math.sqrt(p.x * p.x + p.z * p.z);
  if (dist <= maxR) return p;
  const s = maxR / dist;
  return { x: p.x * s, z: p.z * s };
}

/** Ponto de reforço na borda da arena (modo horda). */
export function hordeSpawnPoint(): SpawnPoint {
  const a = Math.random() * Math.PI * 2;
  const r = ARENA.radius - HORDE.edgeMargin + (Math.random() - 0.5) * 4;
  return pushOutsideRocks({ x: Math.cos(a) * r, z: Math.sin(a) * r });
}

/**
 * Distribui `count` homens em anéis concêntricos ao redor do centro.
 * Quanto mais homens, maior o raio inicial e mais anéis.
 */
export function computeSpawnRing(count: number): SpawnPoint[] {
  const points: SpawnPoint[] = [];
  let radius = SPAWN.baseRadius + Math.sqrt(count) * SPAWN.radiusPerSqrtMan;
  let remaining = count;

  while (remaining > 0) {
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
      points.push(pushOutsideRocks({ x: Math.cos(a) * r, z: Math.sin(a) * r }));
    }

    remaining -= inRing;
    radius += SPAWN.ringSpacing;
    if (radius > ARENA.radius - 4) radius = ARENA.radius - 4;
  }

  return points;
}
