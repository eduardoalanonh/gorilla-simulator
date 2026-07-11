import type { ParticlePool } from "./particles";
import type { DamageNumberPool } from "./damageNumbers";

/** Canal imperativo compartilhado entre o loop e os renderers de efeito. */
export const fx = {
  pool: null as ParticlePool | null,
  numbers: null as DamageNumberPool | null,
  /** Intensidade de tremida de câmera (decai no CameraRig). */
  shake: 0,
};
