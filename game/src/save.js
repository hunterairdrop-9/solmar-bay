// Save / load: one localStorage slot, autosaved after every mission and on S,
// offered as Continue on the title screen.
export const SAVE_KEY = 'solmar-bay.save.v1';

export function saveGame(g) {
  try {
    const data = {
      cash: g.cash,
      health: g.player.health,
      armor: g.player.armor,
      ammo: g.player.ammo,
      missionIndex: g.missionIndex,
      missionsDone: g.missionsDone,
      packagesFound: g.packagesFound,
      packagesTaken: g.packages.map((p) => p.taken),
      playerX: g.player.x,
      playerY: g.player.y,
      clockHours: g.clockHours,
      day: g.day,
      storyDone: g.storyDone,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() { return loadSave() !== null; }

export function applySave(g, data) {
  g.cash = data.cash;
  g.player.health = data.health;
  g.player.armor = data.armor;
  g.player.ammo = data.ammo;
  g.missionIndex = data.missionIndex;
  g.missionsDone = data.missionsDone;
  g.packagesFound = data.packagesFound || 0;
  g.packages.forEach((p, i) => { p.taken = !!data.packagesTaken?.[i]; });
  g.player.x = data.playerX;
  g.player.y = data.playerY;
  g.clockHours = data.clockHours;
  g.day = data.day;
  g.storyDone = !!data.storyDone;
}
