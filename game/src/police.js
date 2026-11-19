// The wanted system: 0–5 stars, police cars and foot cops that chase, ram and
// arrest, heat that decays when the player breaks line of sight, and the
// spray shop that wipes the slate clean (for a fee).
import { CONFIG } from './config.js';
import { angleDiff, clamp, dist } from './random.js';
import { collideBuildings, randomRoadPoint } from './world.js';
import { makeCar } from './vehicles.js';

export function addWanted(g, stars, reason) {
  g.wanted = clamp(g.wanted + stars, 0, CONFIG.maxWanted);
  g.wantedTimer = 0;
  g.heat = 1;
  if (reason) g.toast(reason);
  if (g.wanted > 0 && g.audio) g.audio.siren();
}

export function updateWanted(g, dt) {
  if (g.wanted === 0) return;
  // Is any police unit close enough to see the player?
  let seen = false;
  for (const c of g.policeCars) if (dist(c.x, c.y, g.player.x, g.player.y) < 520) { seen = true; break; }
  if (!seen) for (const c of g.policeFoot) if (dist(c.x, c.y, g.player.x, g.player.y) < 320) { seen = true; break; }
  g.heat = seen ? 1 : Math.max(0, g.heat - dt / 8);
  if (!seen) {
    g.wantedTimer += dt;
    if (g.wantedTimer > CONFIG.wantedDecaySeconds) {
      g.wanted = Math.max(0, g.wanted - 1);
      g.wantedTimer = 0;
      if (g.wanted === 0) g.toast('You lost the cops.');
      else g.toast(`Wanted level dropped to ${g.wanted} star${g.wanted > 1 ? 's' : ''}.`);
    }
  } else {
    g.wantedTimer = 0;
  }
  // Keep pressure proportional to stars: 1 police car per star (cap 4) + foot cops.
  const wantCars = Math.min(4, g.wanted);
  while (g.policeCars.length < wantCars) spawnPoliceCar(g);
  while (g.policeFoot.length < Math.min(3, g.wanted)) spawnPoliceFoot(g);
  if (g.wanted === 0) {
    g.policeCars.length = 0;
    g.policeFoot.length = 0;
  }
}

function spawnPoliceCar(g) {
  const p = randomRoadPoint(g.city, g.rng);
  // Spawn a little away from the player so they arrive, sirens wailing.
  const car = makeCar(p.x, p.y, 0, { name: 'Interceptor', color: '#111827', speed: 1.2 }, { police: true });
  car.speed = 200;
  g.policeCars.push(car);
  if (g.audio) g.audio.siren();
}

function spawnPoliceFoot(g) {
  const a = g.rng() * Math.PI * 2;
  g.policeFoot.push({
    x: g.player.x + Math.cos(a) * 320, y: g.player.y + Math.sin(a) * 320,
    angle: 0, speed: 170, health: 60, state: 'chase', shirt: '#1e3a8a', name: 'Officer',
  });
}

export function updatePolice(g, dt) {
  for (const car of g.policeCars) {
    const target = Math.atan2(g.player.y - car.y, g.player.x - car.x);
    car.angle += clamp(angleDiff(car.angle, target), -2.4 * dt, 2.4 * dt);
    const wantSpeed = 300 + g.wanted * 55;
    car.speed += clamp(wantSpeed - car.speed, -500 * dt, 320 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = collideBuildings(g.city, nx, ny, 20);
    if (Math.abs(hit.x - nx) > 0.5 || Math.abs(hit.y - ny) > 0.5) { car.speed *= 0.5; car.angle += 0.9 * dt * 10; }
    car.x = hit.x; car.y = hit.y;
    // Ram the player's car.
    if (g.player.inCar && g.player.car) {
      const d = dist(car.x, car.y, g.player.car.x, g.player.car.y);
      if (d < 44) {
        g.player.car.health -= 14 * dt;
        g.player.car.speed *= 0.94;
        car.speed *= 0.9;
        if (g.audio && g.rng() < dt * 2) g.audio.crash();
      }
    }
    // Bust on foot: a police car stopping next to a walking player ends the run.
    if (!g.player.inCar && dist(car.x, car.y, g.player.x, g.player.y) < 40 && Math.abs(car.speed) < 60) {
      busted(g);
    }
  }
  for (const cop of g.policeFoot) {
    if (cop.state === 'down') continue;
    const d = dist(cop.x, cop.y, g.player.x, g.player.y);
    cop.angle = Math.atan2(g.player.y - cop.y, g.player.x - cop.x);
    if (d > 34) {
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      const hit = collideBuildings(g.city, nx, ny, 10);
      cop.x = hit.x; cop.y = hit.y;
    } else if (!g.player.inCar) {
      busted(g);
    } else {
      // Cop tries to drag the player out: damage the car instead.
      if (g.player.car) g.player.car.health -= 8 * dt;
    }
  }
}

export function busted(g) {
  if (g.screen !== 'play') return;
  g.cash = Math.max(0, g.cash - 200);
  g.wanted = 0;
  g.policeCars.length = 0;
  g.policeFoot.length = 0;
  g.player.health = 100;
  g.player.x = g.city.places.hospital.x;
  g.player.y = g.city.places.hospital.y + 60;
  g.player.inCar = false;
  g.player.car = null;
  g.screen = 'busted';
  g.toast('BUSTED — $200 bail, released at the hospital.');
}

export function clearWantedAtSpray(g) {
  if (g.wanted === 0) { g.toast('No heat to lose. The paint is already clean.'); return; }
  if (g.cash < 150) { g.toast('Spray shop costs $150. You cannot afford it.'); return; }
  g.cash -= 150;
  g.wanted = 0;
  g.policeCars.length = 0;
  g.policeFoot.length = 0;
  g.toast('Fresh paint, clean record. Wanted level cleared.');
  if (g.audio) g.audio.cash();
}
