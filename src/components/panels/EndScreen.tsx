"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSimulationStore } from "@/store/simulationStore";
import { formatTime } from "@/utils/random";

export function EndScreen() {
  const results = useSimulationStore((s) => s.results);
  const reset = useSimulationStore((s) => s.reset);
  const [copied, setCopied] = useState(false);

  if (!results) return null;

  const gorillaWon = results.winner === "gorilla";
  const title = gorillaWon ? "🏆 Vitória do Gorila" : "🏆 Vitória dos Homens";

  const shareText = [
    `🦍 Gorilla Simulator`,
    gorillaWon
      ? `O gorila venceu ${results.initialMen} ${results.initialMen === 1 ? "homem" : "homens"}!`
      : `${results.initialMen} homens derrotaram o gorila!`,
    `⏱️ ${formatTime(results.durationSec)} · 💀 ${results.deaths} mortes · 🧍 ${results.survivors} sobreviventes`,
    `🦍 HP restante: ${results.gorillaHpLeft.toLocaleString("pt-BR")}/${results.gorillaMaxHp.toLocaleString("pt-BR")}`,
    `Quantos homens você acha que precisa?`,
  ].join("\n");

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Gorilla Simulator", text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* usuário cancelou o share */
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 16, delay: 0.15 }}
        className="relative w-full max-w-md rounded-3xl border border-white/12 bg-zinc-950/90 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.7)]"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.35 }}
          className="mb-2 text-center text-6xl"
        >
          {gorillaWon ? "🦍" : "🧍"}
        </motion.div>

        <h2 className="text-center font-display text-3xl text-amber-100">
          {title}
        </h2>
        <p className="mt-1 text-center text-sm text-zinc-400">
          {gorillaWon
            ? "A natureza segue invicta."
            : "A união fez a força (e muitas baixas)."}
        </p>

        <Separator className="my-5 bg-white/10" />

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Tempo de batalha" value={formatTime(results.durationSec)} />
          <Stat label="Homens no início" value={results.initialMen} />
          <Stat label="Sobreviventes" value={results.survivors} />
          <Stat label="Mortes" value={results.deaths} />
          <Stat
            label="Golpes (homens)"
            value={results.menHits.toLocaleString("pt-BR")}
          />
          <Stat
            label="Golpes (gorila)"
            value={results.gorillaHits.toLocaleString("pt-BR")}
          />
          <Stat
            label="Dano dos homens"
            value={results.menDamage.toLocaleString("pt-BR")}
          />
          <Stat
            label="Dano do gorila"
            value={results.gorillaDamage.toLocaleString("pt-BR")}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            onClick={reset}
            className="h-11 bg-gradient-to-r from-orange-500 to-red-600 font-bold text-white hover:from-orange-400 hover:to-red-500"
          >
            Nova simulação
          </Button>
          <Button
            variant="outline"
            onClick={share}
            className="border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            {copied ? "✅ Copiado!" : "📤 Compartilhar resultado"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="font-mono text-lg font-bold text-zinc-100">{value}</p>
    </div>
  );
}
