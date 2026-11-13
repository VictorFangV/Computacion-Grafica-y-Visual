
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PLAYER_START, ZOMBIE_SPAWNS, PICKUP_SPAWNS, CELL } from './map.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { Zombie, loadZombieModel } from './zombies.js';
import { AmmoPickup } from './pickups.js';
import { shootRay } from './combat.js';
import { initAudio, sfx } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050805);
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070b05, 0.045);
scene.add(new THREE.AmbientLight(0x8a9a7a, 1.4));

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 150);
scene.add(camera); // la cámara está en la escena para que sus hijos (arma, luces) se dibujen
const flashlight = new THREE.PointLight(0xfff2cc, 45, 25, 1.6);
camera.add(flashlight);

const level = new Level(scene);
const map = level.map;
const player = new Player(camera, map);
const weapons = new WeaponSystem(camera);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});


const $ = (id) => document.getElementById(id);
const hud = $('hud'), overlay = $('overlay'), toastEl = $('toast'), crosshair = $('crosshair');
const slotEls = [$('slot0'), $('slot1')];
let toastTimer = 0, hitTimer = 0;

function toast(text, color = '#e6efd9', ms = 1400) {
  toastEl.textContent = text;
  toastEl.style.color = color;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function showOverlay({ title, text, hint, cls = '', controls = true }) {
  overlay.className = cls;
  $('ovTitle').textContent = title;
  $('ovText').textContent = text;
  $('ovHint').textContent = hint;
  $('controls').style.display = controls ? 'grid' : 'none';
  overlay.classList.remove('hidden');
  hud.classList.add('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); hud.classList.remove('hidden'); }

function updateHud() {
  weapons.slots.forEach((s, i) => {
    const el = slotEls[i];
    el.classList.toggle('active', i === weapons.current);
    el.querySelector('.wname').textContent = s.def.name;
    const a = el.querySelector('.wammo');
    a.textContent = s.ammo;
    a.classList.toggle('empty', s.ammo === 0);
  });
  const alive = zombies.filter((z) => z.alive).length;
  $('zombiesInfo').textContent = `ZOMBIS VIVOS: ${alive} / ${zombies.length}`;
  const d = Math.hypot(player.pos.x - level.extractionPos.x, player.pos.z - level.extractionPos.z);
  $('extractInfo').textContent = `EXTRACCIÓN A ${Math.round(d)} m`;
}

let state = 'ready';
let zombies = [];
let pickups = [];
let lastCell = '';
let loaded = false;

function resetGame() {
  zombies.forEach((z) => scene.remove(z.root));
  pickups.forEach((p) => scene.remove(p.mesh));
  zombies = ZOMBIE_SPAWNS.map((s) => { const z = new Zombie(map, s); scene.add(z.root); return z; });
  pickups = PICKUP_SPAWNS.map((s) => { const p = new AmmoPickup(s); scene.add(p.mesh); return p; });
  player.reset(PLAYER_START);
  weapons.reset();
  lastCell = '';
  state = 'ready';
  updateHud();
}

function gameOver() {
  state = 'dead';
  document.exitPointerLock();
  sfx.gameover();
  showOverlay({ title: 'GAME OVER', text: 'Un zombi te atrapó. La infección sigue avanzando...', hint: 'Haz clic o pulsa R para reiniciar', cls: 'gameover', controls: false });
}

function victory() {
  state = 'won';
  document.exitPointerLock();
  sfx.win();
  showOverlay({ title: '¡MISIÓN COMPLETADA!', text: 'Has llegado a la zona de extracción.', hint: 'Haz clic o pulsa R para jugar de nuevo', controls: false });
}

// ---------- entrada ----------
const locked = () => document.pointerLockElement === canvas;

overlay.addEventListener('click', () => {
  if (!loaded) return;
  initAudio();
  if (state === 'dead' || state === 'won') resetGame();
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (locked()) {
    if (state === 'ready') { state = 'playing'; hideOverlay(); }
  } else if (state === 'playing') {
    state = 'ready';
    showOverlay({ title: 'PAUSA', text: 'La partida está en pausa.', hint: 'Haz clic para continuar' });
  }
});

document.addEventListener('mousemove', (e) => {
  if (state === 'playing' && locked()) player.look(e.movementX, e.movementY);
});

// RF01: 'mousedown' se dispara una sola vez por clic -> mantener pulsado NO dispara en automático.
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || state !== 'playing' || !locked()) return;
  const result = weapons.tryShoot();
  if (result === 'empty') { sfx.empty(); toast('SIN MUNICIÓN', '#ff3b30', 900); return; }
  if (result !== 'fired') return;

  const def = weapons.active.def;
  def.id === 'shotgun' ? sfx.shotgun() : sfx.pistol();

  const hit = shootRay(camera, zombies, map, def.hitPadding);
  if (hit) {
    hit.killed ? sfx.kill() : sfx.hit();
    crosshair.classList.add('hit');
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => crosshair.classList.remove('hit'), 120);
  }
  updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (state === 'playing') {
    if (e.code === 'Digit1' || e.code === 'Numpad1') { weapons.select(0); updateHud(); }
    if (e.code === 'Digit2' || e.code === 'Numpad2') { weapons.select(1); updateHud(); }
  }
  if (e.code === 'KeyR' && (state === 'dead' || state === 'won')) { resetGame(); canvas.requestPointerLock(); }
});

// ---------- actualización por frame ----------
function update(dt, t) {
  player.update(dt);

  // El campo de flujo (rutas de los zombis) solo se recalcula al cambiar de celda.
  const key = `${map.cell(player.pos.x)},${map.cell(player.pos.z)}`;
  if (key !== lastCell) { lastCell = key; map.buildFlow(player.pos.x, player.pos.z); }

  weapons.update(dt, player.moving, t);
  level.update(t);

  for (const z of zombies) {
    const wasIdle = z.state === 'idle';
    z.update(dt, player.pos);
    if (wasIdle && z.state === 'chase') sfx.groan();
    if (z.caught) { gameOver(); return; } // RF09: la partida se detiene
  }

  for (const p of pickups) {
    p.update(t);
    if (p.canCollect(player.pos)) {
      p.collected = true;
      scene.remove(p.mesh);
      weapons.addAmmo();
      sfx.pickup();
      toast('+ MUNICIÓN', '#8dff6a');
      updateHud();
    }
  }

  // RF08: zona de extracción
  const d = Math.hypot(player.pos.x - level.extractionPos.x, player.pos.z - level.extractionPos.z);
  if (d < CONFIG.extractionRadius) { victory(); return; }
  updateHud();
}

function render() {
  renderer.clear();
  camera.layers.set(0);
  renderer.render(scene, camera);
  renderer.clearDepth();
  camera.layers.set(1);
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (loaded && state === 'playing') update(dt, clock.elapsedTime);
  render();
}

showOverlay({
  title: 'OPERACIÓN EXTRACCIÓN',
  text: 'El mundo cayó ante la infección. Atraviesa la zona infestada, administra tu munición y llega a la zona de extracción antes de que te atrapen.',
  hint: 'Cargando modelos…',
});

Promise.all([weapons.load(), loadZombieModel()])
  .then(() => {
    loaded = true;
    resetGame();
    $('ovHint').textContent = 'Haz clic para comenzar';
  })
  .catch((err) => {
    console.error(err);
    $('ovHint').textContent = 'Error al cargar los modelos GLB. Ejecuta el juego con "npm run dev" (no abras el HTML directamente).';
  });

frame();

window.__game = { get zombies() { return zombies; }, weapons, player, map, CELL };
