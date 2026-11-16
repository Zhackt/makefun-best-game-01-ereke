// player.js — third-person controller: WASD moves relative to the camera yaw,
// mouse (pointer lock) or arrow keys turn the camera, camera follows behind the player.
import * as THREE from '../vendor/three.module.min.js';
import { makePersonMesh, makePlayerMesh, groundHeight, LAKE, LAKE_WATER_Y } from './world.js';
import { WORLD, SEA_X, SEA_Y, SEA_MAX_X, TITANIC_DECK_Y, SKIN_DEFS } from './data.js';

export const WALK_SPEED = 9;
export const BOAT_SPEED = 15;
export const SWIM_SPEED = 2.2; // berenang lebih lambat dari jalan kaki

/** Water at a point (sea or lake): null on land, { type, y } in the water. */
export function waterAt(x, z) {
  if (x > SEA_X - 4) return { type: 'sea', y: SEA_Y };
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (dl < LAKE.r) return { type: 'lake', y: LAKE_WATER_Y };
  return null;
}

/** Effect multiplier of the equipped skin for a type (1 = no bonus). */
export function skinEffect(p, type) {
  const def = p.skin ? SKIN_DEFS[p.skin] : null;
  if (!def || !def.effect) return 1;
  if (def.effect.type === type) return def.effect.value;
  // Dewa skin boosts XP and sell both.
  if (p.skin === 'dewa' && (type === 'sell' || type === 'xp')) return 1.25;
  return 1;
}

/** Boat speed by tier: 1 wooden, 2 motor, 3 large, 4 giant ship (slower to turn). */
export function boatSpeed(tier) { return [0, 12, 18, 24, 20][tier] || 12; }

export function createPlayer() {
  const mesh = makePlayerMesh('cowo', 'pendek', 0x3498db);
  mesh.visible = true;
  return {
    mesh, x: 62, z: 78, y: 0, yaw: Math.PI, camYaw: Math.PI, camPitch: 0.32,
    onBoat: false, riding: null, vehicle: null, energy: 100, money: 50000, earned: 0, walkways: null,
    swimming: false, freeBoat: false, titanic: false, // berenang / perahu kecil gratis / Kapal Raksasa
    rod: 1, bait: 0, boat: false, boatTier: 0, houses: {},
    gender: 'cowo', hair: 'pendek', shirt: 0x3498db,
    xp: 0, fragments: 0, rareBait: 0, daysPlayed: 0, chestsFound: 0, coconuts: 0, gather: { wood: 0, fruit: 0, mushroom: 0 },
    titles: [], skins: [], skin: null, shopSkins: [], motoPaint: null, boatPaint: null, outfit: 'default', defeated: {},
    fish: {}, caught: {}, moving: false, walkPhase: 0,
    held: 'rod', // what the character holds: rod | hand | pisau | pedang | obor | kayu | senter
    vy: 0, airY: 0, // jump: vertical velocity + height above the ground
    _lastStep: 0, // walk-phase index of the last footstep sound played
  };
}

export function placePlayer(p, x, z, colliders, walkways) {
  // Collision-aware (16 Nov): a teleport must never drop the player inside a
  // solid box — houses are solid AABBs with no door, so a player placed in one
  // can never walk out (blockedAt rejects every step). If the target is
  // blocked, land on the nearest free spot instead (spiral, up to ~5 units).
  // Callers that do not pass colliders get the old behaviour (title shots).
  let px = x; let pz = z;
  if (colliders) {
    const s = findFreeSpot(x, z, p.onBoat, colliders, walkways || p.walkways);
    px = s.x; pz = s.z;
  }
  p.x = px; p.z = pz;
  p.airY = 0; p.vy = 0; // teleports and mounts always land the player
  p.mesh.position.set(px, groundHeight(px, pz), pz);
}

/** Nearest point to (x,z) that is not blocked: the point itself, else an
    expanding ring search (12 directions per ring, radii 0.8..maxR). Returns
    the original point if nothing free is found nearby. */
