import * as THREE from "three";
import type { EffectEvent } from "@/types/simulation";

const POOL_SIZE = 28;
const CANVAS_W = 192;
const CANVAS_H = 96;

interface NumberSlot {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  ctx: CanvasRenderingContext2D;
  life: number;
  maxLife: number;
  vy: number;
  baseScale: number;
}

/**
 * Números de dano flutuantes (sprites com canvas) — sobem e desaparecem.
 * Críticos ganham destaque: maiores, laranja e com "!".
 */
export class DamageNumberPool {
  readonly group = new THREE.Group();
  private slots: NumberSlot[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d")!;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = 999;
      sprite.visible = false;
      this.group.add(sprite);
      this.slots.push({
        sprite,
        material,
        texture,
        ctx,
        life: 0,
        maxLife: 1,
        vy: 0,
        baseScale: 1,
      });
    }
  }

  spawn(e: EffectEvent) {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_SIZE;

    const crit = !!e.crit;
    const fromMen = e.source === "men";
    const value = Math.round(e.power);
    const text = crit ? `${value}!` : `${value}`;
    const color = fromMen ? "#7fc8ff" : crit ? "#ffb020" : "#f2e9dc";

    const { ctx } = slot;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.font = `800 ${crit ? 66 : 52}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = crit ? 10 : 8;
    ctx.strokeStyle = "rgba(10, 6, 2, 0.9)";
    ctx.strokeText(text, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
    slot.texture.needsUpdate = true;

    slot.sprite.position.set(
      e.x + (Math.random() - 0.5) * 0.5,
      e.y + 0.6,
      e.z + (Math.random() - 0.5) * 0.5,
    );
    slot.maxLife = slot.life = crit ? 1.05 : 0.8;
    slot.vy = 2 + Math.random() * 0.8;
    slot.baseScale = crit ? 2.4 : 1.4;
    slot.sprite.visible = true;
  }

  update(dt: number) {
    if (dt <= 0) return;
    for (const slot of this.slots) {
      if (slot.life <= 0) continue;
      slot.life -= dt;
      if (slot.life <= 0) {
        slot.sprite.visible = false;
        slot.material.opacity = 0;
        continue;
      }
      const t = 1 - slot.life / slot.maxLife;
      slot.sprite.position.y += slot.vy * dt;
      slot.vy *= 1 - 1.6 * dt;
      // Pop de entrada + fade de saída
      const pop = 1 + 0.7 * Math.exp(-t * 9);
      const s = slot.baseScale * pop;
      slot.sprite.scale.set(s * (CANVAS_W / CANVAS_H), s, 1);
      slot.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    }
  }
}
