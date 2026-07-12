/** Estados possíveis da state machine de cada entidade. */
export const EntityState = {
  Idle: 0,
  Searching: 1,
  Running: 2,
  Attacking: 3,
  Recovering: 4,
  Dead: 5,
} as const;

export type EntityStateValue = (typeof EntityState)[keyof typeof EntityState];

export type GorillaAction =
  | "idle"
  | "run"
  | "swipe"
  | "slam"
  | "roar"
  | "die";

export type Phase = "intro" | "ready" | "running" | "ended";

export type CameraMode = "free" | "gorilla" | "man" | "aerial";

export type Winner = "gorilla" | "men" | null;

export interface EffectEvent {
  type:
    | "punch"
    | "swipe"
    | "slam"
    | "impact"
    | "death"
    | "roar"
    | "land"
    | "shout"
    | "scream"
    | "damage"
    | "killstreak"
    | "gorillaStep"
    | "gorillaDie";
  x: number;
  y: number;
  z: number;
  power: number;
  /** Golpe crítico (dano dobrado) */
  crit?: boolean;
  /** Quem causou o dano (cor do número flutuante) */
  source?: "gorilla" | "men";
}

/** Amostra da linha do tempo da batalha (para o gráfico final). */
export interface HistorySample {
  t: number;
  deaths: number;
  gorillaHp: number;
}

export type BattleMode = "classic" | "horde";

export interface BattleResults {
  winner: Winner;
  mode: BattleMode;
  history: HistorySample[];
  durationSec: number;
  initialMen: number;
  survivors: number;
  deaths: number;
  menHits: number;
  gorillaHits: number;
  menDamage: number;
  gorillaDamage: number;
  gorillaHpLeft: number;
  gorillaMaxHp: number;
}
