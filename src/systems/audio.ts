import * as THREE from "three";
import type { EffectEvent } from "@/types/simulation";

/**
 * Todos os sons são sintetizados proceduralmente via WebAudio —
 * zero assets externos. Reprodução espacial com THREE.PositionalAudio.
 */

type SoundName =
  | "punch"
  | "impact"
  | "slam"
  | "whoosh"
  | "thud"
  | "shout"
  | "roar"
  | "gorillaStep"
  | "gorillaDie";

const POOL_SIZE = 18;

function makeBuffer(
  ctx: AudioContext,
  duration: number,
  fill: (t: number, i: number, sr: number) => number,
) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buffer = ctx.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = fill(i / sr, i, sr);
  // normaliza
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0) for (let i = 0; i < len; i++) data[i] = (data[i] / peak) * 0.9;
  return buffer;
}

/** Filtro one-pole aplicado in-place (lowpass simples). */
function lowpass(buffer: AudioBuffer, alpha: number) {
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    prev = prev + alpha * (data[i] - prev);
    data[i] = prev;
  }
}

const env = (t: number, attack: number, decay: number) =>
  t < attack ? t / attack : Math.exp(-(t - attack) / decay);

export class AudioManager {
  private listener: THREE.AudioListener | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private pool: THREE.PositionalAudio[] = [];
  private poolCursor = 0;
  private lastPlayed = new Map<SoundName, number>();
  private ambient: THREE.Audio | null = null;
  private rumble: THREE.Audio | null = null;
  private group: THREE.Group | null = null;
  ready = false;

  init(listener: THREE.AudioListener, parent: THREE.Object3D) {
    if (this.ready) return;
    this.listener = listener;
    const ctx = listener.context;

    this.synthesize(ctx);

    this.group = new THREE.Group();
    parent.add(this.group);
    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = new THREE.PositionalAudio(listener);
      audio.setRefDistance(9);
      audio.setRolloffFactor(1.4);
      audio.setDistanceModel("exponential");
      this.group.add(audio);
      this.pool.push(audio);
    }

    // Ambiente: vento constante + rumor de multidão
    const wind = makeBuffer(ctx, 4, () => Math.random() * 2 - 1);
    lowpass(wind, 0.035);
    this.ambient = new THREE.Audio(listener);
    this.ambient.setBuffer(wind);
    this.ambient.setLoop(true);
    this.ambient.setVolume(0.16);
    this.ambient.play();

    const crowd = makeBuffer(ctx, 3.5, (t) => {
      const mod = 0.6 + 0.4 * Math.sin(t * 2.1) * Math.sin(t * 5.7);
      return (Math.random() * 2 - 1) * mod;
    });
    lowpass(crowd, 0.09);
    this.rumble = new THREE.Audio(listener);
    this.rumble.setBuffer(crowd);
    this.rumble.setLoop(true);
    this.rumble.setVolume(0);
    this.rumble.play();

