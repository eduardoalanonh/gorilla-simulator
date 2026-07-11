import { AI, PHYSICS } from "@/constants/config";
import { EntityState } from "@/types/simulation";
import { freezeCorpse } from "./physics";
import { gorillaHitMan, manAttack } from "./combat";
import type { Simulation } from "./simulation";
import { dampAngle } from "@/utils/random";

const TWO_PI = Math.PI * 2;

/** Distância (do centro do gorila) em que um homem consegue golpear. */
export function manAttackDistance(sim: Simulation) {
  return PHYSICS.gorillaRadius + sim.manStats.attackRange;
}

/** Distância (do centro do gorila) em que o gorila alcança um homem. */
export function gorillaAttackDistance(sim: Simulation) {
  return sim.gorillaStats.attackRange + PHYSICS.manRadius;
}

/* ------------------------------------------------------------------ */
/* Homens                                                              */
/* ------------------------------------------------------------------ */

export function updateMen(sim: Simulation, dt: number) {
  const g = sim.gorilla;
  const gBody = g.body;
  if (!gBody) return;
  const gPos = gBody.translation();
  const stats = sim.manStats;
  const attackDist = manAttackDistance(sim);
  const gorillaAlive = g.hp > 0;

  for (let i = 0; i < sim.count; i++) {
    const st = sim.state[i];

    // Mortos: anima queda e congela o corpo depois de assentar
    if (st === EntityState.Dead) {
      if (sim.deathT[i] >= 0 && !sim.settled[i]) {
        sim.deathT[i] += dt;
        const speedSq =
          sim.velX[i] ** 2 + sim.velY[i] ** 2 + sim.velZ[i] ** 2;
        if (sim.deathT[i] > AI.corpseSettleTime && speedSq < 0.05) {
          freezeCorpse(sim, i);
        }
      }
      continue;
    }

    if (sim.punchAnim[i] > 0) sim.punchAnim[i] = Math.max(0, sim.punchAnim[i] - dt * 4);
    if (sim.hitFlash[i] > 0) sim.hitFlash[i] = Math.max(0, sim.hitFlash[i] - dt * 3);

    if (!sim.running) {
      sim.state[i] = EntityState.Idle;
      continue;
    }

    sim.cooldown[i] -= dt;
    if (sim.fearTimer[i] > 0) sim.fearTimer[i] -= dt;

    const dx = gPos.x - sim.posX[i];
    const dz = gPos.z - sim.posZ[i];
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;

    // Aterrissagem após ser arremessado
    if (sim.airborne[i]) {
      const grounded =
        sim.posY[i] < PHYSICS.manRadius + 0.12 && Math.abs(sim.velY[i]) < 1;
      if (grounded) {
        sim.airborne[i] = 0;
        const hSpeed = Math.sqrt(sim.velX[i] ** 2 + sim.velZ[i] ** 2);
        if (hSpeed > 3) sim.emit("land", sim.posX[i], 0.1, sim.posZ[i], hSpeed / 8);
        sim.state[i] = EntityState.Recovering;
        if (sim.fearTimer[i] <= 0) sim.fearTimer[i] = 0.4 + Math.random() * 0.5;
      } else {
        sim.state[i] = EntityState.Recovering;
        continue; // voando — física manda
      }
    }

    // Decisões (staggered para performance)
    sim.decideTimer[i] -= dt;
    if (sim.decideTimer[i] <= 0) {
      sim.decideTimer[i] = AI.decisionInterval * (0.7 + Math.random() * 0.6);

      if (!gorillaAlive) {
        sim.state[i] = EntityState.Idle;
      } else if (sim.fearTimer[i] > 0) {
        sim.state[i] = EntityState.Recovering;
      } else if (sim.state[i] === EntityState.Idle) {
        sim.state[i] = EntityState.Searching;
        if (Math.random() < 0.04)
          sim.emit("shout", sim.posX[i], 1.4, sim.posZ[i], 1);
      } else if (dist <= attackDist) {
        sim.state[i] = EntityState.Attacking;
      } else {
        sim.state[i] = EntityState.Running;
        // Ângulo de cerco: desliza lentamente para espalhar em volta do gorila
        const current = Math.atan2(sim.posZ[i] - gPos.z, sim.posX[i] - gPos.x);
        const drift = (Math.random() - 0.5) * AI.manSurroundJitter;
        sim.angleOffset[i] = current + drift;

        // Preso atrás de pedra/muralha? Sem progresso → tenta outro ângulo
        if (sim.lastDist[i] - dist < 0.08) {
          sim.stuckCount[i]++;
          if (sim.stuckCount[i] >= 8) {
            sim.stuckCount[i] = 0;
            sim.angleOffset[i] = Math.random() * TWO_PI;
          }
        } else {
          sim.stuckCount[i] = 0;
        }
        sim.lastDist[i] = dist;
      }
    }

    const state = sim.state[i];
    const body = sim.bodies[i];
    if (!body) continue;

    let vx = 0;
    let vz = 0;
    const speed = stats.moveSpeed * sim.speedVar[i];

    if (state === EntityState.Running || state === EntityState.Searching) {
      // Ponto alvo: posição no anel de cerco ao redor do gorila
      const ringR = PHYSICS.gorillaRadius + stats.attackRange * 0.62;
      const tx = gPos.x + Math.cos(sim.angleOffset[i]) * ringR;
      const tz = gPos.z + Math.sin(sim.angleOffset[i]) * ringR;
      let mx = tx - sim.posX[i];
      let mz = tz - sim.posZ[i];
      const md = Math.sqrt(mx * mx + mz * mz) || 0.001;
      mx /= md;
      mz /= md;
      vx = mx * speed;
      vz = mz * speed;
    } else if (state === EntityState.Attacking) {
      // Segura posição, encara o gorila e golpeia
      vx = dirX * speed * 0.12;
      vz = dirZ * speed * 0.12;
      if (sim.cooldown[i] <= 0 && dist <= attackDist * 1.15 && gorillaAlive) {
        sim.cooldown[i] =
          stats.attackCooldown * (0.85 + Math.random() * 0.35);
        manAttack(sim, i);
      }
    } else if (state === EntityState.Recovering) {
      // Hesitação: recua devagar olhando para o gorila
      if (sim.fearTimer[i] > 0) {
        vx = -dirX * speed * 0.3;
        vz = -dirZ * speed * 0.3;
      } else {
        sim.state[i] = EntityState.Searching;
      }
    }

    // Separação leve dos vizinhos (evita empilhar no mesmo ponto)
    if (state !== EntityState.Idle) {
      let sepX = 0;
      let sepZ = 0;
      let n = 0;
      sim.grid.forEachInRadius(sim.posX[i], sim.posZ[i], 0.75, (j) => {
        if (j === i || n >= 5) return;
        const ox = sim.posX[i] - sim.posX[j];
        const oz = sim.posZ[i] - sim.posZ[j];
        const d2 = ox * ox + oz * oz;
        if (d2 > 0.6 || d2 === 0) return;
        const d = Math.sqrt(d2);
        sepX += (ox / d) * (1 - d / 0.78);
        sepZ += (oz / d) * (1 - d / 0.78);
        n++;
      });
      vx += sepX * 3.2;
      vz += sepZ * 3.2;
    }

    body.setLinvel({ x: vx, y: sim.velY[i], z: vz }, true);

    // Orientação e passada
    const hSpeed = Math.sqrt(vx * vx + vz * vz);
    const targetYaw =
      state === EntityState.Attacking || hSpeed < 0.3
        ? Math.atan2(dirX, dirZ)
        : Math.atan2(vx, vz);
    sim.facing[i] = dampAngle(sim.facing[i], targetYaw, 10, dt);
    sim.gaitPhase[i] = (sim.gaitPhase[i] + hSpeed * dt * 2.4) % TWO_PI;
  }
}

