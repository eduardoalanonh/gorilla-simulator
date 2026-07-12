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
  critChance: 0.22,
  critMultiplier: 2,
  knockbackForce: 11,
  roarCooldown: 14,
};

export type FighterRig = "human" | "dog" | "robot";

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
  /** Modelo visual do combatente */
  rig: FighterRig;
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
  rig: "human",
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
  mod("medieval", "Cavaleiros medievais", "Armadura, espada e escudo", {
    health: 1.9,
    damage: 2.6,
    speed: 0.92,
    range: 1.4,
  }),
  mod("caes", "Cães de guerra", "Rápidos, ferozes e frágeis", {
    health: 0.6,
    damage: 1.5,
    speed: 1.5,
    range: 0.9,
    cooldown: 0.8,
    rig: "dog",
  }),
  mod("robos", "Robôs", "Blindagem pesada, socos hidráulicos", {
    health: 2.6,
    damage: 2.2,
    speed: 0.8,
    cooldown: 1.25,
    rig: "robot",
  }),
];

/** Variante de gorila: stats + visual (escala, cores, cauda, aura, rajada). */
export interface GorillaVariant extends StatModifier {
  /** Escala visual E física (raio do colisor) */
  scale: number;
  fur: number;
  back: number;
  skin: number;
  eyeGlow: number;
  eyeIntensity: number;
  /** Cauda de macaco (homenagem a um certo Saiyajin) */
  tail?: boolean;
  /** Cor das partículas de aura (dourado etc.) */
  aura?: number;
  /** Rajada de energia pela boca */
  beam?: boolean;
}

const gorilla = (
  id: string,
  label: string,
  description: string,
  m: Partial<Omit<GorillaVariant, "id" | "label" | "description">> = {},
): GorillaVariant => ({
  ...mod(id, label, description),
  scale: 1,
  fur: 0x2e2a31,
  back: 0x63666d,
  skin: 0x2a2426,
  eyeGlow: 0x4a1808,
  eyeIntensity: 0.35,
  ...m,
});