export function findFreeSpot(x, z, onBoat, colliders, walkways, maxR = 5) {
  if (!blockedAt(x, z, onBoat, colliders, walkways)) return { x, z };
  for (let r = 0.8; r <= maxR; r += 0.8) {
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + r; // rotate each ring a little
      const nx = x + Math.cos(a) * r;
      const nz = z + Math.sin(a) * r;
      if (!blockedAt(nx, nz, onBoat, colliders, walkways)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}

export function walkwayAt(x, z, walkways) {
  if (!walkways) return null;
  for (const w of walkways) {
    if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) return w;
  }
  return null;
}

/** Ground height under the player: a bridge/pier deck, the boat, or the terrain.
    deckY: deck height while aboard the giant ship (Kapal Raksasa). */
export function surfaceY(x, z, onBoat, walkways, deckY = null) {
  if (onBoat) return deckY !== null ? deckY : 0.7;
  const w = walkwayAt(x, z, walkways);
  return w ? w.y : groundHeight(x, z);
}

/** Deck height for the player while on a boat (Kapal Raksasa = geladak). */
export function boatDeckY(p) { return p.titanic ? TITANIC_DECK_Y : null; }

export function blockedAt(x, z, onBoat, colliders, walkways) {
  if (walkwayAt(x, z, walkways)) return false; // decks are walkable, even over water
  // In the water (sea or lake) the player swims or sails: no land rules —
  // only the world edge, the far sea edge, and solid colliders (e.g. cliff).
  const w = waterAt(x, z);
  if (w) {
    if (z < WORLD.minZ + 2 || z > WORLD.maxZ - 2) return true;
    if (w.type === 'sea' && x > SEA_MAX_X - 2) return true;
    if (onBoat && x < SEA_X - 30) return true; // boat stays out at sea
    for (const c of colliders) {
      if (x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) return true;
    }
    return false;
  }
  if (x < WORLD.minX + 2 || x > WORLD.maxX - 2 || z < WORLD.minZ + 2 || z > WORLD.maxZ - 2) return true;
  if (!onBoat && x > SEA_X - 4) return true; // sea is for boats only (waterAt covers it)
  if (onBoat && x < SEA_X - 30) return true; // boat stays out at sea
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r - 2) return true;
  for (const c of colliders) {
    if (x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) return true;
  }
  return false;
}

export function updatePlayer(p, keys, dt, colliders) {
  // Arrow keys turn the camera (mouse fallback); WASD moves relative to camera.
  if (keys.has('arrowleft')) p.camYaw += 1.9 * dt;
  if (keys.has('arrowright')) p.camYaw -= 1.9 * dt;
  if (keys.has('arrowup')) p.camPitch = Math.max(0.08, p.camPitch - 1.2 * dt);
  if (keys.has('arrowdown')) p.camPitch = Math.min(1.1, p.camPitch + 1.2 * dt);

  let fx = 0; let fz = 0;
  if (keys.has('w')) { fx -= Math.sin(p.camYaw); fz -= Math.cos(p.camYaw); }
  if (keys.has('s')) { fx += Math.sin(p.camYaw); fz += Math.cos(p.camYaw); }
  if (keys.has('a')) { fx -= Math.cos(p.camYaw); fz += Math.sin(p.camYaw); }
  if (keys.has('d')) { fx += Math.cos(p.camYaw); fz -= Math.sin(p.camYaw); }
  p.moving = fx !== 0 || fz !== 0;
  if (p.moving) {
    const len = Math.hypot(fx, fz); fx /= len; fz /= len;
    let speed;
    let walk = p.walkways;
    if (p.riding === 'moto') speed = 16 * skinEffect(p, 'motoSpeed');
    else if (p.riding === 'car') { speed = onRoad(p.x, p.z) ? 20 : 12; walk = null; }
    else if (p.onBoat) speed = boatSpeed(p.boatTier || 1);
    else if (p.swimming) speed = SWIM_SPEED;
    else speed = WALK_SPEED * skinEffect(p, 'walkSpeed');
    speed *= dt;
    const nx = p.x + fx * speed; const nz = p.z + fz * speed;
    if (!blockedAt(nx, p.z, p.onBoat, colliders, walk)) p.x = nx;
    if (!blockedAt(p.x, nz, p.onBoat, colliders, walk)) p.z = nz;
    p.yaw = Math.atan2(fx, fz);
    p.walkPhase += dt * 9;
    if (!p.riding && Math.floor(p.walkPhase) % 60 === 0 && p.energy > 0) p.energy = Math.max(0, p.energy - 0.05);
  }
  // Swimming: walking into the sea or the lake switches to swim mode; walking
  // back to shore switches back. Boats and vehicles take priority. A walkway
  // deck (pier / bridge) stands above the water, so standing on one is
  // walking, not swimming — even over the sea (Jembatan Lasora).
  const w = waterAt(p.x, p.z);
  p.swimming = !p.riding && !p.onBoat && !!w && !walkwayAt(p.x, p.z, p.walkways);
  // Jump: vertical velocity + gravity, on foot only (never on a vehicle/boat,
  // never while swimming).
  if (p.riding || p.onBoat || p.swimming) { p.airY = 0; p.vy = 0; }
  else if (p.airY > 0 || p.vy > 0) {
    p.vy -= 30 * dt;
    p.airY += p.vy * dt;
    if (p.airY <= 0) { p.airY = 0; p.vy = 0; }
  }
  const gy = surfaceY(p.x, p.z, p.onBoat, p.walkways, boatDeckY(p));
  if (p.riding && p.vehicle) {
    // The vehicle carries the player: sync the vehicle mesh, sit the rider on it.
    const v = p.vehicle;
    v.x = p.x; v.z = p.z; v.yaw = p.yaw;
    v.mesh.position.set(p.x, gy, p.z);
    v.mesh.rotation.y = p.yaw;
    p.mesh.position.set(p.x, gy + (p.riding === 'moto' ? 0.55 : 0), p.z);
    p.mesh.visible = p.riding === 'moto'; // inside the car the rider is hidden
    p.mesh.rotation.y = p.yaw;
    p.mesh.position.y = gy + (p.riding === 'moto' ? 0.55 : 0) + (p.moving ? Math.abs(Math.sin(p.walkPhase)) * 0.05 : 0);
    return;
  }
  p.mesh.visible = true;
  p.mesh.position.set(p.x, gy, p.z);
  p.mesh.rotation.y = p.yaw;
  // Simple walk bob + leg swing, plus the jump height above the ground.
  // While swimming the body floats on the water surface (gentle bobbing).
  let my = gy + p.airY + (p.moving ? Math.abs(Math.sin(p.walkPhase)) * 0.12 : 0);
  if (p.swimming) {
    const w = waterAt(p.x, p.z);
    if (w) my = w.y - 0.4 + (p.moving ? Math.abs(Math.sin(p.walkPhase)) * 0.15 : 0); // chest-deep, bobbing
  }
  p.mesh.position.y = my;
  const legL = p.mesh.getObjectByName('legL'); const legR = p.mesh.getObjectByName('legR');
  if (legL && legR) {
    legL.rotation.x = p.moving ? Math.sin(p.walkPhase) * 0.6 : 0;
    legR.rotation.x = p.moving ? -Math.sin(p.walkPhase) * 0.6 : 0;
  }
}

