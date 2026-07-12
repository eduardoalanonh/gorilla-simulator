import { ARENA } from "@/constants/config";
import { mulberry32 } from "@/utils/random";

export interface RockPlacement {
  x: number;
  z: number;
  /** Raio "visual" (escala do mesh) — o colisor físico é r * 0.85 */
  r: number;
  ry: number;
  squash: number;
}

const ROCK_SEED = 1337;

/**
 * Layout determinístico das pedras grandes — computado uma única vez e
 * compartilhado entre o render (Arena) e o spawn (para não nascer homem
 * dentro de pedra). Mesma seed, mesma ordem de chamadas de rng() do
 * gerador original em Arena.tsx.
 */
export const BIG_ROCKS: RockPlacement[] = (() => {
  const rng = mulberry32(ROCK_SEED);
  const R = ARENA.radius;
  return Array.from({ length: ARENA.bigRocks }, () => {
    const a = rng() * Math.PI * 2;
    const dist = 14 + rng() * (R - 22);
    const r = 0.9 + rng() * 1.5;
    const ry = rng() * Math.PI * 2;
    const squash = 0.7 + rng() * 0.4;
    return { x: Math.cos(a) * dist, z: Math.sin(a) * dist, r, ry, squash };
  });
})();

/** Raio do BallCollider físico da pedra (ver Arena.tsx). */
export const rockColliderRadius = (rock: RockPlacement) => rock.r * 0.85;
