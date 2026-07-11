/**
 * Configuração central da simulação.
 * Todos os valores de balanceamento vivem aqui para facilitar ajustes.
 */

export const MAX_MEN = 1000;

export interface FighterStats {
  maxHealth: number;
  attackDamage: number;
  attackVariance: number;
  weightKg: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldown: number;
  critChance: number;
  critMultiplier: number;
  knockbackForce: number;
}

export const MAN_BASE: FighterStats = {
  maxHealth: 100,
  attackDamage: 5,
  attackVariance: 2,
  weightKg: 80,
  moveSpeed: 5,
  attackRange: 1,
  attackCooldown: 0.95,
  critChance: 0.08,
  critMultiplier: 2,
  knockbackForce: 1.5,
};

export const GORILLA_BASE: FighterStats & { roarCooldown: number } = {
  maxHealth: 10000,
  attackDamage: 80,
  attackVariance: 15,
  weightKg: 220,
  moveSpeed: 7,
  attackRange: 3,
  attackCooldown: 1.35,
  critChance: 0.15,
  critMultiplier: 2,
  knockbackForce: 11,
  roarCooldown: 14,
};

/** Multiplicadores aplicados sobre os stats base. */
export interface StatModifier {
  id: string;
  label: string;
  description: string;
  health: number;
  damage: number;
  speed: number;
  range: number;
  cooldown: number;
  crit: number;
}

const mod = (
  id: string,
  label: string,
  description: string,
  m: Partial<Omit<StatModifier, "id" | "label" | "description">> = {},
): StatModifier => ({
  id,
  label,
  description,
  health: 1,
  damage: 1,
  speed: 1,
  range: 1,
  cooldown: 1,
  crit: 1,
  ...m,
});

export const MEN_MODIFIERS: StatModifier[] = [
  mod("comuns", "Homens comuns", "Pessoas normais, sem treino"),
  mod("desarmados", "Todos desarmados", "Só na raça, dano reduzido", {
    damage: 0.8,
  }),
  mod("treinados", "Homens treinados", "Condicionamento militar", {
    health: 1.3,
    damage: 1.5,
    speed: 1.1,
  }),
  mod("mma", "Lutadores de MMA", "Golpes precisos e ferozes", {
    health: 1.5,
    damage: 2.2,
    speed: 1.15,
    crit: 2,
  }),
  mod("bastoes", "Bastões", "Alcance e impacto extra", {
    damage: 1.8,
    range: 1.6,
  }),
  mod("medieval", "Medieval", "Armaduras e lâminas", {
    health: 1.9,
    damage: 2.6,
    speed: 0.92,
    range: 1.4,
  }),
];

export const GORILLA_MODIFIERS: StatModifier[] = [
  mod("normal", "Gorila normal", "Um silverback saudável"),
  mod("enfurecido", "Gorila enfurecido", "Fúria total, golpes devastadores", {
    damage: 1.5,
    speed: 1.25,
    cooldown: 0.8,
    crit: 1.5,
  }),
  mod("cansado", "Gorila cansado", "Dia ruim para o rei da selva", {
    health: 0.65,
    damage: 0.75,
    speed: 0.75,
    cooldown: 1.2,
  }),
];

export function applyModifier(base: FighterStats, m: StatModifier): FighterStats {
  return {
    maxHealth: Math.round(base.maxHealth * m.health),
    attackDamage: base.attackDamage * m.damage,
    attackVariance: base.attackVariance * m.damage,
    weightKg: base.weightKg,
    moveSpeed: base.moveSpeed * m.speed,
    attackRange: base.attackRange * m.range,
    attackCooldown: base.attackCooldown * m.cooldown,
    critChance: Math.min(0.6, base.critChance * m.crit),
    critMultiplier: base.critMultiplier,
    knockbackForce: base.knockbackForce * m.damage,
  };
}

export const ARENA = {
  radius: 58,
  wallSegments: 26,
  wallHeight: 3,
  groundY: 0,
  bigRocks: 9,
  smallRocks: 26,
  grassTufts: 220,
  torches: 10,
};

export const PHYSICS = {
  gravity: -16,
  fixedStep: 1 / 60,
  maxSubSteps: 10,
  manRadius: 0.34,
  gorillaRadius: 1.15,
  manDamping: 2.2,
  gorillaDamping: 3.5,
};

export const SPAWN = {
  /** Raio do primeiro anel de homens em volta do gorila. */
  baseRadius: 8,
  radiusPerSqrtMan: 0.32,
  ringSpacing: 1.5,
  arcSpacing: 1.55,
};

export const AI = {
  decisionInterval: 0.16,
  manSurroundJitter: 0.35,
  hesitationRadius: 7,
  hesitationDeathWindow: 4,
  hesitationDeathCount: 5,
  hesitationChance: 0.35,
  hesitationDuration: [1.2, 3.2] as const,
  gorillaRetargetInterval: 0.45,
  gorillaSlamThreshold: 9,
  roarFearRadius: 13,
  corpseSettleTime: 2.8,
};

export const SPEED_OPTIONS = [0.5, 1, 2, 5, 10] as const;
export const SLOW_MOTION_FACTOR = 0.28;

export const MEN_PRESETS = [1, 5, 10, 20, 50, 100, 250, 500, 1000] as const;

export const FX = {
  maxParticles: 3000,
  dustColor: 0x9a7d58,
  debrisColor: 0x6e563c,
  impactColor: 0xd8b98a,
  gorillaTrailRate: 0.055,
  menDustBudgetPerSecond: 70,
};

export const COLORS = {
  skinTones: [0xd9a066, 0xc68642, 0x8d5524, 0xe8b88a, 0xa46a3f, 0x6b4423],
  shirts: [
    0x365a75, 0x7a3b3b, 0x4a6741, 0x8a7340, 0x5b4a78, 0x336b66, 0x9c5f33,
    0x704f4f, 0x3f5e50, 0x585858,
  ],
  pants: [0x2e3742, 0x3a3230, 0x413f37, 0x2c3a33, 0x37333f],
  gorillaFur: 0x2e2a31,
  gorillaSilver: 0x63666d,
  gorillaSkin: 0x2a2426,
};
