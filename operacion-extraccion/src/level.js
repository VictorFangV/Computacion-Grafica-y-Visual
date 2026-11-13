import * as THREE from 'three';
import { GridMap, CELL, W, H, ROOMS, CRATES, EXTRACTION } from './map.js';

export const WALL_H = 3.6;

function makeTexture(size, painter, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  painter(g, size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const noisy = (g, size, base, amp, extra) => {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = (Math.random() - 0.5) * amp;
      g.fillStyle = `rgb(${base[0] + n | 0},${base[1] + n | 0},${base[2] + n * 0.5 | 0})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  extra?.(g, size);
};

export class Level {
  constructor(scene) {
    this.map = new GridMap();
    const map = this.map;

    const wallTex = makeTexture(64, (g, s) => noisy(g, s, [104, 106, 44], 38, (g2, s2) => {
      g2.fillStyle = 'rgba(0,0,0,.55)';
      for (let y = 0; y < s2; y += 16) g2.fillRect(0, y, s2, 2);
    }));
    const floorTex = makeTexture(64, (g, s) => noisy(g, s, [92, 112, 92], 30, (g2) => {
      g2.fillStyle = 'rgba(120,10,10,.55)';
      for (let k = 0; k < 14; k++) g2.fillRect(Math.random() * 64 | 0, Math.random() * 64 | 0, 2, 1);
    }), W, H);
    const ceilTex = makeTexture(64, (g, s) => noisy(g, s, [48, 52, 40], 18), W, H);
    const crateTex = makeTexture(64, (g, s) => noisy(g, s, [128, 88, 44], 30, (g2, s2) => {
      g2.strokeStyle = 'rgba(40,20,5,.9)'; g2.lineWidth = 4;
      g2.strokeRect(2, 2, s2 - 4, s2 - 4);
      g2.beginPath(); g2.moveTo(2, 2); g2.lineTo(s2 - 2, s2 - 2); g2.moveTo(s2 - 2, 2); g2.lineTo(2, s2 - 2); g2.stroke();
    }));

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((W * CELL) / 2, 0, (H * CELL) / 2);
    scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshLambertMaterial({ map: ceilTex }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((W * CELL) / 2, WALL_H, (H * CELL) / 2);
    scene.add(ceil);

    const crateSet = new Set(CRATES.map(([i, j]) => j * W + i));
    const walls = [], crates = [];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        if (!map.isSolid(i, j)) continue;
        if (crateSet.has(j * W + i)) { crates.push([i, j]); continue; }
        let visible = false;
        for (let dj = -1; dj <= 1 && !visible; dj++)
          for (let di = -1; di <= 1; di++)
            if ((di || dj) && i + di >= 0 && j + dj >= 0 && i + di < W && j + dj < H && !map.isSolid(i + di, j + dj)) { visible = true; break; }
        if (visible) walls.push([i, j]);
      }
    }
    const place = (cells, height, material) => {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, height, CELL), material, cells.length);
      const m = new THREE.Matrix4();
      cells.forEach(([i, j], k) => {
        m.makeTranslation(map.center(i), height / 2, map.center(j));
        mesh.setMatrixAt(k, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
    };
    place(walls, WALL_H, new THREE.MeshLambertMaterial({ map: wallTex }));
    place(crates, 2.2, new THREE.MeshLambertMaterial({ map: crateTex }));

    this.roomLights = [];
    ROOMS.forEach(([x0, y0, x1, y1]) => {
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (area < 40) return;
      const l = new THREE.PointLight(0xb8ffa0, 28, 22, 1.5);
      l.position.set(((x0 + x1 + 1) / 2) * CELL, WALL_H - 0.6, ((y0 + y1 + 1) / 2) * CELL);
      scene.add(l);
    });

    const ex = map.center(EXTRACTION.cx), ez = map.center(EXTRACTION.cy);
    this.extraction = new THREE.Group();
    this.extraction.position.set(ex, 0, ez);
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.25, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, WALL_H - 0.1, 28, 1, true), this.beamMat);
    beam.position.y = (WALL_H - 0.1) / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.5, 32), new THREE.MeshBasicMaterial({ color: 0x66ff88, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    const glow = new THREE.PointLight(0x44ff77, 40, 16, 1.5);
    glow.position.y = 2;
    this.extraction.add(beam, ring, glow);
    scene.add(this.extraction);
    this.extractionPos = new THREE.Vector3(ex, 0, ez);
  }

  update(t) {
    this.beamMat.opacity = 0.2 + Math.sin(t * 2.5) * 0.08;
  }
}
