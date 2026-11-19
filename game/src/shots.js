// Screenshot staging: ?shot=cover|street|chase|dusk stages a real scene from the
// live simulation (never a mock-up), steps it forward a few seconds so traffic,
// police and particles are mid-motion, then sets window.__shotReady.
import { CONFIG } from './config.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { makeCar } from './vehicles.js';

function stepGame(g, seconds, update) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) update(1 / 60);
}

export function stageShot(name, g, update) {
  // Start from the title backdrop, then drop into play for the staged scene.
  g.screen = 'play';
  if (name === 'street') {
    // On foot in Old Town: traffic, pedestrians, mission marker ahead.
    g.player.x = 1400; g.player.y = 500;
    g.player.aimAngle = -0.6;
    g.clockHours = 10.5;
    g.missionIndex = 1;
    startMission(g);
    stepGame(g, 2.5, update);
  } else if (name === 'chase') {
    // Driving a stolen Sunset Coupe through Neon Strip, 3 stars, police on the tail.
    // Start west so the car ends up centred after two seconds of driving.
    const car = makeCar(2200, 400, 0, { name: 'Sunset Coupe', color: '#ef4444', speed: 1.25 }, {});
    car.speed = 420;
    g.cars.push(car);
    g.player.inCar = true;
    g.player.car = car;
    g.player.x = car.x; g.player.y = car.y;
    g.clockHours = 18.2;
    g.missionIndex = 5;
    startMission(g);
    addWanted(g, 3, '3 stars');
    g.cash = 3420;
    stepGame(g, 2.0, update);
    // Keep the chase in frame: the player's car at speed, a police car on its tail.
    car.speed = 430;
    const cop = g.policeCars[0];
    if (cop) {
      cop.x = car.x - Math.cos(car.angle) * 150;
      cop.y = car.y - Math.sin(car.angle) * 150 + 40;
      cop.angle = car.angle;
      cop.speed = 380;
    }
  } else if (name === 'dusk') {
    // Shootout at the Docks at dusk: enemies, wanted stars, HUD full.
    g.player.x = 400; g.player.y = 1500;
    g.player.aimAngle = 0.4;
    g.player.ammo = 48;
    g.clockHours = 18.6;
    g.missionIndex = 2;
    startMission(g);
    g.cash = 1980;
    // Step first while clean, so no cop can bust the player mid-staging;
    // then raise the heat and park a police car in frame for the shot.
    stepGame(g, 3.0, update);
    addWanted(g, 2, '2 stars');
    const cop = makeCar(g.player.x + 280, g.player.y - 70, Math.PI, { name: 'Interceptor', color: '#111827', speed: 1.2 }, { police: true });
    cop.speed = 200;
    g.policeCars.push(cop);
  } else {
    // cover: driving through the Marina at golden hour, 1 star, mission marker ahead.
    const car = makeCar(700, 400, Math.PI / 2, { name: 'Vesper', color: '#7c3aed', speed: 1.15 }, {});
    car.speed = 300;
    g.cars.push(car);
    g.player.inCar = true;
    g.player.car = car;
    g.player.x = car.x; g.player.y = car.y;
    g.clockHours = 17.4;
    g.missionIndex = 0;
    startMission(g);
    addWanted(g, 1, '1 star');
    g.cash = 1250;
    stepGame(g, 2.5, update);
    car.speed = 320;
    const cop = g.policeCars[0];
    if (cop) {
      cop.x = car.x - Math.cos(car.angle) * 170;
      cop.y = car.y - Math.sin(car.angle) * 170 - 30;
      cop.angle = car.angle;
      cop.speed = 300;
    }
  }
  // The caller (main.js) paints the staged scene and sets window.__shotReady.
}
