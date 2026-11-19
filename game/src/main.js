// SOLMAR BAY — boot, the game state, the fixed-step loop, and every
// interaction (steal a car, shoot, buy ammo, lose the cops, save).
// ?seed=N fixes the city. ?shot=cover|street|chase|dusk stages that scene
// from the live simulation and sets window.__shotReady for a screenshot.
import { CONFIG } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { buildCity, collideBuildings, clampToWorld, districtAt } from './world.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { spawnTraffic, spawnParked, updateTraffic, updatePlayerCar, nearestCar } from './vehicles.js';
import { spawnPeds, updatePeds, scarePeds } from './peds.js';
import { addWanted, updateWanted, updatePolice, clearWantedAtSpray } from './police.js';
import { playerShoot, playerPunch, updateBullets, updateEnemies, hurtPlayer } from './combat.js';
import { startMission, updateMissions, spawnPackages, updatePackages } from './missions.js';
import { saveGame, loadSave, applySave } from './save.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_MISSIONS, SCREEN_WASTED, SCREEN_BUSTED } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = new Input(canvas);
const audio = new AudioEngine();
const renderer = createRenderer(canvas);

function newGameState() {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const g = {
    seed, rng, city, audio,
    time: 0, clockHours: 9.0, day: 1,
    cash: CONFIG.startCash,
    wanted: 0, wantedTimer: 0, heat: 0,
    missionIndex: 0, missionsDone: 0, mission: null, storyDone: false,
    packagesFound: 0,
    screen: SCREEN_TITLE,
    toasts: [],
    bullets: [],
    particles: [],
    policeCars: [],
    policeFoot: [],
    enemies: [],
    saveData: loadSave(),
    toast(text) {
      g.toasts.push({ text, t: 0 });
      if (g.toasts.length > 4) g.toasts.shift();
    },
  };
  g.player = {
    x: 400, y: 2400, angle: 0, aimAngle: 0,
    health: CONFIG.startHealth, armor: 0, ammo: 24,
    inCar: false, car: null, fireT: 0, punchT: 0, recoil: 0,
  };
  g.cars = [...spawnTraffic(city, rng, 26), ...spawnParked(city, rng, 14)];
  g.peds = spawnPeds(city, rng, 42);
  g.packages = spawnPackages(city, rng);
  return g;
}

const g = newGameState();
window.__game = g; // debug hook: lets a play-test read live state (own game, no network).

function announce(msg) { status.textContent = msg; }

function startNewGame(withMission = true) {
  const fresh = newGameState();
  Object.assign(g, fresh);
  g.screen = SCREEN_PLAY;
  if (withMission) startMission(g);
  audio.resume();
  announce('Playing Solmar Bay. Mission 1: First Gear.');
}

function continueGame() {
  const data = g.saveData;
  startNewGame(false);
  if (data) {
    applySave(g, data);
    g.mission = null;
    startMission(g);
    g.toast('Save loaded. Welcome back, Rio.');
  }
}

// ---- interactions -------------------------------------------------------
function tryEnterCar() {
  const car = nearestCar(g.cars, g.player.x, g.player.y, 90);
  if (!car) return false;
  g.player.inCar = true;
  g.player.car = car;
  car.traffic = false;
  car.parked = false;
  car.speed = 0;
  if (!car.stolen) {
    car.stolen = true;
    addWanted(g, 1, 'Grand theft auto — someone saw you take it.');
    g.toast(`Stole a ${car.model.name}. The owner called it in.`);
  }
  audio.resume();
  return true;
}

function exitCar() {
  const car = g.player.car;
  if (!car) return;
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  const p = collideBuildings(g.city, car.x + Math.cos(side) * 34, car.y + Math.sin(side) * 34, 10);
  g.player.x = p.x; g.player.y = p.y;
  g.player.inCar = false;
  g.player.car = null;
  audio.setEngine(0);
}

function nearPlace(key, r = 80) {
  const p = g.city.places[key];
  return dist(g.player.x, g.player.y, p.x, p.y) < r;
}

