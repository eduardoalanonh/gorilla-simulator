"use client";

import { motion } from "framer-motion";
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

  const hpFrac = gorillaMaxHp > 0 ? gorillaHp / gorillaMaxHp : 0;

  return (
    <>
      {/* Barra de vida do gorila — topo centro */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pointer-events-none fixed left-1/2 top-4 z-30 w-[min(420px,42vw)] -translate-x-1/2"
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

      {/* Stats — topo esquerda */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="pointer-events-none fixed left-4 top-4 z-30 flex flex-col gap-1.5"
      >
        <StatChip label="Vivos" value={aliveMen} accent="text-sky-300" />
        <StatChip label="Mortos" value={deadMen} accent="text-red-400" />
        <StatChip label="Tempo" value={formatTime(elapsed)} accent="text-amber-200" />
        <StatChip label="FPS" value={fps} accent={fps < 30 ? "text-red-400" : "text-emerald-300"} />
        <StatChip label="Entidades" value={entityCount} accent="text-zinc-300" />
      </motion.div>

      {/* Modos de câmera — canto inferior esquerdo */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-4 left-4 z-30 flex gap-1 rounded-xl border border-white/10 bg-black/55 p-1 backdrop-blur-md"
      >
        {CAMERA_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setCameraMode(m.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              cameraMode === m.id
                ? "bg-orange-500/30 text-orange-200"
                : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
            )}
          >
            📷 {m.label}
          </button>
        ))}
      </motion.div>

      {phase === "ready" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="pointer-events-none fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-xs text-zinc-300 backdrop-blur"
        >
          Arraste para orbitar · scroll para zoom · clique em{" "}
          <span className="font-semibold text-orange-300">Start Simulation</span>
        </motion.p>
      )}
    </>
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
    <div className="flex min-w-[132px] items-center justify-between rounded-lg border border-white/10 bg-black/55 px-3 py-1.5 backdrop-blur-md">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <span className={cn("font-mono text-sm font-bold", accent)}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </span>
    </div>
  );
}
