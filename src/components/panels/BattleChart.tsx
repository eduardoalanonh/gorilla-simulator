"use client";

import { useMemo, useState } from "react";
import { CHART_COLORS } from "@/constants/config";
import type { HistorySample } from "@/types/simulation";
import { formatTime } from "@/utils/random";

const W = 320;
const H = 130;
const PAD = { top: 8, right: 8, bottom: 18, left: 8 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

interface Props {
  history: HistorySample[];
  gorillaMaxHp: number;
}

/**
 * A história da batalha: mortes acumuladas × vida do gorila.
 * Ambas normalizadas ao próprio máximo (eixo único, em %).
 */
export function BattleChart({ history, gorillaMaxHp }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => {
    if (history.length < 3) return null;
    const duration = Math.max(history[history.length - 1].t, 0.001);
    const maxDeaths = Math.max(history[history.length - 1].deaths, 1);
    const pts = history.map((s) => ({
      x: PAD.left + (s.t / duration) * PW,
      yDeaths: PAD.top + (1 - s.deaths / maxDeaths) * PH,
      yHp: PAD.top + (1 - s.gorillaHp / gorillaMaxHp) * PH,
      sample: s,
    }));
    const line = (key: "yDeaths" | "yHp") =>
      pts.map((p) => `${p.x.toFixed(1)},${p[key].toFixed(1)}`).join(" ");
    return { pts, duration, maxDeaths, deathsLine: line("yDeaths"), hpLine: line("yHp") };
  }, [history, gorillaMaxHp]);

  if (!data) return null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < data.pts.length; i++) {
      const d = Math.abs(data.pts[i].x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  };

  const h = hover != null ? data.pts[hover] : null;

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          A história da batalha
        </p>
        <div className="flex gap-3 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: CHART_COLORS.deaths }}
            />
            Mortes
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: CHART_COLORS.gorillaHp }}
            />
            Vida do gorila
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Grade discreta: 0 / 50 / 100% */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + f * PH}
            y2={PAD.top + f * PH}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        ))}

        <polyline
          points={data.hpLine}
          fill="none"
          stroke={CHART_COLORS.gorillaHp}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <polyline
          points={data.deathsLine}
          fill="none"
          stroke={CHART_COLORS.deaths}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Crosshair + marcadores no hover */}
        {h && (
          <g>
            <line
              x1={h.x}
              x2={h.x}
              y1={PAD.top}
              y2={PAD.top + PH}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
            />
            <circle cx={h.x} cy={h.yDeaths} r={3.5} fill={CHART_COLORS.deaths} stroke="#0a0a0a" strokeWidth={1.5} />
            <circle cx={h.x} cy={h.yHp} r={3.5} fill={CHART_COLORS.gorillaHp} stroke="#0a0a0a" strokeWidth={1.5} />
          </g>
        )}

        {/* Eixo do tempo */}
        <text x={PAD.left} y={H - 5} fill="#71717a" fontSize={9}>
          0:00
        </text>
        <text x={W - PAD.right} y={H - 5} fill="#71717a" fontSize={9} textAnchor="end">
          {formatTime(data.duration)}
        </text>
      </svg>

      {h && (
        <div
          className="pointer-events-none absolute -top-1 z-10 rounded-md border border-white/10 bg-zinc-900/95 px-2 py-1 text-[11px] leading-tight"
          style={{
            left: `${Math.min(Math.max((h.x / W) * 100, 12), 74)}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-mono text-zinc-400">{formatTime(h.sample.t)}</p>
          <p className="font-mono font-bold" style={{ color: CHART_COLORS.deaths }}>
            {h.sample.deaths.toLocaleString("pt-BR")} mortes
          </p>
          <p className="font-mono font-bold" style={{ color: CHART_COLORS.gorillaHp }}>
            {Math.round(h.sample.gorillaHp).toLocaleString("pt-BR")} HP
          </p>
        </div>
      )}
    </div>
  );
}
