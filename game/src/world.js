// The city of Solmar Bay: a road grid, buildings, parks, beach, docks and the
// named places missions use (safehouse, garage, hospital, spray shop, shops).
// Pure data + collision helpers; drawing lives in render.js.
import { CONFIG, DISTRICTS } from './config.js';
import { makeRng, pick, range, rangeInt } from './random.js';

const BUILDING_COLORS = ['#b08968', '#7f8c8d', '#c9a227', '#5d6d7e', '#a569bd', '#5499c7', '#e59866', '#48c9b0', '#f1948a', '#85c1e9'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const W = CONFIG.worldWidth, H = CONFIG.worldHeight, T = CONFIG.tile, RW = CONFIG.roadWidth;
  const roadsV = []; // x centres of vertical roads
  const roadsH = []; // y centres of horizontal roads
  for (let x = T; x < W; x += T) roadsV.push(x);
  for (let y = T; y < H; y += T) roadsH.push(y);

  const buildings = [];
  const parks = [];
  const trees = [];
  // One building (or park) per block, inset from the roads.
  for (let bx = 0; bx < W / T; bx++) {
    for (let by = 0; by < H / T; by++) {
      const x0 = bx * T + RW / 2 + 14, y0 = by * T + RW / 2 + 14;
      const w = T - RW - 28, h = T - RW - 28;
      const cx = x0 + w / 2, cy = y0 + h / 2;
      // Beach strip along the south edge, water beyond it.
      if (by === Math.floor(H / T) - 1) continue;
      // The marina basin in the north-west corner.
      if (bx <= 1 && by === 0) continue;
      const r = rng();
      if (r < 0.14) {
        parks.push({ x: x0, y: y0, w, h, green: pick(rng, ['#4d9e57', '#5da864', '#3e8e4f']) });
        for (let i = 0; i < 5; i++) trees.push({ x: range(rng, x0 + 10, x0 + w - 10), y: range(rng, y0 + 10, y0 + h - 10), r: range(rng, 6, 11) });
        continue;
      }
      const tall = rng() < 0.22;
      buildings.push({
        x: x0, y: y0, w, h,
        color: pick(rng, BUILDING_COLORS),
        roof: pick(rng, ['#3a3f4a', '#4a4038', '#2f3b46']),
        height: tall ? rangeInt(rng, 3, 6) : rangeInt(rng, 1, 2),
        windows: rangeInt(rng, 6, 18),
        district: districtAt(cx, cy).name,
      });
    }
  }

  const places = {
    safehouse: { x: 400, y: 2400, label: 'SAFEHOUSE' },
    garage: { x: 600, y: 2400, label: 'GARAGE' },
    hospital: { x: 1400, y: 400, label: 'HOSPITAL' },
    sprayShop: { x: 1000, y: 2000, label: 'SPRAY SHOP' },
    gunShop: { x: 2400, y: 400, label: 'AMMU-NATION' },
    marina: { x: 200, y: 120, label: 'MARINA YACHT' },
    plaza: { x: 1800, y: 600, label: 'OLD PLAZA' },
    villa: { x: 1600, y: 1400, label: 'HILLS VILLA' },
    arcade: { x: 2800, y: 400, label: 'NEON ARCADE' },
    docks: { x: 400, y: 1400, label: 'DOCKS' },
  };

  return { seed, roadsV, roadsH, buildings, parks, trees, places, W, H };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[DISTRICTS.length - 1];
}

export function isOnRoad(city, x, y) {
  const RW = CONFIG.roadWidth;
  for (const rx of city.roadsV) if (Math.abs(x - rx) < RW / 2 + 6) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) < RW / 2 + 6) return true;
  return false;
}

export function nearestRoadPoint(city, x, y) {
  let best = null, bd = 1e9;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

// Circle (radius r) vs buildings: push the point out of any building it overlaps.
export function collideBuildings(city, x, y, r) {
  let nx = x, ny = y;
  for (const b of city.buildings) {
    if (nx + r < b.x || nx - r > b.x + b.w || ny + r < b.y || ny - r > b.y + b.h) continue;
    const dxl = nx + r - b.x, dxr = b.x + b.w - (nx - r);
    const dyt = ny + r - b.y, dyb = b.y + b.h - (ny - r);
    const m = Math.min(dxl, dxr, dyt, dyb);
    if (m === dxl) nx = b.x - r;
    else if (m === dxr) nx = b.x + b.w + r;
    else if (m === dyt) ny = b.y - r;
    else ny = b.y + b.h + r;
  }
  return { x: nx, y: ny };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  return null;
}

// Random point on a road, for spawning traffic / pedestrians.
export function randomRoadPoint(city, rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, city.roadsV) + range(rng, -14, 14), y: range(rng, 100, city.H - 100), vertical: true };
  }
  return { x: range(rng, 100, city.W - 100), y: pick(rng, city.roadsH) + range(rng, -14, 14), vertical: false };
}

export function clampToWorld(x, y, margin = 20) {
  return {
    x: Math.max(margin, Math.min(CONFIG.worldWidth - margin, x)),
    y: Math.max(margin, Math.min(CONFIG.worldHeight - margin, y)),
  };
}
