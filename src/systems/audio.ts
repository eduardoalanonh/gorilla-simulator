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
  | "groan1"
  | "groan2"
  | "scream"
  | "crit"
  | "streak"
  | "beamCharge"
  | "beamFire"
  | "gorillaStep"
  | "gorillaDie";

/** Falas do locutor (arquivos CC0 do Voiceover Pack: Fighter, kenney.nl) */
export type VoiceName =
  | "fight"
  | "combo"
  | "multi_kill"
  | "sudden_death"
  | "survival_mode"
  | "flawless_victory"
  | "winner"
  | "you_win"
  | "game_over"
  | "prepare_yourself";

const VOICE_NAMES: VoiceName[] = [
  "fight",
  "combo",
  "multi_kill",
  "sudden_death",
  "survival_mode",
  "flawless_victory",
  "winner",
  "you_win",
  "game_over",
  "prepare_yourself",
];

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

/** Bandpass biquad (RBJ) — retorna cópia filtrada do sinal. */
function bandpass(data: Float32Array, sr: number, freq: number, q: number) {
  const out = new Float32Array(data.length);
  const w0 = (2 * Math.PI * freq) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** Dá timbre de voz ao sinal somando ressonâncias de formantes ("aah/ugh"). */
function applyFormants(
  buffer: AudioBuffer,
  formants: [freq: number, q: number, amp: number][],
) {
  const data = buffer.getChannelData(0);
  const dry = data.slice();
  data.fill(0);
  for (const [freq, q, amp] of formants) {
    const wet = bandpass(dry, buffer.sampleRate, freq, q);
    for (let i = 0; i < data.length; i++) data[i] += wet[i] * amp;
  }
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i] / peak) * 0.9;
}

const env = (t: number, attack: number, decay: number) =>
  t < attack ? t / attack : Math.exp(-(t - attack) / decay);

/** Faz o fim do loop desvanecer sobre o início (loop sem clique). */
function crossfadeLoop(buffer: AudioBuffer, fadeSec: number) {
  const data = buffer.getChannelData(0);
  const n = Math.min(Math.floor(fadeSec * buffer.sampleRate), data.length >> 1);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    data[data.length - n + i] = data[data.length - n + i] * (1 - t) + data[i] * t;
  }
}

/**
 * Batida de tambor aditiva com queda de pitch e clique de ataque.
 * Escreve com wrap-around para o loop fechar perfeito.
 */
function addDrumHit(
  data: Float32Array,
  sr: number,
  t0: number,
  freq: number,
  amp: number,
  decay: number,
) {
  const len = Math.floor(decay * 5 * sr);
  const start = Math.floor(t0 * sr);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = freq * (1 - 0.25 * Math.min(t / decay, 1));
    phase += (2 * Math.PI * f) / sr;
    const e = env(t, 0.003, decay);
    const click = i < sr * 0.008 ? (Math.random() * 2 - 1) * 0.35 : 0;
    data[(start + i) % data.length] += (Math.sin(phase) + click) * e * amp;
  }
}

/** Tick de chocalho: ruído curto com highpass grosseiro (diferenciação). */
function addShakerTick(data: Float32Array, sr: number, t0: number, amp: number) {
  const len = Math.floor(0.05 * sr);
  const start = Math.floor(t0 * sr);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    const hp = white - prev;
    prev = white;
    data[(start + i) % data.length] += hp * env(i / sr, 0.002, 0.018) * amp;
  }
}

/**
 * Loop de tambores tribais (2 compassos, 120 BPM). A camada pesada adiciona
 * bumbo de guerra, batidas dobradas e virada de toms no fim do ciclo.
 */
function makeDrumLoop(ctx: AudioContext, heavy: boolean) {
  const duration = 4;
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sr * duration, sr);
  const data = buffer.getChannelData(0);
  const bar = 2;

  for (let b = 0; b < 2; b++) {
    const o = b * bar;
    if (!heavy) {
      // Tresillo: X..X..X. — a base do groove
      for (const t of [0, 0.75, 1.5]) addDrumHit(data, sr, o + t, 58, 1, 0.16);
      for (const t of [0.5, 1.25]) addDrumHit(data, sr, o + t, 84, 0.5, 0.2);
      addDrumHit(data, sr, o + 1.75, 112, 0.4, 0.13);
      for (let s = 0; s < 8; s++) {
        addShakerTick(data, sr, o + s * 0.25, s % 2 === 0 ? 0.22 : 0.13);
      }
    } else {
      // Bumbo de guerra + dobras
      addDrumHit(data, sr, o, 42, 1.25, 0.35);
      for (const t of [0.375, 1.125]) addDrumHit(data, sr, o + t, 58, 0.7, 0.14);
      addDrumHit(data, sr, o + 1, 70, 0.8, 0.24);
    }
  }
  if (heavy) {
    // Virada de toms em semicolcheias fechando o ciclo
    for (let k = 0; k < 8; k++) {
      addDrumHit(data, sr, 3.5 + k * 0.0625, 95 - k * 4, 0.3 + k * 0.06, 0.09);
    }
  }

  // Saturação leve para dar corpo
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.tanh(data[i] * 1.4);
    peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i] / peak) * 0.85;
  return buffer;
}

