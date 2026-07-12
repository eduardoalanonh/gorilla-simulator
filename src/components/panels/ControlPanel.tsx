"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GORILLA_MODIFIERS,
  MEN_MODIFIERS,
  MEN_PRESETS,
  SPEED_OPTIONS,
} from "@/constants/config";
import { useSimulationStore } from "@/store/simulationStore";
import { cn } from "@/lib/utils";

export function ControlPanel() {
  const s = useSimulationStore();
  const running = s.phase === "running";

  return (
    <motion.aside
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className="fixed right-4 top-4 bottom-4 z-30 flex w-[300px] flex-col gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/55 p-5 backdrop-blur-xl"
    >
      <div>
        <h2 className="font-display text-xl text-amber-100">Simulação</h2>
        <p className="text-xs text-zinc-400">Configure e solte o caos</p>
      </div>

      <div className="flex flex-col gap-2">
        {s.phase === "ready" && (
          <Button
            onClick={s.startBattle}
            className="h-11 bg-gradient-to-r from-orange-500 to-red-600 font-bold text-white hover:from-orange-400 hover:to-red-500"
          >
            ▶ Start Simulation
          </Button>
        )}
        {running && (
          <p className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-center text-xs font-semibold text-orange-200">
            ⚔️ Batalha em andamento
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={s.reset}
            className="border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            Reset
          </Button>
          <Button
            variant="outline"
            onClick={s.randomize}
            className="border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            🎲 Randomize
          </Button>
        </div>
      </div>

      <Separator className="bg-white/10" />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-zinc-300">Quantidade de homens</Label>
          <span className="font-mono text-lg font-bold text-sky-300">
            {s.menCount}
          </span>
        </div>
        <Slider
          min={1}
          max={1000}
          step={1}
          value={[s.menCount]}
          onValueChange={(v) => s.setMenCount(Array.isArray(v) ? v[0] : v)}
          disabled={running}
        />
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {MEN_PRESETS.map((n) => (
            <button
              key={n}
              disabled={running}
              onClick={() => s.setMenCount(n)}
              className={cn(
                "rounded-md border px-1 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                s.menCount === n
                  ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-white/10" />

      <div className="space-y-2">
        <Label className="text-zinc-300">Homens</Label>
        <Select
          value={s.menModifierId}
          onValueChange={(v) => v && s.setMenModifier(v)}
          disabled={running}
          items={Object.fromEntries(MEN_MODIFIERS.map((m) => [m.id, m.label]))}
        >
          <SelectTrigger className="w-full border-white/10 bg-white/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEN_MODIFIERS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label className="pt-1 text-zinc-300">Gorila</Label>
        <Select
          value={s.gorillaModifierId}
          onValueChange={(v) => v && s.setGorillaModifier(v)}
          disabled={running}
          items={Object.fromEntries(
            GORILLA_MODIFIERS.map((m) => [m.id, m.label]),
          )}
        >
          <SelectTrigger className="w-full border-white/10 bg-white/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GORILLA_MODIFIERS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="bg-white/10" />

      <div className="space-y-2">
        <Label className="text-zinc-300">Velocidade</Label>
        <div className="grid grid-cols-5 gap-1">
          {SPEED_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => s.setSpeed(v)}
              className={cn(
                "rounded-md border py-1.5 text-xs font-semibold transition-colors",
                s.speed === v
                  ? "border-orange-400/70 bg-orange-500/25 text-orange-200"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10",
              )}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-white/10" />

      <div className="space-y-1">
        <CheckRow
          id="horde"
          label="🌊 Modo Horda (infinito)"
          checked={s.hordeMode}
          onChange={s.toggleHorde}
          disabled={running}
        />
        <p className="pl-6 text-[11px] leading-snug text-zinc-500">
          Reforços não param de chegar pela borda. Score = quantos o gorila
          derruba antes de cair.
        </p>
      </div>

      <Separator className="bg-white/10" />

      <div className="grid grid-cols-1 gap-2.5">
        <CheckRow
          id="healthbars"
          label="Mostrar barras de vida"
          checked={s.showHealthBars}
          onChange={() => s.toggle("showHealthBars")}
        />
        <CheckRow
          id="slowmo"
          label="Slow Motion"
          checked={s.slowMotion}
          onChange={() => s.toggle("slowMotion")}
        />
        <CheckRow
          id="debug"
          label="Modo Debug"
          checked={s.debugMode}
          onChange={() => s.toggle("debugMode")}
        />
        <CheckRow
          id="colliders"
          label="Mostrar colisores"
          checked={s.showColliders}
          onChange={() => s.toggle("showColliders")}
        />
        <CheckRow
          id="postfx"
          label="Pós-processamento"
          checked={s.postFx}
          onChange={() => s.toggle("postFx")}
        />
        <CheckRow
          id="mute"
          label="Silenciar áudio"
          checked={s.muted}
          onChange={() => s.toggle("muted")}
        />
      </div>

    </motion.aside>
  );
}

function CheckRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
      <Label
        htmlFor={id}
        className={cn(
          "cursor-pointer text-sm text-zinc-300",
          disabled && "opacity-50",
        )}
      >
        {label}
      </Label>
    </div>
  );
}
