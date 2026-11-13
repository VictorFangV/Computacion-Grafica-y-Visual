import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CONFIG } from './config.js';
import { CELL } from './map.js';

let template = null;
let clips = [];

export async function loadZombieModel() {
  const gltf = await new GLTFLoader().loadAsync(CONFIG.zombie.url);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  model.scale.multiplyScalar(CONFIG.zombie.height / box.getSize(new THREE.Vector3()).y);
  box.setFromObject(model);
  model.position.x -= (box.min.x + box.max.x) / 2;
  model.position.z -= (box.min.z + box.max.z) / 2;
  model.position.y -= box.min.y;
  template = new THREE.Group();
  template.add(model);
  clips = gltf.animations || [];
}

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class Zombie {
  constructor(map, spawn) {
    this.map = map;
    this.root = cloneSkinned(template);
    this.pos = this.root.position;
    this.pos.set((spawn.cx + 0.5) * CELL, 0, (spawn.cy + 0.5) * CELL);
    this.root.rotation.y = Math.random() * Math.PI * 2;

    this.speed = spawn.fast ? CONFIG.zombie.fastSpeed : CONFIG.zombie.speed;
    this.detectRange = spawn.detectRange ?? CONFIG.zombie.detectRange;
    this.hp = CONFIG.zombie.hp;
    this.state = 'idle';  
    this.caught = false;  
    this.stun = 0;
    this.flash = 0;
    this.t = Math.random() * 10;
    this.deathT = 0;
    this.hitbox = new THREE.Box3();

    this.mats = [];
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      this.mats.push({ m: o.material, e: o.material.emissive ? o.material.emissive.clone() : null });
    });

    this.parts = {};
    for (const n of ['armL', 'armR', 'legL', 'legR', 'head']) this.parts[n] = this.root.getObjectByName(n);
    this.mixer = null;
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(this.root);
      const pick = (re) => clips.find((c) => re.test(c.name));
      this.walkAction = this.mixer.clipAction(pick(/walk|run/i) || clips[0]);
      this.idleAction = pick(/idle/i) ? this.mixer.clipAction(pick(/idle/i)) : null;
      (this.idleAction || this.walkAction).play();
    }
  }

  get alive() { return this.state !== 'dead'; }

  getHitbox(padding = 0) {
    const r = 0.38 + padding;
    this.hitbox.min.set(this.pos.x - r, 0, this.pos.z - r);
    this.hitbox.max.set(this.pos.x + r, CONFIG.zombie.height + 0.1 + padding, this.pos.z + r);
    return this.hitbox;
  }

  takeHit() {
    if (this.state === 'dead') return false;
    this.hp -= 1;
    this.flash = 0.12;
    for (const { m } of this.mats) if (m.emissive) m.emissive.setHex(0xff2200);
    if (this.hp <= 0) {
      this.state = 'dead';          
      this.caught = false;
      this.deathT = 0;
      this.mixer?.stopAllAction();
      return true;
    }
    this.stun = 0.25;
    return false;
  }

  update(dt, playerPos) {
    if (this.state === 'dead') { this._deathAnim(dt); return; }

    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);

    if (this.state === 'idle') {
      if (dist <= this.detectRange) {
        this.state = 'chase';
        this.mixer && this.idleAction && (this.idleAction.stop(), this.walkAction.reset().play());
      } else { this._idleAnim(dt); return; }
    }

    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) for (const { m, e } of this.mats) if (m.emissive && e) m.emissive.copy(e);
    }
    this.mixer?.update(dt);

    if (dist <= CONFIG.zombie.catchDistance) this.caught = true;

    if (this.stun > 0) { this.stun -= dt; return; }

    let tx = playerPos.x, tz = playerPos.z;
    if (!this.map.lineClear(this.pos.x, this.pos.z, playerPos.x, playerPos.z, 0.45)) {
      const n = this.map.nextTarget(this.pos.x, this.pos.z);
      if (n) { tx = n.x; tz = n.z; }
    }
    const vx = tx - this.pos.x, vz = tz - this.pos.z;
    const len = Math.hypot(vx, vz) || 1;
    const step = this.speed * dt;
    this.map.move(this.pos, (vx / len) * step, (vz / len) * step, 0.4);
    this.root.rotation.y = lerpAngle(this.root.rotation.y, Math.atan2(vx, vz) + CONFIG.zombie.yawOffset, Math.min(1, dt * 8));
    this._walkAnim(dt);
  }

  _idleAnim(dt) {
    this.t += dt;
    const p = this.parts;
    if (p.head) p.head.rotation.z = Math.sin(this.t * 1.2) * 0.12;
    if (p.armL) p.armL.rotation.x = -Math.PI / 2 * 0.85 + Math.sin(this.t * 1.5) * 0.05;
    if (p.armR) p.armR.rotation.x = -Math.PI / 2 * 0.85 + Math.sin(this.t * 1.5 + 1) * 0.05;
    this.mixer?.update(dt);
  }

  _walkAnim(dt) {
    this.t += dt * this.speed * 2.4;
    const s = Math.sin(this.t), p = this.parts;
    if (p.legL) p.legL.rotation.x = s * 0.6;
    if (p.legR) p.legR.rotation.x = -s * 0.6;
    if (p.armL) p.armL.rotation.x = -Math.PI / 2 + s * 0.12;
    if (p.armR) p.armR.rotation.x = -Math.PI / 2 - s * 0.12;
    if (p.head) p.head.rotation.z = Math.sin(this.t * 0.5) * 0.15;
  }

  _deathAnim(dt) {
    this.deathT = Math.min(1, this.deathT + dt / 0.5);
    this.root.rotation.x = -Math.PI / 2 * this.deathT; 
    this.root.position.y = 0.12 * this.deathT;
  }
}
