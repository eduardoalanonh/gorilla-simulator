import { ARENA, HORDE, SPAWN } from "@/constants/config";

export interface SpawnPoint {
  x: number;
  z: number;
}

/**
 * Distribui `count` homens em anéis concêntricos ao redor do centro.
 * Quanto mais homens, maior o raio inicial e mais anéis.
 */
/** Ponto de reforço na borda da arena (modo horda). */
export function hordeSpawnPoint(): SpawnPoint {
  const a = Math.random() * Math.PI * 2;
  const r = ARENA.radius - HORDE.edgeMargin + (Math.random() - 0.5) * 4;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

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
      points.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }

    remaining -= inRing;
    radius += SPAWN.ringSpacing;
    if (radius > ARENA.radius - 4) radius = ARENA.radius - 4;
  }

  return points;
}
