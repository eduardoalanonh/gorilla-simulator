/**
 * Grid espacial simples (hash de células) para consultas de vizinhança O(1).
 * Reconstruída a cada frame — barata para até 1000 entidades.
 */
export class SpatialHash {
  private cells = new Map<number, number[]>();
  readonly cellSize: number;

  constructor(cellSize = 2) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cz: number) {
    return (cx + 512) * 2048 + (cz + 512);
  }

  clear() {
    this.cells.clear();
  }

  insert(index: number, x: number, z: number) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const k = this.key(cx, cz);
    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    cell.push(index);
  }

  /** Itera índices em células que cobrem o raio dado. */
  forEachInRadius(
    x: number,
    z: number,
    radius: number,
    fn: (index: number) => void,
  ) {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize);
    const maxZ = Math.floor((z + radius) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const cell = this.cells.get(this.key(cx, cz));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) fn(cell[i]);
      }
    }
  }

  /** Conta entidades na célula (densidade local aproximada). */
  cellCount(x: number, z: number) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return this.cells.get(this.key(cx, cz))?.length ?? 0;
  }
}
