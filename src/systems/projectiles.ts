import type { Simulation } from "./simulation";

/**
 * Avança os projéteis em voo (arco balístico até o gorila) e aplica o
 * dano na chegada. Tiros errados caem ao lado, levantando poeira.
 */
export function updateProjectiles(sim: Simulation, dt: number) {
  const g = sim.gorilla;
  const body = g.body;
  if (!body) return;
  const target = body.translation();
  const targetY = target.y + sim.gorillaRadius * 0.35;

  for (const p of sim.projectiles) {
    if (!p.active) continue;
    p.t += dt / p.flight;

    const tx = target.x + p.missX;
    const tz = target.z + p.missZ;
    const k = Math.min(p.t, 1);
    p.px = p.x;
    p.py = p.y;
    p.pz = p.z;
    p.x = p.sx + (tx - p.sx) * k;
    p.z = p.sz + (tz - p.sz) * k;
    p.y = p.sy + (targetY - p.sy) * k + Math.sin(Math.PI * k) * p.arc;

    if (p.t < 1) continue;
    p.active = false;

    const missed = p.missX !== 0 || p.missZ !== 0;
    if (!missed && g.hp > 0) {
      g.hp = Math.max(0, g.hp - p.dmg);
      sim.menHits++;
      sim.menDamage += p.dmg;
      sim.emit(p.kind === "fire" ? "impact" : "punch", p.x, p.y, p.z, p.crit ? 1.4 : 0.9);
      if (p.crit || Math.random() < 0.3) {
        sim.emit("damage", p.x, p.y + 0.6, p.z, p.dmg, {
          crit: p.crit,
          source: "men",
        });
      }
    } else {
      // Errou: poeira (ou fogo) no chão ao lado
      sim.emit(p.kind === "fire" ? "impact" : "land", p.x, 0.15, p.z, 0.6);
    }
  }
}

/** Quantos projéteis estão no ar (HUD de entidades). */
export function activeProjectiles(sim: Simulation) {
  let n = 0;
  for (const p of sim.projectiles) if (p.active) n++;
  return n;
}
