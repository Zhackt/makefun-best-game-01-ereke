// npcs.js — the villagers of Ereke: low-poly figures standing in the world,
// what they say, and which mission each one gives.
import { NPC_LINES } from './data.js';
import { makePersonMesh, groundHeight } from './world.js';

export const NPC_DEFS = [
  { id: 'sari', name: 'Bu Sari', role: 'Pemilik Warung', x: -10, z: 42, mission: 'm1', shirt: 0xe74c3c },
  { id: 'laode', name: 'Pak Laode', role: 'Nelayan', x: 150, z: 34, mission: 'm2', shirt: 0x2980b9 },
  { id: 'budi', name: 'Pak Budi', role: 'Tetangga', x: 70, z: 82, mission: 'm3', shirt: 0x27ae60 },
  { id: 'imam', name: 'Imam Haji', role: 'Imam Masjid', x: 22, z: 70, mission: 'm4', shirt: 0x8e44ad },
  { id: 'muda', name: 'Nelayan Muda', role: 'Pemancing', x: 146, z: -90, mission: 'm5', shirt: 0xf39c12 },
  { id: 'linsowu', name: 'Ibu Linsowu', role: 'Warga Linsowu', x: 120, z: -40, mission: 'm6', shirt: 0xe67e22 },
  { id: 'bone', name: 'Nelayan Bone', role: 'Nelayan Malalanda', x: 120, z: 130, mission: 'm7', shirt: 0x16a085 },
];

export function createNPCs(scene) {
  return NPC_DEFS.map((d) => {
    const mesh = makePersonMesh(d.shirt);
    mesh.position.set(d.x, groundHeight(d.x, d.z), d.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    return { ...d, mesh, line: 0 };
  });
}

export function npcNear(npcs, x, z) {
  let best = null; let bestD = 5;
  for (const n of npcs) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export function npcLine(npc) {
  const lines = NPC_LINES[npc.id] || ['Halo!'];
  const line = lines[npc.line % lines.length];
  npc.line += 1;
  return line;
}
