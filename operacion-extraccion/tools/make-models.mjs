
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
fs.mkdirSync(OUT, { recursive: true });

const FACES = [
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];

function boxes(list) {
  const pos = [], nor = [], idx = [];
  for (const [[w, h, d], [cx, cy, cz]] of list) {
    const base = pos.length / 3;
    for (const f of FACES) {
      const b = pos.length / 3;
      for (const [sx, sy, sz] of f.v) {
        pos.push(cx + (sx * w) / 2, cy + (sy * h) / 2, cz + (sz * d) / 2);
        nor.push(...f.n);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    void base;
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) };
}

function buildGLB(rootName, materials, parts) {
  const chunks = [];
  let offset = 0;
  const bufferViews = [], accessors = [], meshes = [], nodes = [];

  const matNames = Object.keys(materials);
  const gltfMaterials = matNames.map((k) => ({
    name: k,
    pbrMetallicRoughness: {
      baseColorFactor: materials[k].color,
      metallicFactor: materials[k].metal ?? 0.1,
      roughnessFactor: materials[k].rough ?? 0.85,
    },
    emissiveFactor: materials[k].emissive,
  }));

  const push = (typed, target) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    chunks.push(buf);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    offset += buf.length;
    return bufferViews.length - 1;
  };

  const partNodeIdx = [];
  for (const part of parts) {
    const primitives = part.prims.map((p) => {
      const g = boxes(p.boxes);
      const bvP = push(g.pos, 34962), bvN = push(g.nor, 34962), bvI = push(g.idx, 34963);
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < g.pos.length; i += 3)
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], g.pos[i + k]); max[k] = Math.max(max[k], g.pos[i + k]); }
      accessors.push({ bufferView: bvP, componentType: 5126, count: g.pos.length / 3, type: 'VEC3', min, max });
      const aP = accessors.length - 1;
      accessors.push({ bufferView: bvN, componentType: 5126, count: g.nor.length / 3, type: 'VEC3' });
      const aN = accessors.length - 1;
      accessors.push({ bufferView: bvI, componentType: 5123, count: g.idx.length, type: 'SCALAR' });
      const aI = accessors.length - 1;
      return { attributes: { POSITION: aP, NORMAL: aN }, indices: aI, material: matNames.indexOf(p.mat) };
    });
    meshes.push({ name: part.name, primitives });
    nodes.push({
      name: part.name,
      mesh: meshes.length - 1,
      translation: part.translation ?? [0, 0, 0],
      ...(part.rotation ? { rotation: part.rotation } : {}),
    });
    partNodeIdx.push(nodes.length - 1);
  }
  nodes.push({ name: rootName, children: partNodeIdx });
  const rootIdx = nodes.length - 1;

  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  const bin = Buffer.concat(chunks);

  const gltf = {
    asset: { version: '2.0', generator: 'operacion-extraccion/make-models.mjs' },
    scene: 0,
    scenes: [{ nodes: [rootIdx] }],
    nodes, meshes, materials: gltfMaterials, accessors, bufferViews,
    buffers: [{ byteLength: bin.length }],
  };

  let json = Buffer.from(JSON.stringify(gltf));
  const jpad = (4 - (json.length % 4)) % 4;
  json = Buffer.concat([json, Buffer.alloc(jpad, 0x20)]);

  const total = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, json, bh, bin]);
}

// ---------- PISTOLA (cañón hacia -Z) ----------
const pistol = buildGLB('pistol', {
  metal: { color: [0.13, 0.13, 0.16, 1], metal: 0.8, rough: 0.4 },
  grip: { color: [0.28, 0.16, 0.08, 1] },
  accent: { color: [0.9, 0.55, 0.1, 1], emissive: [0.35, 0.18, 0] },
}, [
  { name: 'slide', prims: [{ mat: 'metal', boxes: [[[0.07, 0.08, 0.34], [0, 0.04, -0.12]], [[0.035, 0.035, 0.06], [0, 0.04, -0.31]], [[0.03, 0.03, 0.09], [0, -0.02, -0.08]]] }] },
  { name: 'grip', prims: [{ mat: 'grip', boxes: [[[0.065, 0.18, 0.08], [0, -0.09, 0.0]]] }] },
  { name: 'sights', prims: [{ mat: 'accent', boxes: [[[0.02, 0.02, 0.02], [0, 0.095, 0.02]], [[0.015, 0.02, 0.02], [0, 0.095, -0.27]]] }] },
]);

