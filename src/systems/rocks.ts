import { ARENA_PRESETS, type ArenaPreset } from "@/constants/config";
import { mulberry32 } from "@/utils/random";

export interface RockPlacement {
  x: number;
  z: number;
  /** Raio "visual" (escala do mesh) — o colisor físico é r * 0.85 */
  r: number;
  ry: number;
  squash: number;
}

/**
 * Layout determinístico das pedras grandes por cenário — computado uma vez
 * e compartilhado entre o render (Arena) e o spawn (para não nascer homem
 * dentro de pedra).
 */
const cache = new Map<string, RockPlacement[]>();

export function getBigRocks(preset: ArenaPreset): RockPlacement[] {
  const cached = cache.get(preset.id);
  if (cached) return cached;

  // Seed estável por cenário (coliseu mantém o layout original: 1337)
  let seed = 1337;
  for (let i = 0; i < preset.id.length; i++)
    seed = (seed * 31 + preset.id.charCodeAt(i)) >>> 0;
  if (preset.id === "coliseu") seed = 1337;

  const rng = mulberry32(seed);
  const R = preset.radius;
  const minDist = Math.min(14, R * 0.4);
  const rocks = Array.from({ length: preset.bigRocks }, () => {
    const a = rng() * Math.PI * 2;
    const dist = minDist + rng() * Math.max(R - minDist - 8, 2);
    const r = 0.9 + rng() * 1.5;
    const ry = rng() * Math.PI * 2;
    const squash = 0.7 + rng() * 0.4;
    return { x: Math.cos(a) * dist, z: Math.sin(a) * dist, r, ry, squash };
  });
  cache.set(preset.id, rocks);
  return rocks;
}

export function getArenaPreset(id: string): ArenaPreset {
  return ARENA_PRESETS.find((p) => p.id === id) ?? ARENA_PRESETS[0];
}

/** Raio do BallCollider físico da pedra (ver Arena.tsx). */
export const rockColliderRadius = (rock: RockPlacement) => rock.r * 0.85;
