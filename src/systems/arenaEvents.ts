import { EntityState } from "@/types/simulation";
import { killMan } from "./combat";
import type { Simulation } from "./simulation";

const COW_FALL_HEIGHT = 45;
const COW_LIFETIME = 12;

/**
 * Eventos aleatórios da arena: raios e vacas caindo do céu.
 * Caos imprevisível = clipes engraçados.
 */
export function updateArenaEvents(sim: Simulation, dt: number, enabled: boolean) {
  // Vaca em queda/estacionada continua mesmo com eventos desligados
  updateCow(sim, dt);

  if (!enabled || !sim.running || sim.aliveCount < 5) return;

  sim.eventTimer -= dt;
  if (sim.eventTimer > 0) return;
  sim.eventTimer = 14 + Math.random() * 14;

  if (Math.random() < 0.5 || sim.cow.active) {
    strikeLightning(sim);
  } else {
    dropCow(sim);
  }
}

/** Raio cai em cima de um azarado aleatório. */
function strikeLightning(sim: Simulation) {
  const i = sim.randomAliveIndex();
  if (i < 0) return;
  const x = sim.posX[i];
  const z = sim.posZ[i];
  sim.emit("lightning", x, 0, z, 1);
  aoeDamage(sim, x, z, 3, 130, 300);
}

/** Uma vaca. Do céu. Sem explicação. */
function dropCow(sim: Simulation) {
  const g = sim.gorilla.body;
  if (!g) return;
  // Mira perto do bolo de gente (posição do gorila com desvio)
  const p = g.translation();
  const a = Math.random() * Math.PI * 2;
  const r = 3 + Math.random() * 6;
  sim.cow.active = true;
  sim.cow.landed = false;
  sim.cow.x = p.x + Math.cos(a) * r;
  sim.cow.z = p.z + Math.sin(a) * r;
  sim.cow.y = COW_FALL_HEIGHT;
  sim.cow.vy = 0;
  sim.cow.timer = 0;
  sim.emit("roar", sim.cow.x, 20, sim.cow.z, 0.6, { cry: "moo" });
}

function updateCow(sim: Simulation, dt: number) {
  const cow = sim.cow;
  if (!cow.active) return;

  if (!cow.landed) {
    cow.vy -= 22 * dt;
    cow.y += cow.vy * dt;
    if (cow.y <= 0.55) {
      cow.y = 0.55;
      cow.landed = true;
      cow.timer = COW_LIFETIME;
      sim.emit("cowLand", cow.x, 0.3, cow.z, 1);
      aoeDamage(sim, cow.x, cow.z, 2.6, 999, 250);
    }
  } else {
    cow.timer -= dt;
    if (cow.timer <= 0) cow.active = false;
  }
}

/** Dano em área de evento: homens e gorila (reduzido) dentro do raio. */
function aoeDamage(
  sim: Simulation,
  x: number,
  z: number,
  radius: number,
  menDmg: number,
  gorillaDmg: number,
) {
  const r2 = radius * radius;
  for (let i = 0; i < sim.count; i++) {
    if (sim.state[i] === EntityState.Dead) continue;
    const dx = sim.posX[i] - x;
    const dz = sim.posZ[i] - z;
    if (dx * dx + dz * dz > r2) continue;
    sim.hp[i] -= menDmg;
    const body = sim.bodies[i];
    if (body) {
      const d = Math.sqrt(dx * dx + dz * dz) || 0.5;
      const k = sim.manStats.weightKg * 3.5;
      body.applyImpulse({ x: (dx / d) * k, y: k * 0.6, z: (dz / d) * k }, true);
      sim.airborne[i] = 1;
    }
    if (sim.hp[i] <= 0) killMan(sim, i);
  }

  const g = sim.gorilla.body;
  if (g && sim.gorilla.hp > 0) {
    const gp = g.translation();
    const dx = gp.x - x;
    const dz = gp.z - z;
    if (dx * dx + dz * dz < (radius + sim.gorillaRadius) ** 2) {
      sim.gorilla.hp = Math.max(0, sim.gorilla.hp - gorillaDmg);
      sim.emit("damage", gp.x, gp.y + sim.gorillaRadius, gp.z, gorillaDmg, {
        crit: true,
        source: "men",
      });
    }
  }
}