const shotgun = buildGLB('shotgun', {
  metal: { color: [0.1, 0.1, 0.12, 1], metal: 0.85, rough: 0.35 },
  wood: { color: [0.38, 0.22, 0.1, 1] },
  accent: { color: [0.85, 0.15, 0.1, 1], emissive: [0.3, 0.02, 0.02] },
}, [
  { name: 'barrel', prims: [{ mat: 'metal', boxes: [[[0.06, 0.06, 0.75], [0, 0.02, -0.45]], [[0.05, 0.05, 0.6], [0, -0.04, -0.42]], [[0.08, 0.11, 0.28], [0, 0, -0.05]]] }] },
  { name: 'wood', prims: [{ mat: 'wood', boxes: [[[0.08, 0.07, 0.22], [0, -0.04, -0.4]], [[0.07, 0.12, 0.38], [0, -0.03, 0.3]], [[0.06, 0.14, 0.07], [0, -0.1, 0.1]]] }] },
  { name: 'muzzle', prims: [{ mat: 'accent', boxes: [[[0.07, 0.07, 0.04], [0, 0.02, -0.84]]] }] },
]);

// ---------- ZOMBI (mira hacia +Z, ~1.84 m) ----------
const Q = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // brazos extendidos hacia +Z
const zombie = buildGLB('zombie', {
  skin: { color: [0.42, 0.56, 0.36, 1] },
  shirt: { color: [0.34, 0.24, 0.2, 1] },
  pants: { color: [0.18, 0.2, 0.3, 1] },
  blood: { color: [0.45, 0.04, 0.04, 1] },
  eyes: { color: [0.3, 0, 0, 1], emissive: [1, 0.1, 0.1] },
}, [
  { name: 'torso', translation: [0, 1.15, 0], prims: [
    { mat: 'shirt', boxes: [[[0.52, 0.72, 0.28], [0, 0, 0]]] },
    { mat: 'blood', boxes: [[[0.2, 0.22, 0.02], [0.1, 0.05, 0.145]]] },
  ] },
  { name: 'head', translation: [0, 1.68, 0], prims: [
    { mat: 'skin', boxes: [[[0.3, 0.32, 0.3], [0, 0, 0]]] },
    { mat: 'eyes', boxes: [[[0.06, 0.05, 0.02], [-0.08, 0.03, 0.155]], [[0.06, 0.05, 0.02], [0.08, 0.03, 0.155]]] },
  ] },
  { name: 'armL', translation: [-0.36, 1.45, 0], rotation: Q, prims: [
    { mat: 'skin', boxes: [[[0.13, 0.62, 0.13], [0, -0.31, 0]]] },
    { mat: 'shirt', boxes: [[[0.15, 0.25, 0.15], [0, -0.125, 0]]] },
  ] },
  { name: 'armR', translation: [0.36, 1.45, 0], rotation: Q, prims: [
    { mat: 'skin', boxes: [[[0.13, 0.62, 0.13], [0, -0.31, 0]]] },
    { mat: 'shirt', boxes: [[[0.15, 0.25, 0.15], [0, -0.125, 0]]] },
  ] },
  { name: 'legL', translation: [-0.14, 0.8, 0], prims: [{ mat: 'pants', boxes: [[[0.2, 0.8, 0.22], [0, -0.4, 0]]] }] },
  { name: 'legR', translation: [0.14, 0.8, 0], prims: [{ mat: 'pants', boxes: [[[0.2, 0.8, 0.22], [0, -0.4, 0]]] }] },
]);

for (const [name, buf] of Object.entries({ pistol, shotgun, zombie })) {
  fs.writeFileSync(path.join(OUT, `${name}.glb`), buf);
  console.log(`${name}.glb  ${buf.length} bytes`);
}
