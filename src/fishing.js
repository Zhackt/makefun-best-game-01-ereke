// fishing.js — cast, wait for a bite, timing-bar minigame, catch roll.
// Press F at a fishing spot to cast (costs energy). When a fish bites, a marker
// sweeps the bar: press Space / tap AKSI while it is in the green zone to reel in.
import { FISH_BY_ID, isNight, isSunset } from './data.js';
import { skinEffect } from './player.js';

export function createFishing() {
  return { state: 'idle', spot: null, wait: 0, marker: 0, dir: 1, speed: 1.6, zone: [0.35, 0.65], fish: null, result: null, resultT: 0, usedBait: false, progress: 0, biteT: 0 };
}

export function startCast(f, spot, player) {
  if (f.state !== 'idle' || player.energy < 3) return false;
  f.state = 'waiting'; f.spot = spot;
  // Topi Pantai skin: mancing lebih cepat (gigitan datang lebih cepat).
  f.wait = (1.2 + Math.random() * 2.2) / skinEffect(player, 'fishSpeed');
  f.result = null;
  f.usedBait = false; f.usedRareBait = false;
  if (player.rareBait > 0) { player.rareBait -= 1; f.usedRareBait = true; }
  else if (player.bait > 0) { player.bait -= 1; f.usedBait = true; }
  else if (player.gather && player.gather.fruit > 0) { player.gather.fruit -= 1; f.usedBait = true; }
  else if (player.gather && player.gather.mushroom > 0) { player.gather.mushroom -= 1; f.usedBait = true; }
  player.energy = Math.max(0, player.energy - 3);
  return true;
}

function rollFish(spot, minutes, rodTier, usedBait, boatTier = 1, usedRareBait = false, rareMult = 1) {
  const night = isNight(minutes);
  const sunset = isSunset(minutes);
  const entries = [];
  for (const [id, wDay, wNight] of spot.table) {
    let w = night ? wNight : wDay;
    if (id === 'pari' && sunset && spot.id === 'membuku') w = 2;
    if (id === 'marlin' && !night) w = 0;
    const fish = FISH_BY_ID[id];
    if (fish.rarity === 'Langka' && rodTier < 2) w *= 0.4;
    if (fish.rarity === 'Legendaris' && rodTier < 3) w *= 0.25;
    if (usedBait && fish.rarity !== 'Biasa') w *= 1.8;
    if (usedRareBait && fish.rarity !== 'Biasa') w *= 2.5;
    if (rareMult > 1 && fish.rarity !== 'Biasa') w *= rareMult; // Rompi Penyelam skin
    if (spot.boatOnly && boatTier >= 2 && fish.rarity === 'Langka') w *= 1.3;
    if (spot.boatOnly && boatTier >= 3 && fish.rarity === 'Legendaris') w *= 1.6;
    if (w > 0) entries.push([id, w]);
  }
  if (!entries.length) return FISH_BY_ID.kembung;
  let total = 0; for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  for (const [id, w] of entries) { r -= w; if (r <= 0) return FISH_BY_ID[id]; }
  return FISH_BY_ID[entries[0][0]];
}

export function updateFishing(f, dt, minutes, rodTier, boatTier = 1, holding = false, fishSpeed = 1, rareMult = 1) {
  if (f.state === 'waiting') {
    f.wait -= dt;
    if (f.wait <= 0) {
      // Stardew-style bite: the marker sweeps; HOLD Space (or AKSI) while it is
      // inside the green zone to fill the catch meter. Rarer fish = faster marker.
      f.state = 'bite';
      f.marker = 0; f.dir = 1; f.progress = 0; f.biteT = 12;
      f.fish = rollFish(f.spot, minutes, rodTier, f.usedBait, boatTier, f.usedRareBait, rareMult);
      const hard = f.fish.rarity === 'Langka' ? 0.35 : f.fish.rarity === 'Legendaris' ? 0.75 : 0;
      f.speed = 1.5 + Math.random() * 0.9 + hard;
      const zw = 0.30 - rodTier * 0.02;
      const z0 = 0.15 + Math.random() * (0.85 - zw);
      f.zone = [z0, z0 + zw];
    }
  } else if (f.state === 'bite') {
    f.marker += f.dir * f.speed * dt;
    if (f.marker > 1) { f.marker = 1; f.dir = -1; }
    if (f.marker < 0) { f.marker = 0; f.dir = 1; }
    f.biteT -= dt;
    const inZone = f.marker >= f.zone[0] && f.marker <= f.zone[1];
    if (holding && inZone) f.progress += dt * 1.2 * fishSpeed;
    else f.progress -= dt * 0.05;
    f.progress = Math.max(0, Math.min(1, f.progress));
    if (f.progress >= 1) {
      f.state = 'result'; f.resultT = 2.4;
      f.result = { fish: f.fish, ok: true };
    } else if (f.biteT <= 0) {
      f.state = 'result'; f.resultT = 2.4;
      f.result = { fish: f.fish, ok: false };
    }
  } else if (f.state === 'result') {
    f.resultT -= dt;
    if (f.resultT <= 0) { f.state = 'idle'; f.result = null; }
  }
}

/** Legacy single-tap reel (kept for the screenshot staging); the game uses hold-to-fill. */
export function reelIn(f) {
  if (f.state !== 'bite') return null;
  const ok = f.marker >= f.zone[0] && f.marker <= f.zone[1];
  f.state = 'result'; f.resultT = 2.4;
  f.result = ok ? { fish: f.fish, ok: true } : { fish: f.fish, ok: false };
  return f.result;
}

export function cancelFishing(f) { if (f.state !== 'idle') { f.state = 'idle'; f.result = null; } }
