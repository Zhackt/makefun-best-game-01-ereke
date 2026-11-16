// costume.js — batch 7: who owns which skin, and what the dev code unlocks.
// Pure functions over plain player-shaped objects (no DOM, no THREE), so
// they are unit-tested directly (see /tmp/b7-test). The DOM rendering in
// main.js (title screen + in-game panel) and the click handling both go
// through these helpers — one rule, one place.
import { SKIN_DEFS, SHOP_SKINS, RANK_SKIN_IDS, RANK_SKIN_LEVEL, fmtRp, levelTitle } from './data.js';

/** All rank titles the dev code grants (Junior..Dewa). */
export const DEV_TITLES = ['Junior', 'Senior', 'Master', 'Grandmaster', 'Legenda', 'Dewa'];
/** XP for exactly level 100 (levelFromXp: 1 + floor(xp/100)). */
export const DEV_XP = 9900;
/** Money a dev account carries (spendMoney() never deducts for dev accounts,
    so this is effectively unlimited). */
export const DEV_MONEY = 999999999;

/** Apply the developer unlock to a plain state object (the live player or a
    save object): level MAX (100, Dewa), unlimited money, ALL skins unlocked.
    Returns the same object. */
export function devUnlockState(s) {
  s.dev = true;
  s.xp = DEV_XP;
  s.money = DEV_MONEY;
  s.skins = [...new Set([...(s.skins || []), ...RANK_SKIN_IDS])];
  s.shopSkins = [...new Set([...(s.shopSkins || []), ...SHOP_SKINS.map((x) => x.id)])];
  s.titles = [...new Set([...(s.titles || []), ...DEV_TITLES])];
  return s;
}

/** Does this player own this skin? Dev accounts own everything. */
export function ownsSkin(p, id) {
  if (p.dev) return true;
  if (RANK_SKIN_IDS.includes(id)) return (p.skins || []).includes(id);
  return (p.shopSkins || []).includes(id);
}

/** Why a skin is locked, for the costume menu: null = owned / wearable. */
export function skinLockReason(p, id) {
  if (ownsSkin(p, id)) return null;
  if (RANK_SKIN_IDS.includes(id)) return `🔒 Buka di Level ${RANK_SKIN_LEVEL[id]} (${levelTitle(RANK_SKIN_LEVEL[id])})`;
  const shop = SHOP_SKINS.find((x) => x.id === id);
  return `🔒 Beli di Pasar Ereke — ${shop ? fmtRp(shop.price) : ''}`;
}

/** Wear a skin: locked skins are refused (nothing changes). Returns
    { ok, msg } — the caller shows msg as a toast. */
export function wearSkin(p, id) {
  if (id === '' || id === null || id === undefined) {
    p.skin = null;
    return { ok: true, msg: '👕 Kembali ke baju biasa.' };
  }
  if (!SKIN_DEFS[id]) return { ok: false, msg: 'Skin tidak ada.' };
  if (!ownsSkin(p, id)) return { ok: false, msg: `🔒 ${SKIN_DEFS[id].name} belum milikmu. ${skinLockReason(p, id)}` };
  p.skin = id;
  return { ok: true, msg: `👕 Memakai ${SKIN_DEFS[id].name} — ${SKIN_DEFS[id].effect.text}` };
}

/** One row of the costume menu. Owned skins get a "Pakai" button, the
    equipped one is disabled, locked ones show how to unlock them. */
function costumeRow(p, id, label, sub) {
  const lock = id === '' ? null : skinLockReason(p, id);
  const btn = id === (p.skin || '')
    ? '<button class="btn" disabled>Dipakai</button>'
    : lock
      ? `<button class="btn ghost" data-costume="${id}">🔒 Terkunci</button>`
      : `<button class="btn" data-costume="${id}">Pakai</button>`;
  return `<div class="shop-item"><div><b>${label}</b><small>${sub}${lock ? ` · ${lock}` : ''}</small></div>${btn}</div>`;
}

/** The whole costume menu as HTML, shared by the title screen section and
    the in-game panel: plain clothes + every rank skin + every shop skin.
    Only owned skins are wearable; locked ones say how to get them. */
export function costumeHTML(p) {
  const plain = costumeRow(p, '', '👕 Baju Biasa', 'Tanpa efek.');
  const rank = RANK_SKIN_IDS.map((id) => costumeRow(p, id, SKIN_DEFS[id].name, `${SKIN_DEFS[id].effect.text} · eksklusif peringkat`)).join('');
  const shop = SHOP_SKINS.map((s) => costumeRow(p, s.id, SKIN_DEFS[s.id].name, `${SKIN_DEFS[s.id].effect.text} · skin toko`)).join('');
  return `<h3>👕 Baju biasa</h3>${plain}`
    + `<h3>⭐ Skin peringkat (eksklusif)</h3>${rank}`
    + `<h3>🛍️ Skin toko</h3>${shop}`
    + `<p><small>🔒 Skin yang belum dimiliki tidak bisa dipakai — naik level untuk skin peringkat, beli skin toko di Pasar Ereke. Tampilan skin mengikuti gender yang dipilih 👦/👧 (cewe punya warna sendiri).</small></p>`;
}
