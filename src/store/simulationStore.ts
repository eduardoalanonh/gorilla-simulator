"use client";

import { create } from "zustand";
import {
  ARENA_PRESETS,
  GORILLA_MODIFIERS,
  MEN_MODIFIERS,
  MEN_PRESETS,
  SPEED_OPTIONS,
} from "@/constants/config";
import type {
  BattleMode,
  BattleResults,
  CameraMode,
  Phase,
  Winner,
} from "@/types/simulation";
import { pick } from "@/utils/random";

interface RuntimeStats {
  aliveMen: number;
  deadMen: number;
  gorillaHp: number;
  gorillaMaxHp: number;
  elapsed: number;
  fps: number;
  entityCount: number;
  /** Legenda do homem seguido pela câmera ("Cleiton, 34 — achou que dava") */
  followedLabel: string | null;
  /** Necrológio recente do homem seguido */
  followedNecro: string | null;
}

/** Laboratório: multiplicadores livres por cima dos modificadores. */
export interface LabConfig {
  menHp: number;
  menDmg: number;
  gorHp: number;
  gorDmg: number;
}

/** Mutadores globais de física/escala. */
export interface Mutators {
  lowGravity: boolean;
  ice: boolean;
  giants: boolean;
}

const LAB_DEFAULT: LabConfig = { menHp: 1, menDmg: 1, gorHp: 1, gorDmg: 1 };

interface SimulationStore extends RuntimeStats {
  phase: Phase;
  /** Incrementa a cada reset — usado para re-spawnar o mundo. */
  runId: number;

  /** Popup de kill streak (id força re-animação) */
  streak: { count: number; id: number } | null;
  /** Popup de onda ("ONDA 3") */
  wave: { n: number; id: number } | null;
  battleMode: BattleMode;

  menCount: number;
  speed: (typeof SPEED_OPTIONS)[number];
  slowMotion: boolean;
  showHealthBars: boolean;
  debugMode: boolean;
  showColliders: boolean;
  postFx: boolean;
  muted: boolean;
  /** Física exagerada + som de mola quando alguém decola */
  cartoonMode: boolean;
  /** Raios e vacas caindo do céu */
  arenaEvents: boolean;
  menModifierId: string;
  gorillaModifierId: string;
  arenaId: string;
  cameraMode: CameraMode;

  lab: LabConfig;
  mutators: Mutators;

  /** Palpite pré-batalha + placar da sessão */
  guess: Winner;
  guessRight: number;
  guessTotal: number;

  results: BattleResults | null;

  enterArena: () => void;
  startBattle: () => void;
  reset: () => void;
  randomize: () => void;
  finish: (winner: Winner, results: BattleResults) => void;
  setMenCount: (n: number) => void;
  setSpeed: (s: (typeof SPEED_OPTIONS)[number]) => void;
  setCameraMode: (m: CameraMode) => void;
  setMenModifier: (id: string) => void;
  setGorillaModifier: (id: string) => void;
  setArena: (id: string) => void;
  setBattleMode: (m: BattleMode) => void;
  setGuess: (g: Winner) => void;
  setLab: (patch: Partial<LabConfig>) => void;
  toggleMutator: (key: keyof Mutators) => void;
  announceStreak: (count: number) => void;
  announceWave: (n: number) => void;
  toggle: (
    key:
      | "slowMotion"
      | "showHealthBars"
      | "debugMode"
      | "showColliders"
      | "postFx"
      | "muted"
      | "cartoonMode"
      | "arenaEvents",
  ) => void;
  syncRuntime: (r: Partial<RuntimeStats>) => void;
}

/** Bump do runId apenas quando dá para re-spawnar (fase ready). */
const bump = (s: { phase: Phase; runId: number }) =>
  s.phase === "ready" ? s.runId + 1 : s.runId;

export const useSimulationStore = create<SimulationStore>()((set, get) => ({
  phase: "intro",
  runId: 0,

  streak: null,
  wave: null,
  battleMode: "classic",

  menCount: 100,
  speed: 1,
  slowMotion: false,
  showHealthBars: true,
  debugMode: false,
  showColliders: false,
  postFx: true,
  muted: false,
  cartoonMode: false,
  arenaEvents: true,
  menModifierId: "comuns",
  gorillaModifierId: "normal",
  arenaId: "coliseu",
  cameraMode: "free",

  lab: { ...LAB_DEFAULT },
  mutators: { lowGravity: false, ice: false, giants: false },

  guess: null,
  guessRight: 0,
  guessTotal: 0,

  aliveMen: 0,
  deadMen: 0,
  gorillaHp: 15000,
  gorillaMaxHp: 15000,
  elapsed: 0,
  fps: 0,
  entityCount: 0,
  followedLabel: null,
  followedNecro: null,

  results: null,

  enterArena: () => set({ phase: "ready" }),

  startBattle: () => {
    if (get().phase !== "ready") return;
    set({ phase: "running", results: null });
  },

  reset: () =>
    set((s) => ({
      phase: "ready",
      runId: s.runId + 1,
      results: null,
      elapsed: 0,
      streak: null,
      wave: null,
      guess: null,
    })),

  randomize: () =>
    set((s) => ({
      menCount: pick(MEN_PRESETS),
      menModifierId: pick(MEN_MODIFIERS).id,
      gorillaModifierId: pick(GORILLA_MODIFIERS).id,
      arenaId: pick(ARENA_PRESETS).id,
      runId: s.phase === "ready" ? s.runId : s.runId + 1,
      phase: "ready",
      results: null,
      guess: null,
    })),

  finish: (winner, results) =>
    set((s) => {
      const guessed = s.guess !== null && s.battleMode === "classic";
      return {
        phase: "ended",
        results,
        guessTotal: guessed ? s.guessTotal + 1 : s.guessTotal,
        guessRight:
          guessed && s.guess === winner ? s.guessRight + 1 : s.guessRight,
      };
    }),

  setMenCount: (n) => set({ menCount: n }),
  setSpeed: (speed) => set({ speed }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setMenModifier: (menModifierId) =>
    set((s) => ({ menModifierId, runId: bump(s) })),
  setGorillaModifier: (gorillaModifierId) =>
    set((s) => ({ gorillaModifierId, runId: bump(s) })),
  setArena: (arenaId) => set((s) => ({ arenaId, runId: bump(s) })),
  setBattleMode: (battleMode) => set((s) => ({ battleMode, runId: bump(s) })),
  setGuess: (guess) => set({ guess }),
  setLab: (patch) =>
    set((s) => ({ lab: { ...s.lab, ...patch }, runId: bump(s) })),
  toggleMutator: (key) =>
    set((s) => ({
      mutators: { ...s.mutators, [key]: !s.mutators[key] },
      runId: bump(s),
    })),

  announceStreak: (count) =>
    set((s) => ({ streak: { count, id: (s.streak?.id ?? 0) + 1 } })),

  announceWave: (n) => set((s) => ({ wave: { n, id: (s.wave?.id ?? 0) + 1 } })),

  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SimulationStore>),

  syncRuntime: (r) => set(r),
}));
