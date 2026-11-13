export const CELL = 3;     
export const W = 40;
export const H = 30;

export const ROOMS = [
  [2, 22, 9, 27],    
  [10, 24, 16, 25],  
  [17, 20, 26, 27], 
  [21, 14, 22, 19],  
  [14, 8, 28, 13],   
  [8, 10, 13, 11],  
  [2, 4, 7, 15],   
  [3, 2, 29, 3],    
  [30, 1, 37, 8],    
  [29, 10, 34, 11],  
  [30, 12, 37, 20], 
  [35, 9, 36, 11],  
];


export const CRATES = [
  [20, 22], [24, 22], [24, 26], [19, 26],
  [18, 9], [18, 12], [24, 9], [24, 12], [21, 10], [21, 11],
  [32, 15], [35, 15], [33, 18], [36, 18],
  [4, 8], [5, 12],
];

export const PLAYER_START = { cx: 4, cy: 25, yaw: -Math.PI / 2 };
export const EXTRACTION = { cx: 36, cy: 2 };


export const ZOMBIE_SPAWNS = [
  { cx: 14, cy: 24 },
  { cx: 22, cy: 22 }, { cx: 25, cy: 25 }, { cx: 18, cy: 26 }, { cx: 24, cy: 21, fast: true },
  { cx: 21, cy: 16 },
  { cx: 16, cy: 9 }, { cx: 26, cy: 12 }, { cx: 20, cy: 12 }, { cx: 25, cy: 9 }, { cx: 27, cy: 10, fast: true },
  { cx: 10, cy: 10 },
  { cx: 4, cy: 6 }, { cx: 5, cy: 10 }, { cx: 3, cy: 14 }, { cx: 6, cy: 14, fast: true },
  { cx: 10, cy: 2 }, { cx: 18, cy: 3 }, { cx: 26, cy: 2 },
  { cx: 31, cy: 14 }, { cx: 34, cy: 19 }, { cx: 36, cy: 13, fast: true }, { cx: 32, cy: 19 },
  { cx: 32, cy: 10 },
  { cx: 33, cy: 6 }, { cx: 35, cy: 6 }, { cx: 32, cy: 3 },
];


export const PICKUP_SPAWNS = [
  { cx: 7, cy: 26 }, { cx: 15, cy: 25 }, { cx: 25, cy: 26 }, { cx: 22, cy: 17 },
  { cx: 15, cy: 12 }, { cx: 27, cy: 9 }, { cx: 3, cy: 12 }, { cx: 14, cy: 3 },
  { cx: 24, cy: 2 }, { cx: 31, cy: 19 }, { cx: 36, cy: 19 }, { cx: 31, cy: 6 },
];

export class GridMap {
  constructor() {
    this.solid = new Uint8Array(W * H).fill(1);
    for (const [x0, y0, x1, y1] of ROOMS)
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) this.solid[j * W + i] = 0;
    for (const [i, j] of CRATES) this.solid[j * W + i] = 1;
    this.flow = new Int16Array(W * H).fill(-1);
  }

  cell(v) { return Math.floor(v / CELL); }
  center(i) { return (i + 0.5) * CELL; }

  isSolid(i, j) {
    if (i < 0 || j < 0 || i >= W || j >= H) return true;
    return this.solid[j * W + i] === 1;
  }

  // ¿un círculo de radio r en (x,z) toca alguna celda sólida?
  circleHits(x, z, r) {
    const i0 = this.cell(x - r), i1 = this.cell(x + r), j0 = this.cell(z - r), j1 = this.cell(z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (this.isSolid(i, j)) return true;
    return false;
  }

  // Mueve pos (objeto con x,z) deslizando por las paredes: se prueba cada eje por separado.
  move(pos, dx, dz, r) {
    if (!this.circleHits(pos.x + dx, pos.z, r)) pos.x += dx;
    if (!this.circleHits(pos.x, pos.z + dz, r)) pos.z += dz;
  }

  // Línea de visión libre entre dos puntos (con margen lateral r).
  lineClear(ax, az, bx, bz, r = 0) {
    const dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-6) return true;
    const nx = -dz / dist, nz = dx / dist;
    const steps = Math.ceil(dist / 0.4);
    const offsets = r > 0 ? [-r, 0, r] : [0];
    for (const o of offsets) {
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        if (this.isSolid(this.cell(ax + dx * t + nx * o), this.cell(az + dz * t + nz * o))) return false;
      }
    }
    return true;
  }

  // BFS desde la celda del jugador: flow[celda] = pasos hasta el jugador (-1 = inalcanzable).
  buildFlow(px, pz) {
    this.flow.fill(-1);
    const si = this.cell(px), sj = this.cell(pz);
    if (this.isSolid(si, sj)) return;
    const queue = [si + sj * W];
    this.flow[si + sj * W] = 0;
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q], ci = c % W, cj = (c / W) | 0, d = this.flow[c];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (this.isSolid(ni, nj)) continue;
        const n = ni + nj * W;
        if (this.flow[n] !== -1) continue;
        this.flow[n] = d + 1;
        queue.push(n);
      }
    }
  }

  // Siguiente celda (centro) hacia el jugador según el campo de flujo.
  nextTarget(x, z) {
    const ci = this.cell(x), cj = this.cell(z);
    const cur = this.flow[ci + cj * W];
    if (cur <= 0) return null;
    let best = null, bd = cur;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di, nj = cj + dj;
      if (this.isSolid(ni, nj)) continue;
      const d = this.flow[ni + nj * W];
      if (d >= 0 && d < bd) { bd = d; best = { x: this.center(ni), z: this.center(nj) }; }
    }
    return best;
  }
}
