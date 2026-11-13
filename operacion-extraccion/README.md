# Operación Extracción — FPS 3D

Videojuego de disparos en primera persona desarrollado con **Three.js (WebGL)** para el curso
*Computación Gráfica y Visual* (UPN) — Evaluación **T3**.

Eres uno de los últimos sobrevivientes de una infección zombi. Debes atravesar una instalación
infestada, administrar tu munición y llegar a la **zona de extracción** (columna de luz verde)
antes de que un zombi te atrape.

## Requisitos e instalación

- [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm run dev
```

Abre la URL que muestra la consola (normalmente <http://localhost:5173>) y haz clic para jugar.
> No abras `index.html` con doble clic: los modelos GLB se cargan por HTTP, por eso hace falta `npm run dev`.

Para generar la versión desplegable: `npm run build` (queda en `dist/`, usa rutas relativas, sirve en GitHub Pages / Netlify / Vercel).

## Controles

| Control | Acción |
|---|---|
| W / A / S / D | Avanzar / izquierda / retroceder / derecha |
| Mouse | Orientar la cámara |
| Clic izquierdo | Disparar (un disparo por clic, no hay fuego automático) |
| 1 / 2 | Seleccionar pistola / escopeta |
| Esc | Pausa |
| R | Reiniciar (tras Game Over o victoria) |

## Reglas del juego

- **Armas:** pistola (15 balas iniciales, cadencia rápida) y escopeta (6 balas, cadencia lenta, hitbox más permisivo). Cada una tiene su propio contador.
- **Munición:** cada disparo gasta 1 bala; con 0 no se puede disparar. No existe recarga: solo se recupera recogiendo **cajas de munición** del escenario (+6 pistola, +3 escopeta).
- **Zombis:** 27 repartidos por el nivel, 2 puntos de vida. Están **inactivos** hasta que entras en su rango de detección (13 m); entonces te persiguen (rodeando paredes). Algunos son más rápidos.
- **Derrota:** si un zombi te toca → **GAME OVER** y la partida se detiene.
- **Victoria:** entrar en la zona de extracción → **¡MISIÓN COMPLETADA!**

## Dónde está cada requerimiento en el código

| Requerimiento | Archivo | Qué buscar |
|---|---|---|
| RF01 Armas GLB, teclas 1/2, un disparo por clic | `src/weapons.js`, `src/main.js` | `WeaponSystem.load/select/tryShoot`, evento `mousedown` |
| RF02 Munición por arma, solo con cajas | `src/weapons.js`, `src/pickups.js` | `ammo`, `addAmmo()`, `AmmoPickup` |
| RF03 Escenario 3D explorable | `src/map.js`, `src/level.js` | `ROOMS`, `CRATES`, `Level` |
| RF04 Zombis GLB | `src/zombies.js` | `loadZombieModel()` |
| RF05 Detección y persecución | `src/zombies.js`, `src/map.js` | `Zombie.update()` (estados idle/chase), `buildFlow()` (BFS) |
| RF06 Cámara FPS y arma pegada a la cámara | `src/player.js`, `src/weapons.js` | `Player.update/look`; el arma es hija de la cámara |
| RF07 Disparos y 2 impactos | `src/combat.js`, `src/zombies.js` | `shootRay()` (raycast), `takeHit()` |
| RF08 Inicio / desarrollo / extracción | `src/main.js`, `src/level.js` | `victory()`, zona de extracción |
| RF09 Game Over (+ reinicio) | `src/main.js` | `gameOver()`, `resetGame()` |
| RF10 Coleccionables | `src/pickups.js` | `AmmoPickup` |
| RF11 Dificultad | `src/config.js`, `src/map.js` | `ZOMBIE_SPAWNS` (algunos `fast`), munición limitada |

Todos los parámetros (velocidades, rango de detección, munición, cadencia) están en `src/config.js`.

## Estructura

```
index.html            HUD y pantallas
src/main.js           bucle principal, estados, entrada, render en 2 pasadas
src/config.js         parámetros de dificultad y armas
src/map.js            rejilla del nivel, colisiones, línea de visión, BFS
src/level.js          geometría y texturas del escenario
src/player.js         cámara FPS y movimiento
src/weapons.js        armas, munición, animaciones
src/zombies.js        modelo GLB, estados y persecución
src/combat.js         raycasting de disparos
src/pickups.js        cajas de munición
src/audio.js          efectos de sonido (WebAudio)
tools/make-models.mjs generador de los .glb
public/models/        pistol.glb, shotgun.glb, zombie.glb
```

## Fuentes de recursos externos

- **Three.js** (MIT) — <https://threejs.org>; **Vite** (MIT) — <https://vitejs.dev>.
- **Modelos GLB** (pistola, escopeta, zombi): creados para este proyecto con `tools/make-models.mjs`. Sin licencias de terceros.
- **Texturas:** generadas por código (canvas). **Sonidos:** sintetizados con WebAudio.

### Usar tus propios modelos GLB
Reemplaza los archivos de `public/models/` (o cambia las rutas en `src/config.js`). El juego normaliza
tamaño y posición automáticamente. Si el arma sale girada, ajusta `view.rot` en `config.js`;
si el zombi mira hacia otro lado, ajusta `zombie.yawOffset`. Si el GLB trae animaciones, se usan
(clip con "walk"/"run"/"idle" en el nombre, o el primero). **Anota aquí la fuente y licencia** de los que uses.