function interact() {
  if (g.player.inCar) { exitCar(); return; }
  if (tryEnterCar()) return;
  if (nearPlace('gunShop')) {
    if (g.cash >= 40) {
      g.cash -= 40; g.player.ammo += 24;
      g.toast('Bought 24 rounds for $40.');
      audio.cash();
    } else g.toast('Ammo is $40 for 24 rounds. You are short.');
    return;
  }
  if (nearPlace('sprayShop')) { clearWantedAtSpray(g); return; }
  if (nearPlace('garage')) {
    if (g.player.car) { /* in car handled by exitCar above */ }
    if (saveGame(g)) g.toast('Game saved at the garage.');
    if (g.player.health < 100) { g.player.health = 100; g.toast('Patched up at the garage.'); }
    return;
  }
  if (nearPlace('hospital')) {
    if (g.cash >= 50 && g.player.health < 100) {
      g.cash -= 50; g.player.health = 100;
      g.toast('Hospital visit: $50, fully healed.');
    } else if (g.player.health >= 100) g.toast('You are already at full health.');
    else g.toast('A check-up is $50. You cannot afford it.');
    return;
  }
}

// ---- simulation ---------------------------------------------------------
let lastMissionsDone = 0;

function updateSim(dt) {
  g.time += dt;
  g.clockHours += dt * 0.05; // a full day takes 8 real minutes
  if (g.clockHours >= 24) { g.clockHours -= 24; g.day += 1; g.toast(`Day ${g.day} in Solmar Bay.`); }
  for (const t of g.toasts) t.t += dt;
  g.toasts = g.toasts.filter((t) => t.t < 5);
  for (const p of g.particles) { p.life -= dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; }
  g.particles = g.particles.filter((p) => p.life > 0);

  const p = g.player;
  // Aim at the mouse (world coordinates).
  const view = rendererView();
  const wx = (input.mouseX / view.zoom) + view.x0;
  const wy = (input.mouseY / view.zoom) + view.y0;
  if (!p.inCar) p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  p.fireT = Math.max(0, p.fireT - dt);
  p.punchT = Math.max(0, p.punchT - dt);
  p.recoil = Math.max(0, p.recoil - dt);

  if (p.inCar && p.car) {
    updatePlayerCar(p.car, input, dt, g.city, audio);
    p.x = p.car.x; p.y = p.car.y;
    p.aimAngle = p.car.angle;
    if (p.car.health <= 0) {
      g.particles.push({ x: p.car.x, y: p.car.y, vx: 0, vy: 0, life: 0.6, max: 0.6, color: '#f97316', size: 26 });
      g.cars = g.cars.filter((c) => c !== p.car);
      g.toast('Your car is wrecked. Time to find another.');
      audio.crash();
      exitCar();
    }
  } else {
    // On foot.
    let mx = 0, my = 0;
    if (input.down('w') || input.down('arrowup')) my -= 1;
    if (input.down('s') || input.down('arrowdown')) my += 1;
    if (input.down('a') || input.down('arrowleft')) mx -= 1;
    if (input.down('d') || input.down('arrowright')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      const sprint = input.down('shift') ? CONFIG.sprintMultiplier : 1;
      const sp = CONFIG.playerSpeed * sprint;
      const nx = p.x + (mx / len) * sp * dt;
      const ny = p.y + (my / len) * sp * dt;
      const hit = collideBuildings(g.city, nx, ny, 12);
      const c = clampToWorld(hit.x, hit.y);
      p.x = c.x; p.y = c.y;
      p.angle = Math.atan2(my, mx);
    }
    if (input.mouseDown && p.fireT <= 0) { playerShoot(g); p.fireT = 0.18; }
  }

  // Traffic + pedestrians, kept near the player so the streets stay alive.
  for (const car of g.cars) {
    if (car.traffic) updateTraffic(car, g.city, g.rng, dt, g.cars);
    else if (!p.inCar || car !== p.car) { /* parked/stolen cars sit still */ }
    if (dist(car.x, car.y, p.x, p.y) > 1500 && car.traffic) {
      const rp = randomRoadPointNear(g);
      car.x = rp.x; car.y = rp.y;
      car.angle = rp.vertical ? Math.PI / 2 : 0;
    }
  }
  updatePeds(g.peds, g.city, g.rng, dt, g.wanted > 0 ? { x: p.x, y: p.y } : null);
  for (const ped of g.peds) {
    if (dist(ped.x, ped.y, p.x, p.y) > 1500) {
      const rp = randomRoadPointNear(g);
      ped.x = rp.x; ped.y = rp.y;
    }
  }

  updateWanted(g, dt);
  updatePolice(g, dt);
  updateEnemies(g, dt);
  updateBullets(g, dt);
  updateMissions(g, dt);
  updatePackages(g);
  audio.updateMusic(dt);

  // A car hit by the player at speed counts as a crime.
  if (p.inCar && p.car) {
    for (const ped of g.peds) {
      if (ped.state !== 'down' && dist(ped.x, ped.y, p.x, p.y) < 26 && Math.abs(p.car.speed) > 120) {
        ped.state = 'down';
        addWanted(g, 1, 'You ran someone over — witnesses called the police.');
        scarePeds(g.peds, p.x, p.y, 300);
      }
    }
  }

  if (g.missionsDone !== lastMissionsDone) {
    lastMissionsDone = g.missionsDone;
    saveGame(g);
  }
}

