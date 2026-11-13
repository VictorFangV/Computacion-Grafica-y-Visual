import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CELL } from './map.js';

const geo = new THREE.BoxGeometry(0.55, 0.35, 0.38);
const bandGeo = new THREE.BoxGeometry(0.12, 0.37, 0.4);
const boxMat = new THREE.MeshLambertMaterial({ color: 0x4d6b2a, emissive: 0x1c3300 });
const bandMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });

export class AmmoPickup {
  constructor(spawn) {
    this.mesh = new THREE.Group();
    this.mesh.add(new THREE.Mesh(geo, boxMat), new THREE.Mesh(bandGeo, bandMat));
    this.baseY = 0.6;
    this.mesh.position.set((spawn.cx + 0.5) * CELL, this.baseY, (spawn.cy + 0.5) * CELL);
    this.phase = Math.random() * Math.PI * 2;
    this.collected = false;
  }

  update(t) {
    this.mesh.rotation.y = t * 1.5 + this.phase;
    this.mesh.position.y = this.baseY + Math.sin(t * 2 + this.phase) * 0.08;
  }

  canCollect(playerPos) {
    return !this.collected &&
      Math.hypot(playerPos.x - this.mesh.position.x, playerPos.z - this.mesh.position.z) < CONFIG.pickupRadius;
  }
}
