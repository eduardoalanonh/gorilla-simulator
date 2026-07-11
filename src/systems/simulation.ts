import type { RigidBody } from "@dimforge/rapier3d-compat";
import {
  applyModifier,
  FighterStats,
  GORILLA_BASE,
  GORILLA_MODIFIERS,
  MAN_BASE,
  MAX_MEN,
  MEN_MODIFIERS,
} from "@/constants/config";
import { EntityState, type EffectEvent, type GorillaAction } from "@/types/simulation";
import { SpatialHash } from "./spatial";

export interface GorillaState {
  body: RigidBody | null;
  hp: number;
  maxHp: number;
  state: number;
  action: GorillaAction;
  actionT: number;
  attackCooldown: number;
  roarCooldown: number;
  retargetTimer: number;
  targetIndex: number;
  targetX: number;
  targetZ: number;
  /** Detecção de "preso atrás de obstáculo" */
  lastDist: number;
  stuckTime: number;
  avoidTimer: number;
  avoidSign: number;
  facing: number;
  speedRef: number;
  stepTimer: number;
  hitsDealt: number;
  damageDealt: number;
  deathT: number;
}

/**
 * Estado bruto da simulação em typed arrays (fora do React).
 * Componentes leem/escrevem imperativamente a cada frame.
 */
export class Simulation {
  capacity = MAX_MEN;
  count = 0;
  time = 0;

  // Dados por homem (SoA para performance)
  posX = new Float32Array(MAX_MEN);
  posY = new Float32Array(MAX_MEN);
  posZ = new Float32Array(MAX_MEN);
  velX = new Float32Array(MAX_MEN);
  velY = new Float32Array(MAX_MEN);
  velZ = new Float32Array(MAX_MEN);
  state = new Uint8Array(MAX_MEN);
  hp = new Float32Array(MAX_MEN);
  cooldown = new Float32Array(MAX_MEN);
  decideTimer = new Float32Array(MAX_MEN);
  angleOffset = new Float32Array(MAX_MEN);
  gaitPhase = new Float32Array(MAX_MEN);
  speedVar = new Float32Array(MAX_MEN);
  facing = new Float32Array(MAX_MEN);
  deathT = new Float32Array(MAX_MEN);
  fearTimer = new Float32Array(MAX_MEN);
  punchAnim = new Float32Array(MAX_MEN);
  hitFlash = new Float32Array(MAX_MEN);
  deathYaw = new Float32Array(MAX_MEN);
  lastDist = new Float32Array(MAX_MEN);
  stuckCount = new Uint8Array(MAX_MEN);
  /** 1 = corpo físico congelado (cadáver assentado) */
  settled = new Uint8Array(MAX_MEN);
  airborne = new Uint8Array(MAX_MEN);

  bodies: (RigidBody | null)[] = new Array(MAX_MEN).fill(null);

  grid = new SpatialHash(2);

  manStats: FighterStats = { ...MAN_BASE };
  gorillaStats: FighterStats & { roarCooldown: number } = { ...GORILLA_BASE };

  gorilla: GorillaState = this.freshGorilla();

  aliveCount = 0;
  deadCount = 0;
  menHits = 0;
  menDamage = 0;
  running = false;

  effects: EffectEvent[] = [];
  recentDeaths: { x: number; z: number; t: number }[] = [];

  /** Orçamento de poeira por frame (compartilhado entre os homens). */
  dustBudget = 0;

  private freshGorilla(): GorillaState {
    return {
      body: null,
      hp: GORILLA_BASE.maxHealth,
      maxHp: GORILLA_BASE.maxHealth,
      state: EntityState.Idle,
      action: "idle",
      actionT: 0,
      attackCooldown: 1,
      roarCooldown: 6,
      retargetTimer: 0,
      targetIndex: -1,
      targetX: 0,
      targetZ: 0,
      lastDist: 0,
      stuckTime: 0,
      avoidTimer: 0,
      avoidSign: 1,
      facing: 0,
      speedRef: 0,
      stepTimer: 0,
      hitsDealt: 0,
      damageDealt: 0,
      deathT: -1,
    };
  }