/* ------------------------------------------------------------------ */
/* Gorila                                                              */
/* ------------------------------------------------------------------ */

export function updateGorilla(sim: Simulation, dt: number) {
  const g = sim.gorilla;
  const body = g.body;
  if (!body) return;

  if (g.state === EntityState.Dead) {
    if (g.deathT >= 0) g.deathT += dt;
    body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true);
    return;
  }

  if (g.hp <= 0) {
    g.state = EntityState.Dead;
    g.action = "die";
    g.actionT = 0;
    g.deathT = 0;
    const p = body.translation();
    sim.emit("gorillaDie", p.x, p.y, p.z, 2);
    return;
  }

  if (!sim.running) {
    g.state = EntityState.Idle;
    g.action = "idle";
    return;
  }

  const pos = body.translation();
  const stats = sim.gorillaStats;
  g.attackCooldown = Math.max(g.attackCooldown - dt, -1);
  g.roarCooldown -= dt;
  g.retargetTimer -= dt;

  // Fúria: com pouca vida, ruge na hora e luta mais rápido
  if (!g.enraged && g.hp <= g.maxHp * AI.rageThreshold) {
    g.enraged = true;
    g.roarCooldown = 0;
  }
  const rageCd = g.enraged ? AI.rageCooldownFactor : 1;
  const rageSpeed = g.enraged ? AI.rageSpeedFactor : 1;

  // Retarget: homem mais próximo com bônus para aglomerações
  if (g.retargetTimer <= 0) {
    g.retargetTimer = AI.gorillaRetargetInterval;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < sim.count; i++) {
      if (sim.state[i] === EntityState.Dead) continue;
      const dx = sim.posX[i] - pos.x;
      const dz = sim.posZ[i] - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const density = sim.grid.cellCount(sim.posX[i], sim.posZ[i]);
      const score = dist - density * 1.4;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    g.targetIndex = best;
    if (best >= 0) {
      g.targetX = sim.posX[best];
      g.targetZ = sim.posZ[best];
    }
  }

  // Ação em andamento (swipe / slam / roar)
  if (g.action === "swipe" || g.action === "slam" || g.action === "roar") {
    const prevT = g.actionT;
    g.actionT += dt;
    const isSlam = g.action === "slam";
    const hitTime = isSlam ? 0.38 : 0.24;
    const duration = g.action === "roar" ? 1.7 : isSlam ? 0.85 : 0.6;

    body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true);

    if (g.action !== "roar" && prevT < hitTime && g.actionT >= hitTime) {
      applyGorillaBlow(sim, pos.x, pos.z, isSlam);
    }
    if (g.action === "roar" && prevT < 0.25 && g.actionT >= 0.25) {
      applyRoar(sim, pos.x, pos.z);
    }
    if (g.actionT >= duration) {
      g.action = "idle";
      g.actionT = 0;
      g.state = EntityState.Searching;
    }
    return;
  }

  // Rugido ocasional
  if (g.roarCooldown <= 0 && sim.aliveCount > 0) {
    g.roarCooldown = stats.roarCooldown * (0.8 + Math.random() * 0.8);
    g.action = "roar";
    g.actionT = 0;
    g.state = EntityState.Recovering;
    return;
  }

  if (g.targetIndex < 0) {
    g.state = EntityState.Idle;
    g.action = "idle";
    body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true);
    return;
  }

  const tx = sim.posX[g.targetIndex];
  const tz = sim.posZ[g.targetIndex];
  const dx = tx - pos.x;
  const dz = tz - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
  const attackDist = gorillaAttackDistance(sim);

  // Quantos homens ao alcance? (para escolher entre swipe e slam)
  let inRange = 0;
  sim.grid.forEachInRadius(pos.x, pos.z, attackDist, (j) => {
    if (sim.state[j] === EntityState.Dead) return;
    const ox = sim.posX[j] - pos.x;
    const oz = sim.posZ[j] - pos.z;
    if (ox * ox + oz * oz <= attackDist * attackDist) inRange++;
  });

  if (inRange > 0 && g.attackCooldown <= 0) {
    const slam = inRange >= AI.gorillaSlamThreshold;
    g.action = slam ? "slam" : "swipe";
    g.actionT = 0;
    g.state = EntityState.Attacking;
    g.attackCooldown = stats.attackCooldown * (slam ? 1.5 : 1) * rageCd;
    sim.emit("swipe", pos.x, pos.y, pos.z, slam ? 1.5 : 1);
    return;
  }

  // Persegue o alvo
  if (dist > attackDist * 0.7) {
    g.state = EntityState.Running;
    g.action = "run";
    const speed = stats.moveSpeed * rageSpeed;

    // Sem progresso na perseguição (pedra no caminho) → contorna
    if (g.lastDist - dist < 0.02 * dt * 60) {
      g.stuckTime += dt;
      if (g.stuckTime > 1) {
        g.stuckTime = 0;
        g.avoidTimer = 1.3;
        g.avoidSign = Math.random() < 0.5 ? -1 : 1;
      }
    } else {
      g.stuckTime = Math.max(0, g.stuckTime - dt * 2);
    }
    g.lastDist = dist;

    let mx = dx / dist;
    let mz = dz / dist;
    if (g.avoidTimer > 0) {
      g.avoidTimer -= dt;
      // Mistura direção tangencial para deslizar ao redor do obstáculo
      const tx = -mz * g.avoidSign;
      const tz = mx * g.avoidSign;
      mx = mx * 0.25 + tx * 0.75;
      mz = mz * 0.25 + tz * 0.75;
    }

    body.setLinvel(
      { x: mx * speed, y: body.linvel().y, z: mz * speed },
      true,
    );
    g.facing = dampAngle(g.facing, Math.atan2(dx, dz), 6, dt);
    g.speedRef = speed;

    g.stepTimer -= dt;
    if (g.stepTimer <= 0) {
      g.stepTimer = 0.32;
      sim.emit("gorillaStep", pos.x, 0.1, pos.z, 1);
    }
  } else {
    g.state = EntityState.Searching;
    g.action = "idle";
    g.speedRef = 0;
    body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true);
    g.facing = dampAngle(g.facing, Math.atan2(dx, dz), 8, dt);
  }
}

