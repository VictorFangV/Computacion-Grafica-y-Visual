import * as THREE from 'three';
import { CONFIG } from './config.js';

const origin = new THREE.Vector3();
const dir = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const ray = new THREE.Ray();

export function shootRay(camera, zombies, map, padding = 0) {
  camera.getWorldPosition(origin);
  camera.getWorldDirection(dir);
  ray.set(origin, dir);

  let best = null, bestDist = Infinity;
  for (const z of zombies) {
    if (!z.alive) continue; // los zombis muertos ya no son blanco
    if (!ray.intersectBox(z.getHitbox(padding), hitPoint)) continue;
    const d = origin.distanceTo(hitPoint);
    if (d > CONFIG.shootRange || d >= bestDist) continue;
    if (!map.lineClear(origin.x, origin.z, hitPoint.x, hitPoint.z)) continue; // pared en medio
    best = z; bestDist = d;
  }
  if (!best) return null;
  const killed = best.takeHit(); // -1 de vida; muere exactamente al 2.º impacto
  return { zombie: best, killed };
}
