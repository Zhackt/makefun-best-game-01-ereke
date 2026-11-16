// missions.js — village quests (3 tiers) + paid work jobs ("kerja", repeatable).
import { MISSIONS, JOBS } from './data.js';

export function createMissions() {
  return MISSIONS.map((m) => ({ ...m, status: 'available', foundRod: false }));
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

export function acceptMission(m) { if (m.status === 'available') m.status = 'active'; }

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
