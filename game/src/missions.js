// The story: 8 missions for Marla Vane, Kess Okafor and Vex Marlowe.
// Each mission is a small state machine: go somewhere, do something, go
// somewhere else, get paid. The current objective always shows on the HUD
// and as a pulsing marker on the map and minimap.
import { MISSIONS } from './config.js';
import { dist } from './random.js';
import { addWanted } from './police.js';
import { makeEnemy } from './combat.js';
import { makeCar } from './vehicles.js';

export function missionDef(g) { return MISSIONS[g.missionIndex]; }

export function startMission(g) {
  // Idempotent: clear anything a previous start of this mission spawned
  // (marked cars, the taxi passenger, mission enemies) before spawning fresh.
  g.cars = g.cars.filter((c) => !c.marked);
  if (g.mission?.passenger) {
    const i = g.peds.indexOf(g.mission.passenger);
    if (i >= 0) g.peds.splice(i, 1);
  }
  g.enemies = [];
  const m = missionDef(g);
  if (!m) return;
  g.mission = { stage: 0, progress: 0, need: 0, crates: [], passenger: null, target: null };
  const P = g.city.places;
  if (m.kind === 'steal') {
    g.mission.target = { x: 1000, y: 2600, label: 'Steal the blue Comet' };
    g.mission.need = 1;
    // The mark: a blue Comet parked by the motel.
    const car = makeCar(1000, 2600, 0, { name: 'Comet', color: '#3b82f6', speed: 1.0 }, { parked: true });
    car.marked = true;
    g.cars.push(car);
    g.mission.markCar = car;
  } else if (m.kind === 'taxi') {
    g.mission.target = { x: P.plaza.x, y: P.plaza.y + 40, label: 'Pick up the passenger' };
    g.mission.passenger = { x: P.plaza.x, y: P.plaza.y + 40, shirt: '#f39c12', name: 'Accountant', state: 'wait' };
    g.peds.push(g.mission.passenger);
  } else if (m.kind === 'combat') {
    const spots = m.id === 3
      ? [{ x: 400, y: 1450 }, { x: 400, y: 1560 }, { x: 400, y: 1640 }]
      : [{ x: 1600, y: 1350 }, { x: 1600, y: 1500 }, { x: 1800, y: 1400 }, { x: 1800, y: 1500 }, { x: 1600, y: 1600 }];
    g.enemies = spots.map((s, i) => makeEnemy(s.x, s.y, { name: m.id === 3 ? 'Dock Enforcer' : 'Coral King', shirt: m.id === 3 ? '#7f1d1d' : '#14532d', health: 70 }));
    g.mission.need = spots.length;
    g.mission.target = { x: spots[0].x, y: spots[0].y, label: `Defeat the attackers (0/${spots.length})` };
  } else if (m.kind === 'escape') {
    addWanted(g, 2, 'The crew tipped off the police — 2 stars!');
    g.mission.target = { x: P.safehouse.x, y: P.safehouse.y, label: 'Lose the cops, then reach the safehouse' };
  } else if (m.kind === 'collect') {
    const spots = [{ x: 400, y: 1400 }, { x: 400, y: 1520 }, { x: 400, y: 1620 }, { x: 400, y: 1680 }];
    g.mission.crates = spots.map((s) => ({ x: s.x, y: s.y, taken: false }));
    g.mission.need = 4;
    g.mission.target = { x: spots[0].x, y: spots[0].y, label: 'Collect the crates (0/4)' };
  } else if (m.kind === 'heist') {
    g.mission.target = { x: P.arcade.x, y: P.arcade.y, label: 'Grab the cash box in the arcade' };
  } else if (m.kind === 'deliver') {
    g.mission.target = { x: P.marina.x, y: P.marina.y, label: 'Deliver the ledger to the marina yacht' };
  }
  g.toast(`MISSION ${m.id}: ${m.name} — ${m.brief}`);
}

export function completeMission(g) {
  const m = missionDef(g);
  g.cash += m.reward;
  g.missionsDone += 1;
  g.missionIndex += 1;
  g.mission = null;
  if (g.audio) g.audio.missionDone();
  g.toast(`MISSION COMPLETE: ${m.name} — +$${m.reward}`);
  if (g.missionIndex >= MISSIONS.length) {
    g.storyDone = true;
    g.toast('DEBT PAID. Solmar Bay is yours now — free roam, Rio.');
  } else {
    startMission(g);
  }
}