/** Golpe de área do gorila: dano + knockback em arco (swipe) ou 360° (slam). */
function applyGorillaBlow(sim: Simulation, gx: number, gz: number, slam: boolean) {
  const g = sim.gorilla;
  const range = gorillaAttackDistance(sim) * (slam ? 1.3 : 1.05);
  const fx = Math.sin(g.facing);
  const fz = Math.cos(g.facing);
  const arcCos = slam ? -1.1 : -0.25; // slam = 360°, swipe ≈ 200°
  const maxHits = slam ? 18 : 7; // um golpe só atinge quem está no caminho do braço
  let hits = 0;

  sim.grid.forEachInRadius(gx, gz, range, (j) => {
    if (sim.state[j] === EntityState.Dead || hits >= maxHits) return;
    const ox = sim.posX[j] - gx;
    const oz = sim.posZ[j] - gz;
    const d = Math.sqrt(ox * ox + oz * oz);
    if (d > range || d === 0) return;
    const nx = ox / d;
    const nz = oz / d;
    if (nx * fx + nz * fz < arcCos) return;
    gorillaHitMan(sim, j, nx, nz, slam ? 1.15 : 1);
    hits++;
  });

  sim.emit(slam ? "slam" : "impact", gx, 0.3, gz, slam ? 2 : 1.2);
}