    this.ready = true;
  }

  private synthesize(ctx: AudioContext) {
    const b = this.buffers;

    b.set(
      "punch",
      makeBuffer(ctx, 0.14, (t) => {
        const thump = Math.sin(2 * Math.PI * (85 - t * 220) * t) * env(t, 0.004, 0.03);
        const snap = (Math.random() * 2 - 1) * env(t, 0.002, 0.02);
        return thump * 0.9 + snap * 0.6;
      }),
    );

    const impact = makeBuffer(ctx, 0.32, (t) => {
      const boom = Math.sin(2 * Math.PI * (70 - t * 90) * t) * env(t, 0.006, 0.09);
      const dirt = (Math.random() * 2 - 1) * env(t, 0.003, 0.06);
      return boom + dirt * 0.7;
    });
    lowpass(impact, 0.4);
    b.set("impact", impact);

    const slam = makeBuffer(ctx, 0.6, (t) => {
      const boom = Math.sin(2 * Math.PI * (52 - t * 40) * t) * env(t, 0.008, 0.18);
      const rubble = (Math.random() * 2 - 1) * env(t, 0.004, 0.12);
      return boom * 1.2 + rubble * 0.6;
    });
    lowpass(slam, 0.3);
    b.set("slam", slam);

    const whoosh = makeBuffer(ctx, 0.28, (t) => {
      const hump = Math.sin((Math.PI * t) / 0.28) ** 2;
      return (Math.random() * 2 - 1) * hump;
    });
    lowpass(whoosh, 0.18);
    b.set("whoosh", whoosh);

    const thud = makeBuffer(ctx, 0.18, (t) => {
      const body = Math.sin(2 * Math.PI * 74 * t) * env(t, 0.005, 0.05);
      return body + (Math.random() * 2 - 1) * env(t, 0.002, 0.03) * 0.5;
    });
    lowpass(thud, 0.35);
    b.set("thud", thud);

    b.set(
      "shout",
      makeBuffer(ctx, 0.3, (t) => {
        const f = 190 + Math.sin(t * 30) * 25;
        const saw = 2 * ((t * f) % 1) - 1;
        return Math.tanh(saw * 1.6) * env(t, 0.03, 0.09);
      }),
    );

    // Rugido: glide grave + vibrato + growl AM + distorção
    const roar = makeBuffer(ctx, 1.6, (t) => {
      const glide = 150 - t * 55;
      const vib = 1 + 0.035 * Math.sin(2 * Math.PI * 5.5 * t);
      const f = glide * vib;
      let s = 0;
      for (let k = 1; k <= 7; k++)
        s += Math.sin(2 * Math.PI * f * k * t + k * 1.7) / k;
      const growl = 0.55 + 0.45 * Math.sin(2 * Math.PI * 26 * t);
      const breath = (Math.random() * 2 - 1) * 0.35;
      const e = env(t, 0.09, 0.55) * (t < 1.45 ? 1 : (1.6 - t) / 0.15);
      return Math.tanh((s * growl + breath) * 2.6) * e;
    });
    lowpass(roar, 0.25);
    b.set("roar", roar);

    const step = makeBuffer(ctx, 0.16, (t) => {
      const boom = Math.sin(2 * Math.PI * 58 * t) * env(t, 0.004, 0.045);
      return boom + (Math.random() * 2 - 1) * env(t, 0.002, 0.02) * 0.3;
    });
    lowpass(step, 0.3);
    b.set("gorillaStep", step);

    const die = makeBuffer(ctx, 1.2, (t) => {
      const fall = Math.sin(2 * Math.PI * (48 - t * 20) * t) * env(t, 0.01, 0.4);
      const roarOut =
        Math.tanh(Math.sin(2 * Math.PI * (90 - t * 40) * t) * 2) *
        env(t, 0.05, 0.3) *
        (0.5 + 0.5 * Math.sin(2 * Math.PI * 20 * t));
      return fall + roarOut * 0.7;
    });
    lowpass(die, 0.28);
    b.set("gorillaDie", die);
  }

  private play(
    name: SoundName,
    x: number,
    y: number,
    z: number,
    volume = 1,
    rateVar = 0.15,
    minInterval = 0.05,
  ) {
    if (!this.ready || !this.listener) return;
    const now = this.listener.context.currentTime;
    const last = this.lastPlayed.get(name) ?? -10;
    if (now - last < minInterval) return;
    this.lastPlayed.set(name, now);

    const node = this.pool[this.poolCursor];
    this.poolCursor = (this.poolCursor + 1) % POOL_SIZE;
    if (node.isPlaying) node.stop();
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    node.setBuffer(buffer);
    node.position.set(x, y, z);
    node.setVolume(volume);
    node.setPlaybackRate(1 + (Math.random() - 0.5) * rateVar * 2);
    node.play();
  }

  handleEvent(e: EffectEvent) {
    switch (e.type) {
      case "punch":
        this.play("punch", e.x, e.y, e.z, 0.5 * e.power, 0.2, 0.06);
        break;
      case "impact":
        this.play("impact", e.x, e.y, e.z, 0.85 * e.power, 0.15, 0.07);
        break;
      case "swipe":
        this.play("whoosh", e.x, e.y, e.z, 0.7, 0.2, 0.1);
        break;
      case "slam":
        this.play("slam", e.x, e.y, e.z, 1, 0.1, 0.2);
        break;
      case "death":
        this.play("thud", e.x, e.y, e.z, 0.55, 0.25, 0.08);
        break;
      case "land":
        this.play("thud", e.x, e.y, e.z, 0.4 * e.power, 0.3, 0.1);
        break;
      case "roar":
        this.play("roar", e.x, e.y, e.z, 1.4, 0.06, 1);
        break;
      case "shout":
        this.play("shout", e.x, e.y, e.z, 0.35, 0.4, 0.25);
        break;
      case "gorillaStep":
        this.play("gorillaStep", e.x, e.y, e.z, 0.5, 0.15, 0.12);
        break;
      case "gorillaDie":
        this.play("gorillaDie", e.x, e.y, e.z, 1.3, 0.05, 1);
        break;
    }
  }

  /** Rumor da multidão proporcional à quantidade de homens em movimento. */
  setCrowdIntensity(intensity: number) {
    this.rumble?.setVolume(Math.min(0.5, intensity * 0.5));
  }

  setMuted(muted: boolean) {
    this.listener?.setMasterVolume(muted ? 0 : 1);
  }

  resume() {
    const ctx = this.listener?.context;
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }
}

export const audioManager = new AudioManager();
