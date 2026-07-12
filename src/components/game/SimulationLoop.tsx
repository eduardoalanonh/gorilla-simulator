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
import { activeProjectiles, updateProjectiles } from "@/systems/projectiles";
import { updateArenaEvents } from "@/systems/arenaEvents";
import { audioManager, type VoiceName } from "@/systems/audio";
import { fx } from "@/systems/fx";
import { getArenaPreset } from "@/systems/rocks";
import { manIdentity } from "@/utils/names";
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
  const wasEnraged = useRef(false);

  const runId = useSimulationStore((s) => s.runId);
  const phase = useSimulationStore((s) => s.phase);
  const menCount = useSimulationStore((s) => s.menCount);
  const menModifierId = useSimulationStore((s) => s.menModifierId);
  const gorillaModifierId = useSimulationStore((s) => s.gorillaModifierId);
  const battleMode = useSimulationStore((s) => s.battleMode);
  const arenaId = useSimulationStore((s) => s.arenaId);
  const muted = useSimulationStore((s) => s.muted);
  const cartoonMode = useSimulationStore((s) => s.cartoonMode);
  const lab = useSimulationStore((s) => s.lab);
  const mutators = useSimulationStore((s) => s.mutators);

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
      const preset = getArenaPreset(arenaId);
      sim.resetRun(menCount, menModifierId, gorillaModifierId, {
        mode: battleMode,
        arena: preset,
        lab,
        mutators,
        cartoon: cartoonMode,
      });
      spawnGorilla(world, rapier, sim);
      spawnMen(world, rapier, sim, computeSpawnRing(menCount, preset));
      spawnedCount.current = menCount;
      ending.current = null;
      fx.killcam = null;
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
  }, [runId, menCount, menModifierId, gorillaModifierId, battleMode, arenaId, phase, world, rapier, lab, mutators, cartoonMode]);

  useEffect(() => {
    sim.running = phase === "running";
    if (phase === "running") {
      audioManager.resume();
      audioManager.playVoice(sim.mode === "horde" ? "survival_mode" : "fight");
    } else if (phase === "ready") {
      audioManager.playVoice("prepare_yourself");
    }
  }, [phase]);

  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

  // Modo cartum pode ser ligado no meio da batalha
  useEffect(() => {
    sim.cartoon = cartoonMode;
  }, [cartoonMode]);


  // Mutador: gravidade lunar
  useEffect(() => {
    world.gravity = {
      x: 0,
      y: mutators.lowGravity ? -3.5 : PHYSICS.gravity,
      z: 0,
    };
  }, [mutators.lowGravity, world]);

  useFrame((_, delta) => {
    const store = useSimulationStore.getState();
    const dt = Math.min(delta, 1 / 20);

    // FPS (EMA)
    fpsEma.current = fpsEma.current * 0.92 + (1 / Math.max(delta, 1e-4)) * 0.08;

    let speedFactor = store.speed * (store.slowMotion ? SLOW_MOTION_FACTOR : 1);
    if (ending.current) speedFactor = Math.min(speedFactor, 0.3); // câmera lenta no golpe final

    // Física só roda durante a batalha (e o desfecho, para corpos assentarem).
    // Enquanto o jogador só está configurando a simulação (arena parada),
    // não há nada a resolver — e não dar step aqui evita que um respawn
    // (troca de quantidade/modificador) resolva alguma sobreposição residual
    // como um "pulo" visível fora de hora.
    const physicsActive = store.phase === "running" || store.phase === "ended";

    // Sub-stepping com passo fixo
    const h = PHYSICS.fixedStep;
    if (physicsActive) {
      accumRef.current += dt * speedFactor;
    } else if (accumRef.current !== 0) {
      accumRef.current = 0;
    }
    let steps = 0;
    const maxSteps = PHYSICS.maxSubSteps;
    const plannedSteps = Math.min(Math.floor(accumRef.current / h), maxSteps);

    if (plannedSteps > 0) {
      const simDt = plannedSteps * h;
      sim.syncFromBodies();
      sim.rebuildGrid();

      updateMen(sim, simDt);
      updateGorilla(sim, simDt);
      updateProjectiles(sim, simDt);
      updateArenaEvents(sim, simDt, store.arenaEvents);
      if (sim.running) {
        sim.time += simDt;
        sim.pruneRecentDeaths(AI.hesitationDeathWindow + 1);
        sim.sampleHistory(simDt);

        // Modo horda: recicla cadáveres assentados como reforços na borda
        if (sim.mode === "horde" && sim.gorilla.hp > 0) {
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
              const p = hordeSpawnPoint(sim.arena);
              reviveMan(sim, slot, p.x, p.z);
            }
          }
        }

        // Modo ondas: limpa a arena → pausa dramática → onda maior
        if (sim.mode === "waves" && sim.gorilla.hp > 0 && sim.aliveCount === 0) {
          sim.waveBreakTimer += simDt;
          if (sim.waveBreakTimer > 2.2) {
            sim.waveBreakTimer = 0;
            sim.wave++;
            sim.gorilla.hp = Math.min(
              sim.gorilla.maxHp,
              sim.gorilla.hp + sim.gorilla.maxHp * 0.15,
            );
            const next = Math.min(
              Math.round(spawnedCount.current * Math.pow(1.35, sim.wave - 1)),
              1000,
            );
            sim.resetMen(next);
            spawnMen(world, rapier, sim, computeSpawnRing(next, sim.arena));
            store.announceWave(sim.wave);
            audioManager.playVoice(
              `round_${Math.min(sim.wave, 5)}` as VoiceName,
            );
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
          audioManager.playVoice(e.power >= 4 ? "multi_kill" : "combo");
        }
        if (e.type === "roar") fx.shake = Math.max(fx.shake, 0.5);
        else if (e.type === "beam") fx.shake = Math.max(fx.shake, 0.6);
        else if (e.type === "slam") fx.shake = Math.max(fx.shake, 0.4);
        else if (e.type === "gorillaDie") fx.shake = Math.max(fx.shake, 0.8);
      }
      sim.effects.length = 0;
    }

    fx.pool?.update(dt * speedFactor);
    fx.numbers?.update(dt * speedFactor);

    // Locutor anuncia a fúria do gorila
    if (sim.gorilla.enraged !== wasEnraged.current) {
      wasEnraged.current = sim.gorilla.enraged;
      if (sim.gorilla.enraged) audioManager.playVoice("sudden_death");
    }

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
      // Horda/ondas: só o gorila caindo encerra — reforços estão a caminho
      if (sim.mode !== "classic" && winner === "gorilla") winner = null;
      if (winner && !ending.current) {
        ending.current = { winner, t: 0 };
        sim.running = winner === "men"; // homens comemoram? não — congela IA do lado morto
        // Kill cam: zoom no ponto do golpe final
        if (winner === "men" && sim.gorilla.body) {
          const p = sim.gorilla.body.translation();
          fx.killcam = { x: p.x, y: p.y, z: p.z };
        } else {
          fx.killcam = { x: sim.lastDeathX, y: 1, z: sim.lastDeathZ };
        }
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
          fx.killcam = null;
          // Locutor encerra a batalha
          if (sim.mode !== "classic") audioManager.playVoice("game_over");
          else if (w === "men") audioManager.playVoice("you_win");
          else
            audioManager.playVoice(
              sim.gorilla.hp >= sim.gorilla.maxHp * 0.95
                ? "flawless_victory"
                : "winner",
            );
          store.finish(w, {
            winner: w,
            mode: sim.mode,
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
            waves: sim.wave,
            namesSeed: sim.namesSeed,
            fun: {
              totalFlight: Math.round(sim.totalFlight),
              maxFlight: Math.round(sim.maxFlight * 10) / 10,
              maxFlightIndex: sim.maxFlightIndex,
              firstFleeIndex: sim.firstFleeIndex,
              firstFleeAt: Math.round(sim.firstFleeAt),
            },
          });
        }
      }
    }

    // Sincroniza HUD a ~5 Hz
    syncTimer.current -= delta;
    if (syncTimer.current <= 0) {
      syncTimer.current = 0.2;

      // Legenda do homem seguido pela câmera
      let followedLabel: string | null = null;
      let followedNecro: string | null = null;
      if (store.cameraMode === "man" && sim.followIndex >= 0) {
        const id = manIdentity(sim.followIndex, sim.namesSeed);
        if (sim.state[sim.followIndex] === EntityState.Dead) {
          followedNecro = `✝ ${id.name} — ${id.necro}`;
        } else {
          followedLabel = `${id.name}, ${id.age} — ${id.phrase}`;
        }
      }

      store.syncRuntime({
        aliveMen: sim.aliveCount,
        deadMen: sim.deadCount,
        gorillaHp: Math.max(0, Math.round(sim.gorilla.hp)),
        gorillaMaxHp: sim.gorilla.maxHp,
        elapsed: sim.time,
        fps: Math.round(fpsEma.current),
        entityCount:
          sim.count + 1 + (fx.pool?.activeCount ?? 0) + activeProjectiles(sim),
        followedLabel,
        followedNecro,
      });
    }
  });

  return null;
}
