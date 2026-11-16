// world.js — builds low-poly Ereke: terrain, animated sea, beaches, town, mosque,
// fort, lake, palms, boats. Also owns collision boxes and the ground-height function.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, SEA_X, SEA_Y, SEA_MAX_X, PLACES, TREASURE_CHESTS, MONSTERS, SPOTS, FREE_BOAT_MAX_X } from './data.js';
import { IS_TOUCH } from './ui.js';

export const LAKE = { x: -118, z: 82, r: 34 };
// Water levels (measured from groundHeight): the lake sits at its low east
// shore, where the player fishes (rim ~1.0–1.4 there); the Bone river runs
// in a shallow channel whose bed is carved in groundHeight below.
export const LAKE_WATER_Y = 1.5;
export const RIVER_WATER_Y = 0.1;

let seed = 987654321;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

/** Gentle hills inland (west), flat coast. Deterministic, no noise library needed. */
export function groundHeight(x, z) {
  // Bukit Lamoliandu: a flat-topped mesa (height 20) carrying Stadion Lamoliandu.
  // (No early return here: the flat pads below must win over the mesa, e.g.
  // the takraw court's north-east corner sits inside the mesa circle.)
  const dh = Math.hypot(x + 185, z + 60);
  let h;
  if (dh < 28) h = 20;
  else {
    h = 0;
    if (x < -60) h += (-60 - x) * 0.055;
    h += Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05) * 1.1;
    h += Math.sin(x * 0.11) * Math.sin(z * 0.09 + 2.0) * 0.35;
    // Gunung Butur: a climbable cone peak in the far west (hiking trail to the summit).
    const dm = Math.hypot(x + 205, z - 115);
    if (dm < 45) h = Math.max(h, 32 * (1 - dm / 45));
    if (dh < 60) h += (20 - h) * ((60 - dh) / 32); // blend the mesa skirt up to the plateau
    if (x > 150) h = Math.max(h, 0) * 0.2; // beach stays flat
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
    if (dl < LAKE.r + 6) h -= Math.max(0, (LAKE.r + 6 - dl)) * 0.12;
    // River channel under Jembatan Kayu Bone (z≈150, x 95..175) and the inlet
    // under Jembatan Lasora (z≈-140, x 146..198): a shallow V bed so the water
    // plane sits below the banks instead of floating over them.
    const dr = Math.abs(z - 150);
    if (x > 95 && x < 175 && dr < 8) h = Math.min(h, -0.4 + dr * 0.12);
    const di = Math.abs(z + 140);
    if (x > 146 && x < 198 && di < 8) h = Math.min(h, -0.4 + di * 0.12);
    // Lake bed: cap the terrain inside the lake below the waterline, so no
    // hill shoulder pokes through the water disc.
    if (dl < LAKE.r) h = Math.min(h, LAKE_WATER_Y - 0.5);
  }
  // Flat pads under big buildings on the mesa slope (GOR, courts, forts):
  // a wide building on a slope floats on its downhill side and buries its
  // uphill side, so the terrain under each footprint is levelled to the
  // building's own height, with a 3-unit feather blending into the hill.
  // Pad heights are the measured groundHeight at each building's centre.
  const PADS = [
    { x0: -141, z0: -27, x1: -115, z1: -9, h: 4.27 }, // GOR (new spot)
    { x0: -166, z0: -35, x1: -150, z1: -25, h: 14.28 }, // basketball court
    { x0: -218, z0: -43.5, x1: -206, z1: -36.5, h: 17.98 }, // takraw court
    { x0: -150, z0: -89, x1: -130, z1: -71, h: 9.12 }, // Fort Kalisusu
    { x0: -127, z0: -105.5, x1: -113, z1: -94.5, h: 3.69 }, // Benteng Lipu
  ];
  for (const p of PADS) {
    const dx = Math.max(p.x0 - x, 0, x - p.x1);
    const dz = Math.max(p.z0 - z, 0, z - p.z1);
    const d = Math.hypot(dx, dz); // 0 inside the rect, growing outside it
    if (d < 3) {
      const t = 1 - d / 3;
      const s = t * t * (3 - 2 * t); // smoothstep feather
      h = h + (p.h - h) * s;
    }
  }
  return h;
}

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
}

function box(w, h, d, color, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cone(r, h, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function makeHouse(w, d, wall, roof) {
  const g = new THREE.Group();
  box(w, 3, d, wall, 0, 1.5, 0, g);
  const prism = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.2, 4), mat(roof));
  prism.position.y = 4.1; prism.rotation.y = Math.PI / 4; prism.scale.z = d / w;
  prism.castShadow = true;
  g.add(prism);
  box(w * 0.3, 1.8, 0.15, 0x5b3a1e, 0, 0.9, d / 2 + 0.02, g, false);
  return g;
}

export function makePalm(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.4 * scale, 5 * scale, 6), mat(0x8a5a2b));
  trunk.position.y = 2.5 * scale; trunk.rotation.z = 0.12; trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 5; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 3.4 * scale, 4), mat(0x2e8b47));
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.3 * scale, 5.2 * scale, Math.sin(a) * 1.3 * scale);
    leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

export function makeBoat(color = 0x8b5a2b) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1.8), mat(color));
  hull.position.y = 0.5; hull.castShadow = true;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), mat(color));
  bow.position.set(3.1, 0.5, 0); bow.rotation.z = -Math.PI / 2;
  g.add(bow);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 5), mat(0x5b3a1e));
  mast.position.y = 2.4; g.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  sail.position.set(0.9, 2.4, 0); g.add(sail);
  return g;
}

/** Free small boat (sampan): a simple dugout canoe, smaller than any bought boat. */
export function makeSampan() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.9), mat(0x8b5a2b));
  hull.position.y = 0.25; hull.castShadow = true; g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), mat(0x8b5a2b));
  bow.position.set(1.7, 0.25, 0); bow.rotation.z = -Math.PI / 2; g.add(bow);
  const stern = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 4), mat(0x6b4423));
  stern.position.set(-1.6, 0.25, 0); stern.rotation.z = Math.PI / 2; g.add(stern);
  for (const px of [-0.6, 0.6]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.9), mat(0x6b4423));
    plank.position.set(px, 0.52, 0); g.add(plank);
  }
  const paddle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), mat(0x5b3a1e));
  paddle.position.set(0.2, 0.6, 0.3); paddle.rotation.z = 0.7; g.add(paddle);
  return g;
}

/** Giant ship "KM Titanik Ereke": a long hull, two decks, two funnels, masts.
    Built from boxes like every model in this game. The main deck top sits at
    local y 3.1 (world TITANIC_DECK_Y 3.65 when the group floats at SEA_Y). */
export function makeTitanic() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 6), mat(0x1a2a3a));
  hull.position.y = 1.0; hull.castShadow = true; g.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(30.1, 0.4, 6.1), mat(0xc0392b));
  stripe.position.y = 2.2; g.add(stripe);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(28, 0.6, 5.4), mat(0x8b6b3d));
  deck.position.y = 2.8; deck.castShadow = true; g.add(deck);
  const superstructure = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 4), mat(0xecf0f1));
  superstructure.position.set(-10, 4.1, 0); superstructure.castShadow = true; g.add(superstructure);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 5), mat(0xecf0f1));
  bridge.position.set(-5.5, 4.6, 0); g.add(bridge);
  for (const fx of [-13.5, -6.5]) {
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3, 8), mat(0xf1c40f));
    funnel.position.set(fx, 6.6, 0); funnel.castShadow = true; g.add(funnel);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.5, 8), mat(0x222222));
    top.position.set(fx, 8.3, 0); g.add(top);
  }
  for (const mx of [12, -16]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 5), mat(0x6b4a26));
    mast.position.set(mx, 5.6, 0); g.add(mast);
  }
  return g;
}

export function makePersonMesh(shirt, skin = 0xc68863) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), mat(shirt));
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), mat(skin));
  head.position.y = 1.85; head.castShadow = true; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.32), mat(0x2c3e50));
  legL.position.set(-0.22, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  return g;
}

