import type { ParticlePool } from "./particles";

/** Canal imperativo compartilhado entre o loop e os renderers de efeito. */
export const fx = {
  pool: null as ParticlePool | null,
  /** Intensidade de tremida de câmera (decai no CameraRig). */
  shake: 0,
};
