// Drawing only: camera, the city, cars, people, bullets, particles, the HUD
// with its minimap, and every menu screen. Canvas 2D, no assets.
import { CONFIG, CONTROLS_TEXT, DISTRICTS, MISSIONS, RADIO_STATIONS } from './config.js';
import { clamp, dist } from './random.js';
import { districtAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_MISSIONS = 'missions';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, dpr = 1;
  const cam = { x: 0, y: 0, zoom: 0.9 };

  function resize() {
    dpr = window.devicePixelRatio || 1;
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function text(s, x, y, size, color, align = 'left', weight = '600') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }

  function skyTint(g) {
    const h = g.clockHours;
    if (h >= 6 && h < 17) return null;            // day
    if (h >= 17 && h < 19.5) return 'rgba(255,120,40,0.14)'; // sunset
    if (h >= 5 && h < 6) return 'rgba(255,120,40,0.10)';
    return 'rgba(8,12,40,0.34)';                  // night
  }

  function drawWorld(g) {
    const city = g.city;
    const viewW = vw / cam.zoom, viewH = vh / cam.zoom;
    const x0 = cam.x - viewW / 2, y0 = cam.y - viewH / 2;
    ctx.save();
    ctx.scale(cam.zoom * dpr, cam.zoom * dpr);
    ctx.translate(-x0, -y0);

    // Ground + district tints.
    ctx.fillStyle = '#8a7f63';
    ctx.fillRect(0, 0, city.W, city.H);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.color + '33';
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    // Water: marina basin NW + sea along the south edge.
    ctx.fillStyle = '#1d6f8f';
    ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, city.H - 100, city.W, 100);
    // Beach.
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, city.H - 150, city.W, 50);
    // Yacht at the marina.
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(150, 90, 130, 34);
    ctx.fillStyle = '#0e7490';
    ctx.fillRect(190, 60, 50, 30);

    // Roads.
    ctx.fillStyle = '#3f4756';
    for (const rx of city.roadsV) ctx.fillRect(rx - CONFIG.roadWidth / 2, 0, CONFIG.roadWidth, city.H);
    for (const ry of city.roadsH) ctx.fillRect(0, ry - CONFIG.roadWidth / 2, city.W, CONFIG.roadWidth);
    // Centre dashes.
    ctx.fillStyle = '#e8c547';
    for (const rx of city.roadsV) for (let y = 20; y < city.H; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    for (const ry of city.roadsH) for (let x = 20; x < city.W; x += 64) ctx.fillRect(x, ry - 2, 30, 4);

    // Parks + trees.
    for (const p of city.parks) { ctx.fillStyle = p.green; ctx.fillRect(p.x, p.y, p.w, p.h); }
    for (const t of city.trees) {
      ctx.fillStyle = '#2d6a33';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    }

    // Buildings: shadow, body, roof, windows.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(255,255,190,0.75)';
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let i = 0; i < b.windows; i++) {
        const wx = b.x + 8 + (i % cols) * ((b.w - 16) / cols);
        const wy = b.y + 8 + Math.floor(i / cols) * ((b.h - 16) / rows);
        if (wy < b.y + b.h - 10) ctx.fillRect(wx, wy, 7, 9);
      }
    }

    // Named places.
    for (const key of Object.keys(city.places)) {
      const p = city.places[key];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
      ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      text(p.label, p.x, p.y - 16, 13, '#fff', 'center');
    }

    // Sun-coins.
    for (const p of g.packages) {
      if (p.taken) continue;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + 4);
    }

    // Mission crates.
    if (g.mission?.crates) {
      for (const c of g.mission.crates) {
        if (c.taken) continue;
        ctx.fillStyle = '#92400e';
        ctx.fillRect(c.x - 12, c.y - 12, 24, 24);
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2;
        ctx.strokeRect(c.x - 12, c.y - 12, 24, 24);
      }
    }

    // Mission marker: pulsing beacon.
    const target = g.mission?.target;
    if (target) {
      const pulse = 1 + Math.sin(g.time * 4) * 0.15;
      ctx.fillStyle = 'rgba(253,224,71,0.25)';
      ctx.beginPath(); ctx.arc(target.x, target.y, 46 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 22);
      ctx.lineTo(target.x + 14, target.y + 4);
      ctx.lineTo(target.x - 14, target.y + 4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
    }

    // Cars.
    for (const car of [...g.cars, ...g.policeCars]) drawCar(g, car, car === g.player.car);
    // Pedestrians.
    for (const p of g.peds) drawPerson(g, p);
    // Enemies + foot cops.
    for (const e of g.enemies) drawPerson(g, e, true);
    for (const c of g.policeFoot) drawPerson(g, c, false, true);
    // Player.
    if (!g.player.inCar) drawPlayer(g);
    // Bullets.
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3;
    for (const b of g.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
    // Particles.
    for (const p of g.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Night / sunset tint over the world.
    const tint = skyTint(g);
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(x0, y0, viewW, viewH); }
    ctx.restore();
  }

  function drawCar(g, car, isPlayer = false) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-27, -18, 54, 36, 9); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-22, -12, 46, 26);
    ctx.fillStyle = car.police ? '#1e293b' : car.color;
    ctx.beginPath();
    ctx.roundRect(-22, -13, 44, 26, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(4, -10, 10, 20);
    ctx.fillRect(-14, -10, 8, 20);
    if (car.marked) {
      ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-25, -16, 50, 32, 8); ctx.stroke();
    }
    if (car.police) {
      const on = Math.floor(g.time * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ef4444' : '#3b82f6';
      ctx.fillRect(-6, -13, 12, 6);
      ctx.fillStyle = on ? '#3b82f6' : '#ef4444';
      ctx.fillRect(-6, 7, 12, 6);
    }
    if (car.brakeLight) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-24, -11, 3, 6); ctx.fillRect(-24, 5, 3, 6);
    }
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(22, -10, 3, 5); ctx.fillRect(22, 5, 3, 5);
    // Damage smoke.
    if (car.health < 45) {
      ctx.fillStyle = 'rgba(100,100,100,0.6)';
      ctx.beginPath(); ctx.arc(10, 0, 8 + Math.sin(g.time * 9) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(g, p, isEnemy = false, isCop = false) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.state === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath(); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(p.angle || 0);
    // Body + head + gun arm for enemies.
    ctx.fillStyle = isCop ? '#1e3a8a' : p.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(4, 0, 6, 0, Math.PI * 2); ctx.fill();
    if (isEnemy) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(6, -2, 14, 4);
    }
    if (isCop) {
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();
    if (p.state === 'flee') {
      text('!', p.x, p.y - 18, 16, '#ef4444', 'center', '800');
    }
  }

  function drawPlayer(g) {
    const p = g.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle);
    if (p.recoil > 0) ctx.translate(-p.recoil * 30, 0);
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(4, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.fillRect(6, -2, 16, 4); // pistol
    ctx.restore();
    // Health ring when hurt.
    if (p.health < 40) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawMinimap(g) {
    const mw = 210, mh = 164;
    const x = vw - mw - 14, y = vh - mh - 14;
    const sx = mw / g.city.W, sy = mh / g.city.H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    ctx.beginPath(); ctx.roundRect(x, y, mw, mh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath(); ctx.rect(x, y, mw, mh); ctx.clip();
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.color + '55';
      ctx.fillRect(x + d.x * sx, y + d.y * sy, d.w * sx, d.h * sy);
    }
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(x, y, 400 * sx, 200 * sy);
    ctx.fillRect(x, y + (g.city.H - 100) * sy, mw, 100 * sy);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const rx of g.city.roadsV) ctx.fillRect(x + rx * sx - 0.5, y, 1, mh);
    for (const ry of g.city.roadsH) ctx.fillRect(x, y + ry * sy - 0.5, mw, 1);
    const dot = (px, py, color, r = 2.5) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x + px * sx, y + py * sy, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const c of g.cars) if (!c.police) dot(c.x, c.y, '#e5e7eb', 1.5);
    for (const c of g.policeCars) dot(c.x, c.y, '#3b82f6', 3);
    for (const c of g.policeFoot) dot(c.x, c.y, '#60a5fa', 2.5);
    for (const e of g.enemies) if (e.state !== 'down') dot(e.x, e.y, '#ef4444', 3);
    const t = g.mission?.target;
    if (t) {
      ctx.fillStyle = '#fde047';
      const px = x + t.x * sx, py = y + t.y * sy;
      ctx.beginPath();
      ctx.moveTo(px, py - 6); ctx.lineTo(px + 5, py + 4); ctx.lineTo(px - 5, py + 4);
      ctx.closePath(); ctx.fill();
    }
    // Player arrow.
    const px = x + g.player.x * sx, py = y + g.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(g.player.inCar && g.player.car ? g.player.car.angle : g.player.aimAngle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    text('SOLMAR BAY', x + 6, y + 14, 10, 'rgba(255,255,255,0.75)', 'left', '700');
  }

  function drawHud(g) {
    const d = districtAt(g.player.x, g.player.y);
    // Top-left: cash, health, armor, ammo.
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.beginPath(); ctx.roundRect(12, 12, 250, 96, 10); ctx.fill();
    text(`$ ${g.cash.toLocaleString('en-US')}`, 24, 42, 26, '#4ade80', 'left', '800');
    text(`DAY ${g.day}`, 250, 42, 14, '#fff', 'right');
    bar(24, 52, 226, 10, g.player.health / 100, '#ef4444');
    text('HP', 24, 72, 11, '#fca5a5', 'left', '700');
    bar(24, 78, 226, 8, g.player.armor / 100, '#60a5fa');
    text('ARMOR', 24, 94, 11, '#93c5fd', 'left', '700');
    text(`AMMO ${g.player.ammo}`, 250, 94, 12, '#fde047', 'right', '700');

    // Top-right: wanted stars + clock + district.
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.beginPath(); ctx.roundRect(vw - 262, 12, 250, 66, 10); ctx.fill();
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < g.wanted ? '★' : '☆';
    text(stars, vw - 24, 40, 24, g.wanted > 0 ? '#facc15' : '#64748b', 'right', '800');
    const hh = Math.floor(g.clockHours), mm = Math.floor((g.clockHours - hh) * 60);
    text(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  •  ${d.name}`, vw - 24, 66, 14, '#fff', 'right');

    // Objective box, bottom-left.
    const m = g.missionIndex < MISSIONS.length ? MISSIONS[g.missionIndex] : null;
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.beginPath(); ctx.roundRect(12, vh - 108, 420, 94, 10); ctx.fill();
    if (m) {
      text(`MISSION ${m.id}/8 — ${m.name.toUpperCase()}  •  $${m.reward}`, 24, vh - 80, 14, '#fde047', 'left', '800');
      text(g.mission?.target?.label || m.objective, 24, vh - 54, 14, '#fff');
      text(`${m.giver}  •  ${m.district}`, 24, vh - 32, 12, '#94a3b8');
    } else {
      text('STORY COMPLETE — DEBT PAID', 24, vh - 80, 14, '#4ade80', 'left', '800');
      text('Free roam: collect sun-coins, steal cars, outrun the law.', 24, vh - 54, 14, '#fff');
    }

    // Speed + radio, bottom-right above minimap.
    if (g.player.inCar && g.player.car) {
      const kmh = Math.round(Math.abs(g.player.car.speed) * 0.36);
      text(`${kmh} km/h`, vw - 240, vh - 216, 26, '#fff', 'right', '800');
      text(g.player.car.model.name, vw - 240, vh - 194, 13, '#cbd5e1', 'right');
    }
    text(`♪ ${RADIO_STATIONS[g.audio?.radio || 0]}`, vw - 240, vh - 176, 12, '#f0abfc', 'right');

    // Toasts.
    let ty = 120;
    for (const t of g.toasts.slice(-3)) {
      ctx.fillStyle = 'rgba(10,14,24,0.78)';
      const w = Math.min(vw - 40, 34 + t.text.length * 7.4);
      ctx.beginPath(); ctx.roundRect((vw - w) / 2, ty, w, 30, 8); ctx.fill();
      text(t.text, vw / 2, ty + 20, 14, '#fff', 'center');
      ty += 38;
    }

    // Off-screen mission direction arrow.
    const t = g.mission?.target;
    if (t) {
      const viewW = vw / cam.zoom, viewH = vh / cam.zoom;
      const sx = (t.x - (cam.x - viewW / 2)) / viewW * vw;
      const sy = (t.y - (cam.y - viewH / 2)) / viewH * vh;
      if (sx < 0 || sx > vw || sy < 0 || sy > vh) {
        const cx = clamp(sx, 60, vw - 60), cy = clamp(sy, 120, vh - 120);
        const a = Math.atan2(sy - vh / 2, sx - vw / 2);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillStyle = '#fde047';
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
        ctx.restore();
        text(`${Math.round(dist(g.player.x, g.player.y, t.x, t.y))}m`, cx, cy + 30, 12, '#fde047', 'center', '700');
      }
    }

    drawMinimap(g);
    // Controls hint.
    text('E car   •   M missions   •   P pause   •   Q save   •   H horn', 14, vh - 122, 12, 'rgba(255,255,255,0.65)');
  }

  function bar(x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2); ctx.fill();
  }

  function panel(title, lines, prompt, accent = '#fde047') {
    const w = Math.min(760, vw - 60);
    const h = 150 + lines.length * 30;
    const x = (vw - w) / 2, y = (vh - h) / 2;
    ctx.fillStyle = 'rgba(8,12,24,0.88)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    text(title, vw / 2, y + 62, 40, '#fff', 'center', '800');
    lines.forEach((ln, i) => text(ln, vw / 2, y + 108 + i * 30, 16, '#cbd5e1', 'center'));
    text(prompt, vw / 2, y + h - 26, 16, accent, 'center', '700');
  }

  function drawTitle(g) {
    drawWorld(g);
    ctx.fillStyle = 'rgba(6,10,22,0.55)';
    ctx.fillRect(0, 0, vw, vh);
    text('SOLMAR BAY', vw / 2, vh * 0.16, 84, '#fde047', 'center', '900');
    text('6 districts  •  8 story missions  •  24 cars to steal  •  5-star wanted  •  12 sun-coins', vw / 2, vh * 0.16 + 44, 19, '#fff', 'center');
    const save = g.saveData;
    const lines = [
      'Rio Kade is back in Solmar Bay, and he owes the fixer Marla Vane $40,000.',
      'One job at a time. Steal the cars. Lose the cops. Pay the debt. Keep the city.',
      '',
      save ? `CONTINUE — Day ${save.day}, $${save.cash.toLocaleString('en-US')}, mission ${save.missionIndex + 1}/8 (saved ${save.savedAt.slice(0, 10)})` : 'No save yet — a fresh start in the South Yards.',
      '',
      ...CONTROLS_TEXT,
    ];
    panel('', lines, save ? 'ENTER — Continue      N — New game' : 'ENTER or CLICK — Start', '#fde047');
    text('An original game. No Rockstar names, maps or art — Solmar Bay is its own city.', vw / 2, vh - 26, 13, 'rgba(255,255,255,0.6)', 'center');
  }

  function drawMissions(g) {
    drawWorld(g);
    ctx.fillStyle = 'rgba(6,10,22,0.72)';
    ctx.fillRect(0, 0, vw, vh);
    const w = Math.min(820, vw - 60);
    const x = (vw - w) / 2;
    const h = 120 + MISSIONS.length * 44;
    const y = (vh - h) / 2;
    ctx.fillStyle = 'rgba(8,12,24,0.92)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2; ctx.stroke();
    text('MISSIONS — THE $40,000 DEBT', vw / 2, y + 52, 30, '#fde047', 'center', '800');
    MISSIONS.forEach((m, i) => {
      const my = y + 96 + i * 44;
      const state = i < g.missionIndex ? '✓ DONE' : i === g.missionIndex ? '▶ NOW' : '○ LOCKED';
      const color = i < g.missionIndex ? '#4ade80' : i === g.missionIndex ? '#fde047' : '#64748b';
      text(`${m.id}. ${m.name} — ${m.giver} (${m.district})`, x + 28, my, 16, i === g.missionIndex ? '#fff' : '#cbd5e1', 'left', i === g.missionIndex ? '700' : '400');
      text(`${state}  $${m.reward}`, x + w - 28, my, 15, color, 'right', '700');
    });
    text(`Missions done: ${g.missionsDone}/8   •   Sun-coins: ${g.packagesFound}/12   •   Cash: $${g.cash.toLocaleString('en-US')}`, vw / 2, y + h - 24, 14, '#94a3b8', 'center');
    text('M or ESC — back to the streets', vw / 2, vh - 26, 14, '#fde047', 'center', '700');
  }

  function draw(g, screen) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, vw, vh);
    // Camera follows the player; wider view while driving.
    const targetZoom = g.player.inCar ? 0.85 : 1.05;
    cam.zoom += (targetZoom - cam.zoom) * 0.05;
    const viewW = vw / cam.zoom, viewH = vh / cam.zoom;
    cam.x = clamp(g.player.x, viewW / 2, g.city.W - viewW / 2);
    cam.y = clamp(g.player.y, viewH / 2, g.city.H - viewH / 2);
    if (screen === SCREEN_TITLE) {
      cam.x = 1800; cam.y = 1400; cam.zoom = 0.42;
      drawTitle(g);
      return;
    }
    drawWorld(g);
    if (screen === SCREEN_PLAY) drawHud(g);
    else if (screen === SCREEN_PAUSED) panel('PAUSED', ['The city waits. The debt does not.', ...CONTROLS_TEXT], 'P or ESC — resume   •   Q — save now');
    else if (screen === SCREEN_MISSIONS) drawMissions(g);
    else if (screen === SCREEN_WASTED) panel('WASTED', ['The hospital patched you up. $150 bill.', 'Your car is gone. The debt remains.'], 'ENTER — back to the streets');
    else if (screen === SCREEN_BUSTED) panel('BUSTED', ['The Solmar Bay PD took $200 bail.', 'Released at the hospital. Drive cleaner next time.'], 'ENTER — back to the streets');
  }

  return { draw };
}
