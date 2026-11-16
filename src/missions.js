// missions.js — village quests (3 tiers) + paid work jobs ("kerja", repeatable).
import { MISSIONS, JOBS, levelFromXp } from './data.js';

// The main chain: one mission per rank, in order. A main mission unlocks
// only after the previous one is done AND the player's rank is high enough.
export const MAIN_CHAIN = ['m1', 'm2', 'm4', 'm7', 'm8', 'm12', 'm13'];

export function createMissions() {
  return MISSIONS.map((m) => ({ ...m, status: 'available', foundRod: false }));
}

/** Can this mission be accepted right now? Returns { ok, reason }. */
export function missionUnlocked(m, missions, player) {
  const lv = levelFromXp(player.xp || 0);
  if (lv < (m.rankMin || 1)) return { ok: false, reason: `🔒 Butuh ${m.rank} (Lv ${m.rankMin})` };
  if (m.kind === 'utama') {
    const idx = MAIN_CHAIN.indexOf(m.id);
    if (idx > 0) {
      const prev = missions.find((x) => x.id === MAIN_CHAIN[idx - 1]);
      if (prev && prev.status !== 'done') return { ok: false, reason: `🔒 Selesaikan dulu: ${prev.title}` };
    }
  }
  return { ok: true, reason: '' };
}

/** The next main mission in the chain (first one not done yet). */
export function nextMainMission(missions) {
  for (const id of MAIN_CHAIN) {
    const m = missions.find((x) => x.id === id);
    if (m && m.status !== 'done') return m;
  }
  return null;
}

/** The active main mission (the one the tracker follows), if any. */
export function activeMainMission(missions) {
  for (const id of MAIN_CHAIN) {
    const m = missions.find((x) => x.id === id);
    if (m && m.status === 'active') return m;
  }
  return null;
}

/** HUD tracker text: always tells the player what the next main mission is. */
export function missionTracker(missions, player) {
  const active = activeMainMission(missions);
  if (active) {
    const p = missionProgress(active, player);
    return { text: `⭐ Misi Utama: ${active.title} — ${p.have}/${p.need}`, done: false };
  }
  const next = nextMainMission(missions);
  if (!next) return { text: '🏆 Semua Misi Utama selesai! Kamu Nelayan Legendaris sejati!', done: true };
  const lock = missionUnlocked(next, missions, player);
  if (!lock.ok) return { text: `⭐ Misi berikutnya: ${next.title} — ${lock.reason}`, done: false };
  return { text: `⭐ Misi berikutnya: ${next.title} — bicara dengan ${next.giver} (${next.place})`, done: false };
}

export function missionProgress(m, player) {
  if (m.need.fish) return { have: player.fish[m.need.fish] || 0, need: m.need.count };
  if (m.need.find) return { have: m.foundRod ? 1 : 0, need: 1 };
  if (m.need.coconuts) return { have: player.coconuts || 0, need: m.need.coconuts };
  if (m.need.monster) return { have: (player.defeated && player.defeated[m.need.monster]) ? 1 : 0, need: 1 };
  return { have: 0, need: 1 };
}

export function canTurnIn(m, player) {
  const p = missionProgress(m, player);
  return m.status === 'active' && p.have >= p.need;
}

export function acceptMission(m, missions, player) {
  if (m.status !== 'available') return false;
  if (missions && player && !missionUnlocked(m, missions, player).ok) return false;
  m.status = 'active'; return true;
}

export function turnIn(m, player) {
  if (!canTurnIn(m, player)) return false;
  if (m.need.fish) player.fish[m.need.fish] -= m.need.count;
  if (m.need.coconuts) player.coconuts -= m.need.coconuts;
  m.status = 'done';
  player.money += m.reward; player.earned += m.reward;
  player.energy = Math.min(100, player.energy + m.energy);
  if (m.rareBait) player.rareBait = (player.rareBait || 0) + m.rareBait;
  if (m.fragment) player.fragments = (player.fragments || 0) + m.fragment;
  if (m.tier === 'Sulit') player.fragments = (player.fragments || 0) + 1; // hard missions drop a map fragment
  return true;
}

export function doneCount(list) { return list.filter((m) => m.status === 'done').length; }

export function missionXp(m) { return m.tier === 'Mudah' ? 50 : m.tier === 'Sedang' ? 100 : 200; }

// --- Paid work jobs: repeatable, no fish collection needed (except deliver jobs). ---
export function createJobs() {
  return JOBS.map((j) => ({ ...j, status: 'available', progress: 0 }));
}

export function jobProgress(j, player) {
  if (j.kind === 'deliver') return { have: player.fish[j.fish] || 0, need: j.count };
  return { have: j.progress, need: j.count };
}

export function canJobTurnIn(j, player) {
  const p = jobProgress(j, player);
  return j.status === 'active' && p.have >= p.need;
}

export function acceptJob(j) { if (j.status === 'available') { j.status = 'active'; j.progress = 0; } }

export function jobTurnIn(j, player) {
  if (!canJobTurnIn(j, player)) return false;
  if (j.kind === 'deliver') player.fish[j.fish] -= j.count;
  player.money += j.reward; player.earned += j.reward;
  player.energy = Math.min(100, player.energy + 10);
  j.status = 'available'; j.progress = 0; // repeatable: take the job again any time
  return true;
}
