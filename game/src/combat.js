// Combat: the player's pistol and fists, enemy gang members, bullets,
// muzzle flashes, damage, death and the hospital respawn.
import { dist } from './random.js';
import { addWanted } from './police.js';
import { scarePeds } from './peds.js';

export function makeEnemy(x, y, opts = {}) {
  return {
    x, y, angle: 0, speed: 120, health: opts.health || 60,
    shirt: opts.shirt || '#7f1d1d', name: opts.name || 'Enforcer',
    state: 'fight', shootT: 1 + Math.random(), punchT: 0,
  };
}

export function playerShoot(g) {
  if (g.player.ammo <= 0) {
    g.toast('Out of ammo — buy more at AMMU-NATION (Neon Strip).');
    return;
  }
  g.player.ammo -= 1;
  const a = g.player.aimAngle;
  const bx = g.player.x + Math.cos(a) * 26;
  const by = g.player.y + Math.sin(a) * 26;
  g.bullets.push({ x: bx, y: by, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.7, fromPlayer: true });
  g.particles.push({ x: bx, y: by, vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#fde047', size: 10 });
  g.player.recoil = 0.12;
  if (g.audio) g.audio.shoot();
  scarePeds(g.peds, g.player.x, g.player.y, 320);
  if (g.wanted === 0) addWanted(g, 1, 'Shots fired — the police are coming.');
}

export function playerPunch(g) {
  if (g.player.punchT > 0) return;
  g.player.punchT = 0.45;
  const a = g.player.aimAngle;
  const px = g.player.x + Math.cos(a) * 34;
  const py = g.player.y + Math.sin(a) * 34;
  let hit = false;
  for (const e of g.enemies) {
    if (e.state !== 'down' && dist(px, py, e.x, e.y) < 30) { damageEnemy(g, e, 25); hit = true; }
  }
  for (const c of g.policeFoot) {
    if (c.state !== 'down' && dist(px, py, c.x, c.y) < 30) { c.health -= 25; if (c.health <= 0) c.state = 'down'; hit = true; }
  }
  for (const p of g.peds) {
    if (p.state !== 'down' && dist(px, py, p.x, p.y) < 30) { p.state = 'down'; hit = true; addWanted(g, 1, 'Assault — witnesses called the police.'); }
  }
  if (hit && g.audio) g.audio.punch();
}

export function damageEnemy(g, e, dmg) {
  e.health -= dmg;
  g.particles.push({ x: e.x, y: e.y, vx: 0, vy: -30, life: 0.3, max: 0.3, color: '#ef4444', size: 8 });
  if (e.health <= 0 && e.state !== 'down') {
    e.state = 'down';
    g.cash += 25;
    g.toast(`+ $25 — ${e.name} is down.`);
  }
}

export function updateBullets(g, dt) {
  for (const b of g.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (b.fromPlayer) {
      for (const e of g.enemies) {
        if (e.state !== 'down' && dist(b.x, b.y, e.x, e.y) < 18) { damageEnemy(g, e, 34); b.life = 0; break; }
      }
      if (b.life <= 0) continue;
      for (const c of g.policeFoot) {
        if (c.state !== 'down' && dist(b.x, b.y, c.x, c.y) < 16) { c.health -= 34; if (c.health <= 0) c.state = 'down'; addWanted(g, 1, 'You shot an officer — wanted level up.'); b.life = 0; break; }
      }
    } else {
      if (dist(b.x, b.y, g.player.x, g.player.y) < 16 && !g.player.inCar) {
        hurtPlayer(g, 12);
        b.life = 0;
      } else if (g.player.inCar && g.player.car && dist(b.x, b.y, g.player.car.x, g.player.car.y) < 26) {
        g.player.car.health -= 6;
        b.life = 0;
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);
}

export function updateEnemies(g, dt) {
  for (const e of g.enemies) {
    if (e.state === 'down') continue;
    const d = dist(e.x, e.y, g.player.x, g.player.y);
    e.angle = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    if (d > 260) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (d > 60) {
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 0.9 + g.rng() * 0.8;
        g.bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.angle) * 520, vy: Math.sin(e.angle) * 520, life: 0.9, fromPlayer: false });
        if (g.audio) g.audio.shoot();
      }
    } else {
      e.punchT -= dt;
      if (e.punchT <= 0) { e.punchT = 0.8; hurtPlayer(g, 8); if (g.audio) g.audio.punch(); }
    }
  }
}

export function hurtPlayer(g, dmg) {
  if (g.screen !== 'play') return;
  if (g.player.armor > 0) {
    const absorbed = Math.min(g.player.armor, dmg);
    g.player.armor -= absorbed;
    dmg -= absorbed;
  }
  g.player.health -= dmg;
  g.particles.push({ x: g.player.x, y: g.player.y, vx: 0, vy: -20, life: 0.3, max: 0.3, color: '#ef4444', size: 9 });
  if (g.player.health <= 0) {
    g.player.health = 100;
    g.player.armor = 0;
    g.cash = Math.max(0, g.cash - 150);
    g.wanted = 0;
    g.policeCars.length = 0;
    g.policeFoot.length = 0;
    g.enemies = g.enemies.filter((e) => e.state !== 'down');
    g.player.x = g.city.places.hospital.x;
    g.player.y = g.city.places.hospital.y + 60;
    g.player.inCar = false;
    g.player.car = null;
    g.screen = 'wasted';
    g.toast('WASTED — the hospital patched you up. $150 bill.');
  }
}
