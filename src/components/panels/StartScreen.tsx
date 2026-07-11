"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MEN_PRESETS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { audioManager } from "@/systems/audio";
import { cn } from "@/lib/utils";

export function StartScreen() {
  const enterArena = useSimulationStore((s) => s.enterArena);
  const menCount = useSimulationStore((s) => s.menCount);
  const setMenCount = useSimulationStore((s) => s.setMenCount);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
      {/* Vinheta para leitura sobre a cena 3D */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(5,4,10,0.88)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="relative flex flex-col items-center px-6 text-center"
      >
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 12, delay: 0.15 }}
          className="mb-2 text-7xl drop-shadow-[0_0_28px_rgba(255,140,60,0.45)]"
        >
          🦍
        </motion.span>

        <h1 className="font-display text-6xl tracking-tight text-amber-100 sm:text-8xl [text-shadow:0_2px_0_rgba(120,50,10,0.9),0_6px_24px_rgba(255,120,40,0.45)]">
          GORILLA SIMULATOR
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-4 max-w-xl text-balance text-base text-zinc-300 sm:text-lg"
        >
          O debate acabou. <span className="text-orange-300 font-semibold">1 gorila</span> contra{" "}
          <span className="text-sky-300 font-semibold">{menCount} {menCount === 1 ? "homem" : "homens"}</span>.
          Quantos são necessários? Descubra na arena.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {MEN_PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => setMenCount(n)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                menCount === n
                  ? "border-orange-400 bg-orange-500/25 text-orange-200 shadow-[0_0_16px_rgba(255,140,60,0.35)]"
                  : "border-white/15 bg-black/40 text-zinc-300 hover:border-white/40 hover:bg-white/10",
              )}
            >
              {n}
            </button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-10"
        >
          <Button
            size="lg"
            onClick={() => {
              audioManager.resume();
              enterArena();
            }}
            className="h-14 rounded-full bg-gradient-to-r from-orange-500 to-red-600 px-12 text-lg font-bold text-white shadow-[0_8px_40px_rgba(255,90,30,0.45)] transition-transform hover:scale-105 hover:from-orange-400 hover:to-red-500"
          >
            Entrar na Arena
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1.4 }}
          className="mt-6 text-xs text-zinc-500"
        >
          100% no navegador · física em tempo real · até 1000 homens
        </motion.p>
      </motion.div>
    </div>
  );
}
