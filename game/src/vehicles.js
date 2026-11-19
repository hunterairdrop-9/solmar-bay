// Vehicles: traffic that drives the road grid, parked cars to steal, and the
// player's car physics (arcade handling, collisions, damage, horn).
import { CONFIG, CAR_MODELS } from './config.js';
import { clamp, dist, pick, range, rangeInt } from './random.js';
import { collideBuildings, isOnRoad, nearestRoadPoint, randomRoadPoint } from './world.js';

let nextCarId = 1;

export function makeCar(x, y, angle, model, opts = {}) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    model,
    color: opts.color || model.color,
    traffic: !!opts.traffic,
    police: !!opts.police,
    parked: !!opts.parked,
    stolen: false,
    health: 100,
    targetSpeed: opts.targetSpeed || 0,
    dir: 1,
    stuck: 0,
    brakeLight: false,
  };
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng);
    const model = pick(rng, CAR_MODELS);
    const angle = p.vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(p.x, p.y, angle, model, { traffic: true, targetSpeed: range(rng, 90, 150) });
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng);
    const model = pick(rng, CAR_MODELS);
    const angle = p.vertical ? Math.PI / 2 : 0;
    cars.push(makeCar(p.x + range(rng, -20, 20), p.y + range(rng, -20, 20), angle + range(rng, -0.2, 0.2), model, { parked: true }));
  }
  return cars;
}

// Traffic AI: follow the current road; at an intersection, sometimes turn.
export function updateTraffic(car, city, rng, dt, allCars) {
  const ahead = 46;
  const ax = car.x + Math.cos(car.angle) * ahead;
  const ay = car.y + Math.sin(car.angle) * ahead;
  const onRoadAhead = isOnRoad(city, ax, ay);
  // Slow for the car ahead.
  let slow = false;
  for (const o of allCars) {
    if (o === car) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const fwd = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (fwd > 0 && fwd < 70 && side < 26) { slow = true; break; }
  }
  const want = slow ? 0 : car.targetSpeed;
  car.speed += clamp(want - car.speed, -260 * dt, 160 * dt);
  if (!onRoadAhead) {
    // Reached an intersection edge or drifted off: snap to the nearest road and maybe turn.
    const p = nearestRoadPoint(city, car.x, car.y);
    if (p) {
      car.x = p.x; car.y = p.y;
      if (rng() < 0.3) {
        car.angle = p.vertical ? pick(rng, [Math.PI / 2, -Math.PI / 2]) : pick(rng, [0, Math.PI]);
      } else {
        car.angle = p.vertical ? (Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2) : (Math.cos(car.angle) > 0 ? 0 : Math.PI);
      }
    }
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, city.W - 40);
  car.y = clamp(car.y, 40, city.H - 40);
}

// Player driving: arcade bicycle-ish model with drift on handbrake.
export function updatePlayerCar(car, input, dt, city, audio) {
  const maxSpeed = CONFIG.carMaxSpeed * car.model.speed;
  const accel = input.down('w') || input.down('arrowup');
  const brake = input.down('s') || input.down('arrowdown');
  const handbrake = input.down(' ');
  if (accel) car.speed += CONFIG.carAccel * dt;
  if (brake) car.speed -= (car.speed > 0 ? CONFIG.carAccel * 1.4 : CONFIG.carAccel * 0.7) * dt;
  car.speed = clamp(car.speed, -CONFIG.carReverseMax, maxSpeed);
  // Drag + rolling resistance.
  car.speed -= car.speed * (handbrake ? 1.6 : 0.35) * dt;
  if (!accel && !brake && Math.abs(car.speed) < 8) car.speed = 0;
  const steer = (input.down('a') || input.down('arrowleft') ? -1 : 0) + (input.down('d') || input.down('arrowright') ? 1 : 0);
  const grip = handbrake ? 0.45 : 1;
  if (Math.abs(car.speed) > 5) {
    car.angle += steer * CONFIG.carTurn * grip * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 160, 0.35, 1);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collideBuildings(city, nx, ny, 20);
  const crashed = Math.abs(hit.x - nx) > 0.5 || Math.abs(hit.y - ny) > 0.5;
  if (crashed && Math.abs(car.speed) > 180) {
    car.health -= 6;
    car.speed *= 0.35;
    if (audio) audio.crash();
  } else if (crashed) {
    car.speed *= 0.6;
  }
  car.x = hit.x; car.y = hit.y;
  car.brakeLight = brake || handbrake;
  if (audio) audio.setEngine(Math.abs(car.speed) / maxSpeed);
  return crashed;
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function randomModel(rng) { return pick(rng, CAR_MODELS); }
export function modelPrice(model) { return model.price; }
export function carLabel(car) { return `${car.model.name}${car.police ? ' (POLICE)' : ''}`; }
