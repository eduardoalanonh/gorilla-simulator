"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  ARENA_PRESETS,
  GORILLA_MODIFIERS,
  MEN_MODIFIERS,
} from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import type { BattleMode } from "@/types/simulation";
import { StartScreen } from "@/components/panels/StartScreen";
import { ControlPanel } from "@/components/panels/ControlPanel";
import { HUD } from "@/components/panels/HUD";
import { EndScreen } from "@/components/panels/EndScreen";

const GameCanvas = dynamic(
  () => import("@/components/game/GameCanvas").then((m) => m.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <span className="animate-pulse text-6xl">🦍</span>
          <p className="text-sm text-zinc-400">Preparando a arena…</p>
        </div>
      </div>
    ),
  },
);

export default function Home() {
  const phase = useSimulationStore((s) => s.phase);

  // Link compartilhável: ?h=250&op=mma&go=oozaru&ar=luacheia&md=horde
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length === 0) return;
    const st = useSimulationStore.getState();

    const h = parseInt(params.get("h") ?? "", 10);
    if (h >= 1 && h <= 1000) st.setMenCount(h);
    const op = params.get("op");
    if (op && MEN_MODIFIERS.some((m) => m.id === op)) st.setMenModifier(op);
    const go = params.get("go");
    if (go && GORILLA_MODIFIERS.some((m) => m.id === go))
      st.setGorillaModifier(go);
    const ar = params.get("ar");
    if (ar && ARENA_PRESETS.some((p) => p.id === ar)) st.setArena(ar);
    const md = params.get("md");
    if (md === "classic" || md === "horde" || md === "waves")
      st.setBattleMode(md as BattleMode);
  }, []);

  return (
    <main className="fixed inset-0 select-none">
      <GameCanvas />

      <AnimatePresence>
        {phase === "intro" && (
          <motion.div
            key="start"
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5 }}
          >
            <StartScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {phase !== "intro" && (
        <>
          <HUD />
          <ControlPanel />
        </>
      )}

      <AnimatePresence>
        {phase === "ended" && <EndScreen key="end" />}
      </AnimatePresence>
    </main>
  );
}