/** Floating text label: a canvas texture on a sprite, always readable. */
export function makeLabel(text, scale = 1) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const font = `bold ${Math.round(44 * scale)}px system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  cv.width = w; cv.height = Math.round(64 * scale);
  const c2 = cv.getContext('2d');
  c2.font = font; c2.textBaseline = 'middle';
  c2.fillStyle = 'rgba(10, 25, 40, 0.72)';
  c2.beginPath(); c2.roundRect(0, 0, w, cv.height, 14); c2.fill();
  c2.fillStyle = '#fff'; c2.fillText(text, 14, cv.height / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set((w / 44) * scale * 1.6, 1.6 * scale, 1);
  return spr;
}

/** Village welcome sign: wooden posts + brown board with a light paper
  panel, and the village name as a floating label above it (same pattern as
  the race start sign). No collider — it stands just off the road edge. */
export function makeWelcomeSign(text) {
  const g = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.18, 0.24, 3.6, 6);
  const postMat = mat(0x6d4c41);
  const p1 = new THREE.Mesh(postGeo, postMat); p1.position.set(-2.5, 1.8, 0); p1.castShadow = true; g.add(p1);
  const p2 = new THREE.Mesh(postGeo, postMat); p2.position.set(2.5, 1.8, 0); p2.castShadow = true; g.add(p2);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.4, 0.25), mat(0x8d6e63));
  panel.position.y = 2.8; panel.castShadow = true; g.add(panel);
  const paper = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.8, 0.06), mat(0xfff9c4));
  paper.position.set(0, 2.8, 0.16); g.add(paper);
  const label = makeLabel(text, 0.62);
  label.position.y = 5.6; g.add(label);
  g.userData.label = label; // the caller may proximity-gate it (placeLabels)
  return g;
}

/** Asphalt road ribbon: a dark-grey strip that hugs the terrain along a
  polyline of waypoints, with a dashed white centre line following the same
  curve (batch 4: Bang asked "mana jalan aspalnya"). Same dark grey as the
  roads drawn on the full map. Sits just above the ground so it never
  z-fights the terrain; the centre line sits a little higher still. */
export function makeRoad(points, width = 5) {
  const pts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i]; const [x2, z2] = points[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.ceil(len / 4));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      pts.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]);
    }
  }
  pts.push(points[points.length - 1]);
  const hw = width / 2;
  const verts = []; const idx = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const [px, pz] = pts[Math.max(0, i - 1)];
    const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    let dx = nx - px; let dz = nz - pz;
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const ox = -dz * hw; const oz = dx * hw;
    verts.push(x + ox, groundHeight(x + ox, z + oz) + 0.15, z + oz);
    verts.push(x - ox, groundHeight(x - ox, z - oz) + 0.15, z - oz);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.95, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  group.add(mesh);
  // Dashed centre line: 1.2 m dashes with 1.2 m gaps, a thin ribbon hugging
  // the same curve 0.07 above the asphalt.
  const dashVerts = []; const dashIdx = [];
  const dashW = 0.18;
  let dist = 0; let vi = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i]; const [x2, z2] = pts[i + 1];
    const segLen = Math.hypot(x2 - x1, z2 - z1);
    const dx = (x2 - x1) / (segLen || 1); const dz = (z2 - z1) / (segLen || 1);
    const ox = -dz * dashW; const oz = dx * dashW;
    let s = 0;
    while (s < segLen) {
      const d0 = s; const d1 = Math.min(s + 1.2, segLen);
      // Dash only when the accumulated distance falls in a dash interval.
      const a0 = dist + d0; const a1 = dist + d1;
      const dashStart = Math.floor(a0 / 2.4) * 2.4;
      if (a0 < dashStart + 1.2) {
        const c0 = Math.max(a0, dashStart); const c1 = Math.min(a1, dashStart + 1.2);
        if (c1 > c0) {
          const t0 = (c0 - dist) / segLen; const t1 = (c1 - dist) / segLen;
          const ax = x1 + (x2 - x1) * t0; const az = z1 + (z2 - z1) * t0;
          const bx = x1 + (x2 - x1) * t1; const bz = z1 + (z2 - z1) * t1;
          dashVerts.push(ax + ox, groundHeight(ax + ox, az + oz) + 0.22, az + oz);
          dashVerts.push(ax - ox, groundHeight(ax - ox, az - oz) + 0.22, az - oz);
          dashVerts.push(bx + ox, groundHeight(bx + ox, bz + oz) + 0.22, bz + oz);
          dashVerts.push(bx - ox, groundHeight(bx - ox, bz - oz) + 0.22, bz - oz);
          dashIdx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
          vi += 4;
        }
      }
      s = d1;
    }
    dist += segLen;
  }
  if (dashVerts.length) {
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.Float32BufferAttribute(dashVerts, 3));
    dgeo.setIndex(dashIdx);
    dgeo.computeVertexNormals();
    const line = new THREE.Mesh(dgeo, new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6, side: THREE.DoubleSide }));
    line.receiveShadow = true;
    group.add(line);
  }
  return group;
}

export function makeMotorbike(color = 0xe74c3c) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.55), mat(color));
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), mat(0x222222));
  seat.position.set(-0.3, 0.95, 0); g.add(seat);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), mat(0x222222));
  handle.rotation.x = Math.PI / 2; handle.position.set(0.9, 1.0, 0); g.add(handle);
  for (const wx of [-0.75, 0.75]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10), mat(0x222222));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.34, 0); wheel.castShadow = true; g.add(wheel);
  }
  return g;
}

export function makeCar(color = 0x3498db) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.9, 1.8), mat(color));
  body.position.y = 0.7; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 1.6), mat(0x2c3e50));
  cabin.position.set(-0.2, 1.55, 0); cabin.castShadow = true; g.add(cabin);
  for (const [wx, wz] of [[-1.25, 0.85], [1.25, 0.85], [-1.25, -0.85], [1.25, -0.85]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 10), mat(0x222222));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.38, wz); g.add(wheel);
  }
  return g;
}

/** The player character: gender, hairstyle, shirt colour and rank skin are changeable. */
export function makePlayerMesh(gender, hair, shirtColor, skin = null) {
  const g = new THREE.Group();
  const shirtMat = skin && skin.glow ? new THREE.MeshStandardMaterial({ color: shirtColor, emissive: 0xaa8800, emissiveIntensity: 0.7 }) : mat(shirtColor);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), shirtMat);
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  if (skin && skin.vest) {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.7, 0.54), mat(0x3e2723));
    vest.position.y = 1.0; g.add(vest);
  }
  if (skin && skin.trim) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.14, 0.54), mat(skin.trim));
    trim.position.y = 0.45; g.add(trim);
  }
  if (skin && skin.cloak) {
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 6), mat(skin.id === 'dewa' ? 0xffd700 : 0x311b92));
    cloak.position.set(0, 0.9, -0.42); cloak.rotation.x = 0.25; g.add(cloak);
  }
  if (skin && skin.glow) {
    const light = new THREE.PointLight(0xffd700, 12, 9);
    light.position.y = 2; g.add(light);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), mat(0xc68863));
  head.position.y = 1.85; head.castShadow = true; g.add(head);
  if (skin && skin.hat === 'straw') {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 8), mat(0xd7ccc8));
    hat.position.y = 2.3; g.add(hat);
  } else if (skin && skin.hat === 'gold') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 8), mat(0xffd700));
    band.position.y = 2.1; g.add(band);
  } else if (skin && skin.hat === 'crown') {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 5), mat(0xffd700));
    crown.position.y = 2.3; g.add(crown);
  }
  const hairMat = mat(0x2b1a12);
  if (hair === 'pendek') {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.58), hairMat);
    h.position.y = 2.16; g.add(h);
  } else if (hair === 'ikal') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), hairMat);
    h.position.y = 2.14; h.scale.set(1, 0.7, 1); g.add(h);
  } else { // panjang
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.58), hairMat);
    top.position.y = 2.16; g.add(top);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.14), hairMat);
    back.position.set(0, 1.85, -0.3); g.add(back);
    if (gender === 'cewe') {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.7, 5), hairMat);
      tail.position.set(0.2, 1.5, -0.34); tail.rotation.z = 0.2; g.add(tail);
    }
  }
  if (gender === 'cewe') {
    // Skirt instead of trousers.
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 6), mat(0xe91e63));
    skirt.position.y = 0.35; g.add(skirt);
  } else {
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.32), mat(0x2c3e50));
    legL.name = 'legL'; legL.position.set(-0.22, 0.35, 0); g.add(legL);
    const legR = legL.clone(); legR.name = 'legR'; legR.position.x = 0.22; g.add(legR);
  }
  return g;
}

/** Small held-item mesh for the character's right hand (simple boxes only).
    Returns null for the empty hand. The caller attaches it to the player
    mesh as 'heldItem' and rebuilds it whenever the held item changes. */
export function makeHeldMesh(held) {
  if (!held || held === 'hand') return null;
  const g = new THREE.Group();
  const blade = mat(0xbdc3c7); const wood = mat(0x8b6b3d); const dark = mat(0x37474f);
  if (held === 'rod') {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), wood);
    r.position.y = 0.5; r.rotation.z = 0.5; g.add(r);
  } else if (held === 'pisau') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.02), blade);
    b.position.y = 0.35; g.add(b);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.03), wood);
    h.position.y = 0.06; g.add(h);
  } else if (held === 'pedang') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.03), blade);
    b.position.y = 0.62; g.add(b);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.04), wood);
    h.position.y = 0.05; g.add(h);
  } else if (held === 'obor') {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.08), wood);
    s.position.y = 0.25; g.add(s);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 6), new THREE.MeshLambertMaterial({ color: 0xff9800, emissive: 0xff6d00, emissiveIntensity: 1.2 }));
    f.position.y = 0.75; g.add(f);
  } else if (held === 'kayu') {
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1), wood);
    k.position.y = 0.3; k.rotation.z = 0.2; g.add(k);
  } else if (held === 'senter') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.32, 0.13), dark);
    b.position.y = 0.2; g.add(b);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), new THREE.MeshLambertMaterial({ color: 0xfff9c4, emissive: 0xfff176, emissiveIntensity: 0.8 }));
    lens.position.y = 0.38; g.add(lens);
  }
  g.position.set(0.55, 0.95, 0.12);
  g.rotation.x = -0.35;
  return g;
}

export function buildWorld(scene) {
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const group = new THREE.Group();
  scene.add(group);
  // Floating labels, proximity-gated: a place's name only shows when the
  // player is within ~30 units of it, so no village name is readable from
  // the forest (nearest village Kalibu is 34 away) or from another village.
  // Declared up here so the BNI label and the welcome-sign labels can join it.
  const placeLabels = [];

  // --- Terrain with vertex colours: sand near sea, grass inland, rock on hills.
  const tw = WORLD.maxX - WORLD.minX; const td = WORLD.maxZ - WORLD.minZ;
  const geo = new THREE.PlaneGeometry(tw, td, 72, 48);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xe8d29a); const grass = new THREE.Color(0x5da24a);
  const grass2 = new THREE.Color(0x7fb069); const rock = new THREE.Color(0x8d8d8d);
  const deepWater = new THREE.Color(0x0d4a5e); // seabed: dark blue-green, never sand
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) + (WORLD.minX + WORLD.maxX) / 2;
    const z = pos.getZ(i) + (WORLD.minZ + WORLD.maxZ) / 2;
    const h = groundHeight(x, z);
    pos.setY(i, h);
    if (x > 148) c.copy(sand);
    else if (h > 7) c.copy(rock);
    else c.copy(grass).lerp(grass2, (Math.sin(x * 0.3 + z * 0.7) + 1) / 2 * 0.6);
    if (x > SEA_X) c.copy(deepWater); // the seabed reads as depth, not sand
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) c.copy(sand);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terrain.position.set((WORLD.minX + WORLD.maxX) / 2, 0, (WORLD.minZ + WORLD.maxZ) / 2);
  terrain.receiveShadow = true;
  group.add(terrain);

  // --- Sea: animated plane east of the beach, stretched far out so the
  // biggest boats never sail past the end of the water (batch 4: x 168..1200).
  // Opaque deep blue; wave troughs stay above the sand (SEA_Y 0.55, ±0.30).
  const seaGeo = new THREE.PlaneGeometry(SEA_MAX_X - SEA_X + 2, td + 60, 48, 24);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshLambertMaterial({ color: 0x0f6a9c, opacity: 1.0, flatShading: true }));
  sea.position.set((SEA_X - 2 + SEA_MAX_X) / 2, SEA_Y, 0);
  group.add(sea);
  const seaBase = seaGeo.attributes.position.array.slice();

  // --- Inland lake. The disc sits at the low east shore's height, and the
  // bed is capped below it in groundHeight, so the whole r=34 disc reads
  // as water from the shore (it used to sit at centre height −2.1+0.4 and
  // was buried under the rim everywhere except a small central puddle).
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 24), mat(0x2a9db5));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(LAKE.x, LAKE_WATER_Y, LAKE.z);
  group.add(lake);

  // --- Cliffs at Tebing Kampa.
  const cliff = new THREE.Mesh(new THREE.ConeGeometry(14, 16, 7), mat(0x7a6a55));
  cliff.position.set(168, 6, -62); cliff.castShadow = true;
  group.add(cliff);
  colliders.push({ minX: 158, maxX: 178, minZ: -72, maxZ: -52 });

  // --- Kota Ereke: market hall, mosque, warung, houses.
  const market = new THREE.Group();
  box(14, 4, 10, 0xd35400, 0, 2, 0, market);
  const mroof = new THREE.Mesh(new THREE.ConeGeometry(10, 3, 4), mat(0x8e44ad));
  mroof.position.y = 5.5; mroof.rotation.y = Math.PI / 4; mroof.castShadow = true;
  market.add(mroof);
  market.position.set(0, groundHeight(0, 28) - 0.5, 28); // -0.5: terrain varies ~0.9 under the hall, so its base floated ~0.5 on the low side
  group.add(market);
  colliders.push({ minX: -7, maxX: 7, minZ: 23, maxZ: 33 });

  const mosque = new THREE.Group();
  box(10, 5, 8, 0xf5f0e1, 0, 2.5, 0, mosque);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1a936f));
  dome.position.y = 5; dome.castShadow = true; mosque.add(dome);
  const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 12, 8), mat(0xf5f0e1));
  minaret.position.set(6.5, 6, 0); minaret.castShadow = true; mosque.add(minaret);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 8), mat(0x1a936f));
  tip.position.set(6.5, 13, 0); mosque.add(tip);
  mosque.position.set(22, groundHeight(22, 62), 62);
  group.add(mosque);
  colliders.push({ minX: 16, maxX: 30, minZ: 57, maxZ: 67 });

  const warung = makeHouse(6, 5, 0xe67e22, 0xc0392b);
  warung.position.set(-14, groundHeight(-14, 46), 46);
  group.add(warung);
  colliders.push({ minX: -17, maxX: -11, minZ: 43.5, maxZ: 48.5 });

  // --- Desa Loji Pantai: player house + neighbours.
  const houseColors = [[0xf1c40f, 0x2980b9], [0xecf0f1, 0xe74c3c], [0xf39c12, 0x27ae60], [0x9b59b6, 0x34495e]];
  const houseSpots = [[58, 52], [74, 70], [48, 76], [70, 88], [86, 52]];
  houseSpots.forEach(([hx, hz], i) => {
    const [wall, roof] = houseColors[i % houseColors.length];
    const h = makeHouse(6, 5, wall, roof);
    h.position.set(hx, groundHeight(hx, hz), hz);
    h.rotation.y = (i % 2) * 0.4;
    group.add(h);
    colliders.push({ minX: hx - 3, maxX: hx + 3, minZ: hz - 2.5, maxZ: hz + 2.5 });
  });

  // --- Bank BNI Ereke (Jl. Raya Bumi Sara'ea): white-blue block, BNI sign.
  const bni = new THREE.Group();
  box(12, 6, 9, 0xf8f9fa, 0, 3, 0, bni);
  box(12, 1.2, 9.4, 0x1a5fb4, 0, 6.4, 0, bni);
  box(3, 2.4, 0.3, 0x1a5fb4, -3, 1.2, 4.6, bni, false);
  box(3, 2.4, 0.3, 0x1a5fb4, 3, 1.2, 4.6, bni, false);
  bni.position.set(-14, groundHeight(-14, 10), 10);
  group.add(bni);
  colliders.push({ minX: -20, maxX: -8, minZ: 5.5, maxZ: 14.5 });
  const bniLabel = makeLabel('BNI Ereke', 0.85);
  bniLabel.position.set(-14, groundHeight(-14, 10) + 9, 10);
  group.add(bniLabel);
  placeLabels.push({ sprite: bniLabel, x: -14, z: 10, range: 30 });

  // --- Buyable houses + rented room (save points).
  const erekeHouse = makeHouse(7, 6, 0x9b59b6, 0x34495e);
  erekeHouse.position.set(24, groundHeight(24, 44), 44);
  group.add(erekeHouse);
  colliders.push({ minX: 20.5, maxX: 27.5, minZ: 41, maxZ: 47 });
  const beachHouse = makeHouse(7, 6, 0xecf0f1, 0x16a085);
  beachHouse.position.set(140, groundHeight(140, -95), -95);
  group.add(beachHouse);
  colliders.push({ minX: 136.5, maxX: 143.5, minZ: -98, maxZ: -92 });
  const rentRoom = makeHouse(5, 4, 0xf39c12, 0x7f8c8d);
  rentRoom.position.set(30, groundHeight(30, 20), 20);
  group.add(rentRoom);
  colliders.push({ minX: 27.5, maxX: 32.5, minZ: 18, maxZ: 22 });

  // --- Benteng Kalisusu: old fort walls from boxes.
  const fort = new THREE.Group();
  box(20, 4, 2, 0x9c8a6a, 0, 2, -8, fort);
  box(20, 4, 2, 0x9c8a6a, 0, 2, 8, fort);
  box(2, 4, 18, 0x9c8a6a, -10, 2, 0, fort);
  box(2, 4, 18, 0x9c8a6a, 10, 2, 0, fort);
  box(4, 6, 4, 0x8a7a5a, -10, 3, -8, fort);
  fort.position.set(-140, groundHeight(-140, -80), -80);
  group.add(fort);
  colliders.push({ minX: -152, maxX: -128, minZ: -90, maxZ: -70 });

  // --- Palms along the beaches and inland.
  const palmSpots = [];
  for (let i = 0; i < 26; i += 1) palmSpots.push([142 + rnd() * 12, -150 + i * 12 + rnd() * 6]);
  for (let i = 0; i < 30; i += 1) palmSpots.push([-200 + rnd() * 260, -150 + rnd() * 300]);
  for (const [px, pz] of palmSpots) {
    if (Math.hypot(px - LAKE.x, pz - LAKE.z) < LAKE.r + 3) continue;
    const p = makePalm(0.8 + rnd() * 0.5);
    p.position.set(px, groundHeight(px, pz), pz);
    group.add(p);
  }

  // --- Boats at the harbour and one drifting in the bay.
  const boats = [];
  const b1 = makeBoat(); b1.position.set(150, 0.4, 30); b1.rotation.y = 0.4; group.add(b1); boats.push(b1);
  const b2 = makeBoat(0x6b4423); b2.position.set(148, 0.4, 48); b2.rotation.y = -0.3; group.add(b2); boats.push(b2);
  const b3 = makeBoat(); b3.position.set(210, SEA_Y + 0.1, -30); b3.rotation.y = 1.2; group.add(b3); boats.push(b3);

  // --- Fishing-spot markers: a wooden post + a floating 🎣 label at every
  // shore spot (lake + river included), so the player can SEE where to fish.
  const spotMarkers = [];
  for (const s of SPOTS.filter((sp) => !sp.boatOnly && sp.id !== 'dermaga')) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 6), mat(0x5b3a1e));
    post.position.set(s.x - 4, 1.5, s.z); post.castShadow = true;
    group.add(post); spotMarkers.push(post);
    const lbl = makeLabel('🎣 Spot Mancing', 0.55);
    lbl.position.set(s.x - 4, 3.6, s.z);
    group.add(lbl);
    placeLabels.push({ sprite: lbl, x: s.x - 4, z: s.z, range: 25 });
  }

  // --- Lost fishing rod at Membuku (mission m3): a thin rod leaning on a palm.
  const lostRod = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), mat(0x8b4513));
  rod.rotation.z = 0.5; rod.position.y = 1.6;
  lostRod.add(rod);
  lostRod.position.set(150, groundHeight(150, -104), -104);
  group.add(lostRod);

  // --- Kulisusu villages: house clusters for the main villages, small pairs
  // for the extra ones, plus a floating label on every named place.
  const villageHouses = {
    lokonea: [[-46, -66], [-34, -54], [-44, -50]],
    linsowu: [[114, -46], [126, -34], [116, -32]],
    'malalanda-desa': [[114, 124], [126, 136], [112, 138]],
    kalibu: [[-66, 114], [-54, 126], [-64, 130]],
    kadacua: [[-166, 14], [-154, 26], [-164, 30]],
    laangke: [[-184, -124], [-176, -116]],
    lantagi: [[-104, -134], [-96, -126]],
    lemoea: [[-44, 136], [-36, 144]],
    rombo: [[36, -134], [44, -126]],
    tomoahi: [[-204, 56], [-196, 64]],
    wasalabose: [[96, -144], [104, -136]],
    eelahaji: [[-144, 136], [-136, 144]],
    jampaka: [[56, 146], [64, 154]],
    lemo: [[26, -94], [34, -86]],
    bonelipu: [[136, 76], [144, 84]],
  };
  const vColors = [[0xf1c40f, 0x2980b9], [0xecf0f1, 0xe74c3c], [0xf39c12, 0x27ae60]];
  for (const [vid, spots] of Object.entries(villageHouses)) {
    spots.forEach(([hx, hz], i) => {
      const [wall, roof] = vColors[(i + vid.length) % vColors.length];
      const h = makeHouse(5, 4.5, wall, roof);
      h.position.set(hx, groundHeight(hx, hz), hz);
      h.rotation.y = (i * 0.7) % 1.2;
      group.add(h);
      colliders.push({ minX: hx - 2.5, maxX: hx + 2.5, minZ: hz - 2.2, maxZ: hz + 2.2 });
    });
  }

  // --- Houses lining the main roads (Jalan Poros Ereke / coast road + the
  // roads between villages): in the real map houses stand along the roads,
  // not only in village centres. Kept just off the road edges so the road,
  // bridges and landmarks stay clear.
  // VILLAGE IDENTITY RULE (Bang, 16 Nov): houses stay in SHORT stretches
  // right next to a village — the stretches BETWEEN villages are left EMPTY
  // on purpose, so walking/driving from one village to the next you cross
  // open land and can tell where one village ends and the next begins.
  // (The mid-gap houses that used to blur the boundaries were removed.)
  const roadsideHouses = [
    // Coast road (Jalan Poros, x = 155), west / inland side — short stretches
    // next to Membuku (-110), Kampa (-62), Mowuru (-12), Lipu (42),
    // Bonelipu (80) and Malalanda (112). Empty between them.
    [144, -124], [144, -112], [144, -70], [144, -52], [144, -16], [144, 2],
    [144, 56], [144, 66], [144, 100], [144, 118],
    // Coast road, east / beach side (clear of fishing markers + pier).
    [163, -70], [163, 80],
    // Ereke -> Loji Pantai: one house at each village's edge, open land between.
    // (The Loji-edge house sits at (48,48): the road to Loji runs just
    // south of it, so it had to move a few steps from (52,44).)
    [23, 30], [48, 48],
    // Ereke -> Lokonea: same — edges only.
    [0, 7], [-24, -46],
    // Ereke -> Kalibu: edges only. (The Kalibu-edge house sits at (-38,100):
    // the road to Kalibu runs just east of it, so it moved from (-41,107).)
    [-10, 60], [-38, 100],
    // Ereke -> Kadacua (west road): only the Kadacua edge; the long stretch
    // from Ereke is open land.
    [-130, 12],
    // Malalanda -> Jembatan Kayu Bone (village edge only). (Moved from
    // (134,140): the road to the bridge runs right through that spot.)
    [128, 144],
  ];
  const rColors = [[0xf1c40f, 0x2980b9], [0xecf0f1, 0xe74c3c], [0xf39c12, 0x27ae60], [0x9b59b6, 0x34495e], [0xfdffb6, 0x16a085]];
  roadsideHouses.forEach(([hx, hz], i) => {
    const [wall, roof] = rColors[i % rColors.length];
    const h = makeHouse(5, 4.5, wall, roof);
    h.position.set(hx, groundHeight(hx, hz), hz);
    h.rotation.y = (i * 0.7) % 1.2;
    group.add(h);
    colliders.push({ minX: hx - 2.5, maxX: hx + 2.5, minZ: hz - 2.2, maxZ: hz + 2.2 });
  });

  // --- Village welcome signs: one at each village's road entrance, facing
  // the incoming road, so the player can tell "this is Desa Loji, this is
  // Desa Bangkudu". [x, z, rotationY, text]. Signs stand just off the road
  // edge and have NO collider, so they can never block the road.
  const welcomeSigns = [
    [47, 53, -2.09, 'Selamat Datang di Desa Loji Pantai'],
    [12, 40, 1.05, 'Selamat Datang di Kota Ereke'],
    [138, 44, -1.57, 'Selamat Datang di Pelabuhan Lipu'],
    [-30, -42, 0.31, 'Selamat Datang di Kelurahan Lokonea'],
    [136, -28, 1.57, 'Selamat Datang di Desa Linsowu'],
    [140, 128, 1.57, 'Selamat Datang di Desa Malalanda'],
    [-44, 120, 2.64, 'Selamat Datang di Desa Kalibu'],
    [-140, 12, 1.57, 'Selamat Datang di Desa Kadacua'],
    [-162, -110, 1.57, 'Selamat Datang di Desa Laangke'],
    [-84, -128, 1.57, 'Selamat Datang di Desa Lantagi'],
    [-48, 130, -2.26, 'Selamat Datang di Desa Lemo Ea'],
    [38, -112, 3.14, 'Selamat Datang di Desa Rombo'],
    [-182, 58, 1.57, 'Selamat Datang di Desa Tomoahi'],
    [82, -138, -1.57, 'Selamat Datang di Desa Wasalabose'],
    [-122, 138, 1.57, 'Selamat Datang di Desa Eelahaji'],
    [44, 148, -1.57, 'Selamat Datang di Desa Jampaka'],
    [30, -72, 3.14, 'Selamat Datang di Kelurahan Lemo'],
    [150, 72, 3.14, 'Selamat Datang di Kelurahan Bonelipu'],
  ];
  for (const [sx, sz, rotY, text] of welcomeSigns) {
    const sign = makeWelcomeSign(text);
    sign.position.set(sx, groundHeight(sx, sz), sz);
    sign.rotation.y = rotY;
    group.add(sign);
    // The sign's floating name is proximity-gated like the village labels,
    // so it never reads as a village name from far away (e.g. from the forest).
    placeLabels.push({ sprite: sign.userData.label, x: sx, z: sz, range: 30 });
  }

  // --- Danger warning board at the Hutan Loji entrance (east side, from
  // Kalibu): same sign style, no collider, never blocks the road. Its
  // label stays visible — it IS the forest's own warning.
  const dangerBoard = makeWelcomeSign('⚠️ HUTAN BERBAHAYA — Monster Lv5–50');
  dangerBoard.position.set(-66, groundHeight(-66, 128), 128);
  dangerBoard.rotation.y = 1.57; // faces east, toward the incoming road
  group.add(dangerBoard);

  // --- Dirt roads between the villages (Jalan Raya) ------------------------
  // Visible ribbons linking village edge to village edge, so the player can
  // SEE the road they travel on. Every route was clearance-checked against
  // all building colliders (min 3.0 units from any wall). The coast road
  // (Jalan Poros, x = 155) is split around the two bridges — the bridge
  // decks ARE the road there.
  const ROADS = [
    // Ereke <-> Loji Pantai.
    [[12, 34], [34, 39], [54, 40], [56, 44]],
    // Ereke <-> Lokonea.
    [[-24, 20], [-30, -8], [-34, -38], [-36, -44]],
    // Ereke <-> Kalibu.
    [[-2, 58], [-5, 66], [-36, 110], [-48, 116]],
    // Ereke <-> Kadacua (west road).
    [[-18, 22], [-60, 18], [-100, 24], [-130, 20], [-148, 20]],
    // Kalibu <-> Lemo Ea.
    [[-58, 132], [-50, 142]],
    // Linsowu <-> Mowuru (meets the coast road).
    [[134, -34], [152, -20]],
    // Malalanda <-> Jembatan Kayu Bone.
    [[134, 134], [150, 148]],
    // Jalan Poros / coast road (split at Jembatan Lasora + Jembatan Kayu Bone).
    [[155, -165], [155, -144]],
    [[155, -136], [155, 138]],
    [[155, 162], [155, 165]],
  ];
  for (const road of ROADS) group.add(makeRoad(road));

  // --- RSUD Buton Utara (Jl. Poros Kalibu, Desa Loji): white block, red cross.
  const rsud = new THREE.Group();
  box(12, 5, 8, 0xf8f9fa, 0, 2.5, 0, rsud);
  box(3, 1, 0.3, 0xe74c3c, 0, 3.4, 4.1, rsud, false);
  box(1, 3, 0.3, 0xe74c3c, 0, 3.4, 4.1, rsud, false);
  rsud.position.set(95, groundHeight(95, 95), 95);
  group.add(rsud);
  colliders.push({ minX: 89, maxX: 101, minZ: 91, maxZ: 99 });

  // --- Lapangan Raja Jin: open football field with goal posts.
  const field = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), mat(0x4caf50));
  field.rotation.x = -Math.PI / 2;
  field.position.set(-20, groundHeight(-20, -10) + 0.15, -10);
  field.receiveShadow = true;
  group.add(field);
  for (const gx of [-36, -4]) {
    for (const gz of [-19, -1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 5), mat(0xffffff));
      post.position.set(gx, groundHeight(gx, gz) + 1.3, gz);
      group.add(post);
    }
  }

  // --- BRIDGES ---------------------------------------------------------------
  // Walkable decks: the player can cross them on foot even over water.
  const walkways = [
    { minX: 166, maxX: 233, minZ: 37, maxZ: 49, y: 1.2 }, // Dermaga Pelabuhan Ereke
    { minX: 147, maxX: 155, minZ: 139, maxZ: 161, y: 1.0 }, // Jembatan Kayu Bone
    { minX: 148, maxX: 196, minZ: -143, maxZ: -137, y: 1.0 }, // Jembatan Lasora
  ];

  // 1) Dermaga Pelabuhan Ereke (Mina-Minanga, Lipu): very long narrow concrete
  // pier out over the blue-green sea, wide crowded platform near the shore.
  const pier = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(66, 0.8, 11), mat(0x9aa0a3));
  deck.position.set(200, 0.8, 43); deck.castShadow = true; deck.receiveShadow = true;
  pier.add(deck);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 18), mat(0x9aa0a3));
  platform.position.set(176, 0.8, 43); platform.castShadow = true; platform.receiveShadow = true;
  pier.add(platform);
  // Yellow rock-lined edges.
  for (const ez of [37.6, 48.4]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(66, 0.5, 0.8), mat(0xf1c40f));
    edge.position.set(200, 1.35, ez); pier.add(edge);
  }
  for (let i = 0; i < 22; i += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mat(0x8d8d8d));
    rock.position.set(170 + i * 3, 1.1, i % 2 ? 36.8 : 49.2);
    pier.add(rock);
  }
  // Pier piles.
  for (let i = 0; i < 9; i += 1) {
    for (const pz of [39, 47]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 6), mat(0x6b4423));
      pile.position.set(172 + i * 7, 0.2, pz); pier.add(pile);
    }
  }
  group.add(pier);
  // People on the pier.
  [[178, 38, 0xe74c3c], [186, 47, 0x2980b9], [205, 40, 0xf39c12], [224, 46, 0x27ae60]].forEach(([px, pz, shirt]) => {
    const person = makePersonMesh(shirt);
    person.position.set(px, 1.2, pz);
    person.rotation.y = Math.random() * 6;
    group.add(person);
  });
  // Parked motorcycles + a car on the platform.
  function motorbike(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.5), mat(0xe74c3c));
    body.position.y = 0.6; g.add(body);
    for (const wx of [-0.7, 0.7]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.15, 8), mat(0x222222));
      wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.32, 0); g.add(wheel);
    }
    g.position.set(x, 1.2, z); g.rotation.y = rot;
    group.add(g);
  }
  motorbike(172, 36, 0.4); motorbike(175, 50, -0.5); motorbike(181, 37, 1.2);
  const parkedCar = new THREE.Group();
  box(3.6, 0.9, 1.7, 0x3498db, 0, 0.7, 0, parkedCar);
  box(2.0, 0.8, 1.5, 0x2c3e50, -0.2, 1.5, 0, parkedCar);
  parkedCar.position.set(180, 1.2, 45); parkedCar.rotation.y = 0.15;
  group.add(parkedCar);
  // Colourful boats moored alongside the pier.
  const pb1 = makeBoat(0xe74c3c); pb1.position.set(196, SEA_Y + 0.1, 30); pb1.rotation.y = 0.2; group.add(pb1);
  const pb2 = makeBoat(0x27ae60); pb2.position.set(214, SEA_Y + 0.1, 56); pb2.rotation.y = -0.2; group.add(pb2);

  // --- Free small boat (sampan, item 7): beached near Loji Pantai, free to
  // board via AKSI. Fragile — sinks past the buoy line (x = FREE_BOAT_MAX_X).
  const sampan = makeSampan();
  sampan.position.set(168, SEA_Y, 66);
  group.add(sampan);
  const sampanLabel = makeLabel('🛶 Perahu Kecil — GRATIS', 0.55);
  sampanLabel.position.y = 2.6;
  sampan.add(sampanLabel);
  placeLabels.push({ sprite: sampanLabel, x: 168, z: 66, range: 25 });
  const freeBoat = { mesh: sampan, x: 168, z: 66, home: { x: 168, z: 66 }, boarded: false, sunk: false };

  // --- Buoy line (item 7): red-white balls marking the free boat's limit.
  const buoys = [];
  for (let bz = -156; bz <= 156; bz += 12) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), mat(((bz / 12) % 2 === 0) ? 0xe74c3c : 0xecf0f1));
    buoy.position.set(FREE_BOAT_MAX_X, SEA_Y, bz);
    group.add(buoy);
    buoys.push(buoy);
  }

  // --- Giant ship "KM Titanik Ereke" (item 10): moored beside the pier at
  // Ereke harbour. Boarded via AKSI once bought (Rp 100.000.000).
  const titanicMesh = makeTitanic();
  titanicMesh.position.set(205, SEA_Y, 58);
  group.add(titanicMesh);
  const titanicLabel = makeLabel('🚢 Kapal Raksasa', 0.6);
  titanicLabel.position.y = 10.5;
  titanicMesh.add(titanicLabel);
  placeLabels.push({ sprite: titanicLabel, x: 205, z: 58, range: 30 });
  const titanic = { mesh: titanicMesh, x: 205, z: 58, home: { x: 205, z: 58 }, boarded: false };

  // 2) Jembatan Kayu Bone: ~75 m historic wooden truss bridge over the river
  // on Jalan Poros Ereke toward Pantai Bone/Malalanda. Weathered planks, gaps,
  // small boats below, people searching for pokea shellfish.
  const river = new THREE.Mesh(new THREE.PlaneGeometry(80, 9), mat(0x2a9db5));
  river.rotation.x = -Math.PI / 2;
  river.position.set(135, RIVER_WATER_Y, 150);
  group.add(river);
  const bone = new THREE.Group();
  for (let i = 0; i < 22; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.18, 0.9), mat(i % 3 === 0 ? 0x9c7a4a : 0x8b6b3d));
    plank.position.set(151, 0.95, 140 + i * 1.0);
    plank.castShadow = true;
    bone.add(plank);
  }
  // Truss sides: diagonal wooden beams.
  for (const sx of [147.4, 154.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 22), mat(0x6b4a26));
    rail.position.set(sx, 2.2, 150); bone.add(rail);
    for (let i = 0; i < 6; i += 1) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), mat(0x6b4a26));
      post.position.set(sx, 1.2, 141 + i * 3.6); bone.add(post);
      const diag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), mat(0x6b4a26));
      diag.position.set(sx, 1.4, 142.8 + i * 3.6); diag.rotation.x = 0.6; bone.add(diag);
    }
  }
  group.add(bone);
  const rb1 = makeBoat(0x8b5a2b); rb1.position.set(164, RIVER_WATER_Y + 0.05, 148); rb1.rotation.y = 1.4; rb1.scale.setScalar(0.8); group.add(rb1);
  const rb2 = makeBoat(0xc0392b); rb2.position.set(162, RIVER_WATER_Y + 0.05, 154); rb2.rotation.y = -1.2; rb2.scale.setScalar(0.8); group.add(rb2);
  [[142, 148, 0x8e44ad], [144, 152, 0x16a085]].forEach(([px, pz, shirt]) => {
    const person = makePersonMesh(shirt);
    person.position.set(px, RIVER_WATER_Y - 0.4, pz); // wading in the shallows
    group.add(person);
  });

  // 3) Jembatan Lasora: concrete road bridge near Pelabuhan Lasora, Teluk Koro.
  const inlet = new THREE.Mesh(new THREE.PlaneGeometry(52, 10), mat(0x2a9db5));
  inlet.rotation.x = -Math.PI / 2;
  inlet.position.set(172, RIVER_WATER_Y, -140);
  group.add(inlet);
  const lasora = new THREE.Group();
  const ldeck = new THREE.Mesh(new THREE.BoxGeometry(48, 0.7, 6), mat(0xb8bec2));
  ldeck.position.set(172, 0.7, -140); ldeck.castShadow = true; ldeck.receiveShadow = true;
  lasora.add(ldeck);
  for (const rz of [-143.2, -136.8]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(48, 0.9, 0.3), mat(0xf1c40f));
    rail.position.set(172, 1.5, rz); lasora.add(rail);
  }
  for (let i = 0; i < 5; i += 1) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 5), mat(0x8a9095));
    pillar.position.set(154 + i * 9, -0.4, -140); lasora.add(pillar);
  }
  group.add(lasora);

  // --- Stadion Lamoliandu: football stadium on the hilltop, overlooking town and sea.
  const hillTop = groundHeight(-185, -60);
  const stadium = new THREE.Group();
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(44, 26), mat(0x3fae4a));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.25, 0);
  pitch.receiveShadow = true;
  stadium.add(pitch);
  // White pitch lines.
  const lineMat = mat(0xffffff);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 26), lineMat);
  mid.position.y = 0.3; stadium.add(mid);
  for (const lx of [-22, 22]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 26), lineMat);
    edge.position.set(lx, 0.3, 0); stadium.add(edge);
  }
  for (const lz of [-13, 13]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(44, 0.05, 0.4), lineMat);
    edge.position.set(0, 0.3, lz); stadium.add(edge);
  }
  const circle = new THREE.Mesh(new THREE.TorusGeometry(4, 0.2, 4, 24), lineMat);
  circle.rotation.x = Math.PI / 2; circle.position.y = 0.3; stadium.add(circle);
  // Stepped stands on both long sides.
  for (const sz of [-19, 19]) {
    for (let s = 0; s < 3; s += 1) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 3), mat(s % 2 ? 0xdddddd : 0x2c3e50));
      step.position.set(0, 0.6 + s * 1.2, sz + (sz > 0 ? s * 3 : -s * 3));
      step.castShadow = true;
      stadium.add(step);
    }
  }
  colliders.push({ minX: -185 - 23, maxX: -185 + 23, minZ: -60 - 28, maxZ: -60 - 16 });
  colliders.push({ minX: -185 - 23, maxX: -185 + 23, minZ: -60 + 16, maxZ: -60 + 28 });
  // Floodlights: tall poles with bright heads, visible from below.
  for (const [fx, fz] of [[-26, -17], [26, -17], [-26, 17], [26, 17]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 14, 6), mat(0x555555));
    pole.position.set(fx, 7, fz); pole.castShadow = true;
    stadium.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.6), mat(0xfff6c9));
    head.position.set(fx, 14.4, fz);
    stadium.add(head);
  }
  // Goals.
  for (const gx of [-21, 21]) {
    const goal = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 7), mat(0xffffff));
    bar.position.y = 2.4; goal.add(bar);
    for (const gz of [-3.5, 3.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 5), mat(0xffffff));
      post.position.set(0, 1.2, gz); goal.add(post);
    }
    goal.position.set(gx, 0.3, 0);
    stadium.add(goal);
  }
  stadium.position.set(-185, hillTop, -60);
  group.add(stadium);
  // Entrance gate to the stadium, at the top of the winding road.
  for (const gz of [-66, -54]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), mat(0x1a936f));
    pillar.position.set(-152, groundHeight(-152, gz) + 3, gz);
    pillar.castShadow = true;
    group.add(pillar);
  }
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 13.2), mat(0x1a936f));
  gateBeam.position.set(-152, groundHeight(-152, -60) + 6.4, -60);
  group.add(gateBeam);

  // --- GOR Bukit Lamoliandu: big indoor sports hall (badminton, Piala Lamoliandu).
  // Moved 16 Nov from (-148,-62): its old spot sat across the mesa slope
  // (terrain 20 west, ~8 east) so the hall floated ~8 units on its east side
  // and nearly touched the stadium stands (west edge -161 vs stands -162).
  // New spot (-128,-18) is open ground south-east of the stadium, ~21 units
  // from the stands, clear of the hill road, the basketball court and the
  // roadside house at (-130,12); a flat pad in groundHeight levels it.
  const gor = new THREE.Group();
  box(26, 8, 18, 0xeaf2f8, 0, 4, 0, gor);
  const gorRoof = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 26, 12, 1, false, 0, Math.PI), mat(0x2980b9));
  gorRoof.rotation.z = Math.PI / 2; gorRoof.rotation.y = Math.PI / 2;
  gorRoof.position.y = 8; gorRoof.castShadow = true;
  gor.add(gorRoof);
  box(6, 5, 0.4, 0x2c3e50, 0, 2.5, 9.1, gor, false);
  gor.position.set(-128, groundHeight(-128, -18), -18);
  group.add(gor);
  colliders.push({ minX: -141, maxX: -115, minZ: -27, maxZ: -9 });

  // --- Outdoor basketball court + takraw court beside the hall.
  function court(cx, cz, w, d, color, net) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
    c.rotation.x = -Math.PI / 2;
    c.position.set(cx, groundHeight(cx, cz) + 0.15, cz);
    c.receiveShadow = true;
    group.add(c);
    const border = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.3), mat(0xffffff));
    border.position.set(cx, groundHeight(cx, cz) + 0.2, cz - d / 2);
    group.add(border);
    const border2 = border.clone(); border2.position.z = cz + d / 2; group.add(border2);
    if (net) {
      const n = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, d), mat(0x222222));
      n.position.set(cx, groundHeight(cx, cz) + 0.8, cz);
      group.add(n);
    }
    return c;
  }
  court(-158, -30, 16, 10, 0x2e6fb0, false);
  court(-212, -40, 12, 7, 0x27ae60, true);
  // Basketball hoops.
  for (const [hx, hz] of [[-166, -30], [-150, -30]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 5), mat(0x888888));
    pole.position.set(hx, groundHeight(hx, hz) + 1.8, hz);
    group.add(pole);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 1.8), mat(0xffffff));
    board.position.set(hx + (hx < -158 ? 0.6 : -0.6), groundHeight(hx, hz) + 3.4, hz);
    group.add(board);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 12), mat(0xe67e22));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(hx + (hx < -158 ? 1.0 : -1.0), groundHeight(hx, hz) + 3.0, hz);
    group.add(rim);
  }

  // --- Benteng Lipu: small stone cultural fort at the foot of the hill.
  const bl = new THREE.Group();
  box(14, 3, 1.5, 0x9c8a6a, 0, 1.5, -5, bl);
  box(14, 3, 1.5, 0x9c8a6a, 0, 1.5, 5, bl);
  box(1.5, 3, 11, 0x9c8a6a, -7, 1.5, 0, bl);
  box(1.5, 3, 11, 0x9c8a6a, 7, 1.5, 0, bl);
  bl.position.set(-120, groundHeight(-120, -100), -100);
  group.add(bl);
  colliders.push({ minX: -128, maxX: -112, minZ: -106, maxZ: -94 });

  // --- Motorbike race: gold checkpoint rings up the winding hill road.
  const racePoints = [
    { x: -112, z: -56 }, { x: -138, z: -70 }, { x: -158, z: -50 },
    { x: -172, z: -68 }, { x: -185, z: -60 },
  ];
  const raceRings = racePoints.map((p, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.28, 8, 20),
      new THREE.MeshLambertMaterial({ color: i === racePoints.length - 1 ? 0x2ecc71 : 0xf1c40f, emissive: 0x664400 }),
    );
    ring.position.set(p.x, groundHeight(p.x, p.z) + 2.6, p.z);
    ring.castShadow = true;
    group.add(ring);
    return ring;
  });
  // Race start sign at the foot of the hill road.
  const sign = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), mat(0x5b3a1e));
  post.position.y = 1.5; sign.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 0.3), mat(0xf1c40f));
  board.position.y = 3.4; sign.add(board);
  sign.position.set(-110, groundHeight(-110, -56), -56);
  group.add(sign);
  const signLabel = makeLabel(IS_TOUCH ? 'BALAP MOTOR — ketuk AKSI' : 'BALAP MOTOR — tekan E', 0.7);
  signLabel.position.set(-110, groundHeight(-110, -56) + 5.5, -56);
  group.add(signLabel);
  // Dirt path winding up the hill from the lowlands (driveable by bike/car).
  for (let i = 0; i < 12; i += 1) {
    const t = i / 11;
    const px = -120 - t * 62 + Math.sin(t * 9) * 8;
    const pz = -60 + Math.sin(t * 5) * 10;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 10), mat(0xc9a86a));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(px, groundHeight(px, pz) + 0.12, pz);
    disc.receiveShadow = true;
    group.add(disc);
  }

  // --- Rideable vehicles: motorcycle at the player's home, car in Kota Ereke.
  const moto = makeMotorbike(0xe74c3c);
  moto.position.set(56, groundHeight(56, 58), 58); moto.rotation.y = 0.6;
  group.add(moto);
  const car = makeCar(0x3498db);
  car.position.set(-24, groundHeight(-24, 52), 52); car.rotation.y = -0.4;
  group.add(car);
  const vehicles = [
    { id: 'moto', kind: 'moto', name: 'Motor', mesh: moto, x: 56, z: 58, yaw: 0.6, home: { x: 56, z: 58 } },
    { id: 'car', kind: 'car', name: 'Mobil', mesh: car, x: -24, z: 52, yaw: -0.4, home: { x: -24, z: 52 } },
  ];

  // --- Floating labels for every named place (main bigger, extra villages smaller).
  // VILLAGE IDENTITY (Bang, 16 Nov): a label only shows when the player is
  // near that place (within 30 units), so the screen is never a wall of
  // overlapping names and the label you see is the village you are actually
  // in — and no village name is visible from inside Hutan Loji. Small POIs
  // (bank, salons, rented room, notice board, buyable houses) follow the
  // same rule. Worst overlaps are also nudged apart with label offsets
  // (village coordinates themselves never move).
  const POI_LABELS = new Set(['bni', 'rumah-ereke', 'rumah-membuku', 'sewa', 'salon-ereke', 'salon-loji', 'papan']);
  const LABEL_OFFSETS = {
    lemoea: [8, 6], kalibu: [-6, -8],
    'salon-loji': [8, 6], 'salon-ereke': [-4, 6],
    'rumah-membuku': [-8, 6], kalisusu: [6, -6],
  };
  for (const p of PLACES) {
    if (p.id === 'laut') continue; // the sea needs no label
    const isPoi = POI_LABELS.has(p.id);
    const label = makeLabel(p.name, isPoi ? 0.62 : (p.minor ? 0.62 : 0.85));
    const [ox, oz] = LABEL_OFFSETS[p.id] || [0, 0];
    const lx = p.x + ox; const lz = p.z + oz;
    label.position.set(lx, groundHeight(lx, lz) + (p.minor || isPoi ? 7 : 10), lz);
    group.add(label);
    placeLabels.push({ sprite: label, x: lx, z: lz, range: 30 });
  }

  // --- Shipyard corner at the pier: planks + a boat under construction.
  const yard = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.5), mat(0x9c7a4a));
    plank.position.set(0, 0.2 + i * 0.2, (i % 2) * 0.3);
    yard.add(plank);
  }
  const hull = makeBoat(0xd35400);
  hull.position.set(3.5, 0.9, 0); hull.rotation.z = 0.12;
  yard.add(hull);
  yard.position.set(166, groundHeight(166, 56), 56);
  group.add(yard);

  // --- Salon (barbershop): Ereke town + Loji Pantai — pink building + barber pole.
  const salons = [];
  for (const [sx, sz] of [[14, 52], [78, 60]]) {
    const salon = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), mat(0xec407a));
    base.position.y = 2; base.castShadow = true; salon.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2, 4), mat(0xffffff));
    roof.position.y = 5; roof.rotation.y = Math.PI / 4; salon.add(roof);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8), mat(0xffffff));
    pole.position.set(3.6, 1.2, 2.6); salon.add(pole);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 8), mat(0xe91e63));
    stripe.position.set(3.6, 1.8, 2.6); salon.add(stripe);
    salon.position.set(sx, groundHeight(sx, sz), sz);
    group.add(salon);
    salons.push({ x: sx, z: sz });
  }

  // --- Notice board (papan pengumuman event mingguan) next to the market.
  const boardGroup = new THREE.Group();
  const boardPanel = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 0.25), mat(0x8d6e63));
  boardPanel.position.y = 2.2; boardPanel.castShadow = true; boardGroup.add(boardPanel);
  const boardPaper = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 0.05), mat(0xfff9c4));
  boardPaper.position.set(0, 2.2, 0.16); boardGroup.add(boardPaper);
  const legB1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), mat(0x5d4037));
  legB1.position.set(-1.6, 0.7, 0); boardGroup.add(legB1);
  const legB2 = legB1.clone(); legB2.position.x = 1.6; boardGroup.add(legB2);
  boardGroup.position.set(2, groundHeight(2, 18), 18);
  group.add(boardGroup);

  // --- Coconuts on Membuku beach (mission m5: collect 3).
  const coconuts = [];
  for (const [cx, cz] of [[144, -120], [138, -114], [148, -126]]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat(0x6b4423));
    mesh.position.set(cx, groundHeight(cx, cz) + 0.4, cz);
    mesh.castShadow = true;
    group.add(mesh);
    coconuts.push({ mesh, x: cx, z: cz, taken: false });
  }

  // --- Buried treasure chests (hidden until 3 map fragments reveal one).
  const chests = [];
  for (const c of TREASURE_CHESTS) {
    const mesh = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 1.2), mat(0x8d6e63));
    box.position.y = 0.5; box.castShadow = true; mesh.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.3), mat(0xffd700));
    lid.position.y = 1.15; mesh.add(lid);
    mesh.position.set(c.x, groundHeight(c.x, c.z), c.z);
    mesh.visible = false;
    group.add(mesh);
    chests.push({ ...c, mesh, revealed: false, taken: false });
  }

  // --- Forest (Hutan Loji): tall trees + gatherables (wood, fruit, mushrooms).
  const gather = [];
  const forestSpots = [];
  for (let i = 0; i < 26; i += 1) {
    const fx = -118 + Math.random() * 60;
    const fz = 112 + Math.random() * 42;
    if (Math.hypot(fx - LAKE.x, fz - LAKE.z) < LAKE.r + 4) continue;
    forestSpots.push([fx, fz]);
  }
  for (const [fx, fz] of forestSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 7, 6), mat(0x5d4037));
    trunk.position.set(fx, groundHeight(fx, fz) + 3.5, fz); trunk.castShadow = true; group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8, 6), mat(0x1b5e20));
    top.position.set(fx, groundHeight(fx, fz) + 10, fz); top.castShadow = true; group.add(top);
  }
  const gatherSpots = [
    [-100, 128, 'wood'], [-78, 142, 'wood'], [-95, 148, 'fruit'],
    [-70, 122, 'fruit'], [-110, 138, 'mushroom'], [-84, 152, 'mushroom'],
  ];
  for (const [gx, gz, kind] of gatherSpots) {
    let mesh;
    if (kind === 'wood') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 6), mat(0x8d6e63));
      mesh.rotation.z = Math.PI / 2;
    } else if (kind === 'fruit') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), mat(0x2e7d32));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), mat(0xe53935));
      dot.position.set(0.5, 0.5, 0.4); mesh.add(dot);
    } else {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.7, 6), mat(0xfff3e0));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe53935));
      cap.position.y = 0.35; mesh.add(cap);
    }
    mesh.position.set(gx, groundHeight(gx, gz) + 0.5, gz);
    mesh.castShadow = true;
    group.add(mesh);
    gather.push({ mesh, x: gx, z: gz, kind, taken: false });
  }

  // --- Floating loot: crates and coconuts drifting in the bay, scooped up by boat.
  const pickups = [];
  const lootSpots = [
    [195, -60, 'crate', 8000], [215, -20, 'coconut', 5000], [240, 30, 'crate', 12000],
    [205, 70, 'coconut', 5000], [230, 110, 'crate', 10000], [250, -80, 'coconut', 6000],
  ];
  for (const [lx, lz, kind, value] of lootSpots) {
    const mesh = kind === 'crate'
      ? new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), mat(0xc98a2b))
      : new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), mat(0x6b4423));
    mesh.position.set(lx, 0.6, lz);
    mesh.castShadow = true;
    group.add(mesh);
    pickups.push({ mesh, x: lx, z: lz, kind, value, taken: false });
  }

  // --- Forest monsters (tap-to-attack): nameplate + threat-coloured marker.
  const monsters = [];
  for (const def of MONSTERS) {
    const g = new THREE.Group();
    if (def.id === 'babi') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.9), mat(0x6d4c41)); body.position.y = 0.7; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat(0x5d4037)); head.position.set(0.9, 0.8, 0); g.add(head);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.4), mat(0x8d6e63)); snout.position.set(1.3, 0.65, 0); g.add(snout);
    } else if (def.id === 'ular') {
      for (let i = 0; i < 3; i += 1) {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.5 - i * 0.1, 8, 6), mat(0x2e7d32));
        seg.position.set(-i * 0.7, 0.45, Math.sin(i) * 0.3); g.add(seg);
      }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat(0xff0000));
      eye.position.set(0.4, 0.6, 0.2); g.add(eye);
    } else if (def.id === 'kera') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.7), mat(0x795548)); body.position.y = 1.0; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), mat(0x8d6e63)); head.position.y = 1.9; g.add(head);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 1.4, 5), mat(0x5d4037));
      tail.position.set(-0.6, 1.2, 0); tail.rotation.z = 0.9; g.add(tail);
    } else if (def.id === 'buaya' || def.id === 'buaya-danau') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 1.0), mat(0x33691e)); body.position.y = 0.45; g.add(body);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.8), mat(0x558b2f)); jaw.position.set(2.0, 0.35, 0); g.add(jaw);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 5), mat(0x33691e));
      tail.position.set(-2.2, 0.45, 0); tail.rotation.z = Math.PI / 2; g.add(tail);
    } else { // raja — big boss with a crown
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.6), mat(0x3e2723)); body.position.y = 1.4; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), mat(0x4e342e)); head.position.y = 3.1; g.add(head);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 5), mat(0xffd700)); crown.position.y = 3.9; g.add(crown);
    }
    const label = makeLabel(`${def.name} Lv${def.level} · ${def.threat}`, 0.72);
    label.position.y = def.id === 'raja' ? 5.2 : 3.4;
    g.add(label);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(def.threatColor));
    marker.position.y = def.id === 'raja' ? 4.6 : 2.9;
    g.add(marker);
    g.position.set(def.x, groundHeight(def.x, def.z), def.z);
    group.add(g);
    monsters.push({ ...def, mesh: g, hp: def.hp, maxHp: def.hp, alive: true, attackT: 0 });
  }

  // --- Village lamps: poles + a glowing head that only lights up at night.
  // One shared emissive material for all heads (one toggle for the whole
  // village), and a real PointLight at just TWO main squares (Ereke + Loji)
  // so a phone never carries dozens of lights. Lamps stand off the road
  // and have no collider, like the welcome signs.
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xffc46b, emissiveIntensity: 0 });
  // Lamp spots: open ground near each village centre, CLEAR of buildings,
  // signs, houses and roads (checked against the colliders + sign spots —
  // the old spots sat inside the market, the BNI, a house and on top of
  // several welcome signs, so their heads and the square lights were hidden).
  const lampSpots = [
    [0, 38], [16, 44], [-24, 16], [-8, 40], // Kota Ereke (market square first)
    [62, 66], [52, 64], [42, 58], // Desa Loji Pantai (village centre first)
    [134, 48], [150, 58], [-26, -36], [-42, -38], // Lipu + Lokonea
    [130, -22], [132, -14], [134, 122], [128, 128], // Linsowu + Malalanda
    [-54, 110], [-38, 126], [-146, 6], [-154, 12], // Kalibu + Kadacua
  ];
  const lampLights = [];
  for (const [lx, lz] of lampSpots) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.2, 6), mat(0x37474f));
    pole.position.y = 2.1; pole.castShadow = true; lamp.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lampHeadMat);
    head.position.y = 4.4; lamp.add(head);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 8), mat(0x37474f));
    cap.position.y = 4.85; lamp.add(cap);
    lamp.position.set(lx, groundHeight(lx, lz), lz);
    group.add(lamp);
  }
  // Real light pools at the two main squares only.
  for (const [lx, lz] of [[0, 38], [62, 66]]) {
    const pl = new THREE.PointLight(0xffc46b, 0, 36, 1.5);
    pl.position.set(lx, groundHeight(lx, lz) + 4.5, lz);
    group.add(pl);
    lampLights.push(pl);
  }

  // --- Road lamps along Jalan Poros (item 8): same shared head material
  // (emissive at night, like the village lamps), NO extra PointLights for
  // phone performance. On the LAND side of the road (x=150), clear of the
  // roadside houses (x=144) and of both bridges (Lasora z≈-140, Bone z≈150).
  // Heads are a little bigger (r 0.55) so they read from a moving motorbike.
  const roadLampZ = [-160, -110, -85, -60, -35, -10, 15, 40, 65, 90, 115, 165];
  const roadLampExtra = [[24, 33], [44, 37]]; // Ereke↔Loji road (main route from spawn)
  for (const lz of roadLampZ) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.2, 6), mat(0x37474f));
    pole.position.y = 2.1; pole.castShadow = true; lamp.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampHeadMat);
    head.position.y = 4.4; lamp.add(head);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.35, 8), mat(0x37474f));
    cap.position.y = 4.9; lamp.add(cap);
    lamp.position.set(150, groundHeight(150, lz), lz);
    group.add(lamp);
  }
  for (const [lx, lz] of roadLampExtra) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 4.2, 6), mat(0x37474f));
    pole.position.y = 2.1; pole.castShadow = true; lamp.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampHeadMat);
    head.position.y = 4.4; lamp.add(head);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.35, 8), mat(0x37474f));
    cap.position.y = 4.9; lamp.add(cap);
    lamp.position.set(lx, groundHeight(lx, lz), lz);
    group.add(lamp);
  }

  return { group, colliders, sea, seaBase, seaGeo, boats, lostRod, walkways, vehicles, pickups, raceRings, racePoints, raceSign: { x: -110, z: -56 }, salons, board: { x: 2, z: 18 }, coconuts, chests, gather, monsters, placeLabels, lampHeadMat, lampLights, buoys, freeBoat, titanic };
}

export function updateSea(world, t) {
  const pos = world.seaGeo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const bx = world.seaBase[i * 3]; const bz = world.seaBase[i * 3 + 2];
    // Wave troughs stay above the sand (SEA_Y 0.55, amplitude ±0.30).
    pos.setY(i, Math.sin(bx * 0.12 + t * 1.4) * 0.18 + Math.cos(bz * 0.1 + t * 0.9) * 0.12);
  }
  pos.needsUpdate = true;
  world.seaGeo.computeVertexNormals();
  // Boats float on the raised sea: beached boats stay low, boats in the
  // water ride at SEA_Y + 0.1.
  world.boats.forEach((b, i) => {
    const base = b.position.x > SEA_X ? SEA_Y + 0.1 : 0.4;
    b.position.y = base + Math.sin(t * 1.2 + i * 2) * 0.15; b.rotation.z = Math.sin(t * 0.9 + i) * 0.03;
  });
  // Buoy line bobs on the waves.
  if (world.buoys) world.buoys.forEach((b, i) => { b.position.y = SEA_Y + Math.sin(t * 1.2 + i) * 0.12; });
  // The free sampan and the giant ship bob at rest (not while boarded — the
  // main loop drives them then).
  if (world.freeBoat && !world.freeBoat.boarded) world.freeBoat.mesh.position.y = SEA_Y + Math.sin(t * 1.1) * 0.12;
  if (world.titanic && !world.titanic.boarded) world.titanic.mesh.position.y = SEA_Y + Math.sin(t * 0.8) * 0.06;
  if (world.pickups) {
    world.pickups.forEach((p, i) => {
      if (p.taken) return;
      p.mesh.position.y = 0.6 + Math.sin(t * 1.3 + i * 1.7) * 0.18;
      p.mesh.rotation.y += 0.002;
      // Slow drift with the current, staying inside the bay.
      p.x += Math.sin(t * 0.11 + i) * 0.004;
      p.mesh.position.x = p.x;
    });
  }
}