/** Grilos de savana: vozes com padrões de trinado e pausas diferentes. */
function makeCricketLoop(ctx: AudioContext) {
  const duration = 8;
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sr * duration, sr);
  const data = buffer.getChannelData(0);

  const voices = [
    { freq: 4300, trill: 38, chirps: 4, gap: 0.9, offset: 0, amp: 0.5 },
    { freq: 3700, trill: 31, chirps: 3, gap: 1.4, offset: 0.55, amp: 0.4 },
    { freq: 5100, trill: 44, chirps: 5, gap: 1.1, offset: 1.2, amp: 0.3 },
  ];

  for (const v of voices) {
    let t0 = v.offset;
    while (t0 < duration) {
      for (let c = 0; c < v.chirps; c++) {
        const chirpStart = t0 + c * 0.085;
        const len = Math.floor(0.055 * sr);
        const start = Math.floor(chirpStart * sr);
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const am = 0.5 - 0.5 * Math.cos(2 * Math.PI * v.trill * t);
          const e = Math.sin((Math.PI * i) / len);
          data[(start + i) % data.length] +=
            Math.sin(2 * Math.PI * v.freq * t) * am * e * v.amp;
        }
      }
      t0 += v.chirps * 0.085 + v.gap;
    }
  }

  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i] / peak) * 0.7;
  return buffer;
}

export class AudioManager {
  private listener: THREE.AudioListener | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private pool: THREE.PositionalAudio[] = [];
  private poolCursor = 0;
  private lastPlayed = new Map<SoundName, number>();
  private ambient: THREE.Audio | null = null;
  private rumble: THREE.Audio | null = null;
  private crickets: THREE.Audio | null = null;
  private drums: THREE.Audio | null = null;
  private drumsHeavy: THREE.Audio | null = null;
  /** Música real de batalha ("Five Armies" — Kevin MacLeod, CC-BY 4.0) */
  private music: THREE.Audio | null = null;
  /** Locutor (vozes CC0 da Kenney) */
  private announcer: THREE.Audio | null = null;
  private voiceBuffers = new Map<VoiceName, AudioBuffer>();
  private lastVoiceAt = -10;
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

    // Ambiência em camadas: vento com rajadas + grilos de savana (menu),
    // tambores tribais em duas intensidades (batalha)
    const wind = makeBuffer(ctx, 8, (t) => {
      const gust = 0.55 + 0.45 * Math.sin((2 * Math.PI * 2 * t) / 8 + 1.3);
      return (Math.random() * 2 - 1) * gust;
    });
    lowpass(wind, 0.03);
    crossfadeLoop(wind, 0.3);
    this.ambient = this.makeLoop(listener, wind, 0.12);

    this.crickets = this.makeLoop(listener, makeCricketLoop(ctx), 0.16);
    this.drums = this.makeLoop(listener, makeDrumLoop(ctx, false), 0);
    this.drumsHeavy = this.makeLoop(listener, makeDrumLoop(ctx, true), 0);

    const crowd = makeBuffer(ctx, 3.5, (t) => {
      const mod = 0.6 + 0.4 * Math.sin(t * 2.1) * Math.sin(t * 5.7);
      return (Math.random() * 2 - 1) * mod;
    });
    lowpass(crowd, 0.09);
    crossfadeLoop(crowd, 0.25);
    this.rumble = this.makeLoop(listener, crowd, 0);

    // Assets externos carregam em segundo plano (o synth cobre enquanto isso)
    this.loadExternalAssets(listener);

