// events.js — rotating weekly events (4-week cycle, real calendar weeks).
// Week A: Turnamen Mancing · B: Kejuaraan Balapan Motor · C: Pesta Harta Karun · D: Festival Pantai.
// Scores are local-only; rivals are deterministic per week (seeded), so the
// leaderboard feels alive without any server.

export const EVENTS = [
  {
    id: 'mancing', name: 'Turnamen Mancing', emoji: '🎣',
    desc: 'Tangkap ikan TERBERAT minggu ini! Berat ikan dihitung saat tertangkap. 3 besar menang.',
    scoreLabel: 'Ikan terberat (kg)', prize: { money: 100000, rareBait: 1, title: 'Juara Mancing' },
  },
  {
    id: 'balapan', name: 'Kejuaraan Balapan Motor', emoji: '🏁',
    desc: 'Balapan motor tercepat di jalan Bukit Lamoliandu! Waktu terbaik minggu ini menang.',
    scoreLabel: 'Waktu terbaik (detik)', prize: { money: 120000, rareBait: 1, title: 'Juara Balapan' },
  },
  {
    id: 'harta', name: 'Pesta Harta Karun', emoji: '💰',
    desc: 'Fragmen peta jatuh 2x lebih sering & hadiah peti 2x lipat! Harta terbanyak minggu ini menang.',
    scoreLabel: 'Peti ditemukan', prize: { money: 150000, rareBait: 2, title: 'Pemburu Harta Karun' },
  },
  {
    id: 'festival', name: 'Festival Pantai', emoji: '🎉',
    desc: 'Semua dihitung: ikan (10 poin) + finis balapan (50 poin) + peti harta (100 poin). Skor tertinggi menang!',
    scoreLabel: 'Skor festival', prize: { money: 200000, rareBait: 2, title: 'Bintang Festival' },
  },
];

/** ISO week number (Monday = first day). */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - fday + 3);
  return 1 + Math.round((d - first) / (7 * 24 * 3600 * 1000));
}

export function weekId(date = new Date()) {
  return `${date.getFullYear()}-W${isoWeek(date)}`;
}

export function currentEvent(date = new Date()) {
  const idx = (isoWeek(date) - 1) % 4;
  return { ...EVENTS[idx], week: weekId(date), index: idx };
}

/** Deterministic rivals for a week (seeded by week id, so the board is stable). */
export function rivalsFor(week, eventId) {
  let seed = 0;
  for (const ch of week + eventId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0x100000000; };
  const names = ['Pak Laode', 'Nelayan Muda', 'Bu Sari', 'Pak Budi'];
  if (eventId === 'mancing') return names.map((n) => ({ name: n, score: +(2 + rnd() * 6).toFixed(1) }));
  if (eventId === 'balapan') return names.map((n) => ({ name: n, score: +(55 + rnd() * 40).toFixed(1) }));
  if (eventId === 'harta') return names.map((n) => ({ name: n, score: Math.floor(rnd() * 3) }));
  return names.map((n) => ({ name: n, score: Math.floor(80 + rnd() * 300) }));
}

/** Rank of the player's score among rivals (1 = best). Lower-is-better for balapan. */
export function playerRank(score, rivals, lowerBetter = false) {
  let rank = 1;
  for (const r of rivals) {
    if (lowerBetter ? r.score < score : r.score > score) rank += 1;
  }
  return rank;
}

export function emptyEventState(week) {
  return { week, bestFishKg: 0, bestRace: null, chests: 0, festival: 0, claimed: false };
}
