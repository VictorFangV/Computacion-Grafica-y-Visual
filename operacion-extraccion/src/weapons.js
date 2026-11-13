
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';


export const WEAPON_LAYER = 1;

export class WeaponSystem {
  constructor(camera) {
    this.camera = camera;
    this.slots = [];
    this.current = 0;  
    this.shown = 0;  
    this.swapT = 1;   
    this.cooldown = 0;
    this.recoil = 0;
    this.flashT = 0;
    this.bobT = 0;
    this.bobAmp = 0;

    this.holder = new THREE.Group();
    camera.add(this.holder);

    // Luces solo para la capa del arma
    const amb = new THREE.AmbientLight(0xffffff, 2.4); amb.layers.set(WEAPON_LAYER);
    const key = new THREE.PointLight(0xfff0d0, 10, 6, 1.5); key.position.set(0.3, 0.4, 0.2); key.layers.set(WEAPON_LAYER);
    this.holder.add(amb, key);

    this.flashSprite = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.flashSprite.layers.set(WEAPON_LAYER);
    this.flashSprite.visible = false;
    this.holder.add(this.flashSprite);
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 18, 1.5);
    this.flashLight.position.set(0, 0, -0.5);
    camera.add(this.flashLight);
  }

  async load() {
    const loader = new GLTFLoader();
    for (const def of CONFIG.weapons) {
      const gltf = await loader.loadAsync(def.url);
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(def.view.size / Math.max(size.x, size.y, size.z));
      box.setFromObject(model);
      model.position.sub(box.getCenter(new THREE.Vector3()));

      const pivot = new THREE.Group();
      pivot.add(model);
      pivot.rotation.set(...def.view.rot);
      pivot.position.set(...def.view.pos);
      pivot.traverse((o) => { o.layers.set(WEAPON_LAYER); o.frustumCulled = false; });
      pivot.visible = false;
      this.holder.add(pivot);

      this.slots.push({
        def,
        ammo: def.startAmmo,
        pivot,
        basePos: pivot.position.clone(),
        baseRotX: pivot.rotation.x,
      });
    }
    this.reset();
  }

  reset() {
    this.slots.forEach((s) => { s.ammo = s.def.startAmmo; s.pivot.visible = false; });
    this.current = this.shown = 0;
    this.swapT = 1;
    this.cooldown = 0;
    this.recoil = 0;
    this.flashT = 0;
    this.slots[0].pivot.visible = true;
  }

  get active() { return this.slots[this.current]; }

  select(index) {
    if (index === this.current || index >= this.slots.length || this.swapT < 1) return false;
    this.current = index;
    this.swapT = 0;
    return true;
  }

  tryShoot() {
    if (this.swapT < 1 || this.cooldown > 0) return 'wait';
    const slot = this.active;
    if (slot.ammo <= 0) { this.cooldown = 0.3; return 'empty'; } 
    slot.ammo -= 1;                                        
    this.cooldown = slot.def.cooldown;
    this.recoil = 1;
    this.flashT = 0.06;
    return 'fired';
  }

  addAmmo() {
    for (const s of this.slots) s.ammo = Math.min(s.def.maxAmmo, s.ammo + s.def.pickupAmmo);
  }

  update(dt, moving, t) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.flashT = Math.max(0, this.flashT - dt);
    this.bobAmp += ((moving ? 1 : 0) - this.bobAmp) * Math.min(1, dt * 8);
    this.bobT += dt * (moving ? 9 : 0);

    let drop = 0;
    if (this.swapT < 1) {
      this.swapT = Math.min(1, this.swapT + dt / 0.4);
      if (this.swapT >= 0.5 && this.shown !== this.current) {
        this.slots[this.shown].pivot.visible = false;
        this.shown = this.current;
        this.slots[this.shown].pivot.visible = true;
      }
      drop = this.swapT < 0.5 ? this.swapT / 0.5 : 1 - (this.swapT - 0.5) / 0.5;
    }

    const s = this.slots[this.shown];
    const bx = Math.sin(this.bobT) * 0.012 * this.bobAmp;
    const by = Math.abs(Math.cos(this.bobT)) * 0.012 * this.bobAmp + Math.sin(t * 1.6) * 0.003;
    s.pivot.position.set(s.basePos.x + bx, s.basePos.y + by - drop * 0.5, s.basePos.z + this.recoil * s.def.view.recoil);
    s.pivot.rotation.x = s.baseRotX + this.recoil * 0.12;

    const flashing = this.flashT > 0;
    this.flashSprite.visible = flashing;
    this.flashLight.intensity = flashing ? 30 : 0;
    if (flashing) {
      this.flashSprite.position.set(...s.def.view.muzzle);
      this.flashSprite.rotation.z = Math.random() * Math.PI;
      this.flashSprite.scale.setScalar(0.8 + Math.random() * 0.6);
    }
  }
}
