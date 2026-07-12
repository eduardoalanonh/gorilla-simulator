import type { FighterStats } from "@/constants/config";
import { AI } from "@/constants/config";
import { EntityState } from "@/types/simulation";
import type { Simulation } from "./simulation";

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

/** Dano base ± variância, com chance de crítico. */
export function rollDamage(stats: FighterStats): DamageRoll {
  const crit = Math.random() < stats.critChance;
  let amount =
    stats.attackDamage + (Math.random() * 2 - 1) * stats.attackVariance;
  if (crit) amount *= stats.critMultiplier;
  return { amount: Math.max(1, amount), crit };
}

/** Um homem golpeia o gorila. */
export function manAttack(sim: Simulation, i: number) {
  const roll = rollDamage(sim.manStats);
  sim.gorilla.hp = Math.max(0, sim.gorilla.hp - roll.amount);
  sim.menHits++;
  sim.menDamage += roll.amount;
  sim.punchAnim[i] = 1;

  const g = sim.gorilla;
  if (g.body) {
    sim.emit(
      "punch",
      sim.posX[i],
      sim.posY[i] + 0.9,
      sim.posZ[i],
      roll.crit ? 1.6 : 1,
    );
    // Críticos dos homens também mostram o número subindo
    if (roll.crit) {
      const p = g.body.translation();
      sim.emit("damage", p.x, p.y + 1.6, p.z, roll.amount, {
        crit: true,
        source: "men",
      });
    }
  }
}

/** O gorila acerta o homem `i` com knockback exagerado (estilo cartoon). */
export function gorillaHitMan(
  sim: Simulation,
  i: number,
  dirX: number,
  dirZ: number,
  powerScale = 1,
) {
  const roll = rollDamage(sim.gorillaStats);
  const dmg = roll.amount * powerScale;
  sim.hp[i] -= dmg;
  sim.hitFlash[i] = 1;
  sim.gorilla.hitsDealt++;
  sim.gorilla.damageDealt += dmg;

  const body = sim.bodies[i];
  if (body) {
    const kb =
      sim.gorillaStats.knockbackForce *
      (roll.crit ? 1.5 : 1) *
      powerScale *
      (0.8 + Math.random() * 0.5);
    const mass = sim.manStats.weightKg;
    const up = kb * (0.45 + Math.random() * 0.35);
    body.applyImpulse(
      { x: dirX * kb * mass * 0.42, y: up * mass * 0.42, z: dirZ * kb * mass * 0.42 },
      true,
    );
    sim.airborne[i] = 1;
  }

  sim.emit("impact", sim.posX[i], sim.posY[i] + 0.5, sim.posZ[i], roll.crit ? 1.5 : 1, {
    crit: roll.crit,
  });
  // Número de dano flutuante (sempre no crítico, às vezes no golpe normal)
  if (roll.crit || Math.random() < 0.45) {
    sim.emit("damage", sim.posX[i], sim.posY[i] + 1.3, sim.posZ[i], dmg, {
      crit: roll.crit,
      source: "gorilla",
    });
  }

  if (sim.hp[i] <= 0) killMan(sim, i);
  else if (sim.state[i] !== EntityState.Dead) {
    sim.state[i] = EntityState.Recovering;
    // Sobrevoando a arena aos berros
    if (Math.random() < 0.5) {
      sim.emit("scream", sim.posX[i], sim.posY[i] + 1, sim.posZ[i], 1);
    }
  }
}

export function killMan(sim: Simulation, i: number) {
  if (sim.state[i] === EntityState.Dead) return;
  sim.state[i] = EntityState.Dead;
  sim.deathT[i] = 0;
  sim.deathYaw[i] = sim.facing[i] + (Math.random() - 0.5) * 1.2;
  sim.aliveCount--;
  sim.deadCount++;
  sim.recentDeaths.push({ x: sim.posX[i], z: sim.posZ[i], t: sim.time });

  const body = sim.bodies[i];
  if (body) {
    // Ragdoll simplificado: libera rotações e deixa a física tombar o corpo
    body.setEnabledRotations(true, true, true, true);
    body.setLinearDamping(1.6);
    body.setAngvel(
      {
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 6,
      },
      true,
    );
  }
  sim.emit("death", sim.posX[i], sim.posY[i], sim.posZ[i], 1);

  // Pânico: mortes próximas podem fazer vizinhos hesitarem (zumbis não)
  if (sim.manFearless) return;
  const deaths = sim.countRecentDeathsNear(
    sim.posX[i],
    sim.posZ[i],
    AI.hesitationRadius,
    AI.hesitationDeathWindow,
  );
  if (deaths >= AI.hesitationDeathCount) {
    sim.grid.forEachInRadius(sim.posX[i], sim.posZ[i], AI.hesitationRadius, (j) => {
      if (sim.state[j] === EntityState.Dead || sim.fearTimer[j] > 0) return;
      if (Math.random() < AI.hesitationChance * 0.2) {
        sim.fearTimer[j] =
          AI.hesitationDuration[0] +
          Math.random() * (AI.hesitationDuration[1] - AI.hesitationDuration[0]);
        sim.state[j] = EntityState.Recovering;
      }
    });
  }
}
