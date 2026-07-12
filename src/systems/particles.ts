import * as THREE from "three";
import { FX } from "@/constants/config";
import type { EffectEvent } from "@/types/simulation";

const _mat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _color = new THREE.Color();

interface SpawnOptions {
  count: number;
  speed: number;
  up: number;
  spread: number;
  size: number;
  sizeVar?: number;
  life: number;
  gravity: number;
  color: number;
  colorJitter?: number;
}

/**
 * Pool única de partículas via InstancedMesh — poeira, detritos e impactos.
 * Ring buffer: partículas mais antigas são recicladas.
 */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private readonly capacity = FX.maxParticles;
  private cursor = 0;
  activeCount = 0;

  private px = new Float32Array(this.capacity);
  private py = new Float32Array(this.capacity);
  private pz = new Float32Array(this.capacity);
  private vx = new Float32Array(this.capacity);
  private vy = new Float32Array(this.capacity);
  private vz = new Float32Array(this.capacity);
  private life = new Float32Array(this.capacity);
  private maxLife = new Float32Array(this.capacity);
  private size = new Float32Array(this.capacity);
  private grav = new Float32Array(this.capacity);

  constructor() {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    _mat.makeScale(0, 0, 0);
    for (let i = 0; i < this.capacity; i++) this.mesh.setMatrixAt(i, _mat);
    // count sobe conforme slots são realmente usados (high-water mark);
    // garante que lixo de GPU em slots nunca escritos jamais renderize
    this.mesh.count = 0;
  }

  spawn(x: number, y: number, z: number, o: SpawnOptions) {
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * o.spread;
      this.px[i] = x + Math.cos(a) * r;
      this.py[i] = y + Math.random() * 0.15;
      this.pz[i] = z + Math.sin(a) * r;

      const sp = o.speed * (0.4 + Math.random() * 0.9);
      const va = Math.random() * Math.PI * 2;
      this.vx[i] = Math.cos(va) * sp;
      this.vz[i] = Math.sin(va) * sp;
      this.vy[i] = o.up * (0.5 + Math.random() * 0.8);

      this.life[i] = this.maxLife[i] = o.life * (0.6 + Math.random() * 0.7);
      this.size[i] = o.size * (1 + (Math.random() - 0.5) * (o.sizeVar ?? 0.6));
      this.grav[i] = o.gravity;

      _color.setHex(o.color);
      const j = (o.colorJitter ?? 0.12) * (Math.random() - 0.5);
      _color.offsetHSL(0, 0, j);
      this.mesh.setColorAt(i, _color);

      // Escreve a matriz já no spawn — o slot pode entrar no draw range
      // neste mesmo frame
      _pos.set(this.px[i], this.py[i], this.pz[i]);
      _scale.setScalar(0.001);
      _mat.compose(_pos, _quat, _scale);
      this.mesh.setMatrixAt(i, _mat);

      if (i + 1 > this.mesh.count) this.mesh.count = i + 1;
      if (this.life[i] > 0) this.activeCount++;
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    if (dt <= 0) return;
    let active = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        _mat.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _mat);
        continue;
      }
      active++;

      this.vy[i] -= 9.8 * this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      // Quica suave no chão
      if (this.py[i] < 0.04 && this.vy[i] < 0) {
        this.py[i] = 0.04;
        this.vy[i] *= -0.25;
        this.vx[i] *= 0.6;
        this.vz[i] *= 0.6;
      }

      // Cresce rápido, encolhe até sumir
      const t = 1 - this.life[i] / this.maxLife[i];
      const s =
        this.size[i] * (t < 0.15 ? t / 0.15 : 1 - ((t - 0.15) / 0.85) * 0.95);

      _pos.set(this.px[i], this.py[i], this.pz[i]);
      _scale.setScalar(Math.max(s, 0.001));
      _mat.compose(_pos, _quat, _scale);
      this.mesh.setMatrixAt(i, _mat);
    }
    this.activeCount = active;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /* ------- receitas ------- */

  dustPuff(x: number, y: number, z: number, power = 1) {
    this.spawn(x, y, z, {
      count: Math.round(2 + power * 2),
      speed: 0.7 * power,
      up: 0.8,
      spread: 0.3,
      size: 0.22 * power,
      life: 0.8,
      gravity: -0.06, // poeira sobe de leve
      color: FX.dustColor,
    });
  }

  impactBurst(x: number, y: number, z: number, power = 1) {
    this.spawn(x, y, z, {
      count: Math.round(6 + power * 5),
      speed: 3 * power,
      up: 3.2 * power,
      spread: 0.25,
      size: 0.14,
      life: 0.7,
      gravity: 0.9,
      color: FX.impactColor,
    });
    this.dustPuff(x, Math.max(0.1, y - 0.4), z, power * 1.4);
  }

  debrisBurst(x: number, y: number, z: number, power = 1) {
    this.spawn(x, y, z, {
      count: Math.round(10 + power * 8),
      speed: 4.5 * power,
      up: 4.5 * power,
      spread: 0.6,
      size: 0.12,
      life: 1.1,
      gravity: 1.1,
      color: FX.debrisColor,
    });
  }

  groundRing(x: number, z: number, power = 1) {
    const n = Math.round(14 + power * 10);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      this.spawn(x + Math.cos(a) * 1.6, 0.15, z + Math.sin(a) * 1.6, {
        count: 1,
        speed: 2.4 * power,
        up: 1.6 * power,
        spread: 0.1,
        size: 0.24,
        life: 0.9,
        gravity: 0.35,
        color: FX.dustColor,
      });
    }
  }

  handleEvent(e: EffectEvent) {
    switch (e.type) {
      case "punch":
        this.spawn(e.x, e.y, e.z, {
          count: 3,
          speed: 1.4,
          up: 1.2,
          spread: 0.15,
          size: 0.09,
          life: 0.4,
          gravity: 0.4,
          color: 0xf5e6c4,
        });
        break;
      case "impact":
        this.impactBurst(e.x, e.y, e.z, e.power);
        break;
      case "slam":
        this.debrisBurst(e.x, 0.3, e.z, e.power);
        this.groundRing(e.x, e.z, e.power);
        break;
      case "death":
        this.dustPuff(e.x, 0.3, e.z, 1.2);
        break;
      case "land":
        this.dustPuff(e.x, 0.15, e.z, Math.min(e.power, 1.6));
        break;
      case "roar":
        this.groundRing(e.x, e.z, 1.4);
        break;
      case "gorillaStep":
        this.dustPuff(e.x, 0.12, e.z, 0.9);
        break;
      case "lightning":
        // Coluna de luz + faíscas no chão
        for (let k = 0; k < 16; k++) {
          this.spawn(e.x, 0.4 + k * 0.8, e.z, {
            count: 1,
            speed: 0.2,
            up: 0,
            spread: 0.15,
            size: 0.34,
            life: 0.35,
            gravity: 0,
            color: 0xcfe4ff,
            colorJitter: 0.05,
          });
        }
        this.groundRing(e.x, e.z, 1.6);
        this.debrisBurst(e.x, 0.3, e.z, 1.2);
        break;
      case "cowLand":
        this.debrisBurst(e.x, 0.3, e.z, 1.6);
        this.groundRing(e.x, e.z, 1.8);
        break;
      case "gorillaDie":
        this.debrisBurst(e.x, 0.4, e.z, 2);
        this.groundRing(e.x, e.z, 2.2);
        break;
      default:
        break;
    }
  }
}
