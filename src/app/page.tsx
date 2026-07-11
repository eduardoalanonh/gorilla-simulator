"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useSimulationStore } from "@/store/simulationStore";
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