export const GORILLA_MODIFIERS: GorillaVariant[] = [
  gorilla("normal", "Gorila normal", "Um silverback saudável"),
  gorilla("enfurecido", "Gorila enfurecido", "Fúria total, golpes devastadores", {
    damage: 1.5,
    speed: 1.25,
    cooldown: 0.8,
    crit: 1.5,
    fur: 0x3a2528,
    eyeGlow: 0xff2200,
    eyeIntensity: 2,
  }),
  gorilla("cansado", "Gorila cansado", "Dia ruim para o rei da selva", {
    health: 0.65,
    damage: 0.75,
    speed: 0.75,
    cooldown: 1.2,
    fur: 0x3c3a3e,
    back: 0x7d8087,
  }),
  gorilla("gigante", "Gorila GIGANTE 🏔️", "Um monstro de 7 metros", {
    health: 3.2,
    damage: 2.2,
    speed: 0.95,
    range: 1.9,
    cooldown: 1.15,
    scale: 2.1,
  }),
  gorilla("oozaru", "Macaco Lendário 🌕", "Homenagem a um Saiyajin na lua cheia", {
    health: 5,
    damage: 3,
    speed: 0.85,
    range: 2.4,
    cooldown: 1.2,
    scale: 2.9,
    fur: 0x5a3d28,
    back: 0x6e4c30,
    skin: 0x3a2a20,
    eyeGlow: 0xff1a00,
    eyeIntensity: 4,
    tail: true,
    beam: true,
  }),
  gorilla("dourado", "Gorila Dourado ⚡", "Cabelo dourado, poder além dos limites", {
    health: 1.6,
    damage: 1.4,
    speed: 1.55,
    cooldown: 0.55,
    crit: 2,
    scale: 1.25,
    fur: 0xc9971d,
    back: 0xe8c04a,
    skin: 0x4a3a1a,
    eyeGlow: 0x6fffd0,
    eyeIntensity: 3,
    aura: 0xffd75e,
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

/** Preset de cenário: geometria da arena + clima/iluminação. */
export interface ArenaPreset {
  id: string;
  label: string;
  description: string;
  radius: number;
  /** 0 = sem muralha (campo aberto) */
  wallSegments: number;
  wallHeight: number;
  bigRocks: number;
  smallRocks: number;
  grassTufts: number;
  torches: number;
  fogDensity: number;
  fogColor: string;
  sky: {
    top: string;
    mid: string;
    horizon: string;
    sunColor: string;
    sunIntensity: number;
    ambientIntensity: number;
    hemiIntensity: number;
    /** Lua cheia gigante no céu */
    moon?: boolean;
  };
  /** Tinta do chão (multiplica a textura de terra) */
  groundTint: string;
}

export const ARENA_PRESETS: ArenaPreset[] = [
  {
    id: "coliseu",
    label: "Coliseu Clássico 🏟️",
    description: "A arena original ao pôr do sol",
    radius: 58,
    wallSegments: 26,
    wallHeight: 3,
    bigRocks: 9,
    smallRocks: 26,
    grassTufts: 220,
    torches: 10,
    fogDensity: 0.0062,
    fogColor: "#1c1425",
    sky: {
      top: "#0d1026",
      mid: "#3b2544",
      horizon: "#c96a3a",
      sunColor: "#ffb168",
      sunIntensity: 3.4,
      ambientIntensity: 0.38,
      hemiIntensity: 0.55,
    },
    groundTint: "#ffffff",
  },
  {
    id: "poco",
    label: "O Poço 🕳️",
    description: "Apertado, sem escapatória — caos imediato",
    radius: 22,
    wallSegments: 16,
    wallHeight: 10,
    bigRocks: 2,
    smallRocks: 8,
    grassTufts: 20,
    torches: 8,
    fogDensity: 0.011,
    fogColor: "#221528",
    sky: {
      top: "#0a0c1e",
      mid: "#33203c",
      horizon: "#b05a30",
      sunColor: "#ff9c50",
      sunIntensity: 2.8,
      ambientIntensity: 0.34,
      hemiIntensity: 0.5,
    },
    groundTint: "#d8c8b8",
  },
  {
    id: "planicie",
    label: "Planície Aberta 🌾",
    description: "Enorme, sem muros — dá para correr (e fugir)",
    radius: 100,
    wallSegments: 0,
    wallHeight: 0,
    bigRocks: 16,
    smallRocks: 60,
    grassTufts: 700,
    torches: 0,
    fogDensity: 0.0032,
    fogColor: "#2a1e28",
    sky: {
      top: "#141336",
      mid: "#4a2c4e",
      horizon: "#d8813f",
      sunColor: "#ffc078",
      sunIntensity: 4.2,
      ambientIntensity: 0.45,
      hemiIntensity: 0.65,
    },
    groundTint: "#ffffff",
  },
  {
    id: "luacheia",
    label: "Lua Cheia 🌕",
    description: "Noite azul, lua gigante — cuidado com macacos",
    radius: 58,
    wallSegments: 26,
    wallHeight: 3,
    bigRocks: 9,
    smallRocks: 26,
    grassTufts: 120,
    torches: 12,
    fogDensity: 0.008,
    fogColor: "#0e1220",
    sky: {
      top: "#04060f",
      mid: "#0d1730",
      horizon: "#28405c",
      sunColor: "#aabfff",
      sunIntensity: 2.4,
      ambientIntensity: 0.42,
      hemiIntensity: 0.5,
      moon: true,
    },
    groundTint: "#93a2c4",
  },
];

/** Compatibilidade: valores do preset clássico para consumidores estáticos. */
export const ARENA = ARENA_PRESETS[0];

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
  /** Modo enfurecido: ativa abaixo desta fração de vida do gorila */
  rageThreshold: 0.25,
  rageCooldownFactor: 0.8,
  rageSpeedFactor: 1.15,
};

export const HORDE = {
  /** Intervalo entre levas de reforço (s) */
  spawnInterval: 0.55,
  /** Quantos entram por leva */
  spawnBatch: 5,
  /** Distância da borda onde os reforços surgem */
  edgeMargin: 7,
};

/** Marcos de kill streak: [mínimo de kills num golpe, texto] */
export const KILL_STREAKS: [number, string][] = [
  [10, "EXTINÇÃO!!!"],
  [7, "MASSACRE!!"],
  [5, "RAMPAGE!"],
  [4, "QUAD KILL"],
  [3, "TRIPLE KILL"],
  [2, "DOUBLE KILL"],
];

export const CHART_COLORS = {
  deaths: "#ea580c",
  gorillaHp: "#0284c7",
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