/** Rugido: medo + empurrão leve nos homens próximos. */
function applyRoar(sim: Simulation, gx: number, gz: number) {
  sim.emit("roar", gx, 1.8, gz, 2);
  sim.grid.forEachInRadius(gx, gz, AI.roarFearRadius, (j) => {
    if (sim.state[j] === EntityState.Dead) return;
    const ox = sim.posX[j] - gx;
    const oz = sim.posZ[j] - gz;
    const d = Math.sqrt(ox * ox + oz * oz);
    if (d > AI.roarFearRadius || d === 0) return;
    if (Math.random() < 0.55) {
      sim.fearTimer[j] = 0.8 + Math.random() * 2.2;
      sim.state[j] = EntityState.Recovering;
    }
    const body = sim.bodies[j];
    if (body && d < 6) {
      const k = (1 - d / 6) * 3.2 * sim.manStats.weightKg;
      body.applyImpulse({ x: (ox / d) * k, y: k * 0.35, z: (oz / d) * k }, true);
      sim.airborne[j] = 1;
    }
  });
}

/** Fim de jogo? Retorna o vencedor ou null. */
export function checkWinner(sim: Simulation): "gorilla" | "men" | null {
  if (sim.gorilla.hp <= 0) return "men";
  if (sim.aliveCount <= 0) return "gorilla";
  return null;
}
