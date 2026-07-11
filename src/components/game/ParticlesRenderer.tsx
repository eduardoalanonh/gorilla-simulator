"use client";

import { useEffect, useMemo } from "react";
import { ParticlePool } from "@/systems/particles";
import { fx } from "@/systems/fx";

/** Monta a pool única de partículas na cena e registra no canal fx. */
export function ParticlesRenderer() {
  const pool = useMemo(() => new ParticlePool(), []);

  useEffect(() => {
    fx.pool = pool;
    return () => {
      if (fx.pool === pool) fx.pool = null;
    };
  }, [pool]);

  return <primitive object={pool.mesh} />;
}
