// main.js — boot, game loop and screen state machine for Ereke (3D).
// Screens: title, play, paused, shop, npc, book, missions, win, lose.
// ?shot=start|play|shop|end stages a deterministic scene for screenshots.
import * as THREE from '../vendor/three.module.min.js';
import { createScene } from './scene.js';
import { buildWorld, updateSea, groundHeight, makePlayerMesh, makeHeldMesh, makeNameTag } from './world.js';
import { createPlayer, placePlayer, updatePlayer, updateCamera, addFish, collectionCount, sellAllFish, skinEffect, surfaceY, blockedAt, waterAt, boatDeckY } from './player.js';
import { createFishing, startCast, updateFishing, cancelFishing } from './fishing.js';
import { shopList, buyItem, boatList, buyBoat, fishPrices } from './shop.js';
import { createMissions, missionProgress, canTurnIn, acceptMission, turnIn, doneCount, missionXp, createJobs, jobProgress, canJobTurnIn, acceptJob, jobTurnIn, missionUnlocked, nextMainMission, missionChip } from './missions.js';
import { createNPCs, npcNear, npcLine } from './npcs.js';
import { createClock, updateClock, endDay, clockText, applyDayNight } from './daynight.js';
import { createAudio, sfxSplash, sfxCoin, sfxCatch, sfxFail, sfxTalk, sfxSleep, sfxFanfare, sfxStep, sfxHurt, sfxSlash, sfxBite, sfxCrash, updateAmbient } from './audio.js';
import { createUI, updateHUD, setPrompt, showToast, showBanner, updateTimers, showPanel, hidePanel, showEnd, hideEnd, drawMinimap, drawFullMap, setupFullMap, collectionHTML, missionsHTML, setupTouch, IS_TOUCH } from './ui.js';
import { SPOTS, PLACES, FISH_BY_ID, fmtRp, fishOfTheDay, LOGIN_REWARDS, TREASURE_CHESTS, RANK_REWARDS, SKIN_DEFS, SHOP_SKINS, THREAT_DAMAGE, HELD_ITEMS, WEAPON_DMG, WEAPONS, isNight, levelFromXp, levelTitle, rankColor, SEA_X, SEA_Y, FREE_BOAT_MAX_X, FREE_BOAT_WARN_X, BOAT_LIMIT_X, BOAT_WARN_X, BOAT_WARN_TEXT, BOAT_ZONE_TABLES } from './data.js';
import { readBest, saveBest, readRaceBest, saveRaceBest, saveGame, loadGame, clearSave, readLogin, writeLogin, readEvent, writeEvent } from './save.js';
import { currentEvent, rivalsFor, playerRank, emptyEventState } from './events.js';
import { HOUSES, RENT_PRICE } from './data.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
// Loading screen (batch 5, item 5): real progress only — the bar moves when
// a stage actually finishes. The awaits let the browser paint each step;
// without them the synchronous init would jump 5% straight to 100%.
const loadTick = () => new Promise((r) => requestAnimationFrame(r));
const loadStep = (pct, label) => { if (window.__erekeLoad) window.__erekeLoad(pct, label); };
const canvas = document.getElementById('game');
loadStep(30, 'Memuat script…');
await loadTick();
const { renderer, scene, camera, sun, hemi, moon } = createScene(canvas);
loadStep(45, 'Menyiapkan layar…');
await loadTick();
const world = buildWorld(scene);
loadStep(75, 'Membangun dunia Ereke…');
await loadTick();
const npcs = createNPCs(scene);
const player = createPlayer();
scene.add(player.mesh);
player.walkways = world.walkways;
placePlayer(player, 62, 78, world.colliders);
const fishing = createFishing();
const clock = createClock();
const missions = createMissions();
const jobs = createJobs();
const audio = createAudio();
const ui = createUI();
loadStep(90, 'Menyiapkan misi & toko…');
await loadTick();
const keys = new Set();
let screen = 'title';
document.body.classList.add('screen-title'); // hide HUD + touch controls while the title screen shows
let visited = new Set(['loji']);
let currentPlace = null;
let currentNpc = null;
let best = readBest();
let elapsed = 0;
let haggle = null; // { total, n, marker, dir, timer } — warung haggling timing bar
let race = null; // { t, cp } — motorbike checkpoint race up Bukit Lamoliandu
let raceBest = readRaceBest();
let waypoint = null; // { x, z, name } — set from the full map; NO fast travel
let jobCrates = []; // { mesh, x, z, jobId } — crates/nets spawned by active carry jobs
const evt = currentEvent();
let eventState = readEvent();
if (!eventState || eventState.week !== evt.week) { eventState = emptyEventState(evt.week); writeEvent(eventState); }

/** Rebuild the hero mesh when gender / hair / shirt / skin changes. */
function applyAppearance() {
  const skin = player.skin ? SKIN_DEFS[player.skin] : null;
  const shirtColor = skin ? skin.shirt : player.shirt;
  scene.remove(player.mesh);
  const mesh = makePlayerMesh(player.gender, player.hair, shirtColor, skin);
  mesh.position.copy(player.mesh.position);
  mesh.rotation.y = player.mesh.rotation.y;
  player.mesh = mesh;
  scene.add(mesh);
  updateHeldMesh(); // the hand mesh is a child of the player mesh: re-attach it
  updateNameTag(); // same for the floating name tag above the head
}

/** Floating name tag (batch 5, item 4): white name + rank title in the rank
    colour, above the head. Rebuilt only when the name or rank changes (and
    after the mesh is rebuilt by applyAppearance). Called every frame — the
    check is two string compares, the rebuild only on change. */
function updateNameTag() {
  if (!player.mesh) return;
  const title = levelTitle(levelFromXp(player.xp || 0));
  const key = `${player.name || 'Nelayan'}|${title}`;
  if (player._nameTagKey === key && player.mesh.getObjectByName('nameTag')) return;
  const old = player.mesh.getObjectByName('nameTag');
  if (old) player.mesh.remove(old);
  const tag = makeNameTag(player.name || 'Nelayan', title, rankColor(title));
  tag.name = 'nameTag';
  tag.position.set(0, 2.5, 0); // above the head (hero is ~1.9 tall)
  player.mesh.add(tag);
  player._nameTagKey = key;
}

/** Award XP; crossing a rank boundary triggers the SELAMAT! celebration. */
function gainXp(n) {
  const before = levelTitle(levelFromXp(player.xp || 0));
  player.xp = (player.xp || 0) + Math.round(n * skinEffect(player, 'xp'));
  const after = levelTitle(levelFromXp(player.xp));
  if (after !== before) rankUp(after);
}

function rankUp(title) {
  const rw = RANK_REWARDS[title];
  sfxFanfare(audio);
  if (rw) {
    player.money += rw.bonus; player.earned += rw.bonus;
    if (!player.skins.includes(rw.skinId)) player.skins.push(rw.skinId);
    player.titles.push(title);
  }
  const skinName = rw ? SKIN_DEFS[rw.skinId].name : '';
  const popup = document.getElementById('rankup-popup');
  document.getElementById('rankup-text').innerHTML = `Kamu naik ke <b>${title}</b>! (Level ${levelFromXp(player.xp)})<br>` +
    (rw ? `🎁 Bonus <b>${fmtRp(rw.bonus)}</b><br>👕 Skin eksklusif terbuka: <b>${skinName}</b> — ${SKIN_DEFS[rw.skinId].effect.text}<br><small>Pakai skin dari Profil (klik ⭐ Lv di HUD).</small>` : '');
  popup.style.display = 'flex';
  // Confetti: falling emoji, purely cosmetic DOM.
  const emojis = ['🎉', '✨', '🎊', '⭐', '🐟'];
  for (let i = 0; i < 24; i += 1) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = emojis[i % emojis.length];
    s.style.left = `${Math.random() * 96}vw`;
    s.style.animationDelay = `${Math.random() * 1.5}s`;
    popup.appendChild(s);
  }
  saveGame(snapshot());
}
document.getElementById('rankup-close').addEventListener('click', () => {
  const popup = document.getElementById('rankup-popup');
  popup.querySelectorAll('.confetti').forEach((c) => c.remove());
  popup.style.display = 'none';
});

// --- Gender choice on the title screen ---
document.querySelectorAll('[data-gender]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-gender]').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    player.gender = btn.dataset.gender;
    player.shirt = player.gender === 'cewe' ? 0xe91e63 : 0x3498db;
    applyAppearance();
  });
});

// --- Daily login (real days): streak resets if a day is missed. ---
function dayStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let loginClaim = null;
(function checkLogin() {
  const today = new Date();
  const stored = readLogin();
  if (stored && stored.lastDate === dayStr(today)) return; // already claimed today
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  let streak = 1;
  if (stored && stored.lastDate === dayStr(yesterday)) streak = Math.min(7, stored.streak + 1);
  const reward = LOGIN_REWARDS[streak - 1];
  loginClaim = { streak, reward };
  const daysEl = document.getElementById('login-days');
  daysEl.innerHTML = LOGIN_REWARDS.map((r, i) => {
    const cls = i + 1 === streak ? 'today' : (i + 1 < streak ? 'claimed' : '');
    return `<div class="login-day ${cls}">Hari ${i + 1}<br><b>${fmtRp(r.money)}</b>${r.bait ? `<br>+${r.bait} umpan` : ''}${r.rareBait ? '<br>+🎁 umpan langka' : ''}</div>`;
  }).join('');
  document.getElementById('login-text').textContent = `Hari ke-${streak} berturut-turut! Klaim hadiahmu — kalau bolos sehari, streak kembali ke Hari 1.`;
  document.getElementById('login-popup').style.display = 'flex';
})();
document.getElementById('login-claim').addEventListener('click', () => {
  if (!loginClaim) return;
  const { streak, reward } = loginClaim;
  player.money += reward.money; player.earned += reward.money;
  player.bait += reward.bait; player.rareBait += reward.rareBait;
  gainXp(30);
  writeLogin({ lastDate: dayStr(new Date()), streak });
  document.getElementById('login-popup').style.display = 'none';
  showToast(ui, `🎁 Login Hari ${streak}: +${fmtRp(reward.money)}${reward.bait ? ` +${reward.bait} umpan` : ''}${reward.rareBait ? ' +🎁 umpan langka' : ''} · +30 XP`);
  loginClaim = null;
});
// Dismiss the daily-reward popup without claiming: it sits above the title
// screen, so it must never block the "Mulai Bermain" button. The reward is
// NOT lost — nothing is written, so the popup (and the reward) is still
// there to claim on the next load.
document.getElementById('login-close').addEventListener('click', () => {
  document.getElementById('login-popup').style.display = 'none';
});

function nearSalon() {
  for (const s of world.salons) if (Math.hypot(player.x - s.x, player.z - s.z) < 6) return s;
  return null;
}
function nearBoard() { return Math.hypot(player.x - world.board.x, player.z - world.board.z) < 5; }

function openSalon() {
  screen = 'salon';
  const hairs = [['pendek', 'Pendek'], ['ikal', 'Ikal'], ['panjang', 'Panjang']];
  const shirts = [[0x3498db, 'Biru'], [0xe74c3c, 'Merah'], [0x27ae60, 'Hijau'], [0x8e44ad, 'Ungu']];
  showPanel(ui, `<h2>💇 Salon ${nearSalon() === world.salons[0] ? 'Ereke' : 'Loji'}</h2><p>Uangmu: <b>${fmtRp(player.money)}</b><br>Ganti gaya — rambut Rp 5.000, baju Rp 8.000.</p>
  <h3>💇 Gaya rambut</h3>${hairs.map(([id, name]) => `<div class="shop-item"><div><b>${name}</b><small>${player.hair === id ? '· sedang dipakai' : ''}</small></div><button class="btn" data-hair="${id}">${player.hair === id ? 'Dipakai' : 'Rp 5.000'}</button></div>`).join('')}
  <h3>👕 Baju</h3>${shirts.map(([c, name]) => `<div class="shop-item"><div><b>Baju ${name}</b><small>${player.shirt === c && !player.skin ? '· sedang dipakai' : ''}</small></div><button class="btn" data-shirt="${c}">${player.shirt === c ? 'Dipakai' : 'Rp 8.000'}</button></div>`).join('')}
  <br><button class="btn ghost" data-close>Tutup (Esc)</button>`);
}

