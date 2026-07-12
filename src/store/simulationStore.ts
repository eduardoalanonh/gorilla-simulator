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
}

interface SimulationStore extends RuntimeStats {
  phase: Phase;
  /** Incrementa a cada reset — usado para re-spawnar o mundo. */
  runId: number;

  /** Popup de kill streak (id força re-animação) */
  streak: { count: number; id: number } | null;
  hordeMode: boolean;

  menCount: number;
  speed: (typeof SPEED_OPTIONS)[number];
  slowMotion: boolean;
  showHealthBars: boolean;
  debugMode: boolean;
  showColliders: boolean;
  postFx: boolean;
  muted: boolean;
  menModifierId: string;
  gorillaModifierId: string;
  arenaId: string;
  cameraMode: CameraMode;

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
  toggleHorde: () => void;
  announceStreak: (count: number) => void;
  toggle: (
    key:
      | "slowMotion"
      | "showHealthBars"
      | "debugMode"
      | "showColliders"
      | "postFx"
      | "muted",
  ) => void;
  syncRuntime: (r: Partial<RuntimeStats>) => void;
}

export const useSimulationStore = create<SimulationStore>()((set, get) => ({
  phase: "intro",
  runId: 0,

  streak: null,
  hordeMode: false,

  menCount: 100,
  speed: 1,
  slowMotion: false,
  showHealthBars: true,
  debugMode: false,
  showColliders: false,
  postFx: true,
  muted: false,
  menModifierId: "comuns",
  gorillaModifierId: "normal",
  arenaId: "coliseu",
  cameraMode: "free",

  aliveMen: 0,
  deadMen: 0,
  gorillaHp: 10000,
  gorillaMaxHp: 10000,
  elapsed: 0,
  fps: 0,
  entityCount: 0,

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
    })),

  finish: (winner, results) => set({ phase: "ended", results }),

  setMenCount: (n) => set({ menCount: n }),
  setSpeed: (speed) => set({ speed }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setMenModifier: (menModifierId) =>
    set((s) => ({
      menModifierId,
      runId: s.phase === "ready" ? s.runId + 1 : s.runId,
    })),
  setGorillaModifier: (gorillaModifierId) =>
    set((s) => ({
      gorillaModifierId,
      runId: s.phase === "ready" ? s.runId + 1 : s.runId,
    })),

  setArena: (arenaId) =>
    set((s) => ({
      arenaId,
      runId: s.phase === "ready" ? s.runId + 1 : s.runId,
    })),

  toggleHorde: () =>
    set((s) => ({
      hordeMode: !s.hordeMode,
      runId: s.phase === "ready" ? s.runId + 1 : s.runId,
    })),

  announceStreak: (count) =>
    set((s) => ({ streak: { count, id: (s.streak?.id ?? 0) + 1 } })),

  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SimulationStore>),

  syncRuntime: (r) => set(r),
}));
