import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CELL } from './map.js';

export class Player {
  constructor(camera, map) {
    this.camera = camera;
    this.map = map;
    this.camera.rotation.order = 'YXZ'; 
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = {};
    this.moving = false;
    this.bobT = 0;

    window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }

  reset(start) {
    this.pos.set((start.cx + 0.5) * CELL, 0, (start.cy + 0.5) * CELL);
    this.yaw = start.yaw;
    this.pitch = 0;
    this.keys = {};
    this.moving = false;
    this._apply();
  }

  look(dx, dy) {
    this.yaw -= dx * CONFIG.player.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * CONFIG.player.sensitivity, -1.45, 1.45);
  }

  update(dt) {
    const k = this.keys;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);

    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);

    let vx = fx * f + rx * s, vz = fz * f + rz * s;
    const len = Math.hypot(vx, vz);
    this.moving = len > 0;
    if (this.moving) {
      const step = (CONFIG.player.speed * dt) / len; 
      this.map.move(this.pos, vx * step, vz * step, CONFIG.player.radius);
      this.bobT += dt * 9;
    }
    this._apply();
  }

  _apply() {
    const bob = this.moving ? Math.sin(this.bobT * 2) * 0.035 : 0;
    this.camera.position.set(this.pos.x, CONFIG.player.eyeHeight + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
