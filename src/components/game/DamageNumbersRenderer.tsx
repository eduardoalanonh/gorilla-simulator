"use client";

import { useEffect, useMemo } from "react";
import { DamageNumberPool } from "@/systems/damageNumbers";
import { fx } from "@/systems/fx";

/** Monta a pool de números de dano na cena e registra no canal fx. */
export function DamageNumbersRenderer() {
  const pool = useMemo(() => new DamageNumberPool(), []);

  useEffect(() => {
    fx.numbers = pool;
    return () => {
      if (fx.numbers === pool) fx.numbers = null;
    };
  }, [pool]);

  return <primitive object={pool.group} />;
}