/** Position the camera behind the player, looking at them.
    GTA-style feel: the camera lags softly behind a fast vehicle and the FOV
    widens with speed. */
export function updateCamera(p, camera, dt = 0.016) {
  const dist = 10; const height = 4.2;
  const gy = surfaceY(p.x, p.z, p.onBoat, p.walkways, boatDeckY(p));
  const cx = p.x + Math.sin(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cz = p.z + Math.cos(p.camYaw) * Math.cos(p.camPitch) * dist;
  const cy = gy + height + Math.sin(p.camPitch) * dist * 0.7;
  const k = 1 - Math.exp(-6 * dt);
  if (camera.position.distanceTo(new THREE.Vector3(cx, cy, cz)) > 40) {
    camera.position.set(cx, Math.max(cy, 1.2), cz); // snap on teleports / shot staging
  } else {
    camera.position.x += (cx - camera.position.x) * k;
    camera.position.y += (Math.max(cy, 1.2) - camera.position.y) * k;
    camera.position.z += (cz - camera.position.z) * k;
  }
  camera.lookAt(p.x, gy + 1.6, p.z);
  const targetFov = p.riding ? (p.riding === 'car' ? 70 : 66) : (p.onBoat ? 64 : 60);
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * k;
    camera.updateProjectionMatrix();
  }
}

export function addFish(p, id) { p.fish[id] = (p.fish[id] || 0) + 1; p.caught[id] = true; }
export function collectionCount(p) { return Object.keys(p.caught).length; }

export function sellAllFish(p, prices, fotd = null, modifier = null) {
  let total = 0; let n = 0;
  for (const [id, count] of Object.entries(p.fish)) {
    const mult = fotd && fotd.fish.id === id ? fotd.mult : 1;
    const mod = modifier ? modifier(id) : 1;
    total += (prices[id] || 0) * count * mult * mod; n += count;
  }
  // Rumah Ereke perk: gudang ikan, harga jual +10%.
  if (p.houses && p.houses.ereke) total = Math.round(total * 1.1);
  // Skin effect: Baju Nelayan +10% (or rank skins stronger).
  total = Math.round(total * skinEffect(p, 'sell'));
  p.fish = {};
  p.money += total; p.earned += total;
  return { total, n };
}
