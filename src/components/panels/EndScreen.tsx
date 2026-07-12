"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSimulationStore } from "@/store/simulationStore";
import { formatTime } from "@/utils/random";
import { manIdentity } from "@/utils/names";
import { BattleChart } from "./BattleChart";

/** Avaliação da luta pelo próprio monstro (estrelas). */
function monsterReview(gorillaWon: boolean, hpFrac: number) {
  if (!gorillaWon)
    return { stars: "★★★★★", text: "“5 estrelas. Voltaria a lutar.” (não vai voltar)" };
  if (hpFrac > 0.8) return { stars: "★☆☆☆☆", text: "“Muito fácil. Mandem mais.”" };
  if (hpFrac > 0.4) return { stars: "★★★☆☆", text: "“Deu pra suar.”" };
  return { stars: "★★★★☆", text: "“Quase respeitável.”" };
}

export function EndScreen() {
  const results = useSimulationStore((s) => s.results);
  const reset = useSimulationStore((s) => s.reset);
  const guess = useSimulationStore((s) => s.guess);
  const guessRight = useSimulationStore((s) => s.guessRight);
  const guessTotal = useSimulationStore((s) => s.guessTotal);
  const store = useSimulationStore;
  const [copied, setCopied] = useState(false);

  if (!results) return null;

  const gorillaWon = results.winner === "gorilla";
  const horde = results.mode === "horde";
  const waves = results.mode === "waves";
  const title = horde
    ? "🌊 Fim da Horda"
    : waves
      ? `🌀 Caiu na onda ${results.waves}`
      : gorillaWon
        ? "🏆 Vitória do Monstro"
        : "🏆 Vitória dos Homens";

  const review = monsterReview(
    gorillaWon,
    results.gorillaHpLeft / results.gorillaMaxHp,
  );
  const maxFlightId =
    results.fun.maxFlightIndex >= 0
      ? manIdentity(results.fun.maxFlightIndex, results.namesSeed)
      : null;
  const fleeId =
    results.fun.firstFleeIndex >= 0
      ? manIdentity(results.fun.firstFleeIndex, results.namesSeed)
      : null;

  // Link com a configuração atual — quem receber joga a mesma simulação
  const buildShareUrl = () => {
    const st = store.getState();
    const params = new URLSearchParams({
      h: String(st.menCount),
      op: st.menModifierId,
      go: st.gorillaModifierId,
      ar: st.arenaId,
      md: st.battleMode,
    });
    return `${window.location.origin}${window.location.pathname}?${params}`;
  };

  const shareText = [
    `🦍 Gorilla Simulator`,
    horde
      ? `Modo Horda: o monstro derrubou ${results.deaths.toLocaleString("pt-BR")} antes de cair!`
      : waves
        ? `Modo Ondas: o monstro sobreviveu até a onda ${results.waves} (${results.deaths.toLocaleString("pt-BR")} abatidos)!`
        : gorillaWon
          ? `O monstro venceu ${results.initialMen} ${results.initialMen === 1 ? "oponente" : "oponentes"}!`
          : `${results.initialMen} oponentes derrotaram o monstro!`,
    `⏱️ ${formatTime(results.durationSec)} · 💀 ${results.deaths} mortes · 🧍 ${results.survivors} sobreviventes`,
    maxFlightId
      ? `🏅 Maior voo: ${maxFlightId.name}, ${results.fun.maxFlight} m`
      : "",
    `Tenta bater: ${typeof window !== "undefined" ? buildShareUrl() : ""}`,
  ]
    .filter(Boolean)
    .join("\n");

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
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/12 bg-zinc-950/90 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.7)] sm:p-8"
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
          {horde || waves ? (
            <>
              O monstro derrubou{" "}
              <span className="font-bold text-amber-300">
                {results.deaths.toLocaleString("pt-BR")}
              </span>{" "}
              antes de cair.
            </>
          ) : gorillaWon ? (
            "A natureza segue invicta."
          ) : (
            "A união fez a força (e muitas baixas)."
          )}
        </p>

        {/* Avaliação do monstro + palpite */}
        <div className="mt-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-center">
          <p className="text-lg tracking-widest text-amber-300">{review.stars}</p>
          <p className="text-xs italic text-zinc-400">{review.text}</p>
        </div>
        {guess !== null && results.mode === "classic" && (
          <p className="mt-2 text-center text-sm">
            {guess === results.winner ? (
              <span className="text-emerald-300">
                🎯 Você acertou o palpite! ({guessRight}/{guessTotal})
              </span>
            ) : (
              <span className="text-red-300">
                ❌ Errou o palpite ({guessRight}/{guessTotal})
              </span>
            )}
          </p>
        )}

        <Separator className="my-5 bg-white/10" />

        <BattleChart
          history={results.history}
          gorillaMaxHp={results.gorillaMaxHp}
        />

        <Separator className="my-5 bg-white/10" />

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Tempo de batalha" value={formatTime(results.durationSec)} />
          <Stat
            label={waves ? "Ondas sobrevividas" : "Homens no início"}
            value={waves ? results.waves : results.initialMen}
          />
          <Stat label="Sobreviventes" value={results.survivors} />
          <Stat label="Mortes" value={results.deaths} />
          <Stat
            label="Golpes (homens)"
            value={results.menHits.toLocaleString("pt-BR")}
          />
          <Stat
            label="Golpes (monstro)"
            value={results.gorillaHits.toLocaleString("pt-BR")}
          />
          <Stat
            label="Dano dos homens"
            value={results.menDamage.toLocaleString("pt-BR")}
          />
          <Stat
            label="Dano do monstro"
            value={results.gorillaDamage.toLocaleString("pt-BR")}
          />
        </div>

        {/* Estatísticas absurdas */}
        {(results.fun.totalFlight > 0 || fleeId) && (
          <div className="mt-3 space-y-1.5 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-xs text-zinc-300">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Fatos da batalha
            </p>
            {results.fun.totalFlight > 0 && (
              <p>
                ✈️ Distância total voada pelos homens:{" "}
                <b>
                  {results.fun.totalFlight >= 1000
                    ? `${(results.fun.totalFlight / 1000).toFixed(1)} km`
                    : `${results.fun.totalFlight} m`}
                </b>
              </p>
            )}
            {maxFlightId && results.fun.maxFlight > 2 && (
              <p>
                🏅 Maior arremesso: <b>{maxFlightId.name}</b>,{" "}
                {results.fun.maxFlight} m (recorde da arena)
              </p>
            )}
            {fleeId && (
              <p>
                🏃 Primeiro a hesitar: <b>{fleeId.name}</b>, aos{" "}
                {results.fun.firstFleeAt}s — {fleeId.necro.toLowerCase()}
              </p>
            )}
          </div>
        )}

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
