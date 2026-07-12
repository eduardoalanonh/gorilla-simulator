import type { Collider, RigidBody } from "@dimforge/rapier3d-compat";
import {
  applyModifier,
  ARENA_PRESETS,
  type ArenaPreset,
  FighterStats,
  GORILLA_BASE,
  GORILLA_MODIFIERS,
  type GorillaVariant,
  MAN_BASE,
  MAX_MEN,
  MEN_MODIFIERS,
  PHYSICS,
  type RangedConfig,
} from "@/constants/config";
import {
  EntityState,
  type EffectEvent,
  type GorillaAction,
  type HistorySample,
} from "@/types/simulation";
import { SpatialHash } from "./spatial";

export interface Projectile {
  active: boolean;
  kind: "arrow" | "fire";
  /** Origem do tiro */
  sx: number;
  sy: number;
  sz: number;
  /** Progresso 0..1 e duração do voo */
  t: number;
  flight: number;
  arc: number;
  dmg: number;
  crit: boolean;
  /** Tiro errado: cai ao lado do alvo (offset fixo) */
  missX: number;
  missZ: number;
  /** Posição atual e anterior (orientação da flecha) */
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
}

export interface GorillaState {
  body: RigidBody | null;
  collider: Collider | null;
  hp: number;
  maxHp: number;
  state: number;
  action: GorillaAction;
  actionT: number;
  attackCooldown: number;
  roarCooldown: number;
  /** Rajada de energia (variantes com beam) */
  beamCooldown: number;
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
  /** Fúria: ativa com pouca vida — mais rápido e golpes mais frequentes */
  enraged: boolean;
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
  /** Config de ataque à distância (null = corpo a corpo) */
  manRanged: RangedConfig | null = null;
  /** Imune a medo/hesitação (zumbis) */
  manFearless = false;
  gorillaStats: FighterStats & { roarCooldown: number } = { ...GORILLA_BASE };
  gorillaVariant: GorillaVariant = GORILLA_MODIFIERS[0];
  /** Raio físico do gorila (escala com a variante) */
  gorillaRadius = PHYSICS.gorillaRadius;
  arena: ArenaPreset = ARENA_PRESETS[0];

  gorilla: GorillaState = this.freshGorilla();

  aliveCount = 0;
  deadCount = 0;
  menHits = 0;
  menDamage = 0;
  running = false;

  /** Modo horda: mortos renascem na borda até o gorila cair */
  horde = false;
  hordeSpawnTimer = 0;
  hordeScanCursor = 0;

  /** Linha do tempo da batalha (gráfico da tela final) */
  history: HistorySample[] = [];
  historyTimer = 0;
  historyInterval = 0.5;

  effects: EffectEvent[] = [];
  recentDeaths: { x: number; z: number; t: number }[] = [];

  /** Projéteis em voo (flechas, bolas de fogo) — pool com reuso */
  projectiles: Projectile[] = [];

  /** Orçamento de poeira por frame (compartilhado entre os homens). */
  dustBudget = 0;

  private freshGorilla(): GorillaState {
    return {
      body: null,
      collider: null,
      hp: GORILLA_BASE.maxHealth,
      maxHp: GORILLA_BASE.maxHealth,
      state: EntityState.Idle,
      action: "idle",
      actionT: 0,
      attackCooldown: 1,
      roarCooldown: 6,
      beamCooldown: 7,
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
      enraged: false,
    };
  }

  emit(
    type: EffectEvent["type"],
    x: number,
    y: number,
    z: number,
    power = 1,
    extra?: Pick<EffectEvent, "crit" | "source">,
  ) {
    if (this.effects.length < 256)
      this.effects.push({ type, x, y, z, power, ...extra });
  }

  /** Reinicia stats e contadores para uma nova batalha (corpos são reposicionados fora daqui). */
  resetRun(
    count: number,
    menModId: string,
    gorillaModId: string,
    horde = false,
    arena: ArenaPreset = ARENA_PRESETS[0],
  ) {
    this.arena = arena;
    this.count = count;
    this.time = 0;
    this.running = false;
    this.aliveCount = count;
    this.deadCount = 0;
    this.menHits = 0;
    this.menDamage = 0;
    this.effects.length = 0;
    this.recentDeaths.length = 0;
    this.horde = horde;
    this.hordeSpawnTimer = 0;
    this.hordeScanCursor = 0;
    this.history.length = 0;
    this.historyTimer = 0;
    this.historyInterval = 0.5;

    const menMod = MEN_MODIFIERS.find((m) => m.id === menModId) ?? MEN_MODIFIERS[0];
    const gorMod =
      GORILLA_MODIFIERS.find((m) => m.id === gorillaModId) ?? GORILLA_MODIFIERS[0];
    this.manStats = applyModifier(MAN_BASE, menMod);
    this.manRanged = menMod.ranged ?? null;
    this.manFearless = !!menMod.fearless;
    for (const p of this.projectiles) p.active = false;
    this.gorillaVariant = gorMod;
    this.gorillaRadius = PHYSICS.gorillaRadius * gorMod.scale;
    this.gorillaStats = {
      ...applyModifier(GORILLA_BASE, gorMod),
      roarCooldown: GORILLA_BASE.roarCooldown,
    };

    const prevBody = this.gorilla.body;
    const prevCollider = this.gorilla.collider;
    this.gorilla = this.freshGorilla();
    this.gorilla.body = prevBody;
    this.gorilla.collider = prevCollider;
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

  /** Dispara um projétil de `(sx,sy,sz)` em direção ao gorila. */
  spawnProjectile(
    kind: "arrow" | "fire",
    sx: number,
    sy: number,
    sz: number,
    dmg: number,
    crit: boolean,
    miss: boolean,
  ) {
    if (!this.manRanged) return;
    let p = this.projectiles.find((q) => !q.active);
    if (!p) {
      if (this.projectiles.length >= 400) return;
      p = {} as Projectile;
      this.projectiles.push(p);
    }
    p.active = true;
    p.kind = kind;
    p.sx = p.x = p.px = sx;
    p.sy = p.y = p.py = sy;
    p.sz = p.z = p.pz = sz;
    p.t = 0;
    p.flight = this.manRanged.flightTime;
    p.arc = this.manRanged.arcHeight;
    p.dmg = dmg;
    p.crit = crit;
    if (miss) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 2.5;
      p.missX = Math.cos(a) * r;
      p.missZ = Math.sin(a) * r;
    } else {
      p.missX = 0;
      p.missZ = 0;
    }
  }

  /** Amostra a linha do tempo; comprime quando fica longa (hordas). */
  sampleHistory(dt: number) {
    this.historyTimer -= dt;
    if (this.historyTimer > 0) return;
    this.historyTimer = this.historyInterval;
    this.history.push({
      t: this.time,
      deaths: this.deadCount,
      gorillaHp: Math.max(0, this.gorilla.hp),
    });
    if (this.history.length > 640) {
      this.history = this.history.filter((_, i) => i % 2 === 0);
      this.historyInterval *= 2;
    }
  }

  /** Busca circular por um cadáver assentado para reciclar (modo horda). */
  findRecyclableCorpse(): number {
    for (let n = 0; n < this.count; n++) {
      const i = (this.hordeScanCursor + n) % this.count;
      if (this.state[i] === EntityState.Dead && this.settled[i]) {
        this.hordeScanCursor = (i + 1) % this.count;
        return i;
      }
    }
    return -1;
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
