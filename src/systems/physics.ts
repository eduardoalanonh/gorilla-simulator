import type Rapier from "@dimforge/rapier3d-compat";
import type { World } from "@dimforge/rapier3d-compat";
import { PHYSICS } from "@/constants/config";
import type { Simulation } from "./simulation";
import type { SpawnPoint } from "./spawn";

type RapierModule = typeof Rapier;

const IDENTITY_ROT = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Object pool de rigid bodies: corpos são criados uma única vez (lazy)
 * e reutilizados/desativados entre resets — nunca destruídos.
 */
export function spawnMen(
  world: World,
  rapier: RapierModule,
  sim: Simulation,
  points: SpawnPoint[],
) {
  const r = PHYSICS.manRadius;
  for (let i = 0; i < sim.capacity; i++) {
    const active = i < points.length;
    let body = sim.bodies[i];

    if (!body && active) {
      const desc = rapier.RigidBodyDesc.dynamic()
        .setTranslation(points[i].x, r, points[i].z)
        .setLinearDamping(PHYSICS.manDamping)
        .setAngularDamping(1.2)
        .enabledRotations(false, false, false);
      body = world.createRigidBody(desc);
      const colDesc = rapier.ColliderDesc.ball(r)
        .setMass(sim.manStats.weightKg)
        .setFriction(0.55)
        .setRestitution(0.05);
      world.createCollider(colDesc, body);
      sim.bodies[i] = body;
    }
    if (!body) continue;

    body.setEnabled(active);
    if (!active) {
      // Estaciona corpos fora de uso bem abaixo da arena (fora do debug view)
      body.setTranslation({ x: 0, y: -80, z: 0 }, false);
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    }
    if (active) {
      body.setEnabledRotations(false, false, false, false);
      body.setRotation(IDENTITY_ROT, false);
      body.setTranslation({ x: points[i].x, y: r, z: points[i].z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      body.setLinearDamping(PHYSICS.manDamping);
      sim.posX[i] = points[i].x;
      sim.posY[i] = r;
      sim.posZ[i] = points[i].z;
      sim.facing[i] = Math.atan2(-points[i].x, -points[i].z);
    }
  }
}

export function spawnGorilla(world: World, rapier: RapierModule, sim: Simulation) {
  const r = PHYSICS.gorillaRadius;
  let body = sim.gorilla.body;
  if (!body) {
    const desc = rapier.RigidBodyDesc.dynamic()
      .setTranslation(0, r, 0)
      .setLinearDamping(PHYSICS.gorillaDamping)
      .enabledRotations(false, false, false)
      .setCcdEnabled(true);
    body = world.createRigidBody(desc);
    const colDesc = rapier.ColliderDesc.ball(r)
      .setMass(sim.gorillaStats.weightKg * 3)
      .setFriction(0.8)
      .setRestitution(0.02);
    world.createCollider(colDesc, body);
    sim.gorilla.body = body;
  }
  body.setEnabled(true);
  body.setTranslation({ x: 0, y: r, z: 0 }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, false);
  sim.gorilla.facing = Math.random() * Math.PI * 2;
}

/** Congela um cadáver assentado (economia de física). */
export function freezeCorpse(sim: Simulation, i: number) {
  const body = sim.bodies[i];
  if (!body) return;
  body.setEnabled(false);
  sim.settled[i] = 1;
}