function randomRoadPointNear(g) {
  for (let i = 0; i < 8; i++) {
    const a = g.rng() * Math.PI * 2;
    const r = 700 + g.rng() * 500;
    const x = clamp(g.player.x + Math.cos(a) * r, 100, g.city.W - 100);
    const y = clamp(g.player.y + Math.sin(a) * r, 100, g.city.H - 100);
    if (g.city.roadsV.some((rx) => Math.abs(x - rx) < 40) || g.city.roadsH.some((ry) => Math.abs(y - ry) < 40)) {
      return { x, y, vertical: Math.abs(x - g.city.roadsV[0]) < 40 };
    }
  }
  return { x: g.player.x + 600, y: g.player.y, vertical: true };
}

// The renderer owns the camera; mirror its math here for mouse aiming.
function rendererView() {
  const zoom = g.player.inCar ? 0.85 : 1.05;
  const vw = window.innerWidth, vh = window.innerHeight;
  const viewW = vw / zoom, viewH = vh / zoom;
  const cx = clamp(g.player.x, viewW / 2, g.city.W - viewW / 2);
  const cy = clamp(g.player.y, viewH / 2, g.city.H - viewH / 2);
  return { zoom, x0: cx - viewW / 2, y0: cy - viewH / 2 };
}

// ---- screens / loop -----------------------------------------------------
function handleScreens() {
  if (g.screen === SCREEN_TITLE) {
    if (input.wasPressed('enter') || input.mouseClicked) {
      if (g.saveData && !input.wasPressed('n')) continueGame();
      else startNewGame();
    }
    if (input.wasPressed('n')) startNewGame();
    return;
  }
  if (g.screen === SCREEN_WASTED || g.screen === SCREEN_BUSTED) {
    if (input.wasPressed('enter') || input.mouseClicked) {
      g.screen = SCREEN_PLAY;
      if (!g.mission) startMission(g);
    }
    return;
  }
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    if (g.screen === SCREEN_PLAY) { g.screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (g.screen === SCREEN_PAUSED) { g.screen = SCREEN_PLAY; announce('Playing.'); }
    else if (g.screen === SCREEN_MISSIONS) { g.screen = SCREEN_PLAY; }
    return;
  }
  if (input.wasPressed('m') && (g.screen === SCREEN_PLAY || g.screen === SCREEN_MISSIONS)) {
    g.screen = g.screen === SCREEN_PLAY ? SCREEN_MISSIONS : SCREEN_PLAY;
  }
}

// One-shot actions, handled exactly once per frame (never inside the fixed
// steps: a slow frame runs several steps, and a press must not fire twice).
function handleOneShots() {
  if (input.wasPressed('e')) interact();
  if (input.wasPressed('r')) { audio.radio = (audio.radio + 1) % 3; g.toast(`Radio: ${['BAY FM 88.1', 'NEON 104', 'DOCK RADIO'][audio.radio]}`); }
  if (input.wasPressed('n')) { const m = audio.toggleMute(); g.toast(m ? 'Sound muted.' : 'Sound on.'); }
  if (input.wasPressed('q')) { if (saveGame(g)) g.toast('Game saved.'); }
  if (input.wasPressed('h') && g.player.inCar) audio.horn();
  if (input.wasPressed(' ') && !g.player.inCar) playerPunch(g);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleScreens();
  if (g.screen === SCREEN_PLAY) {
    handleOneShots();
    let acc = dt;
    while (acc >= STEP) { updateSim(STEP); acc -= STEP; }
  }
  renderer.draw(g, g.screen);
  input.endFrame();
}

let last = performance.now();

if (shot) {
  // Staged screenshot: build the scene, paint it, signal readiness.
  g.screen = SCREEN_PLAY;
  stageShot(shot, g, updateSim);
  let painted = 0;
  function paintShot() {
    renderer.draw(g, SCREEN_PLAY);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
} else {
  announce('Solmar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && g.screen === SCREEN_PLAY) g.screen = SCREEN_PAUSED;
});