    this.ready = true;
  }

  private loadExternalAssets(listener: THREE.AudioListener) {
    const loader = new THREE.AudioLoader();

    this.music = new THREE.Audio(listener);
    this.announcer = new THREE.Audio(listener);
    this.announcer.setVolume(0.95);

    loader.load("/audio/music/battle.mp3", (buffer) => {
      if (!this.music) return;
      this.music.setBuffer(buffer);
      this.music.setLoop(true);
      this.music.setVolume(0);
      this.music.play();
    });

    for (const name of VOICE_NAMES) {
      loader.load(`/audio/voice/${name}.ogg`, (buffer) => {
        this.voiceBuffers.set(name, buffer);
      });
    }
  }

  /** Locutor de arena: "FIGHT!", "MULTI KILL", "SUDDEN DEATH"… */
  playVoice(name: VoiceName, minInterval = 1.1) {
    if (!this.listener || !this.announcer) return;
    const buffer = this.voiceBuffers.get(name);
    if (!buffer) return;
    const now = this.listener.context.currentTime;
    if (now - this.lastVoiceAt < minInterval) return;
    this.lastVoiceAt = now;
    if (this.announcer.isPlaying) this.announcer.stop();
    this.announcer.setBuffer(buffer);
    this.announcer.play();
  }

  private makeLoop(
    listener: THREE.AudioListener,
    buffer: AudioBuffer,
    volume: number,
  ) {
    const audio = new THREE.Audio(listener);
    audio.setBuffer(buffer);
    audio.setLoop(true);
    audio.setVolume(volume);
    audio.play();
    return audio;
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

    // Gemidos cômicos de morte: "uôôh" grave e "agh!" curto
    const groan1 = makeBuffer(ctx, 0.42, (t) => {
      const f = (128 - t * 110) * (1 + 0.06 * Math.sin(2 * Math.PI * 7 * t));
      const saw = 2 * ((t * f) % 1) - 1;
      const breath = (Math.random() * 2 - 1) * 0.14;
      return Math.tanh(saw * 1.8 + breath) * env(t, 0.025, 0.16);
    });
    applyFormants(groan1, [
      [420, 4, 1],
      [850, 5, 0.75],
      [1350, 6, 0.3],
    ]);
    b.set("groan1", groan1);

    const groan2 = makeBuffer(ctx, 0.3, (t) => {
      const f = (185 - t * 160) * (1 + 0.05 * Math.sin(2 * Math.PI * 9 * t));
      const saw = 2 * ((t * f) % 1) - 1;
      return Math.tanh(saw * 2) * env(t, 0.015, 0.1);
    });
    applyFormants(groan2, [
      [560, 4, 1],
      [1050, 5, 0.7],
    ]);
    b.set("groan2", groan2);

    // Grito cômico de quem sai voando: "aaaah!" descendo
    const scream = makeBuffer(ctx, 0.85, (t) => {
      const f = (470 - t * 240) * (1 + 0.08 * Math.sin(2 * Math.PI * 9.5 * t));
      const saw = 2 * ((t * f) % 1) - 1;
      const e = env(t, 0.04, 0.4) * (t < 0.7 ? 1 : (0.85 - t) / 0.15);
      return Math.tanh(saw * 1.6) * Math.max(e, 0);
    });
    applyFormants(scream, [
      [720, 5, 1],
      [1150, 5, 0.7],
      [2400, 8, 0.25],
    ]);
    b.set("scream", scream);

    // "POW" de golpe crítico: soco profundo + ping curto
    b.set(
      "crit",
      makeBuffer(ctx, 0.3, (t) => {
        const boom = Math.sin(2 * Math.PI * (58 - t * 60) * t) * env(t, 0.004, 0.09);
        const ping =
          Math.sin(2 * Math.PI * (760 - t * 240) * t) * env(t, 0.002, 0.045) * 0.4;
        const snap = (Math.random() * 2 - 1) * env(t, 0.001, 0.02) * 0.5;
        return boom * 1.2 + ping + snap;
      }),
    );

    // Rajada de energia: carga subindo + disparo devastador
    b.set(
      "beamCharge",
      makeBuffer(ctx, 0.85, (t) => {
        const k = t / 0.85;
        const f = 160 + k * k * 900;
        const trem = 0.65 + 0.35 * Math.sin(2 * Math.PI * (8 + k * 26) * t);
        const body = Math.sin(2 * Math.PI * f * t) * trem;
        const shimmer = Math.sin(2 * Math.PI * f * 2.01 * t) * 0.3 * k;
        return (body + shimmer) * (0.25 + k * 0.75);
      }),
    );

    const beamFire = makeBuffer(ctx, 1.1, (t) => {
      const e = env(t, 0.015, 0.4) * (t < 0.9 ? 1 : Math.max(0, (1.1 - t) / 0.2));
      const sub = Math.sin(2 * Math.PI * (52 - t * 14) * t) * 1.1;
      const saw = (2 * ((t * 210) % 1) - 1) * 0.5;
      const hiss = (Math.random() * 2 - 1) * 0.8;
      return Math.tanh((sub + saw + hiss) * 1.6) * e;
    });
    lowpass(beamFire, 0.28);
    b.set("beamFire", beamFire);

    // Sting de kill streak: dois toms rápidos + ping metálico
    b.set(
      "streak",
      makeBuffer(ctx, 0.5, (t) => {
        const tom1 = Math.sin(2 * Math.PI * 96 * t) * env(t, 0.003, 0.07);
        const t2 = Math.max(0, t - 0.11);
        const tom2 =
          t >= 0.11 ? Math.sin(2 * Math.PI * 72 * t2) * env(t2, 0.003, 0.1) : 0;
        const t3 = Math.max(0, t - 0.22);
        const ping =
          t >= 0.22
            ? Math.sin(2 * Math.PI * 1180 * t3) *
              Math.sin(2 * Math.PI * 1770 * t3) *
              env(t3, 0.002, 0.12) *
              0.5
            : 0;
        return tom1 + tom2 * 1.1 + ping;
      }),
    );

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
    fixedRate?: number,
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
    node.setPlaybackRate(fixedRate ?? 1 + (Math.random() - 0.5) * rateVar * 2);
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
        this.play(
          Math.random() < 0.5 ? "groan1" : "groan2",
          e.x,
          e.y + 1,
          e.z,
          0.6,
          0.35,
          0.07,
        );
        this.play("thud", e.x, e.y, e.z, 0.3, 0.25, 0.12);
        break;
      case "scream":
        this.play("scream", e.x, e.y, e.z, 0.42, 0.3, 0.18);
        break;
      case "damage":
        if (e.crit)
          this.play("crit", e.x, e.y, e.z, e.source === "men" ? 0.5 : 0.9, 0.12, 0.1);
        break;
      case "killstreak":
        // Mais abates = sting mais grave e imponente
        this.play(
          "streak",
          e.x,
          e.y,
          e.z,
          Math.min(1.2, 0.7 + e.power * 0.06),
          0,
          0.3,
          Math.max(0.72, 1.05 - e.power * 0.035),
        );
        break;
      case "land":
        this.play("thud", e.x, e.y, e.z, 0.4 * e.power, 0.3, 0.1);
        break;
      case "roar":
        this.play("roar", e.x, e.y, e.z, 1.4, 0.06, 1);
        break;
      case "beamCharge":
        this.play("beamCharge", e.x, e.y, e.z, 0.9, 0.05, 0.5);
        break;
      case "beam":
        this.play("beamFire", e.x, e.y, e.z, 1.4, 0.05, 0.5);
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

  /**
   * Mixagem da ambiência (chamada a cada frame): grilos no aguardo,
   * tambores tribais crescendo com a intensidade da batalha.
   */
  updateAmbience(running: boolean, intensity: number) {
    if (!this.ready) return;
    // Com a música carregada, os tambores sintetizados viram camada de apoio
    const hasMusic = !!this.music?.buffer;
    const targets: [THREE.Audio | null, number][] = [
      [this.crickets, running ? 0.05 : 0.16],
      [this.music, running ? 0.34 + intensity * 0.16 : 0],
      [
        this.drums,
        running ? (hasMusic ? 0.1 : 0.28) + intensity * (hasMusic ? 0.12 : 0.35) : 0,
      ],
      [
        this.drumsHeavy,
        running ? Math.max(0, intensity - 0.3) * (hasMusic ? 0.35 : 0.75) : 0,
      ],
      [this.rumble, running ? Math.min(0.22, intensity * 0.25) : 0],
    ];
    for (const [audio, target] of targets) {
      if (!audio) continue;
      const current = audio.getVolume();
      audio.setVolume(current + (target - current) * 0.045);
    }

    // A percussão acelera conforme a batalha esquenta (as duas camadas
    // recebem o mesmo rate para permanecerem em sincronia)
    if (this.drums && this.drumsHeavy) {
      const targetRate = running ? 1 + intensity * 0.22 : 1;
      const rate =
        this.drums.playbackRate + (targetRate - this.drums.playbackRate) * 0.02;
      this.drums.setPlaybackRate(rate);
      this.drumsHeavy.setPlaybackRate(rate);
    }
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
