"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { PHYSICS, SLOW_MOTION_FACTOR, FX, AI, HORDE } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { sim } from "@/systems/simulation";
import { reviveMan, spawnGorilla, spawnMen } from "@/systems/physics";
import { computeSpawnRing, hordeSpawnPoint } from "@/systems/spawn";
import { checkWinner, updateGorilla, updateMen } from "@/systems/ai";
import { audioManager } from "@/systems/audio";
import { fx } from "@/systems/fx";
import { EntityState } from "@/types/simulation";

/**
 * Orquestrador central: faz o stepping manual da física, roda a IA,
 * despacha efeitos (partículas + áudio) e sincroniza o Zustand (4 Hz).
 */
export function SimulationLoop() {
  const { world, rapier } = useRapier();
  const accumRef = useRef(0);
  const syncTimer = useRef(0);
  const fpsEma = useRef(60);
  const dustTimer = useRef(0);
  const trailTimer = useRef(0);
  const ending = useRef<{ winner: "gorilla" | "men"; t: number } | null>(null);
  const spawnedCount = useRef(-1);

  const runId = useSimulationStore((s) => s.runId);
  const phase = useSimulationStore((s) => s.phase);
  const menCount = useSimulationStore((s) => s.menCount);
  const menModifierId = useSimulationStore((s) => s.menModifierId);
  const gorillaModifierId = useSimulationStore((s) => s.gorillaModifierId);
  const hordeMode = useSimulationStore((s) => s.hordeMode);
  const muted = useSimulationStore((s) => s.muted);

  // (Re)spawn do mundo — debounce para o slider não recriar 1000 corpos por tick
  const lastWorld = useRef<typeof world | null>(null);
  useEffect(() => {
    // Mundo físico recriado (ex.: HMR / remount do Canvas): handles antigos
    // são ponteiros inválidos — descarta e força um reset limpo
    if (lastWorld.current !== world) {
      const hadWorld = lastWorld.current !== null;
      lastWorld.current = world;
      sim.bodies.fill(null);
      sim.gorilla.body = null;
      spawnedCount.current = -1;
      if (hadWorld && (phase === "running" || phase === "ended")) {
        useSimulationStore.getState().reset();
        return;
      }
    }
    if (phase === "running" || phase === "ended") return;
    const delay = spawnedCount.current === -1 ? 0 : 280;
    const handle = setTimeout(() => {
      sim.resetRun(menCount, menModifierId, gorillaModifierId, hordeMode);
      spawnGorilla(world, rapier, sim);
      spawnMen(world, rapier, sim, computeSpawnRing(menCount));
      spawnedCount.current = menCount;
      ending.current = null;
      useSimulationStore.getState().syncRuntime({
        aliveMen: menCount,
        deadMen: 0,
        gorillaHp: sim.gorilla.maxHp,
        gorillaMaxHp: sim.gorilla.maxHp,
        elapsed: 0,
        entityCount: menCount + 1,
      });
    }, delay);
    return () => clearTimeout(handle);
  }, [runId, menCount, menModifierId, gorillaModifierId, hordeMode, phase, world, rapier]);

  useEffect(() => {
    sim.running = phase === "running";
    if (phase === "running") audioManager.resume();
  }, [phase]);


  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

  useFrame((_, delta) => {
    const store = useSimulationStore.getState();
    const dt = Math.min(delta, 1 / 20);

    // FPS (EMA)
    fpsEma.current = fpsEma.current * 0.92 + (1 / Math.max(delta, 1e-4)) * 0.08;

    let speedFactor = store.speed * (store.slowMotion ? SLOW_MOTION_FACTOR : 1);
    if (ending.current) speedFactor = Math.min(speedFactor, 0.3); // câmera lenta no golpe final

    // Sub-stepping com passo fixo
    const h = PHYSICS.fixedStep;
    accumRef.current += dt * speedFactor;
    let steps = 0;
    const maxSteps = PHYSICS.maxSubSteps;
    const plannedSteps = Math.min(Math.floor(accumRef.current / h), maxSteps);

    if (plannedSteps > 0) {
      const simDt = plannedSteps * h;
      sim.syncFromBodies();
      sim.rebuildGrid();

      updateMen(sim, simDt);
      updateGorilla(sim, simDt);
      if (sim.running) {
        sim.time += simDt;
        sim.pruneRecentDeaths(AI.hesitationDeathWindow + 1);
        sim.sampleHistory(simDt);

        // Modo horda: recicla cadáveres assentados como reforços na borda
        if (sim.horde && sim.gorilla.hp > 0) {
          sim.hordeSpawnTimer -= simDt;
          if (sim.hordeSpawnTimer <= 0) {
            sim.hordeSpawnTimer = HORDE.spawnInterval;
            const missing = Math.min(
              HORDE.spawnBatch,
              spawnedCount.current - sim.aliveCount,
            );
            for (let n = 0; n < missing; n++) {
              const slot = sim.findRecyclableCorpse();
              if (slot < 0) break;
              const p = hordeSpawnPoint();
              reviveMan(sim, slot, p.x, p.z);
            }
          }
        }
      }

      world.timestep = h;
      while (steps < plannedSteps) {
        world.step();
        steps++;
      }
      accumRef.current -= plannedSteps * h;
      if (accumRef.current > h * maxSteps) accumRef.current = 0;

      sim.syncFromBodies();

      // Poeira de corrida (orçamento global)
      if (sim.running && fx.pool) {
        dustTimer.current -= simDt;
        if (dustTimer.current <= 0) {
          dustTimer.current = 1 / FX.menDustBudgetPerSecond;
          const i = Math.floor(Math.random() * sim.count);
          if (
            sim.state[i] === EntityState.Running &&
            sim.velX[i] ** 2 + sim.velZ[i] ** 2 > 6
          ) {
            fx.pool.dustPuff(sim.posX[i], 0.08, sim.posZ[i], 0.55);
          }
        }
        // Rastro do gorila
        const g = sim.gorilla;
        if (g.body && g.speedRef > 3.5) {
          trailTimer.current -= simDt;
          if (trailTimer.current <= 0) {
            trailTimer.current = FX.gorillaTrailRate;
            const p = g.body.translation();
            fx.pool.dustPuff(
              p.x - Math.sin(g.facing) * 1.2,
              0.12,
              p.z - Math.cos(g.facing) * 1.2,
              1.3,
            );
          }
        }
      }
    }

    // Despacha eventos para partículas + áudio + screen shake
    if (sim.effects.length > 0) {
      for (const e of sim.effects) {
        fx.pool?.handleEvent(e);
        audioManager.handleEvent(e);
        if (e.type === "damage") fx.numbers?.spawn(e);
        if (e.type === "killstreak") {
          store.announceStreak(e.power);
          fx.shake = Math.max(fx.shake, 0.15 + e.power * 0.03);
        }
        if (e.type === "roar") fx.shake = Math.max(fx.shake, 0.5);
        else if (e.type === "slam") fx.shake = Math.max(fx.shake, 0.4);
        else if (e.type === "gorillaDie") fx.shake = Math.max(fx.shake, 0.8);
      }
      sim.effects.length = 0;
    }

    fx.pool?.update(dt * speedFactor);
    fx.numbers?.update(dt * speedFactor);

    // Intensidade musical: multidão em campo, ritmo de abates ou fúria
    const recentKills = sim.recentDeaths.filter(
      (d) => sim.time - d.t < 3,
    ).length;
    const intensity = Math.min(
      1,
      Math.max(
        sim.aliveCount / 300,
        recentKills / 12,
        sim.gorilla.enraged ? 0.75 : 0,
      ),
    );
    audioManager.updateAmbience(sim.running, intensity);

    // Fim de batalha (com pequeno delay cinematográfico)
    if (store.phase === "running") {
      let winner = checkWinner(sim);
      // Na horda só o gorila caindo encerra — reforços estão a caminho
      if (sim.horde && winner === "gorilla") winner = null;
      if (winner && !ending.current) {
        ending.current = { winner, t: 0 };
        sim.running = winner === "men"; // homens comemoram? não — congela IA do lado morto
      }
      if (ending.current) {
        ending.current.t += dt;
        if (ending.current.t > 1.6) {
          const w = ending.current.winner;
          ending.current = null;
          sim.running = false;
          // Fecha a linha do tempo com o estado final
          sim.history.push({
            t: sim.time,
            deaths: sim.deadCount,
            gorillaHp: Math.max(0, sim.gorilla.hp),
          });
          store.finish(w, {
            winner: w,
            mode: sim.horde ? "horde" : "classic",
            history: sim.history.slice(),
            durationSec: sim.time,
            initialMen: sim.count,
            survivors: sim.aliveCount,
            deaths: sim.deadCount,
            menHits: sim.menHits,
            gorillaHits: sim.gorilla.hitsDealt,
            menDamage: Math.round(sim.menDamage),
            gorillaDamage: Math.round(sim.gorilla.damageDealt),
            gorillaHpLeft: Math.max(0, Math.round(sim.gorilla.hp)),
            gorillaMaxHp: sim.gorilla.maxHp,
          });
        }
      }
    }

    // Sincroniza HUD a ~5 Hz
    syncTimer.current -= delta;
    if (syncTimer.current <= 0) {
      syncTimer.current = 0.2;
      store.syncRuntime({
        aliveMen: sim.aliveCount,
        deadMen: sim.deadCount,
        gorillaHp: Math.max(0, Math.round(sim.gorilla.hp)),
        gorillaMaxHp: sim.gorilla.maxHp,
        elapsed: sim.time,
        fps: Math.round(fpsEma.current),
        entityCount: sim.count + 1 + (fx.pool?.activeCount ?? 0),
      });
    }
  });

  return null;
}
