// save.js — best result in localStorage (survives reloads, never leaves the browser).
export const BEST_KEY = 'ereke-best-v1';

export function readBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v.score === 'number' ? v : null;
  } catch { return null; }
}

export function saveBest(result) {
  try {
    const prev = readBest();
    if (!prev || result.score > prev.score) window.localStorage.setItem(BEST_KEY, JSON.stringify(result));
    return readBest();
  } catch { return result; }
}

export const RACE_KEY = 'ereke-race-best-v1';
export const SAVE_KEY = 'ereke-save-v1';
export const LOGIN_KEY = 'ereke-login-v1';
export const EVENT_KEY = 'ereke-event-v1';
export const NAME_KEY = 'ereke-player-name-v1';

/** Character name, saved the moment it is typed on the title screen (batch 6,
    item 3) — not only when sleeping. The full save still carries the name
    too; this small key is what prefills the title-screen field on reopen. */
export function readPlayerName() {
  try { return window.localStorage.getItem(NAME_KEY) || ''; }
  catch { return ''; }
}
export function writePlayerName(name) {
  try {
    const v = (name || '').trim().slice(0, 16);
    if (v) window.localStorage.setItem(NAME_KEY, v);
    else window.localStorage.removeItem(NAME_KEY);
    return v;
  } catch { return ''; }
}

/** Daily login streak (real days). { lastDate: 'YYYY-MM-DD', streak: n } */
export function readLogin() {
  try { const raw = window.localStorage.getItem(LOGIN_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
export function writeLogin(v) {
  try { window.localStorage.setItem(LOGIN_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

/** Weekly event scores, keyed by ISO week. */
export function readEvent() {
  try { const raw = window.localStorage.getItem(EVENT_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
export function writeEvent(v) {
  try { window.localStorage.setItem(EVENT_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

/** Full game save (Stardew-style: sleeping in a bed saves). Plain JSON, local only. */
export function saveGame(state) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function readRaceBest() {
  try {
    const raw = window.localStorage.getItem(RACE_KEY);
    return raw ? Number.parseFloat(raw) : null;
  } catch { return null; }
}

export function saveRaceBest(seconds) {
  try {
    const prev = readRaceBest();
    if (prev === null || seconds < prev) window.localStorage.setItem(RACE_KEY, String(seconds));
    return readRaceBest();
  } catch { return seconds; }
}

// --- Save backup code (batch 6, item 4): one text code the player can keep
// in notes/WA and paste back on any phone/browser to restore everything
// (name, level, XP, money, skins/items, missions, day). Offline only: the
// code never leaves the browser except through the clipboard. Moved here
// from main.js in batch 7 so the codec is importable by tests.
export const BACKUP_PREFIX = 'EREKE1.';
export function encodeSaveCode(state) {
  return BACKUP_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}
export function decodeSaveCode(code) {
  const raw = (code || '').trim();
  if (!raw.startsWith(BACKUP_PREFIX)) throw new Error('prefix');
  const s = JSON.parse(decodeURIComponent(escape(atob(raw.slice(BACKUP_PREFIX.length)))));
  if (!s || typeof s !== 'object' || typeof s.money !== 'number' || typeof s.day !== 'number' || !Array.isArray(s.missions)) throw new Error('shape');
  return s;
}