function eventScore() {
  if (evt.id === 'mancing') return eventState.bestFishKg;
  if (evt.id === 'balapan') return eventState.bestRace;
  if (evt.id === 'harta') return eventState.chests;
  return eventState.festival;
}

function openEvents() {
  screen = 'events';
  const rivals = rivalsFor(evt.week, evt.id);
  const myScore = eventScore();
  const lowerBetter = evt.id === 'balapan';
  const rank = myScore === null || myScore === 0 ? 5 : playerRank(myScore, rivals, lowerBetter);
  const rows = [...rivals.map((r) => ({ name: r.name, score: r.score })), { name: 'Kamu', score: myScore === null ? 0 : myScore, you: true }]
    .sort((a, b) => lowerBetter ? a.score - b.score : b.score - a.score)
    .map((r, i) => `<div class="fish-row"><b>${i + 1}. ${r.name}${r.you ? ' (Kamu)' : ''}</b><span>${r.score === 0 ? '—' : r.score + (evt.id === 'mancing' ? ' kg' : evt.id === 'balapan' ? ' dtk' : '')}</span></div>`).join('');
  const canClaim = rank <= 3 && !eventState.claimed && myScore > 0;
  showPanel(ui, `<h2>${evt.emoji} ${evt.name}</h2><p>Minggu ${evt.week} · ${evt.desc}</p>
  <p><b>Skor kamu:</b> ${myScore === null || myScore === 0 ? 'belum ada' : myScore} · <b>Peringkat:</b> ${myScore > 0 ? '#' + rank : '—'}</p>
  <h3>🏆 Leaderboard minggu ini</h3><div class="fish-list">${rows}</div>
  <p>🎁 Hadiah 3 besar: <b>${fmtRp(evt.prize.money)}</b> + ${evt.prize.rareBait}x umpan langka + gelar <b>${evt.prize.title}</b></p>
  ${canClaim ? `<button class="btn" data-claimevent>Klaim Hadiah (#${rank})</button>` : (eventState.claimed ? '<p>✅ Hadiah minggu ini sudah diklaim.</p>' : '<p><small>Masuk 3 besar dulu untuk klaim hadiah!</small></p>')}
  <br><button class="btn ghost" data-close>Tutup (Esc)</button>`);
}

function openProfile() {
  screen = 'profile';
  const lv = levelFromXp(player.xp || 0);
  const xpNext = lv * 100;
  const owned = player.skins || [];
  const skinRows = owned.length ? owned.map((id) => {
    const def = SKIN_DEFS[id];
    return `<div class="shop-item"><div><b>${def.name}</b><small>${def.effect.text} · eksklusif peringkat</small></div><button class="btn" data-skin="${id}" ${player.skin === id ? 'disabled' : ''}>${player.skin === id ? 'Dipakai' : 'Pakai'}</button></div>`;
  }).join('') : '<p><small>Belum ada skin peringkat — naik level untuk membuka skin eksklusif!</small></p>';
  const shopOwned = (player.shopSkins || []).map((id) => {
    const def = SKIN_DEFS[id];
    return `<div class="shop-item"><div><b>${def.name}</b><small>${def.effect.text}</small></div><button class="btn" data-skin="${id}" ${player.skin === id ? 'disabled' : ''}>${player.skin === id ? 'Dipakai' : 'Pakai'}</button></div>`;
  }).join('');
  showPanel(ui, `<h2>👤 Profil — Bangzhackt</h2>
  <p>⭐ Level <b>${lv}</b> · <b>${levelTitle(lv)}</b> · XP ${player.xp}/${xpNext}<br>
  🗓️ Total hari main: <b>${player.daysPlayed || 0}</b> · 🎣 Ikan: ${collectionCount(player)}/12 · 📜 Misi: ${doneCount(missions)}/${missions.length} · 💰 Peti harta: ${player.chestsFound || 0}<br>
  🧩 Fragmen peta: <b>${player.fragments || 0}/3</b> · 🎁 Umpan langka: ${player.rareBait || 0}<br>
  🏆 Gelar event: ${(player.titles || []).join(', ') || '—'}</p>
  <h3>👕 Skin yang kamu pakai: ${player.skin ? SKIN_DEFS[player.skin].name + ' — ' + SKIN_DEFS[player.skin].effect.text : 'Baju biasa'}</h3>
  <button class="btn" data-skin="" ${!player.skin ? 'disabled' : ''}>Lepas Skin (baju biasa)</button>
  <h3>👕 Skin peringkat (eksklusif)</h3>${skinRows}
  <h3>🛍️ Skin toko yang kamu miliki</h3>${shopOwned || '<p><small>Belum beli skin — ada di Pasar Ereke!</small></p>'}
  <br><button class="btn ghost" data-close>Tutup (Esc)</button>`);
}
document.getElementById('level-pill').addEventListener('click', () => { if (screen === 'play') openProfile(); });

// 3D waypoint arrow: a gold cone floating above the player, pointing at the waypoint.
const arrowGeo = new THREE.ConeGeometry(0.55, 1.6, 4);
arrowGeo.rotateX(Math.PI / 2); // tip now points along +Z
const waypointArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffd700 }));
waypointArrow.visible = false;
scene.add(waypointArrow);

function nearRaceSign() { return Math.hypot(player.x - world.raceSign.x, player.z - world.raceSign.z) < 5; }

function startRace() {
  race = { t: 0, cp: 0 };
  document.getElementById('race-timer').style.display = 'block';
  showToast(ui, '🏁 BALAP DIMULAI! Lewati semua ring emas sampai Stadion Bahteramas!');
  sfxCoin(audio);
}

function fmtRace(t) {
  const m = Math.floor(t / 60); const s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function finishRace() {
  const t = race.t;
  const best = saveRaceBest(t);
  raceBest = best;
  race = null;
  document.getElementById('race-timer').style.display = 'none';
  sfxCatch(audio);
  if (evt.id === 'balapan' && (eventState.bestRace === null || t < eventState.bestRace)) { eventState.bestRace = +t.toFixed(1); }
  eventState.festival = (eventState.festival || 0) + 50;
  writeEvent(eventState);
  gainXp(50);
  showToast(ui, `🏆 Finis! Waktu ${fmtRace(t)}${t <= best ? ' — REKOR BARU!' : ` (terbaik ${fmtRace(best)})`}`);
}

function fotd() { return fishOfTheDay(clock.day); }

function openHaggle(total, n) {
  screen = 'haggle';
  haggle = { total, n, marker: 0, dir: 1, timer: null };
  showPanel(ui, `<h2>🤝 Tawar-menawar!</h2><p>Bu Sari menawar harga ${n} ikanmu (<b>${fmtRp(total)}</b>). Tekan <b>Tawar!</b> saat penanda di tengah hijau untuk bonus!</p>
  <div style="position:relative;height:26px;background:#222;border:2px solid #fff;border-radius:13px;overflow:hidden;margin:14px 0">
  <div style="position:absolute;left:30%;width:40%;height:100%;background:#f1c40f"></div>
  <div style="position:absolute;left:42%;width:16%;height:100%;background:#2ecc71"></div>
  <div id="haggle-marker" style="position:absolute;left:0;top:-2px;width:6px;height:30px;background:#fff;border:1px solid #000"></div></div>
  <p style="text-align:center">🟢 tengah = <b>+50%</b> &nbsp; 🟡 kuning = <b>+25%</b> &nbsp; luar = harga biasa</p>
  <button class="btn" data-haggle>💰 Tawar! (Spasi)</button>
  <button class="btn ghost" data-close>Jual biasa</button>`);
  haggle.timer = setInterval(() => {
    if (!haggle) return;
    haggle.marker += haggle.dir * 0.035;
    if (haggle.marker > 1) { haggle.marker = 1; haggle.dir = -1; }
    if (haggle.marker < 0) { haggle.marker = 0; haggle.dir = 1; }
    const m = document.getElementById('haggle-marker');
    if (m) m.style.left = `${haggle.marker * 100}%`;
  }, 30);
}

function resolveHaggle() {
  if (!haggle) return;
  clearInterval(haggle.timer);
  const d = Math.abs(haggle.marker - 0.5);
  const mult = d < 0.08 ? 1.5 : d < 0.2 ? 1.25 : 1.0;
  const base = sellAllFish(player, fishPrices(), fotd());
  const bonus = Math.round(base.total * (mult - 1));
  player.money += bonus; player.earned += bonus;
  sfxCoin(audio);
  showToast(ui, mult > 1 ? `🤝 Tawaran diterima! +${fmtRp(base.total + bonus)} (bonus ${Math.round((mult - 1) * 100)}%)` : `💰 Terjual ${base.n} ikan: ${fmtRp(base.total)}`);
  haggle = null;
  openShop();
}

function cancelHaggle() {
  if (haggle) { clearInterval(haggle.timer); haggle = null; }
}

if (best) document.getElementById('best-line').textContent = `Skor terbaik: ${best.score} · Ikan ${best.collected}/12 · Hari ${best.day}`;

function score() { return player.earned + collectionCount(player) * 5000; }

function spotNearPlayer() {
  let s = null; let d = 9;
  for (const sp of SPOTS) {
    if (sp.boatOnly && !player.onBoat) continue;
    const dist = Math.hypot(sp.x - player.x, sp.z - player.z);
    if (dist < d) { d = dist; s = sp; }
  }
  return s;
}
function nearMarket() { return Math.hypot(player.x - 0, player.z - 28) < 10; }
function nearBoatShop() { return Math.hypot(player.x - 175, player.z - 52) < 10; }
function nearHome() { return Math.hypot(player.x - 58, player.z - 52) < 9; }
function nearHarbour() { return Math.hypot(player.x - 150, player.z - 40) < 10; }
function nearLostRod() { return Math.hypot(player.x - 150, player.z + 104) < 5; }

function placeCheck() {
  let p = null;
  for (const pl of PLACES) {
    if (Math.hypot(pl.x - player.x, pl.z - player.z) < (pl.r || 34)) { p = pl; break; }
  }
  if (p && (!currentPlace || currentPlace.id !== p.id)) {
    currentPlace = p; visited.add(p.id);
    if (p.id !== 'loji') gainXp(10); // exploring a new place gives XP
    if (p.id === 'gunung') showToast(ui, '📸 Titik foto! Seluruh Ereke terlihat dari puncak Gunung Butur!');
    showBanner(ui, p.name, p.sub);
  } else if (!p) currentPlace = null;
}

function vehicleNear() {
  let v = null; let d = 4.5;
  for (const veh of world.vehicles) {
    const dist = Math.hypot(veh.x - player.x, veh.z - player.z);
    if (dist < d) { d = dist; v = veh; }
  }
  return v;
}

function openBoatShop() {
  screen = 'boatshop';
  const boats = boatList(player);
  showPanel(ui, `<h2>⚓ Galangan Kapal — Pelabuhan Ereke</h2><p>Uangmu: <b>${fmtRp(player.money)}</b> · Perahu sekarang: <b>${player.boatTier ? ['—', 'Perahu Kayu', 'Perahu Motor', 'Kapal Besar', 'Kapal Raksasa'][player.boatTier] : 'belum punya'}</b><br>Beli perahu, lalu naik dari dermaga dengan tombol <b>B</b> untuk berlayar ke Tengah Laut Banda.</p>
  ${boats.map((b) => `<div class="shop-item"><div><b>${b.name}</b><small>${b.desc} ${b.note ? '· ' + b.note : ''}</small></div><button class="btn" data-buyboat="${b.id}" ${b.owned ? 'disabled' : ''}>${b.owned ? 'Dimiliki' : fmtRp(b.price)}</button></div>`).join('')}
  <br><button class="btn ghost" data-close>Tutup (Esc)</button>`);
}

function openMap() {
  screen = 'map';
  document.getElementById('fullmap').style.display = 'flex';
  drawFullMap(ui, player, PLACES, waypoint);
}
function closeMap() {
  document.getElementById('fullmap').style.display = 'none';
  if (screen === 'map') screen = 'play';
}

function openShop() {
  screen = 'shop';
  const items = shopList(player);
  const inv = Object.entries(player.fish).map(([id, n]) => `${FISH_BY_ID[id].name} x${n} — ${fmtRp(FISH_BY_ID[id].price * n)}`).join('<br>') || 'Belum ada ikan. Pergi memancing dulu!';
  const sellTotal = Object.entries(player.fish).reduce((t, [id, n]) => t + FISH_BY_ID[id].price * n * (fotd().fish.id === id ? fotd().mult : 1), 0);
  showPanel(ui, `<h2>🏪 Pasar Ereke</h2><p>Uangmu: <b>${fmtRp(player.money)}</b> · Joran: tier ${player.rod} · Umpan: ${player.bait}x · Perahu: ${player.boatTier ? ['—', 'Perahu Kayu', 'Perahu Motor', 'Kapal Besar'][player.boatTier] : 'belum'}</p>
  <p>🐟 <b>Ikan Hari Ini:</b> ${fotd().fish.name} dari ${fotd().spot.name} — harga <b>3x</b> hari ini!</p>
  <h3>🐟 Jual hasil tangkapan</h3><p>${inv}</p>
  ${sellTotal > 0 ? `<button class="btn" data-sell>Jual Semua (${fmtRp(sellTotal)})</button>` : ''}
  <h3>🛒 Beli perlengkapan</h3>${items.map((it) => `<div class="shop-item"><div><b>${it.name}</b><small>${it.desc} ${it.note ? '· ' + it.note : ''}</small></div><button class="btn" data-buy="${it.id}" ${it.owned ? 'disabled' : ''}>${it.owned ? 'Dimiliki' : fmtRp(it.price)}</button></div>`).join('')}
  <h3>👕 Skin (efek aktif saat dipakai)</h3>
  <p><small>${player.skin ? `Sedang dipakai: <b>${SKIN_DEFS[player.skin].name}</b> — ${SKIN_DEFS[player.skin].effect.text}` : 'Belum ada skin dipakai. Beli satu, lalu pakai dari Profil (klik ⭐ Lv di HUD).'}</small></p>
  ${SHOP_SKINS.map((s) => {
    const def = SKIN_DEFS[s.id];
    const owned = (player.shopSkins || []).includes(s.id);
    return `<div class="shop-item"><div><b>${def.name}</b><small>✨ ${def.effect.text}</small></div><button class="btn" data-buyskin="${s.id}" ${owned ? 'disabled' : ''}>${owned ? 'Dimiliki' : fmtRp(s.price)}</button></div>`;
  }).join('')}
  ${(player.gather && player.gather.wood > 0) ? `<h3>🪵 Hasil hutan</h3><button class="btn" data-sellwood>Jual Kayu x${player.gather.wood} (Rp 3.000/kayu)</button>` : ''}
  <br><button class="btn ghost" data-close>Tutup (Esc)</button>`);
}

function openNpc(npc) {
  screen = 'npc'; currentNpc = npc;
  sfxTalk(audio);
  const tierEmoji = { Mudah: '🟢 Mudah', Sedang: '🟡 Sedang', Sulit: '🔴 Sulit' };
  let missionHtml = '';
  for (const m of missions.filter((x) => x.giver === npc.name)) {
    const prog = missionProgress(m, player);
    if (m.status === 'available') {
      const lock = missionUnlocked(m, missions, player);
      if (!lock.ok) missionHtml += `<p>📜 <b>${m.title}</b> <small>${tierEmoji[m.tier]}</small><br>${m.text}<br><span style="opacity:.7">${lock.reason} — selesaikan misi sebelumnya / naik level dulu.</span></p>`;
      else missionHtml += `<p>📜 <b>${m.title}</b> <small>${tierEmoji[m.tier]}</small><br>${m.text}<br>Hadiah: ${fmtRp(m.reward)}${m.rareBait ? ' +🎁 umpan langka' : ''}${m.fragment ? ' +🧩 fragmen' : ''}</p><button class="btn" data-accept="${m.id}">Terima Misi</button>`;
    }
    else if (m.status === 'active' && canTurnIn(m, player)) missionHtml += `<p>📜 <b>${m.title}</b> — selesai! (${prog.have}/${prog.need})</p><button class="btn" data-turnin="${m.id}">Serahkan (${fmtRp(m.reward)})</button>`;
    else if (m.status === 'active') missionHtml += `<p>📜 <b>${m.title}</b> — ${prog.have}/${prog.need}. ${m.text}</p>`;
    else missionHtml += `<p>📜 <b>${m.title}</b> — ✅ ${m.done}</p>`;
  }
  let jobHtml = '';
  for (const j of jobs.filter((x) => x.giver === npc.name)) {
    const prog = jobProgress(j, player);
    if (j.status === 'available') jobHtml += `<p>💼 <b>Kerja: ${j.title}</b><br>${j.text}<br>Upah: ${fmtRp(j.reward)} (bisa diulang)</p><button class="btn" data-jobaccept="${j.id}">Ambil Kerjaan</button>`;
    else if (canJobTurnIn(j, player)) jobHtml += `<p>💼 <b>${j.title}</b> — selesai! (${prog.have}/${prog.need})</p><button class="btn" data-jobturnin="${j.id}">Terima Upah (${fmtRp(j.reward)})</button>`;
    else jobHtml += `<p>💼 <b>${j.title}</b> — ${prog.have}/${prog.need}. ${j.text}</p>`;
  }
  showPanel(ui, `<h2>${npc.name} — ${npc.role}</h2><p>“${npcLine(npc)}”</p>${missionHtml}${jobHtml}
  ${npc.id === 'sari' ? '<button class="btn" data-openshop>🛒 Buka Toko Pasar</button>' : ''}
  ${npc.id === 'laode' && Object.keys(player.fish).length ? `<button class="btn" data-sellpier>🐟 Jual Ikan di Dermaga (Tongkol & Kerapu +20%, lainnya -20%)</button>` : ''}
  <button class="btn ghost" data-close>Tutup (E)</button>`);
}

function openBook() { screen = 'book'; showPanel(ui, collectionHTML(player)); }
function openMissions() { screen = 'missions'; showPanel(ui, missionsHTML(missions, player, jobs)); }

function closePanel() {
  hidePanel(ui);
  if (screen !== 'win' && screen !== 'lose') screen = 'play';
}

function savePoints() {
  const pts = [{ id: 'home', name: 'Rumahmu di Loji Pantai', x: 58, z: 52 }];
  if (player.houses.ereke) pts.push({ id: 'ereke', name: 'Rumah Ereke', x: 24, z: 44 });
  if (player.houses.membuku) pts.push({ id: 'membuku', name: 'Rumah Pantai Membuku', x: 140, z: -95 });
  pts.push({ id: 'rent', name: 'Kamar Sewa Ereke', x: 30, z: 20, rent: true });
  return pts;
}

function nearestSavePoint() {
  let best = null; let d = 9;
  for (const p of savePoints()) {
    const dist = Math.hypot(p.x - player.x, p.z - player.z);
    if (dist < d) { d = dist; best = p; }
  }
  return best;
}

function snapshot() {
  return {
    money: player.money, earned: player.earned, rod: player.rod, bait: player.bait,
    boatTier: player.boatTier, energy: player.energy, fish: player.fish, caught: player.caught,
    houses: player.houses, day: clock.day, minutes: clock.minutes,
    missions: missions.map((m) => ({ id: m.id, status: m.status, foundRod: m.foundRod })),
    jobs: jobs.map((j) => ({ id: j.id, status: j.status, progress: j.progress })),
    x: player.x, z: player.z,
    gender: player.gender, hair: player.hair, shirt: player.shirt, skin: player.skin,
    name: player.name, // character name (title screen; 'Nelayan' if blank)
    skins: player.skins, shopSkins: player.shopSkins || [],
    xp: player.xp, fragments: player.fragments, rareBait: player.rareBait,
    daysPlayed: player.daysPlayed, chestsFound: player.chestsFound,
    coconuts: player.coconuts, gather: player.gather, titles: player.titles, defeated: player.defeated,
  };
}

function applySave(s) {
  player.money = s.money; player.earned = s.earned; player.rod = s.rod; player.bait = s.bait;
  player.boatTier = s.boatTier; player.boat = s.boatTier > 0; player.energy = s.energy;
  player.fish = s.fish || {}; player.caught = s.caught || {}; player.houses = s.houses || {};
  clock.day = s.day; clock.minutes = s.minutes;
  player.gender = s.gender || 'cowo'; player.hair = s.hair || 'pendek';
  player.name = s.name || ''; // old saves have no name: stays blank until the title screen fills it
  player.shirt = s.shirt ?? 0x3498db; player.skin = s.skin || null;
  player.skins = s.skins || []; player.shopSkins = s.shopSkins || [];
  player.xp = s.xp || 0; player.fragments = s.fragments || 0; player.rareBait = s.rareBait || 0;
  player.daysPlayed = s.daysPlayed || 0; player.chestsFound = s.chestsFound || 0;
  player.coconuts = s.coconuts || 0; player.gather = s.gather || { wood: 0, fruit: 0, mushroom: 0 };
  player.titles = s.titles || []; player.defeated = s.defeated || {};
  for (const sj of s.jobs || []) {
    const j = jobs.find((x) => x.id === sj.id);
    if (j) { j.status = sj.status; j.progress = sj.progress; }
  }
  for (const sm of s.missions || []) {
    const m = missions.find((x) => x.id === sm.id);
    if (m) { m.status = sm.status; m.foundRod = sm.foundRod; }
  }
  placePlayer(player, s.x ?? 62, s.z ?? 78, world.colliders);
  applyAppearance();
}

/** Sleep in a bed: saves the game (Stardew-style) and starts the next day. */
let sleepChoiceOpen = false; // a sleep-choice modal is open: the game is paused
let sleepConfirmPoint = null; // bed for a manual-sleep confirmation (trySleep)
let dayEndPromptShown = false; // day-end popup shown once per end of day
let energyPromptShown = false; // energy-empty popup shown once per episode

/** Sleep-choice modal (batch 4, item 11): sleeping is ALWAYS the player's
    choice — never an automatic teleport from the middle of the sea. While
    the modal is open the game is paused (frame loop skips the inGame block). */
function showSleepModal(kind, point = null) {
  sleepChoiceOpen = true;
  sleepConfirmPoint = point;
  const modal = document.getElementById('sleep-modal');
  const title = document.getElementById('sleep-modal-title');
  const text = document.getElementById('sleep-modal-text');
  const sleepBtn = document.getElementById('sleep-modal-sleep');
  const stayBtn = document.getElementById('sleep-modal-stay');
  if (kind === 'confirm') {
    title.textContent = '🛏️ Tidur sampai pagi?';
    text.textContent = 'Tidur menyimpan game dan memulai hari berikutnya.';
    sleepBtn.textContent = '😴 Ya, Tidur';
    stayBtn.textContent = 'Batal';
  } else if (kind === 'energy') {
    title.textContent = '😴 Energimu habis — mau pulang dan tidur?';
    text.textContent = 'Energi 0: kamu masih bisa jalan kaki pulang sendiri, tapi tidak bisa memancing atau beraksi yang butuh energi. Tidur memulihkan energi dan menyimpan game.';
    sleepBtn.textContent = '😴 Pulang & Tidur — Simpan';
    stayBtn.textContent = '🌙 Lanjutkan main';
  } else {
    title.textContent = '🌙 Hari sudah berakhir — mau tidur?';
    text.textContent = 'Jam sudah 22:00. Tidur menyimpan game dan memulai hari berikutnya. Kalau lanjut main, jam berhenti di 22:00 sampai kamu tidur.';
    sleepBtn.textContent = '😴 Pulang & Tidur — Simpan';
    stayBtn.textContent = '🌙 Lanjutkan main';
  }
  if (document.pointerLockElement) document.exitPointerLock();
  modal.style.display = 'flex';
}

function closeSleepModal(choice) {
  document.getElementById('sleep-modal').style.display = 'none';
  const point = sleepConfirmPoint;
  sleepChoiceOpen = false;
  sleepConfirmPoint = null;
  if (choice === 'sleep') {
    if (point) sleepAt(point);
    else sleep(); // chosen: teleport home is fine, the player asked for it
  }
  // 'stay': no teleport, no save, no day change — the player keeps playing.
}

function sleepAt(point) {
  cancelFishing(fishing);
  sfxSleep(audio);
  if (point.rent) {
    if (player.money < RENT_PRICE) { showToast(ui, `Kamar sewa Rp ${RENT_PRICE.toLocaleString('id-ID')}/malam — uangmu tidak cukup.`); return; }
    player.money -= RENT_PRICE;
  }
  player.energy = 100;
  player.daysPlayed = (player.daysPlayed || 0) + 1;
  // Monsters respawn, coconuts + gatherables regrow, job crates clear.
  for (const m of world.monsters) { m.alive = true; m.hp = m.maxHp; m.mesh.visible = true; }
  player.defeated = {};
  for (const c of jobCrates) scene.remove(c.mesh);
  jobCrates = [];
  for (const c of world.coconuts) { c.taken = false; c.mesh.visible = true; }
  for (const g of world.gather) { g.taken = false; g.mesh.visible = true; }
  if (player.houses.membuku && point.id === 'membuku') player.bait += 2; // beach-house perk
  if (player.riding) { player.riding = null; player.vehicle = null; player.mesh.visible = true; }
  if (race) { race = null; document.getElementById('race-timer').style.display = 'none'; }
  for (const v of world.vehicles) { v.x = v.home.x; v.z = v.home.z; v.yaw = 0.6; v.mesh.position.set(v.x, 0, v.z); }
  for (const p of world.pickups) { p.taken = false; p.mesh.visible = true; }
  // Boats reset to harbour/beach; the player is never left swimming or aboard.
  if (player.onBoat) { player.onBoat = false; player.freeBoat = false; player.titanic = false; }
  player.swimming = false;
  player._freeWarned = false; player._boatWarned = false; player._boatPushed = false; player._boatZone = 0;
  if (world.freeBoat) { world.freeBoat.boarded = false; world.freeBoat.x = world.freeBoat.home.x; world.freeBoat.z = world.freeBoat.home.z; world.freeBoat.mesh.position.set(world.freeBoat.home.x, SEA_Y, world.freeBoat.home.z); world.freeBoat.mesh.visible = true; }
  if (world.titanic) { world.titanic.boarded = false; world.titanic.x = world.titanic.home.x; world.titanic.z = world.titanic.home.z; world.titanic.mesh.position.set(world.titanic.home.x, SEA_Y, world.titanic.home.z); }
  const over = endDay(clock);
  dayEndPromptShown = false; energyPromptShown = false; // a new day: popups may fire again
  saveGame(snapshot());
  if (over) { showToast(ui, 'Hari ke-7 berakhir...'); return endGame(false); }
  placePlayer(player, point.x, point.z, world.colliders);
  showToast(ui, `💾 Tersimpan! Selamat pagi, Hari ${clock.day}. 🐟 Ikan Hari Ini: ${fotd().fish.name} di ${fotd().spot.name} (3x)!`);
}

/** Collapse / day-end: wake up at home the next morning (also saves).
    Only ever called from the sleep-choice modal, i.e. the player chose it. */
function sleep() {
  sleepAt({ id: 'home', name: 'Rumahmu di Loji Pantai', x: 58, z: 52 });
}

function trySleep() {
  const point = nearestSavePoint();
  if (!point) {
    showToast(ui, '🛏️ Belum ada tempat tidur di sini. Rumahmu di Desa Loji Pantai — atau sewa kamar di Ereke (Rp 2.000/malam).');
    return;
  }
  // Manual sleep is an explicit choice too: confirm before saving + next day.
  showSleepModal('confirm', point);
}

// --- Boats (batch 4, items 7/9/10) ---
function nearFreeBoat() {
  const fb = world.freeBoat;
  return fb && !fb.sunk && Math.hypot(fb.x - player.x, fb.z - player.z) < 5;
}
function nearTitanic() {
  const tt = world.titanic;
  return tt && Math.hypot(tt.x - player.x, tt.z - player.z) < 10;
}
/** Boat fishing zone by distance from the shore (x − SEA_X). */
function boatZone(x) {
  const d = x - SEA_X;
  return d < 60 ? 0 : d < 150 ? 1 : d < 300 ? 2 : 3;
}
/** The fishing spot a boat cast uses: the zone table at the boat's position. */
function boatZoneSpot(x) {
  const z = boatZone(x);
  return { id: 'boat-zone', name: `${BOAT_ZONE_TABLES[z].name} (${Math.max(0, Math.round(x - SEA_X))} m dari pantai)`, boatOnly: true, table: BOAT_ZONE_TABLES[z].table };
}
function sinkFreeBoat() {
  const fb = world.freeBoat;
  sfxCrash(audio); sfxSplash(audio);
  showToast(ui, '💥 Perahu kecilmu hancur kena ombak besar!');
  player.onBoat = false; player.freeBoat = false; player._freeWarned = false;
  player.x = FREE_BOAT_MAX_X - 4; // the player ends up swimming just inside the limit
  // The sampan respawns at the beach, ready to use again.
  fb.boarded = false; fb.sunk = false;
  fb.x = fb.home.x; fb.z = fb.home.z;
  fb.mesh.visible = true;
  fb.mesh.position.set(fb.home.x, SEA_Y, fb.home.z);
  fb.mesh.rotation.y = 0;
}
/** Step off a boat into the water: the player swims, the boat stays put. */
function disembarkToSwim() {
  player.onBoat = false;
  if (player.freeBoat) { player.freeBoat = false; if (world.freeBoat) world.freeBoat.boarded = false; }
  if (player.titanic) { player.titanic = false; if (world.titanic) world.titanic.boarded = false; }
  showToast(ui, '🏊 Turun dari perahu — berenang kembali ke tepi!');
}

function nearBank() { return Math.hypot(player.x + 14, player.z - 10) < 10; }

function openBank() {
  screen = 'bank';
  const rows = HOUSES.map((h) => {
    const owned = !!player.houses[h.id];
    return `<div class="shop-item"><div><b>${h.name}</b><small>${h.perk} · Titik simpan baru.</small></div><button class="btn" data-buyhouse="${h.id}" ${owned ? 'disabled' : ''}>${owned ? 'Dimiliki' : fmtRp(h.price)}</button></div>`;
  }).join('');
  showPanel(ui, `<h2>🏦 Bank BNI Ereke</h2><p>BNI KCP Ereke — Jl. Raya Bumi Sara'ea.<br>Saldo: <b>${fmtRp(player.money)}</b> · Rumah dimiliki: <b>${Object.keys(player.houses).filter((k) => player.houses[k]).length}/2</b></p>
  <h3>🏠 Beli rumah (jadi titik simpan)</h3>${rows}
  <p><small>Pinjaman KPR belum tersedia — nabung dulu dari hasil memancing!</small></p>
  <br><button class="btn ghost" data-close>Tutup (Esc)</button>`);
}

function endGame(win) {
  const stats = `Skor: <b>${score()}</b> · Uang didapat: ${fmtRp(player.earned)} · Ikan: ${collectionCount(player)}/12 · Misi: ${doneCount(missions)}/${missions.length} · Hari: ${clock.day} · Level: ${levelFromXp(player.xp || 0)} (${levelTitle(levelFromXp(player.xp || 0))})`;
  const result = { score: score(), collected: collectionCount(player), day: clock.day, win, when: Date.now() };
  best = saveBest(result);
  clearSave(); // a finished run starts fresh next time
  screen = win ? 'win' : 'lose';
  showEnd(ui, win, stats);
  if (document.pointerLockElement) document.exitPointerLock();
}

function startGame() {
  document.body.classList.remove('screen-title'); // HUD + touch controls return
  document.getElementById('settings-popup').style.display = 'none'; // never leave settings open over the game
  document.getElementById('title-screen').style.display = 'none';
  hideEnd(ui); hidePanel(ui);
  setHeld(player.held); // sync the held pil, the AKSI icon and SERANG with what is held
  player.mesh.visible = true; // the title shot hides the hero for a clean scene
  screen = 'play';
  showToast(ui, `🐟 Ikan Hari Ini: ${fotd().fish.name} di ${fotd().spot.name} — harga 3x!`);
}

function resetGame() {
  const keepName = player.name; // same character, new run — the name survives
  scene.remove(player.mesh);
  const fresh = createPlayer();
  Object.assign(player, fresh);
  player.name = keepName;
  player.walkways = world.walkways;
  scene.add(player.mesh);
  placePlayer(player, 62, 78, world.colliders);
  fishing.state = 'idle'; fishing.result = null;
  clock.day = 1; clock.minutes = 6 * 60;
  missions.forEach((m, i) => { m.status = 'available'; m.foundRod = false; });
  jobs.forEach((j) => { j.status = 'available'; j.progress = 0; });
  for (const c of jobCrates) scene.remove(c.mesh);
  jobCrates = [];
  for (const mon of world.monsters) { mon.alive = true; mon.hp = mon.maxHp; mon.mesh.visible = true; }
  for (const c of world.coconuts) { c.taken = false; c.mesh.visible = true; }
  for (const g of world.gather) { g.taken = false; g.mesh.visible = true; }
  for (const c of world.chests) { c.revealed = false; c.taken = false; c.mesh.visible = false; }
  visited = new Set(['loji']); currentPlace = null;
  world.lostRod.visible = true;
  // Sleep-choice state + boats back to their home spots.
  sleepChoiceOpen = false; sleepConfirmPoint = null; dayEndPromptShown = false; energyPromptShown = false;
  document.getElementById('sleep-modal').style.display = 'none';
  if (world.freeBoat) { world.freeBoat.boarded = false; world.freeBoat.x = world.freeBoat.home.x; world.freeBoat.z = world.freeBoat.home.z; world.freeBoat.mesh.position.set(world.freeBoat.home.x, SEA_Y, world.freeBoat.home.z); world.freeBoat.mesh.visible = true; }
  if (world.titanic) { world.titanic.boarded = false; world.titanic.x = world.titanic.home.x; world.titanic.z = world.titanic.home.z; world.titanic.mesh.position.set(world.titanic.home.x, SEA_Y, world.titanic.home.z); }
  startGame();
}

function nearMonster() {
  let best = null; let d = 4.5;
  for (const m of world.monsters) {
    if (!m.alive) continue;
    const dist = Math.hypot(m.x - player.x, m.z - player.z);
    if (dist < d) { d = dist; best = m; }
  }
  return best;
}

function attackMonster(mon) {
  const lowLevel = levelFromXp(player.xp || 0) < mon.level;
  // Damage by what is held: the rod scales with its tier (8 + rod*6 = 14/20/26);
  // weapons are fixed tiers — wood weakest, then torch, knife, sword strongest.
  // Empty hand and flashlight hit with bare-hand damage (6).
  let dmg;
  if (player.held === 'rod') dmg = 8 + player.rod * 6;
  else dmg = WEAPON_DMG[player.held] || 6;
  if (lowLevel) dmg = Math.round(dmg / 2);
  mon.hp -= dmg;
  sfxSlash(audio, player.held);
  const heldName = (HELD_ITEMS.find((h) => h.id === player.held) || {}).name || 'Pancing';
  if (mon.hp <= 0) {
    mon.alive = false; mon.mesh.visible = false;
    player.defeated = player.defeated || {};
    player.defeated[mon.id] = true;
    player.money += mon.reward; player.earned += mon.reward;
    gainXp(mon.xp);
    if (mon.fragment) { player.fragments = (player.fragments || 0) + mon.fragment; maybeRevealChest(); }
    if (mon.rareBait) player.rareBait = (player.rareBait || 0) + mon.rareBait;
    sfxCatch(audio);
    showToast(ui, `🏆 ${mon.name} dikalahkan! +${fmtRp(mon.reward)} · +${mon.xp} XP${mon.fragment ? ' · +🧩 fragmen' : ''}`);
  } else {
    showToast(ui, `⚔️ ${heldName} → ${mon.name}! HP ${Math.max(0, mon.hp)}/${mon.maxHp}${lowLevel ? ' — ⚠️ Level kamu terlalu rendah!' : ''}`);
  }
}

function spawnJobCrates(job) {
  for (let i = 0; i < job.count; i += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0xc98a2b }));
    const cx = job.at.x + (i - 1) * 2.5; const cz = job.at.z + (i % 2) * 2;
    mesh.position.set(cx, groundHeight(cx, cz) + 0.65, cz);
    mesh.castShadow = true;
    scene.add(mesh);
    jobCrates.push({ mesh, x: cx, z: cz, jobId: job.id });
  }
}

function maybeRevealChest() {
  if ((player.fragments || 0) < 3) return;
  const next = world.chests.find((c) => !c.revealed && !c.taken);
  if (!next) return;
  next.revealed = true; next.mesh.visible = true;
  showToast(ui, `🗺️ 3 fragmen terkumpul! Peti harta muncul di ${next.name} — ikuti panah emas!`);
  waypoint = { x: next.x, z: next.z, name: next.name };
  waypointArrow.visible = true;
}

function doAction() {
  if (screen === 'title') { startGame(); return true; }
  if (screen === 'win' || screen === 'lose') { resetGame(); return true; }
  if (screen !== 'play') return true;
  if (fishing.state === 'bite') {
    // Stardew-style: HOLD Space / AKSI while the marker is in the green zone.
    // The catch meter fills in the frame loop; nothing instant happens here.
    return true;
  }
  if (fishing.state === 'waiting') { showToast(ui, 'Sabar... tunggu gigitan!'); return true; }
  // Step off a boat: near the shore AKSI docks / steps off (the only
  // disembark on a phone, which has no B key); far out at sea AKSI fishes
  // instead — sail back toward shore to get off.
  if (player.onBoat && player.x < 190) {
    if (player.freeBoat || player.titanic) disembarkToSwim();
    else { player.onBoat = false; placePlayer(player, 160, player.z, world.colliders); showToast(ui, '⚓ Turun dari perahu.'); }
    return true;
  }
  // Motorbike race at the foot of Bukit Lamoliandu.
  if (nearRaceSign()) {
    if (race) { showToast(ui, 'Balapan sedang berjalan!'); return true; }
    if (player.riding === 'moto') { startRace(); return true; }
    showToast(ui, '🏁 Balap Motor Bukit Lamoliandu! Naik motor dulu (motor ada di rumah, Desa Loji Pantai).');
    return true;
  }
  // Forest monsters: tap-to-attack with the fishing rod.
  const mon = nearMonster();
  if (mon) { attackMonster(mon); return true; }
  // Dismount a vehicle first — one action button does mount and dismount.
  if (player.riding) {
    const v = player.vehicle;
    player.riding = null; player.vehicle = null;
    player.mesh.visible = true;
    // Dismount point: try several offsets around the vehicle and take the
    // first one that is not blocked (16 Nov: the old fixed offset (-2,+1)
    // could land the player INSIDE a house collider next to the bike, and
    // there is no way out of a solid box). placePlayer's spiral is the
    // backstop if every offset is blocked.
    const offs = [[-2, 1], [2, 1], [-2, -1], [2, -1], [0, 2], [0, -2], [-3, 0], [3, 0]];
    let dx = -2; let dz = 1;
    for (const [ox, oz] of offs) {
      if (!blockedAt(v.x + ox, v.z + oz, false, world.colliders, player.walkways)) { dx = ox; dz = oz; break; }
    }
    placePlayer(player, v.x + dx, v.z + dz, world.colliders);
    showToast(ui, `Turun dari ${v.name}. Kendaraan menunggu di sini.`);
    return true;
  }
  const veh = vehicleNear();
  if (veh) {
    player.riding = veh.kind; player.vehicle = veh;
    showToast(ui, IS_TOUCH ? `Naik ${veh.name}! Joystick untuk jalan. Ketuk AKSI untuk turun.` : `Naik ${veh.name}! WASD / joystick untuk jalan. E untuk turun.`);
    return true;
  }
  if (nearFreeBoat() && !player.onBoat && !player.riding) {
    player.onBoat = true; player.freeBoat = true;
    world.freeBoat.boarded = true;
    showToast(ui, '🛶 Naik Perahu Kecil (Gratis)! Hati-hati — jangan terlalu jauh, ombak besar bisa menghancurkannya.');
    return true;
  }
  if (nearTitanic() && !player.onBoat && !player.riding) {
    if (player.boatTier < 4) { showToast(ui, '🚢 Kapal Raksasa itu milik yang membelinya (Rp 100.000.000 di Galangan Kapal).'); return true; }
    player.onBoat = true; player.titanic = true;
    world.titanic.boarded = true;
    showToast(ui, '🚢 Naik Kapal Raksasa! Berlayarlah ke laut dalam.');
    return true;
  }
  if (nearBoatShop()) {
    if (clock.minutes >= 17 * 60) { showToast(ui, '🔒 Galangan Kapal tutup jam 17:00. Datang lagi besok pagi!'); return true; }
    openBoatShop(); return true;
  }
  if (nearBank()) { openBank(); return true; }
  if (nearSalon()) { openSalon(); return true; }
  if (nearBoard()) { openEvents(); return true; }
  const npc = npcNear(npcs, player.x, player.z);
  if (npc) { openNpc(npc); return true; }
  // Sleep (16 Nov): AKSI sleeps too — on a phone there is no T key, so this
  // was the only way out of a trap and the only way to save on mobile.
  // After the vehicle/NPC checks, before the fishing-spot check.
  if (nearestSavePoint()) { trySleep(); return true; }
  if (nearLostRod()) {
    const m3 = missions.find((m) => m.id === 'm3');
    if (m3 && m3.status === 'active' && !m3.foundRod) {
      m3.foundRod = true; world.lostRod.visible = false;
      showToast(ui, '🎣 Joran Pak Budi ditemukan! Kembalikan padanya.');
      sfxCoin(audio); return true;
    }
  }
  // Coconuts (mission m5), job crates, forest gatherables, revealed treasure chests.
  const coco = world.coconuts.find((c) => !c.taken && Math.hypot(c.x - player.x, c.z - player.z) < 4);
  if (coco) {
    coco.taken = true; coco.mesh.visible = false;
    player.coconuts = (player.coconuts || 0) + 1;
    sfxCoin(audio);
    showToast(ui, `🥥 Kelapa didapat! (${player.coconuts}/3 untuk Es Kelapa)`);
    return true;
  }
  const crate = jobCrates.find((c) => Math.hypot(c.x - player.x, c.z - player.z) < 4);
  if (crate) {
    const job = jobs.find((j) => j.id === crate.jobId);
    scene.remove(crate.mesh);
    jobCrates = jobCrates.filter((c) => c !== crate);
    if (job) { job.progress += 1; showToast(ui, `📦 Peti diangkut! (${job.progress}/${job.count}) — kembali ke ${job.giver} untuk upah.`); }
    return true;
  }
  const gath = world.gather.find((g) => !g.taken && Math.hypot(g.x - player.x, g.z - player.z) < 4);
  if (gath) {
    gath.taken = true; gath.mesh.visible = false;
    player.gather[gath.kind] = (player.gather[gath.kind] || 0) + 1;
    sfxCoin(audio);
    showToast(ui, gath.kind === 'wood' ? `🪵 Kayu didapat! Jual di Pasar Ereke (Rp 3.000).` : gath.kind === 'fruit' ? `🍎 Buah liar didapat! Bisa dipakai sebagai umpan.` : `🍄 Jamur didapat! Bisa dipakai sebagai umpan.`);
    return true;
  }
  const chest = world.chests.find((c) => c.revealed && !c.taken && Math.hypot(c.x - player.x, c.z - player.z) < 4);
  if (chest) {
    chest.taken = true; chest.mesh.visible = false;
    const mult = evt.id === 'harta' ? 2 : 1; // Pesta Harta Karun: hadiah peti 2x
    const reward = chest.reward * mult;
    player.money += reward; player.earned += reward;
    player.fragments = Math.max(0, (player.fragments || 0) - 3);
    player.chestsFound = (player.chestsFound || 0) + 1;
    player.rareBait = (player.rareBait || 0) + 1;
    eventState.chests = (eventState.chests || 0) + 1;
    eventState.festival = (eventState.festival || 0) + 100;
    writeEvent(eventState);
    gainXp(150);
    sfxCatch(audio);
    showToast(ui, `💰 ${chest.name} digali! +${fmtRp(reward)} +🎁 umpan langka +150 XP`);
    return true;
  }
  if (nearMarket()) {
    if (clock.minutes >= 18 * 60) { showToast(ui, '🔒 Pasar Ereke tutup jam 18:00. Buka lagi besok pagi!'); return true; }
    openShop(); return true;
  }
  // Fishing spot: from a boat the player can cast anywhere — the zone table
  // at the boat's distance from shore decides the fish. On foot, the nearest
  // shore spot within 9 m.
  const spot = player.onBoat ? boatZoneSpot(player.x) : spotNearPlayer();
  if (spot) {
    // Only the fishing rod can cast: anything else in hand gets a reminder.
    if (player.held !== 'rod') { showToast(ui, '🎣 Pegang pancing dulu buat mancing'); return true; }
    // No fishing while swimming — climb out first.
    if (player.swimming) { showToast(ui, '🏊 Naik ke darat dulu buat mancing!'); return true; }
    if (startCast(fishing, spot, player)) { sfxSplash(audio); showToast(ui, `Memancing di ${spot.name}...`); }
    else showToast(ui, 'Energi habis! Tidur dulu (T).');
  }
  return false; // nothing in reach — the caller (Space) may jump instead
}

// --- Input: keyboard ---
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  // While a sleep-choice modal is open the game is paused: only Escape closes
  // it (as "Lanjutkan main" — never a teleport, never a save).
  if (sleepChoiceOpen) { if (k === 'escape') closeSleepModal('stay'); return; }
  if (k === 'n') { audio.muted = !audio.muted; showToast(ui, audio.muted ? '🔇 Suara mati' : '🔊 Suara hidup'); return; }
  if (k === 'm' && (screen === 'play' || screen === 'map')) {
    if (screen === 'play') openMap();
    else closeMap();
    return;
  }
  if (screen === 'title' && (k === 'enter' || k === ' ')) { startGame(); return; }
  if ((screen === 'win' || screen === 'lose') && (k === 'enter' || k === ' ')) { resetGame(); return; }
  if (k === 'escape' || k === 'p') {
    const sp = document.getElementById('settings-popup');
    if (sp && sp.style.display === 'flex') { sp.style.display = 'none'; return; }
    if (screen === 'haggle') { cancelHaggle(); openShop(); return; }
    if (screen === 'map') { closeMap(); return; }
    if (screen === 'play') { screen = 'paused'; showPanel(ui, `<h2>⏸ Jeda</h2><p>${clockText(clock)} · ${fmtRp(player.money)} · Ikan ${collectionCount(player)}/12</p><button class="btn" data-close>Lanjut Bermain</button><button class="btn ghost" data-restart>Mulai dari Awal</button>`); }
    else if (screen === 'paused' || screen === 'shop' || screen === 'boatshop' || screen === 'bank' || screen === 'npc' || screen === 'book' || screen === 'missions' || screen === 'salon' || screen === 'events' || screen === 'profile') closePanel();
    return;
  }
  if (screen === 'haggle' && k === ' ') { resolveHaggle(); return; }
  if (screen !== 'play') { if (k === 'c' && (screen === 'book')) closePanel(); return; }
  keys.add(k);
  if (k === 'f') doAction();
  if (k === ' ') { if (!doAction() && !e.repeat) tryJump(); } // Space: action first, jump if nothing is in reach
  if (k === 'e') doAction();
  if (k === 'x' && fishing.state !== 'idle') { cancelFishing(fishing); showToast(ui, '🎣 Pancingan ditarik kembali.'); }
  if (k === 'c') openBook();
  if (k === 'v') openMissions();
  if (k === 't') trySleep();
  if (k === 'b') {
    if (player.riding) { showToast(ui, 'Turun dulu dari kendaraan (E).'); return; }
    const onPier = player.x > 166 && player.z > 37 && player.z < 49;
    if (player.boatTier > 0 && (nearHarbour() || onPier) && !player.onBoat) {
      player.onBoat = true;
      placePlayer(player, onPier ? 200 : 185, onPier ? 58 : 45, world.colliders);
      showToast(ui, '⛵ Berlayar! Arahkan ke Tengah Laut Banda.');
    } else if (player.onBoat && (player.freeBoat || player.titanic)) {
      disembarkToSwim(); // B always drops the player in the water from these two
    } else if (player.onBoat && player.x < 190) {
      player.onBoat = false; placePlayer(player, 160, player.z, world.colliders);
      showToast(ui, '⚓ Turun dari perahu.');
    } else if (player.onBoat) {
      disembarkToSwim(); // far out at sea: swim back (owned boats too)
    } else if (!player.boatTier) showToast(ui, 'Kamu belum punya perahu. Beli di Galangan Kapal, Pelabuhan Ereke.');
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// --- Input: mouse camera (pointer lock on click) ---
canvas.addEventListener('click', () => {
  if (screen === 'play' && !IS_TOUCH && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && screen === 'play') {
    player.camYaw -= e.movementX * 0.0028;
    player.camPitch = Math.max(0.08, Math.min(1.1, player.camPitch + e.movementY * 0.002));
  }
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && screen === 'play' && !IS_TOUCH && !sleepChoiceOpen) {
    screen = 'paused';
    showPanel(ui, `<h2>⏸ Jeda</h2><p>Klik Lanjut untuk bermain lagi.</p><button class="btn" data-close>Lanjut Bermain</button>`);
  }
});

// --- Panel buttons (delegated) ---
ui.panelBody.addEventListener('click', (e) => {
  const t = e.target.closest('[data-close],[data-buy],[data-buyboat],[data-buyhouse],[data-sell],[data-sellpier],[data-haggle],[data-accept],[data-turnin],[data-openshop],[data-restart],[data-hair],[data-shirt],[data-buyskin],[data-skin],[data-jobaccept],[data-jobturnin],[data-claimevent],[data-sellwood]');
  if (!t) return;
  if (t.hasAttribute('data-close')) { cancelHaggle(); closePanel(); }
  else if (t.hasAttribute('data-hair')) {
    if (player.hair === t.dataset.hair) { showToast(ui, 'Gaya rambut itu sudah dipakai.'); }
    else if (player.money < 5000) showToast(ui, 'Uang tidak cukup (Rp 5.000).');
    else { player.money -= 5000; player.hair = t.dataset.hair; applyAppearance(); sfxCoin(audio); showToast(ui, '💇 Gaya rambut baru!'); }
    openSalon();
  }
  else if (t.hasAttribute('data-shirt')) {
    const c = Number(t.dataset.shirt);
    if (player.shirt === c) { showToast(ui, 'Baju itu sudah dipakai.'); }
    else if (player.money < 8000) showToast(ui, 'Uang tidak cukup (Rp 8.000).');
    else { player.money -= 8000; player.shirt = c; player.skin = null; applyAppearance(); sfxCoin(audio); showToast(ui, '👕 Baju baru!'); }
    openSalon();
  }
  else if (t.hasAttribute('data-buyskin')) {
    const s = SHOP_SKINS.find((x) => x.id === t.dataset.buyskin);
    if (!s) return;
    if ((player.shopSkins || []).includes(s.id)) { showToast(ui, 'Skin itu sudah milikmu — pakai dari Profil.'); }
    else if (player.money < s.price) showToast(ui, `Uang tidak cukup. Butuh ${fmtRp(s.price)} — efek: ${SKIN_DEFS[s.id].effect.text}.`);
    else {
      player.money -= s.price;
      player.shopSkins = [...(player.shopSkins || []), s.id];
      player.skin = s.id; applyAppearance();
      sfxCoin(audio);
      showToast(ui, `👕 Kamu membeli & memakai ${SKIN_DEFS[s.id].name}! Efek: ${SKIN_DEFS[s.id].effect.text}`);
    }
    openShop();
  }
  else if (t.hasAttribute('data-skin')) {
    player.skin = t.dataset.skin || null;
    applyAppearance();
    sfxCoin(audio);
    showToast(ui, player.skin ? `👕 Memakai ${SKIN_DEFS[player.skin].name} — ${SKIN_DEFS[player.skin].effect.text}` : '👕 Kembali ke baju biasa.');
    openProfile();
  }
  else if (t.hasAttribute('data-jobaccept')) {
    const j = jobs.find((x) => x.id === t.dataset.jobaccept);
    acceptJob(j);
    if (j.kind === 'carry') { spawnJobCrates(j); showToast(ui, `💼 Kerja diterima! Angkut ${j.count} peti di dekat ${j.title.includes('Pasar') ? 'pasar' : 'dermaga'} (${IS_TOUCH ? 'ketuk AKSI di dekat peti' : 'tekan E di dekat peti'}).`); }
    else showToast(ui, '💼 Kerja diterima! Serahkan ikan ke pemberi kerja.');
    openNpc(currentNpc);
  }
  else if (t.hasAttribute('data-jobturnin')) {
    const j = jobs.find((x) => x.id === t.dataset.jobturnin);
    if (jobTurnIn(j, player)) { sfxCoin(audio); gainXp(25); showToast(ui, `✅ Kerja selesai! +${fmtRp(j.reward)} · +25 XP (bisa ambil lagi kapan saja)`); }
    openNpc(currentNpc);
  }
  else if (t.hasAttribute('data-claimevent')) {
    if (!eventState.claimed) {
      eventState.claimed = true; writeEvent(eventState);
      player.money += evt.prize.money; player.earned += evt.prize.money;
      player.rareBait += evt.prize.rareBait;
      if (!player.titles.includes(evt.prize.title)) player.titles.push(evt.prize.title);
      sfxFanfare(audio);
      showToast(ui, `🏆 Hadiah ${evt.name} diklaim! +${fmtRp(evt.prize.money)} +${evt.prize.rareBait}x umpan langka · Gelar: ${evt.prize.title}`);
    }
    openEvents();
  }
  else if (t.hasAttribute('data-sellwood')) {
    const n = player.gather.wood || 0;
    if (n > 0) {
      const total = n * 3000;
      player.gather.wood = 0;
      player.money += total; player.earned += total;
      sfxCoin(audio);
      showToast(ui, `🪵 Terjual ${n} kayu: ${fmtRp(total)}`);
    }
    openShop();
  }
  else if (t.hasAttribute('data-buyhouse')) {
    const h = HOUSES.find((x) => x.id === t.dataset.buyhouse);
    if (!h) return;
    if (player.houses[h.id]) { showToast(ui, 'Rumah itu sudah milikmu.'); }
    else if (player.money < h.price) { showToast(ui, `Uang tidak cukup. Butuh ${fmtRp(h.price)}.`); }
    else {
      player.money -= h.price;
      player.houses[h.id] = true;
      sfxCoin(audio);
      showToast(ui, `🏠 Kamu membeli ${h.name}! Sekarang bisa tidur & menyimpan game di sana.`);
    }
    openBank();
  }
  else if (t.hasAttribute('data-sellpier')) {
    const r = sellAllFish(player, fishPrices(), null, (id) => (id === 'tongkol' || id === 'kerapu' ? 1.2 : 0.8));
    sfxCoin(audio);
    showToast(ui, `⚓ Terjual ${r.n} ikan di dermaga: ${fmtRp(r.total)}`);
    openNpc(currentNpc);
  }
  else if (t.hasAttribute('data-restart')) resetGame();
  else if (t.hasAttribute('data-openshop')) openShop();
  else if (t.hasAttribute('data-sell')) {
    const total = Object.entries(player.fish).reduce((s, [id, n]) => s + FISH_BY_ID[id].price * n * (fotd().fish.id === id ? fotd().mult : 1), 0);
    const n = Object.values(player.fish).reduce((s, v) => s + v, 0);
    if (n > 0) openHaggle(total, n);
    else { showToast(ui, 'Tidak ada ikan untuk dijual.'); openShop(); }
  } else if (t.hasAttribute('data-haggle')) {
    resolveHaggle();
  } else if (t.hasAttribute('data-buy')) {
    const msg = buyItem(player, t.dataset.buy);
    showToast(ui, msg);
    if (msg.startsWith('Berhasil')) sfxCoin(audio);
    openShop();
  } else if (t.hasAttribute('data-buyboat')) {
    const msg = buyBoat(player, t.dataset.buyboat);
    showToast(ui, msg);
    if (msg.startsWith('Berhasil')) sfxCoin(audio);
    openBoatShop();
  } else if (t.hasAttribute('data-accept')) {
    const m = missions.find((x) => x.id === t.dataset.accept);
    if (!acceptMission(m, missions, player)) {
      const lock = missionUnlocked(m, missions, player);
      showToast(ui, lock.reason || 'Misi itu belum bisa diambil.');
    } else showToast(ui, '📜 Misi diterima! Cek dengan tombol V.');
    openNpc(currentNpc);
  } else if (t.hasAttribute('data-turnin')) {
    const m = missions.find((x) => x.id === t.dataset.turnin);
    if (turnIn(m, player)) {
      sfxCoin(audio); gainXp(missionXp(m));
      showToast(ui, `✅ Misi selesai! +${fmtRp(m.reward)} · +${missionXp(m)} XP${m.rareBait ? ' · +🎁 umpan langka' : ''}`);
      maybeRevealChest();
      // Main chain: always tell the player what the NEXT mission is.
      if (m.kind === 'utama') {
        const next = nextMainMission(missions);
        if (!next) showBanner(ui, '🏆 Semua Misi Utama selesai!', 'Kamu Nelayan Legendaris sejati!');
        else {
          const lock = missionUnlocked(next, missions, player);
          showBanner(ui, `⭐ Misi Berikutnya: ${next.title}`, lock.ok ? `${next.giver} — ${next.place}` : lock.reason);
        }
      }
    }
    openNpc(currentNpc);
  }
});

// --- Minimap click opens the full map; full-map click sets a waypoint (no fast travel). ---
ui.minimap.addEventListener('click', () => { if (screen === 'play') openMap(); });
ui.onWaypoint = (place) => {
  waypoint = { x: place.x, z: place.z, name: place.name };
  waypointArrow.visible = true;
  showToast(ui, `📍 Tujuan: ${place.name} — ikuti panah emas!`);
  closeMap();
};
ui.onCloseMap = () => closeMap();
setupFullMap(ui);
document.getElementById('map-btn').addEventListener('click', () => { if (screen === 'play') openMap(); });

// --- Touch controls ---
ui.onCamDrag = (dx, dy) => {
  player.camYaw -= dx * 0.005;
  player.camPitch = Math.max(0.08, Math.min(1.1, player.camPitch + dy * 0.004));
};
ui.onAction = () => doAction();
ui.onJump = () => tryJump();
ui.onAttack = () => {
  const mon = nearMonster();
  if (mon) attackMonster(mon); // same slash sound + damage as AKSI
  else showToast(ui, 'Tidak ada monster di dekatmu');
};
setupTouch(ui);
// Held-item selector: the HUD button toggles the panel; a row picks an item.
(function buildHeldPanel() {
  const list = document.getElementById('held-list');
  for (const h of HELD_ITEMS) {
    const b = document.createElement('button');
    b.className = 'held-row' + (h.id === player.held ? ' sel' : '');
    b.dataset.held = h.id;
    b.innerHTML = `<span>${h.icon} ${h.name}</span><small>${h.note}</small>`;
    b.addEventListener('click', () => setHeld(h.id));
    list.appendChild(b);
  }
  // One toggle for the held-item panel, shared by the left HUD pill and the
  // right-side "Senjata" button (batch 5, item 3): both open the same panel.
  const toggleHeldPanel = () => {
    ui.heldPanel.style.display = ui.heldPanel.style.display === 'block' ? 'none' : 'block';
  };
  ui.heldBtn.addEventListener('click', toggleHeldPanel);
  if (ui.weaponBtn) ui.weaponBtn.addEventListener('click', toggleHeldPanel);
  ui.onWeapon = toggleHeldPanel; // touchstart path in setupTouch (ui.js)
  document.getElementById('held-close').addEventListener('click', () => { ui.heldPanel.style.display = 'none'; });
})();
// Touch help line: no keyboard on a phone, so show the touch controls instead.
if (IS_TOUCH) document.getElementById('help').textContent = 'Joystick jalan · Geser kamera · AKSI memancing/bicara · 🗺️ peta';

// --- Character name (batch 5, item 4): typed on the title screen, blank → 'Nelayan'. ---
function readNameInput() {
  const el = document.getElementById('name-input');
  const v = (el.value || '').trim().slice(0, 16);
  return v || 'Nelayan';
}
document.getElementById('start-btn').addEventListener('click', () => { player.name = readNameInput(); startGame(); });
document.getElementById('restart-btn').addEventListener('click', resetGame);

// --- Settings popup (title screen): full control list, closable. ---
document.getElementById('settings-btn').addEventListener('click', () => { document.getElementById('settings-popup').style.display = 'flex'; });
document.getElementById('settings-close').addEventListener('click', () => { document.getElementById('settings-popup').style.display = 'none'; });
document.getElementById('settings-popup').addEventListener('click', (e) => { if (e.target.id === 'settings-popup') e.target.style.display = 'none'; });

// Sleep-choice modal buttons (item 11): the player always chooses.
document.getElementById('sleep-modal-sleep').addEventListener('click', () => closeSleepModal('sleep'));
document.getElementById('sleep-modal-stay').addEventListener('click', () => closeSleepModal('stay'));
// Mission tracker (item 12): tap the bar to open the mission panel.
document.getElementById('mission-tracker').addEventListener('click', () => { if (screen === 'play') openMissions(); });

// Continue a saved game (sleeping in a bed saves): show the button only when a save exists.
const existingSave = loadGame();
if (existingSave) {
  const cb = document.getElementById('continue-btn');
  cb.style.display = 'inline-block';
  cb.textContent = `↻ Lanjutkan — Hari ${existingSave.day}, ${fmtRp(existingSave.money)}, Ikan ${Object.keys(existingSave.caught || {}).length}/12`;
  // Old saves have no name: prefill the field when the save has one, and
  // always take the field's value on continue (blank → 'Nelayan', then saved).
  document.getElementById('name-input').value = existingSave.name || '';
  cb.addEventListener('click', () => {
    applySave(existingSave);
    player.name = readNameInput();
    startGame();
    showToast(ui, `💾 Save dimuat — selamat datang kembali di Ereke, Hari ${clock.day}!`);
  });
  document.getElementById('start-btn').textContent = '▶ Permainan Baru';
}

// Debug/testing handle (read-only state for playtests; the game never reads it).
window.__ereke = { player, clock, missions, jobs, fishing, world, eventState, evt, get screen() { return screen; }, startGame, doAction, gainXp, levelFromXp, levelTitle, maybeRevealChest, openEvents, openProfile, openSalon };

// --- Night lights: a warm torch glow around the player and a focused
// flashlight beam forward, both only at night and only while held. The
// village lamps are toggled in the frame loop (world.lampHeadMat/lampLights).
const torchLight = new THREE.PointLight(0xffa040, 0, 20, 1.6);
scene.add(torchLight);
const flashLight = new THREE.SpotLight(0xfff2cc, 0, 30, 0.45, 0.4, 1.2);
scene.add(flashLight); scene.add(flashLight.target);

/** Rebuild the small held-item mesh in the character's right hand. */
function updateHeldMesh() {
  if (!player.mesh) return;
  const old = player.mesh.getObjectByName('heldItem');
  if (old) player.mesh.remove(old);
  const m = makeHeldMesh(player.held);
  if (m) { m.name = 'heldItem'; player.mesh.add(m); }
}

/** Switch the held item: button label, SERANG visibility, hand mesh, and the
    AKSI button icon (batch 4, item 13: the AKSI icon follows what is held —
    🎣 only while holding the rod, 👊 for empty hands, 🔪/🗡️/🪵/🔥/🔦 else). */
function setHeld(id) {
  player.held = id;
  const item = HELD_ITEMS.find((h) => h.id === id) || HELD_ITEMS[0];
  ui.heldBtn.textContent = `${item.icon} ${item.name}`;
  if (ui.actionBtn) ui.actionBtn.innerHTML = `${item.icon}<br>AKSI`;
  ui.attackBtn.style.display = WEAPONS.has(id) ? 'block' : 'none';
  updateHeldMesh();
  if (ui.heldPanel) ui.heldPanel.style.display = 'none';
  // Refresh the selected row in the panel (it is rebuilt below on open).
  document.querySelectorAll('.held-row').forEach((r) => r.classList.toggle('sel', r.dataset.held === id));
}

/** Jump: vertical velocity, on foot only (never on a vehicle/boat, never fishing, never swimming). */
function tryJump() {
  if (screen !== 'play' || fishing.state !== 'idle' || player.riding || player.onBoat || player.swimming || player.airY > 0) return;
  player.vy = 9;
}

// --- Place labels: only show a place's floating name when the player is
// near it, so distant village names never pile up on screen. ---
function updatePlaceLabels(world, player) {
  if (!world.placeLabels) return;
  for (const l of world.placeLabels) {
    l.sprite.visible = Math.hypot(l.x - player.x, l.z - player.z) <= l.range;
  }
}

// --- Main loop ---
const clock3 = new THREE.Clock();
let lastPrompt = '';
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock3.getDelta(), 0.05);
  elapsed += dt;
  // Paused while a sleep-choice modal is open (item 11): the player chooses,
  // nothing moves, nothing attacks, the clock stops.
  const inGame = screen === 'play' && !sleepChoiceOpen;

  if (inGame) {
    // Touch joystick -> synthetic WASD keys, but ONLY while the stick is actually
    // held: a centred stick must never erase keyboard input.
    const jx = ui.joyVec.x; const jy = ui.joyVec.y;
    const joyKeys = new Set();
    if (Math.hypot(jx, jy) > 0.2) {
      if (jy < -0.3) joyKeys.add('w');
      if (jy > 0.3) joyKeys.add('s');
      if (jx < -0.3) joyKeys.add('a');
      if (jx > 0.3) joyKeys.add('d');
    }
    for (const k of ['w', 'a', 's', 'd']) {
      if (joyKeys.has(k)) keys.add(k);
      else if (ui._joyKeys && ui._joyKeys.has(k)) keys.delete(k);
    }
    ui._joyKeys = joyKeys;
    if (fishing.state === 'idle') updatePlayer(player, keys, dt, world.colliders);
    // Safety net (16 Nov): if the player is somehow inside a solid collider
    // (an old save, a dismount, a teleport), push them out to the nearest
    // free spot at once — walking out of a solid box is impossible, so a
    // stuck player would otherwise be soft-locked with no way out.
    if (!player.riding && !player.onBoat && !player.swimming && blockedAt(player.x, player.z, false, world.colliders, player.walkways)) {
      placePlayer(player, player.x, player.z, world.colliders);
    }
    const holding = keys.has(' ') || !!ui.actionHeld;
    const prevFishState = fishing.state;
    // Kapal Raksasa: peluang ikan langka/legendaris 1.5x (item 10).
    updateFishing(fishing, dt, clock.minutes, player.rod, player.boatTier || 1, holding, skinEffect(player, 'fishSpeed'), skinEffect(player, 'rare') * (player.titanic ? 1.5 : 1));
    if (prevFishState === 'waiting' && fishing.state === 'bite') sfxBite(audio); // the fish bites: reel in NOW
    // Footsteps: a soft thud per half walk-cycle, on foot only (never on a
    // vehicle/boat, never while fishing or standing still). Left/right alternate.
    if (player.moving && !player.riding && !player.onBoat && fishing.state === 'idle') {
      const si = Math.floor(player.walkPhase / Math.PI);
      if (si !== player._lastStep) { player._lastStep = si; sfxStep(audio, si % 2 === 0); }
    } else {
      player._lastStep = Math.floor(player.walkPhase / Math.PI);
    }
    // Monster counterattacks: alive monsters near the player strike on a timer.
    for (const mon of world.monsters) {
      if (!mon.alive) continue;
      const d = Math.hypot(mon.x - player.x, mon.z - player.z);
      if (d < 7) {
        mon.attackT += dt;
        if (mon.attackT > 2.5) {
          mon.attackT = 0;
          const dmg = THREAT_DAMAGE[mon.threat];
          player.energy = Math.max(0, player.energy - dmg);
          sfxHurt(audio); // the player is hit — a low thud + falling tone
          if (mon.steals && Math.random() < 0.25) {
            if (player.bait > 0) { player.bait -= 1; showToast(ui, `🐒 Kera Hutan mencuri 1 umpanmu! (−${dmg} energi)`); }
            else if (Object.keys(player.fish).length) { const id = Object.keys(player.fish)[0]; player.fish[id] -= 1; if (player.fish[id] <= 0) delete player.fish[id]; showToast(ui, `🐒 Kera Hutan mencuri 1 ikanmu! (−${dmg} energi)`); }
            else showToast(ui, `🐒 Kera Hutan menyerang! (−${dmg} energi)`);
          } else showToast(ui, `💥 ${mon.name} menyerang! (−${dmg} energi)`);
        }
      } else mon.attackT = 0;
    }
    // Monster HP bar (nearest alive monster within 12 m).
    const mbar = document.getElementById('monster-bar');
    let nearestMon = null; let nd = 12;
    for (const mon of world.monsters) {
      if (!mon.alive) continue;
      const d = Math.hypot(mon.x - player.x, mon.z - player.z);
      if (d < nd) { nd = d; nearestMon = mon; }
    }
    if (nearestMon) {
      mbar.style.display = 'block';
      const low = levelFromXp(player.xp || 0) < nearestMon.level;
      document.getElementById('monster-name').textContent = `${nearestMon.name} · Lv ${nearestMon.level} · ${nearestMon.threat}${low ? ' — ⚠️ Level kamu terlalu rendah!' : ''}`;
      document.getElementById('monster-fill').style.width = `${Math.max(0, nearestMon.hp / nearestMon.maxHp * 100)}%`;
      document.getElementById('monster-fill').style.background = nearestMon.threat === 'Bahaya' ? '#e74c3c' : nearestMon.threat === 'Tinggi' ? '#e67e22' : nearestMon.threat === 'Sedang' ? '#f1c40f' : '#2ecc71';
    } else mbar.style.display = 'none';
    // A finished catch is claimed once, here (the hold-to-fill mechanic sets result).
    if (fishing.state === 'result' && fishing.result && !fishing.resultHandled) {
      fishing.resultHandled = true;
      if (fishing.result.ok) {
        addFish(player, fishing.result.fish.id);
        sfxCatch(audio);
        const r = fishing.result.fish.rarity;
        const weight = r === 'Legendaris' ? 6 + Math.random() * 9 : r === 'Langka' ? 2 + Math.random() * 4 : 0.5 + Math.random() * 1.5;
        if (evt.id === 'mancing' && weight > (eventState.bestFishKg || 0)) { eventState.bestFishKg = +weight.toFixed(1); writeEvent(eventState); }
        eventState.festival = (eventState.festival || 0) + 10; writeEvent(eventState);
        gainXp(r === 'Legendaris' ? 100 : r === 'Langka' ? 40 : 20);
        // Map fragment: 8% per catch (16% during Pesta Harta Karun).
        const fragChance = evt.id === 'harta' ? 0.16 : 0.08;
        if (Math.random() < fragChance) {
          player.fragments = (player.fragments || 0) + 1;
          showToast(ui, `🧩 Fragmen peta harta didapat! (${player.fragments}/3)`);
          maybeRevealChest();
        } else showToast(ui, `🎉 Dapat ${fishing.result.fish.name}! (${weight.toFixed(1)} kg)`);
        if (collectionCount(player) >= 12) endGame(true);
      } else {
        sfxFail(audio);
        showToast(ui, `💨 ${fishing.result.fish.name} lepas... coba lagi!`);
      }
    }
    if (fishing.state === 'idle') fishing.resultHandled = false;
    // Motorbike race: timer + checkpoints.
    if (race) {
      race.t += dt;
      const rt = document.getElementById('race-timer');
      rt.textContent = `🏁 ${fmtRace(race.t)} · Ring ${race.cp}/${world.racePoints.length}${raceBest ? ` · Terbaik ${fmtRace(raceBest)}` : ''}`;
      if (!player.riding) { race = null; rt.style.display = 'none'; showToast(ui, 'Balapan batal — kamu turun dari motor.'); }
      else {
        const cp = world.racePoints[race.cp];
        if (cp && Math.hypot(cp.x - player.x, cp.z - player.z) < 7) {
          race.cp += 1;
          sfxCoin(audio);
          if (race.cp >= world.racePoints.length) finishRace();
          else showToast(ui, `✅ Ring ${race.cp}/${world.racePoints.length}! Lanjut!`);
        }
      }
    }
    world.raceRings.forEach((r) => { r.rotation.y += dt * 0.6; });
    // Day end / empty energy: NEVER an automatic teleport (item 11). Ask the
    // player instead — once per end of day / once per energy-empty episode.
    // The clock is clamped at 22:00, so the day-end popup cannot re-fire.
    if (updateClock(clock, dt) && !dayEndPromptShown) { dayEndPromptShown = true; showSleepModal('dayend'); }
    if (player.energy <= 0 && !energyPromptShown) { energyPromptShown = true; showSleepModal('energy'); }
    if (player.energy > 5) energyPromptShown = false; // energy recovered: may ask again later
    // Floating loot: scoop up crates/coconuts with the boat.
    if (player.onBoat) {
      for (const p of world.pickups) {
        if (!p.taken && Math.hypot(p.x - player.x, p.z - player.z) < 5) {
          p.taken = true; p.mesh.visible = false;
          player.money += p.value; player.earned += p.value;
          sfxCoin(audio);
          showToast(ui, `📦 Dapat ${p.kind === 'crate' ? 'peti hanyut' : 'kelapa hanyut'}! +${fmtRp(p.value)}`);
        }
      }
    }
    placeCheck();
    // --- Boat range limits, zone toasts, boat follow (batch 4, items 7/9/10).
    if (player.onBoat) {
      // The visible boat follows the player while aboard.
      if (player.freeBoat && world.freeBoat) { const fb = world.freeBoat; fb.mesh.position.set(player.x, SEA_Y + Math.sin(elapsed * 1.2) * 0.1, player.z); fb.mesh.rotation.y = player.yaw; fb.x = player.x; fb.z = player.z; }
      if (player.titanic && world.titanic) { const tt = world.titanic; tt.mesh.position.set(player.x, SEA_Y + Math.sin(elapsed * 0.8) * 0.06, player.z); tt.mesh.rotation.y = player.yaw; tt.x = player.x; tt.z = player.z; }
      // Zone toasts: announce each new fishing zone once. Shown BEFORE the
      // range warnings below, so a limit warning in the same frame wins the
      // toast (the warning matters more than the zone name).
      const zone = boatZone(player.x);
      if (zone !== (player._boatZone || 0)) {
        player._boatZone = zone;
        if (zone > 0) showToast(ui, BOAT_ZONE_TABLES[zone].toast);
      }
      // Free sampan: warn once near the limit, sink past it (respawn at beach).
      if (player.freeBoat) {
        if (player.x > FREE_BOAT_WARN_X && !player._freeWarned) { player._freeWarned = true; showToast(ui, '⚠️ Ombak besar di depan! Perahu kecil ini gratis — jangan terlalu jauh, bisa hancur! Beli perahu di Pelabuhan Ereke untuk berlayar ke tengah laut.'); }
        if (player.x < FREE_BOAT_WARN_X - 5) player._freeWarned = false;
        if (player.x > FREE_BOAT_MAX_X) sinkFreeBoat();
      } else if (player.boatTier > 0 && player.boatTier < 4) {
        // Bought boats never sink: big waves push them back at their limit.
        const lim = BOAT_LIMIT_X[player.boatTier];
        const warnX = BOAT_WARN_X[player.boatTier];
        if (player.x > warnX && !player._boatWarned) { player._boatWarned = true; showToast(ui, BOAT_WARN_TEXT[player.boatTier]); }
        if (player.x < warnX - 5) player._boatWarned = false;
        if (player.x > lim) {
          player.x = lim;
          if (!player._boatPushed) { player._boatPushed = true; showToast(ui, '🌊 Ombak besar mendorongmu kembali! Perahu ini tidak bisa lebih jauh.'); }
        }
        if (player.x < lim - 15) player._boatPushed = false;
      }
      // HUD: distance from the shore while on a boat.
      const bd = document.getElementById('boat-dist');
      if (bd) { bd.style.display = ''; bd.textContent = `🌊 ${Math.max(0, Math.round(player.x - SEA_X))} m dari pantai`; }
    } else {
      const bd = document.getElementById('boat-dist');
      if (bd) bd.style.display = 'none';
      player._boatZone = 0;
    }
    // Context prompt. On a phone there is no E/F/Space key, so the action
    // prompts say "Ketuk AKSI" (or "Tahan AKSI" for the bite) instead.
    const act = IS_TOUCH ? 'Ketuk AKSI' : 'Tekan E / AKSI';
    let prompt = '';
    if (fishing.state === 'bite') prompt = IS_TOUCH ? 'Tahan AKSI saat di zona hijau!' : 'Tekan SPASI / AKSI saat di zona hijau!';
    else if (fishing.state === 'waiting') prompt = 'Menunggu gigitan...';
    else if (player.riding) prompt = `${act}: Turun dari kendaraan`;
    else if (nearMonster()) prompt = `${act}: Serang ${nearMonster().name} (HP ${Math.max(0, nearMonster().hp)}/${nearMonster().maxHp})`;
    else if (nearRaceSign()) prompt = `${act}: Balap Motor Bukit Lamoliandu`;
    else if (nearBank()) prompt = `${act}: Bank BNI Ereke (beli rumah)`;
    else if (nearSalon()) prompt = `${act}: Salon (ganti rambut & baju)`;
    else if (nearBoard()) prompt = `${act}: Papan Pengumuman (event minggu ini)`;
    else if (vehicleNear()) prompt = `${act}: Naik ${vehicleNear().name}`;
    else if (nearestSavePoint()) prompt = IS_TOUCH ? 'Ketuk AKSI: Tidur & simpan game' : 'Tekan T: Tidur & simpan game';
    else if (nearBoatShop()) prompt = `${act}: Galangan Kapal (beli perahu)`;
    else if (npcNear(npcs, player.x, player.z)) prompt = `${act}: Bicara`;
    else if (nearLostRod() && missions.find((m) => m.id === 'm3').status === 'active') prompt = `${act}: Ambil joran`;
    else if (world.coconuts.find((c) => !c.taken && Math.hypot(c.x - player.x, c.z - player.z) < 4)) prompt = `${act}: Ambil kelapa`;
    else if (jobCrates.find((c) => Math.hypot(c.x - player.x, c.z - player.z) < 4)) prompt = `${act}: Angkut peti`;
    else if (world.gather.find((g) => !g.taken && Math.hypot(g.x - player.x, g.z - player.z) < 4)) prompt = `${act}: Kumpulkan hasil hutan`;
    else if (world.chests.find((c) => c.revealed && !c.taken && Math.hypot(c.x - player.x, c.z - player.z) < 4)) prompt = `${act}: Gali peti harta!`;
    else if (nearMarket()) prompt = `${act}: Pasar Ereke`;
    else if (nearHome()) prompt = IS_TOUCH ? 'Ketuk AKSI: Tidur (akhiri hari)' : 'Tekan T: Tidur (akhiri hari)';
    else if (nearFreeBoat() && !player.onBoat) prompt = IS_TOUCH ? 'Ketuk AKSI: Naik Perahu Kecil (Gratis)' : 'Tekan E / AKSI: Naik Perahu Kecil (Gratis)';
    else if (nearTitanic() && !player.onBoat) prompt = IS_TOUCH ? 'Ketuk AKSI: Naik Kapal Raksasa' : 'Tekan E / AKSI: Naik Kapal Raksasa';
    else if (player.swimming) prompt = '🏊 Berenang — naik ke darat dulu buat mancing';
    else if (nearHarbour() && player.boatTier > 0 && !player.onBoat) prompt = 'Tekan B: Naik perahu';
    else if (player.onBoat && player.x < 190) prompt = IS_TOUCH ? 'Ketuk AKSI: Turun dari perahu' : 'Tekan B: Turun dari perahu';
    else if (player.onBoat) prompt = player.held === 'rod'
      ? (IS_TOUCH ? `Ketuk AKSI: Memancing di ${boatZoneSpot(player.x).name}` : `Tekan F / AKSI: Memancing di ${boatZoneSpot(player.x).name}`)
      : '🎣 Pegang pancing dulu buat mancing';
    else {
      const s = spotNearPlayer();
      if (s) {
        prompt = player.held === 'rod'
          ? (IS_TOUCH ? `Ketuk AKSI: Memancing di ${s.name}` : `Tekan F / AKSI: Memancing di ${s.name}`)
          : '🎣 Pegang pancing dulu buat mancing';
      }
    }
    if (prompt !== lastPrompt) { setPrompt(ui, prompt); lastPrompt = prompt; }
  }
  updateAmbient(audio, dt);
  applyDayNight({ sun, hemi, moon, scene }, clock.minutes);
  // Night lights (night = 18:00+, the game's own isNight): village lamp heads
  // glow + the two square PointLights come on; the torch gives a warm glow
  // around the player and the flashlight a focused beam forward.
  const nightNow = isNight(clock.minutes);
  if (world.lampHeadMat) world.lampHeadMat.emissiveIntensity = nightNow ? 1.4 : 0;
  for (const l of world.lampLights || []) l.intensity = nightNow ? 50 : 0;
  const gy = surfaceY(player.x, player.z, player.onBoat, player.walkways, boatDeckY(player));
  torchLight.intensity = (player.held === 'obor' && nightNow) ? 50 : 0;
  torchLight.position.set(player.x, gy + 2, player.z);
  const flOn = player.held === 'senter' && nightNow;
  flashLight.intensity = flOn ? 80 : 0;
  if (flOn) {
    flashLight.position.set(player.x, gy + 1.6, player.z);
    const fx = player.x - Math.sin(player.camYaw) * 10;
    const fz = player.z - Math.cos(player.camYaw) * 10;
    flashLight.target.position.set(fx, surfaceY(fx, fz, player.onBoat, player.walkways, boatDeckY(player)) + 0.5, fz);
  }
  updateSea(world, elapsed);
  updateCamera(player, camera, dt);
  updateHUD(ui, player, clock, fishing);
  // Mission chip (batch 5, item 1): one short line, title only — the full
  // mission text lives in the missions panel, never on the play screen.
  // The chip sits directly under the HUD block (HUD wraps differently per
  // screen width / level / boat, so its top is measured, not hard-coded).
  const mt = document.getElementById('mission-tracker');
  if (mt) {
    const t = missionChip(missions, player);
    if (mt.textContent !== t.text) mt.textContent = t.text;
    mt.classList.toggle('done', t.done);
    const top = Math.round(ui.hud.getBoundingClientRect().bottom) + 6;
    if (mt._chipTop !== top) { mt._chipTop = top; mt.style.top = `${top}px`; }
  }
  updateNameTag(); // floating name + rank title above the head (batch 5, item 4)
  drawMinimap(ui, player, visited, PLACES, waypoint);
  updatePlaceLabels(world, player);
  // 3D waypoint arrow above the player + compass chip with live distance.
  const wchip = document.getElementById('waypoint-chip');
  if (waypoint) {
    const d = Math.hypot(waypoint.x - player.x, waypoint.z - player.z);
    if (d < 7) {
      showToast(ui, `📍 Sampai di ${waypoint.name}!`);
      waypoint = null; waypointArrow.visible = false;
      wchip.style.display = 'none';
    } else {
      waypointArrow.visible = screen === 'play';
      const gy = player.mesh.position.y;
      waypointArrow.position.set(player.x, gy + 3.6 + Math.sin(elapsed * 2) * 0.25, player.z);
      waypointArrow.rotation.y = Math.atan2(waypoint.x - player.x, waypoint.z - player.z);
      wchip.style.display = 'block';
      wchip.textContent = `📍 ${waypoint.name} · ${Math.round(d)} m`;
    }
  } else { waypointArrow.visible = false; wchip.style.display = 'none'; }
  updateTimers(ui, dt);
  renderer.render(scene, camera);
}

if (shot) {
  // Screenshots: hide the loading screen now (the title screen is controlled
  // by the shot code below, not by the loading flow).
  if (window.__erekeLoadDone) window.__erekeLoadDone(false);
  stageShot(shot, { player, clock, missions, fishing, world, screen: (s) => { screen = s; }, startGame, placePlayer, endGame });
  if (shot === 'shop') openShop();
  if (shot === 'start') document.getElementById('title-screen').style.display = 'flex';
  else document.getElementById('title-screen').style.display = 'none';
  let painted = 0;
  (function paint() {
    updateCamera(player, camera);
    applyDayNight({ sun, hemi, moon, scene }, clock.minutes);
    renderer.render(scene, camera);
    updateHUD(ui, player, clock, fishing);
    drawMinimap(ui, player, visited, PLACES);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  })();
} else {
  frame();
  // First frame painted → 100%, then the title screen (Mobile-Legends style:
  // the bar holds at 100% for a beat before the transition).
  requestAnimationFrame(() => {
    loadStep(100, 'Siap!');
    setTimeout(() => { if (window.__erekeLoadDone) window.__erekeLoadDone(true); }, 350);
  });
}
