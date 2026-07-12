"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KILL_STREAKS } from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { formatTime } from "@/utils/random";
import type { CameraMode } from "@/types/simulation";
import { cn } from "@/lib/utils";

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: "free", label: "Livre" },
  { id: "gorilla", label: "Gorila" },
  { id: "man", label: "Homem" },
  { id: "aerial", label: "Aérea" },
];

export function HUD() {
  const aliveMen = useSimulationStore((s) => s.aliveMen);
  const deadMen = useSimulationStore((s) => s.deadMen);
  const gorillaHp = useSimulationStore((s) => s.gorillaHp);
  const gorillaMaxHp = useSimulationStore((s) => s.gorillaMaxHp);
  const elapsed = useSimulationStore((s) => s.elapsed);
  const fps = useSimulationStore((s) => s.fps);
  const entityCount = useSimulationStore((s) => s.entityCount);
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const setCameraMode = useSimulationStore((s) => s.setCameraMode);
  const phase = useSimulationStore((s) => s.phase);
  const hordeMode = useSimulationStore((s) => s.hordeMode);

  const hpFrac = gorillaMaxHp > 0 ? gorillaHp / gorillaMaxHp : 0;

  return (
    <>
      {/* Barra de vida do gorila — topo centro (full-width no mobile) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pointer-events-none fixed z-30 max-md:inset-x-2 max-md:top-2 md:left-1/2 md:top-4 md:w-[min(420px,42vw)] md:-translate-x-1/2"
      >
        <div className="mb-1 flex items-center justify-between text-xs font-semibold">
          <span className={hpFrac <= 0.25 && gorillaHp > 0 ? "text-red-400" : "text-amber-200"}>
            {hpFrac <= 0.25 && gorillaHp > 0 ? "😡 Gorila ENFURECIDO" : "🦍 Gorila"}
          </span>
          <span className="font-mono text-zinc-300">
            {gorillaHp.toLocaleString("pt-BR")} / {gorillaMaxHp.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full border border-white/15 bg-black/60">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              hpFrac > 0.5
                ? "bg-emerald-500"
                : hpFrac > 0.2
                  ? "bg-amber-500"
                  : "bg-red-600",
            )}
            style={{ width: `${hpFrac * 100}%` }}
          />
        </div>
      </motion.div>

      {/* Stats — topo esquerda (abaixo da barra de HP no mobile) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pointer-events-none fixed z-30 flex flex-col max-md:left-2 max-md:top-14 max-md:gap-1 md:left-4 md:top-4 md:gap-1.5"
      >
        <StatChip label="Vivos" value={aliveMen} accent="text-sky-300" />
        <StatChip
          label={hordeMode ? "Score 🦍" : "Mortos"}
          value={deadMen}
          accent={hordeMode ? "text-amber-300" : "text-red-400"}
        />
        <StatChip label="Tempo" value={formatTime(elapsed)} accent="text-amber-200" />
        <StatChip label="FPS" value={fps} accent={fps < 30 ? "text-red-400" : "text-emerald-300"} />
        <StatChip label="Entidades" value={entityCount} accent="text-zinc-300" />
      </motion.div>

      {/* Modos de câmera — canto inferior esquerdo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "fixed z-30 flex gap-1 rounded-xl border border-white/10 bg-black/55 p-1 backdrop-blur-md max-md:left-2 md:bottom-4 md:left-4",
          // No mobile, sobe para não colidir com o botão Start flutuante
          phase === "ready"
            ? "max-md:bottom-[max(4.25rem,calc(env(safe-area-inset-bottom)+3.75rem))]"
            : "max-md:bottom-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        {CAMERA_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setCameraMode(m.id)}
            className={cn(
              "rounded-lg font-medium transition-colors max-md:px-2 max-md:py-1 max-md:text-[10px] md:px-3 md:py-1.5 md:text-xs",
              cameraMode === m.id
                ? "bg-orange-500/30 text-orange-200"
                : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
            )}
          >
            <span className="max-md:hidden">📷 </span>
            {m.label}
          </button>
        ))}
      </motion.div>

      <KillStreakPopup />

      {phase === "ready" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="pointer-events-none fixed bottom-5 left-1/2 z-30 hidden -translate-x-1/2 rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-xs text-zinc-300 backdrop-blur md:block"
        >
          Arraste para orbitar · scroll para zoom · clique em{" "}
          <span className="font-semibold text-orange-300">Start Simulation</span>
        </motion.p>
      )}
    </>
  );
}

function streakLabel(count: number) {
  for (const [min, label] of KILL_STREAKS) if (count >= min) return label;
  return null;
}

/** Popup central de kill streak — some sozinho após ~1.4s. */
function KillStreakPopup() {
  const streak = useSimulationStore((s) => s.streak);
  const [visible, setVisible] = useState<{ label: string; count: number; id: number } | null>(null);

  useEffect(() => {
    if (!streak) return;
    const label = streakLabel(streak.count);
    if (!label) return;
    setVisible({ label, count: streak.count, id: streak.id });
    const t = setTimeout(() => setVisible(null), 1400);
    return () => clearTimeout(t);
  }, [streak]);

  const big = (visible?.count ?? 0) >= 5;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[26%] z-30 -translate-x-1/2">
      <AnimatePresence mode="popLayout">
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 16 }}
            className="flex flex-col items-center"
          >
            <span
              className={cn(
                "font-display tracking-wide",
                big
                  ? "text-4xl sm:text-5xl text-red-400 [text-shadow:0_2px_0_rgba(80,10,10,0.9),0_6px_28px_rgba(255,60,30,0.6)]"
                  : "text-3xl sm:text-4xl text-amber-300 [text-shadow:0_2px_0_rgba(90,50,5,0.9),0_5px_20px_rgba(255,150,40,0.5)]",
              )}
            >
              {visible.label}
            </span>
            <span className="mt-1 rounded-full bg-black/60 px-3 py-0.5 font-mono text-xs font-bold text-zinc-200">
              {visible.count} de uma vez
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/55 backdrop-blur-md max-md:min-w-[104px] max-md:gap-2 max-md:px-2 max-md:py-1 md:min-w-[132px] md:px-3 md:py-1.5">
      <span className="uppercase tracking-wide text-zinc-500 max-md:text-[9px] md:text-[11px]">
        {label}
      </span>
      <span className={cn("font-mono font-bold max-md:text-xs md:text-sm", accent)}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </span>
    </div>
  );
}
