// Pedestrians: walk the sidewalks, chat in pairs, flee from gunfire and
// police chases, and scream (visually) when a car comes at them.
import { clamp, dist, pick, range } from './random.js';
import { collideBuildings, randomRoadPoint } from './world.js';

const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9'];
const NAMES = ['Mara', 'Tomas', 'Lena', 'Ivo', 'Nadia', 'Petar', 'Sofia', 'Dario', 'Ana', 'Luka', 'Mia', 'Bruno'];

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng);
    peds.push({
      id: i, name: pick(rng, NAMES),
      x: p.x + range(rng, -30, 30), y: p.y + range(rng, -30, 30),
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 28, 55),
      shirt: pick(rng, SHIRTS),
      state: 'walk', // walk | flee | down
      fleeX: 0, fleeY: 0, panic: 0,
      wanderT: range(rng, 1, 4),
    });
  }
  return peds;
}

export function updatePeds(peds, city, rng, dt, danger) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    if (danger && dist(p.x, p.y, danger.x, danger.y) < 260) {
      p.state = 'flee';
      p.panic = 2.5;
      const a = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.fleeX = Math.cos(a); p.fleeY = Math.sin(a);
    }
    if (p.state === 'flee') {
      p.panic -= dt;
      const nx = p.x + p.fleeX * 150 * dt;
      const ny = p.y + p.fleeY * 150 * dt;
      const hit = collideBuildings(city, nx, ny, 10);
      p.x = hit.x; p.y = hit.y;
      p.angle = Math.atan2(p.fleeY, p.fleeX);
      if (p.panic <= 0) p.state = 'walk';
      continue;
    }
    p.wanderT -= dt;
    if (p.wanderT <= 0) {
      p.wanderT = range(rng, 1.5, 5);
      p.angle = range(rng, 0, Math.PI * 2);
    }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    const hit = collideBuildings(city, nx, ny, 10);
    if (Math.abs(hit.x - nx) > 0.5 || Math.abs(hit.y - ny) > 0.5) p.angle += Math.PI / 2;
    p.x = clamp(hit.x, 30, city.W - 30);
    p.y = clamp(hit.y, 30, city.H - 30);
  }
}

export function scarePeds(peds, x, y, radius = 260) {
  for (const p of peds) {
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee'; p.panic = 2.5;
      const a = Math.atan2(p.y - y, p.x - x);
      p.fleeX = Math.cos(a); p.fleeY = Math.sin(a);
    }
  }
}
