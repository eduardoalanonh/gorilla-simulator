import * as THREE from "three";
import { mulberry32 } from "./random";

/** Textura de terra batida gerada em canvas — zero assets externos. */
export function makeDirtTexture(size = 1024, seed = 42) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(seed);

  ctx.fillStyle = "#6b5238";
  ctx.fillRect(0, 0, size, size);

  // Manchas grandes de tons de terra
  for (let i = 0; i < 260; i++) {
    const r = 20 + rng() * 90;
    const x = rng() * size;
    const y = rng() * size;
    const shade = 0.75 + rng() * 0.55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = `rgba(${Math.round(104 * shade)}, ${Math.round(80 * shade)}, ${Math.round(54 * shade)}, ${0.16 + rng() * 0.2})`;
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Centro pisoteado (mais escuro e liso)
  const center = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.04,
    size / 2,
    size / 2,
    size * 0.4,
  );
  center.addColorStop(0, "rgba(48, 36, 24, 0.5)");
  center.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, size, size);

  // Grão fino
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // Pedrinhas
  for (let i = 0; i < 900; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 0.8 + rng() * 2.4;
    const l = 60 + rng() * 70;
    ctx.fillStyle = `rgba(${l + 25}, ${l + 8}, ${l - 8}, ${0.35 + rng() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
