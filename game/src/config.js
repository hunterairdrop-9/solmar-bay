// SOLMAR BAY — tuning, names and story data. All original: a fictional sun-soaked
// coastal city, its own districts, people, gangs and cars. Nothing from any commercial game.
export const CONFIG = {
  worldWidth: 3600,
  worldHeight: 2800,
  tile: 200,               // city block size
  roadWidth: 56,
  playerSpeed: 235,
  sprintMultiplier: 1.55,
  carAccel: 620,
  carMaxSpeed: 560,
  carReverseMax: 200,
  carTurn: 2.6,
  wantedDecaySeconds: 26,
  maxWanted: 5,
  startCash: 150,
  startHealth: 100,
};

export const DISTRICTS = [
  { name: 'Marina', x: 0, y: 0, w: 1200, h: 900, color: '#2e6f8e', blurb: 'yachts, hotels, tourists' },
  { name: 'Old Town', x: 1200, y: 0, w: 1200, h: 900, color: '#8e6f2e', blurb: 'plazas, cafes, the old casino' },
  { name: 'Neon Strip', x: 2400, y: 0, w: 1200, h: 900, color: '#7a2e8e', blurb: 'clubs, arcades, all-night diners' },
  { name: 'The Docks', x: 0, y: 900, w: 1200, h: 1000, color: '#4a5568', blurb: 'crates, cranes, smugglers' },
  { name: 'Hills', x: 1200, y: 900, w: 1200, h: 1000, color: '#2e8e4a', blurb: 'villas, gardens, quiet money' },
  { name: 'Bayfront', x: 2400, y: 900, w: 1200, h: 1000, color: '#0e7490', blurb: 'boardwalk, beach, fairground' },
  { name: 'South Yards', x: 0, y: 1900, w: 3600, h: 900, color: '#6b4a2e', blurb: 'garages, motels, the safehouse' },
];

// Story: Rio Kade, a getaway driver back in Solmar Bay, owes the fixer Marla Vane
// $40,000. Eight missions pay it off, one job at a time.
export const MISSIONS = [
  { id: 1, name: 'First Gear', giver: 'Marla Vane', district: 'South Yards',
    brief: 'Steal the blue Comet parked by the motel and bring it to the garage.',
    objective: 'Steal a car and drive it to the garage marker', kind: 'steal', reward: 400 },
  { id: 2, name: 'Taxi for Trouble', giver: 'Marla Vane', district: 'Old Town',
    brief: 'A nervous accountant needs a ride across town. Do not scratch the paint.',
    objective: 'Pick up the passenger and drive them to the plaza', kind: 'taxi', reward: 650 },
  { id: 3, name: 'Dockside Debt', giver: 'Kess Okafor', district: 'The Docks',
    brief: 'Three dock enforcers are collecting for the wrong crew. Persuade them otherwise.',
    objective: 'Defeat the 3 dock enforcers', kind: 'combat', reward: 900 },
  { id: 4, name: 'The Long Way Home', giver: 'Marla Vane', district: 'Neon Strip',
    brief: 'Lose a 2-star wanted level, then reach the safehouse without being seen.',
    objective: 'Escape the police and reach the safehouse', kind: 'escape', reward: 1200 },
  { id: 5, name: 'Crate Expectations', giver: 'Kess Okafor', district: 'The Docks',
    brief: 'Pick up 4 marked crates from the docks and deliver them to the Hills villa.',
    objective: 'Collect 4 crates, deliver to the villa', kind: 'collect', reward: 1500 },
  { id: 6, name: 'Neon Heist', giver: 'Vex Marlowe', district: 'Neon Strip',
    brief: 'Lift the cash box from the arcade vault. Quiet is optional. Fast is not.',
    objective: 'Grab the cash box and reach the getaway car', kind: 'heist', reward: 2200 },
  { id: 7, name: 'Hillside Ambush', giver: 'Marla Vane', district: 'Hills',
    brief: 'The Coral Kings set a trap on the hill road. Drive through it and settle it.',
    objective: 'Survive the ambush: defeat 5 attackers', kind: 'combat', reward: 3000 },
  { id: 8, name: 'The Last Ledger', giver: 'Marla Vane', district: 'Marina',
    brief: 'One final run: deliver the ledger to the marina yacht and the debt is gone.',
    objective: 'Deliver the ledger to the yacht at the marina', kind: 'deliver', reward: 5000 },
];

export const CAR_MODELS = [
  { name: 'Comet', color: '#3b82f6', speed: 1.0, price: 800 },
  { name: 'Dune Runner', color: '#d97706', speed: 0.9, price: 600 },
  { name: 'Vesper', color: '#7c3aed', speed: 1.15, price: 1500 },
  { name: 'Harbor Taxi', color: '#eab308', speed: 0.95, price: 700 },
  { name: 'Mule Truck', color: '#64748b', speed: 0.8, price: 900 },
  { name: 'Sunset Coupe', color: '#ef4444', speed: 1.25, price: 2200 },
];

export const RADIO_STATIONS = ['BAY FM 88.1 — sunset pop', 'NEON 104 — synth drive', 'DOCK RADIO — late-night talk'];

export const CONTROLS_TEXT = [
  'WASD / Arrows — move & drive   Mouse — aim   Click — shoot',
  'E — steal / enter car, exit car   SPACE — punch / handbrake   SHIFT — sprint',
  'M — missions   P — pause   Q — save   H — horn   R — radio   N — mute',
];