  emit(type: EffectEvent["type"], x: number, y: number, z: number, power = 1) {
    if (this.effects.length < 256) this.effects.push({ type, x, y, z, power });
  }

  /** Reinicia stats e contadores para uma nova batalha (corpos são reposicionados fora daqui). */
  resetRun(count: number, menModId: string, gorillaModId: string) {
    this.count = count;
    this.time = 0;
    this.running = false;
    this.aliveCount = count;
    this.deadCount = 0;
    this.menHits = 0;
    this.menDamage = 0;
    this.effects.length = 0;
    this.recentDeaths.length = 0;

    const menMod = MEN_MODIFIERS.find((m) => m.id === menModId) ?? MEN_MODIFIERS[0];
    const gorMod =
      GORILLA_MODIFIERS.find((m) => m.id === gorillaModId) ?? GORILLA_MODIFIERS[0];
    this.manStats = applyModifier(MAN_BASE, menMod);
    this.gorillaStats = {
      ...applyModifier(GORILLA_BASE, gorMod),
      roarCooldown: GORILLA_BASE.roarCooldown,
    };

    const prevBody = this.gorilla.body;
    this.gorilla = this.freshGorilla();
    this.gorilla.body = prevBody;
    this.gorilla.hp = this.gorillaStats.maxHealth;
    this.gorilla.maxHp = this.gorillaStats.maxHealth;

    for (let i = 0; i < MAX_MEN; i++) {
      this.state[i] = i < count ? EntityState.Idle : EntityState.Dead;
      this.hp[i] = this.manStats.maxHealth;
      this.cooldown[i] = Math.random() * this.manStats.attackCooldown;
      this.decideTimer[i] = Math.random() * 0.2;
      this.gaitPhase[i] = Math.random() * Math.PI * 2;
      this.speedVar[i] = 0.85 + Math.random() * 0.3;
      this.deathT[i] = -1;
      this.fearTimer[i] = 0;
      this.punchAnim[i] = 0;
      this.hitFlash[i] = 0;
      this.settled[i] = 0;
      this.airborne[i] = 0;
      this.lastDist[i] = 999;
      this.stuckCount[i] = 0;
      this.velX[i] = this.velY[i] = this.velZ[i] = 0;
    }
  }

  rebuildGrid() {
    this.grid.clear();
    for (let i = 0; i < this.count; i++) {
      if (this.state[i] === EntityState.Dead) continue;
      this.grid.insert(i, this.posX[i], this.posZ[i]);
    }
  }

  /** Copia posições/velocidades dos rigid bodies para os arrays SoA. */
  syncFromBodies() {
    for (let i = 0; i < this.count; i++) {
      const b = this.bodies[i];
      if (!b || this.settled[i]) continue;
      const t = b.translation();
      this.posX[i] = t.x;
      this.posY[i] = t.y;
      this.posZ[i] = t.z;
      const v = b.linvel();
      this.velX[i] = v.x;
      this.velY[i] = v.y;
      this.velZ[i] = v.z;
    }
  }

  randomAliveIndex(): number {
    if (this.aliveCount === 0) return -1;
    for (let tries = 0; tries < 40; tries++) {
      const i = Math.floor(Math.random() * this.count);
      if (this.state[i] !== EntityState.Dead) return i;
    }
    for (let i = 0; i < this.count; i++)
      if (this.state[i] !== EntityState.Dead) return i;
    return -1;
  }

  countRecentDeathsNear(x: number, z: number, radius: number, window: number) {
    let n = 0;
    const r2 = radius * radius;
    for (const d of this.recentDeaths) {
      if (this.time - d.t > window) continue;
      const dx = d.x - x;
      const dz = d.z - z;
      if (dx * dx + dz * dz < r2) n++;
    }
    return n;
  }

  pruneRecentDeaths(window: number) {
    if (this.recentDeaths.length === 0) return;
    this.recentDeaths = this.recentDeaths.filter((d) => this.time - d.t <= window);
  }
}

/** Singleton — o mundo inteiro da simulação fora do React. */
export const sim = new Simulation();