export function updateMissions(g, dt) {
  if (!g.mission) return;
  const m = missionDef(g);
  if (!m) return;
  const P = g.city.places;
  const px = g.player.x, py = g.player.y;
  const near = (t, r = 70) => dist(px, py, t.x, t.y) < r;

  if (m.kind === 'steal') {
    if (g.mission.stage === 0) {
      if (g.player.inCar && g.player.car === g.mission.markCar) {
        g.mission.stage = 1;
        g.mission.target = { x: P.garage.x, y: P.garage.y, label: 'Drive the Comet to the garage' };
        g.toast('Nice. Now bring it to the garage.');
      }
    } else if (near(P.garage, 90)) {
      completeMission(g);
    }
  } else if (m.kind === 'taxi') {
    if (g.mission.stage === 0) {
      if (g.mission.passenger && near(g.mission.passenger, 60)) {
        g.mission.stage = 1;
        g.mission.passenger.state = 'riding';
        g.mission.target = { x: 1000, y: 600, label: 'Drive the passenger to the west plaza' };
        g.toast('Passenger aboard. Drive smooth — he hates scratches.');
      }
    } else if (g.player.inCar && near({ x: 1000, y: 600 }, 90)) {
      g.mission.passenger.state = 'done';
      completeMission(g);
    } else if (!g.player.inCar && g.mission.stage === 1) {
      g.toast('The passenger is waiting in the car. Get back in!');
      g.mission.stage = 0;
      g.mission.target = { x: P.plaza.x, y: P.plaza.y + 40, label: 'Pick up the passenger' };
    }
  } else if (m.kind === 'combat') {
    const down = g.enemies.filter((e) => e.state === 'down').length;
    g.mission.progress = down;
    const alive = g.enemies.find((e) => e.state !== 'down');
    g.mission.target = alive
      ? { x: alive.x, y: alive.y, label: `Defeat the attackers (${down}/${g.mission.need})` }
      : { x: g.player.x, y: g.player.y, label: `Defeat the attackers (${down}/${g.mission.need})` };
    if (down >= g.mission.need) completeMission(g);
  } else if (m.kind === 'escape') {
    if (g.wanted === 0 && near(P.safehouse, 90)) completeMission(g);
    else if (g.wanted === 0) g.mission.target = { x: P.safehouse.x, y: P.safehouse.y, label: 'Clean! Reach the safehouse' };
  } else if (m.kind === 'collect') {
    for (const c of g.mission.crates) {
      if (!c.taken && near(c, 60)) {
        c.taken = true;
        g.mission.progress += 1;
        if (g.audio) g.audio.pickup();
        g.toast(`Crate ${g.mission.progress}/4 secured.`);
      }
    }
    const got = g.mission.crates.filter((c) => c.taken).length;
    if (got < 4) {
      const next = g.mission.crates.find((c) => !c.taken);
      g.mission.target = { x: next.x, y: next.y, label: `Collect the crates (${got}/4)` };
    } else {
      g.mission.target = { x: P.villa.x, y: P.villa.y, label: 'Deliver the crates to the Hills villa' };
      if (near(P.villa, 90)) completeMission(g);
    }
  } else if (m.kind === 'heist') {
    if (g.mission.stage === 0) {
      if (near(P.arcade, 70)) {
        g.mission.stage = 1;
        addWanted(g, 3, 'ALARM! 3 stars — get to the getaway car!');
        g.mission.target = { x: 2600, y: 800, label: 'Reach the getaway car on the Strip' };
        const car = makeCar(2600, 800, Math.PI / 2, { name: 'Sunset Coupe', color: '#ef4444', speed: 1.25 }, { parked: true });
        car.marked = true;
        g.cars.push(car);
        g.mission.markCar = car;
        g.toast('Cash box grabbed. RUN.');
      }
    } else if (g.player.inCar && g.player.car === g.mission.markCar) {
      completeMission(g);
    }
  } else if (m.kind === 'deliver') {
    if (near(P.marina, 90)) completeMission(g);
  }
}

// 12 hidden sun-coins scattered across the districts: $50 each, a reason to explore.
export function spawnPackages(city, rng) {
  const spots = [];
  const seen = new Set();
  while (spots.length < 12) {
    const x = 200 + Math.floor(rng() * 32) * 100;
    const y = 200 + Math.floor(rng() * 24) * 100;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    spots.push({ x, y, taken: false });
  }
  return spots;
}

export function updatePackages(g) {
  for (const p of g.packages) {
    if (!p.taken && dist(g.player.x, g.player.y, p.x, p.y) < 40) {
      p.taken = true;
      g.cash += 50;
      g.packagesFound += 1;
      if (g.audio) g.audio.pickup();
      g.toast(`Sun-coin found! +$50 (${g.packagesFound}/12)`);
    }
  }
}
