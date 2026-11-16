// ui.js — DOM HUD, dialogs, minimap and touch controls (Indonesian UI).
// The 3D scene stays in the canvas; everything the player reads or clicks is DOM.
import { WORLD, PLACES, FISH, fmtRp, fmtClock, levelFromXp, levelTitle, DANGER_ZONES } from './data.js';
import { MAIN_CHAIN, missionUnlocked, nextMainMission, missionProgress, jobProgress } from './missions.js';

export const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;

export function createUI() {
  const $ = (id) => document.getElementById(id);
  return {
    hud: $('hud'), money: $('money'), clock: $('clock'), energyFill: $('energy-fill'),
    energyText: $('energy-text'), collection: $('collection'), banner: $('banner'),
    levelPill: $('level-pill'),
    toast: $('toast'), prompt: $('prompt'), minimap: $('minimap'),
    panel: $('panel'), panelBody: $('panel-body'),
    fishbar: $('fishbar'), fishMarker: $('fish-marker'), fishZone: $('fish-zone'), fishLabel: $('fish-label'),
    fishProgress: $('fish-progress'),
    title: $('title-screen'), end: $('end-screen'), endTitle: $('end-title'), endText: $('end-text'),
    touch: $('touch'), joy: $('joy'), joyKnob: $('joy-knob'), actionBtn: $('action-btn'),
    jumpBtn: $('jump-btn'), attackBtn: $('attack-btn'), heldBtn: $('held-btn'), heldPanel: $('held-panel'),
    bannerT: 0, toastT: 0, joyVec: { x: 0, y: 0 }, onAction: null, onTravel: null, onCamDrag: null,
    onJump: null, onAttack: null,
  };
}

export function updateHUD(ui, player, clock, fishing) {
  ui.money.textContent = fmtRp(player.money);
  ui.clock.textContent = `Hari ${clock.day}/7 · ${fmtClock(clock.minutes)}`;
  ui.energyFill.style.width = `${Math.max(0, player.energy)}%`;
  ui.energyText.textContent = `Energi ${Math.round(player.energy)}`;
  ui.collection.textContent = `Ikan ${Object.keys(player.caught).length}/12`;
  if (ui.levelPill) {
    const lv = levelFromXp(player.xp || 0);
    ui.levelPill.textContent = `⭐ Lv ${lv} · ${levelTitle(lv)}`;
  }
  // Fishing bar.
  if (fishing.state === 'waiting') {
    ui.fishbar.style.display = 'block';
    ui.fishLabel.textContent = 'Menunggu gigitan... sabar ya 🎣';
    ui.fishZone.style.display = 'none'; ui.fishMarker.style.display = 'none';
  } else if (fishing.state === 'bite') {
    ui.fishbar.style.display = 'block';
    ui.fishLabel.textContent = `🐟 ${fishing.fish ? fishing.fish.name + ' menggigit! ' : ''}TAHAN SPASI / AKSI saat penanda di zona hijau — isi meteran sampai penuh! (${Math.ceil(fishing.biteT)} dtk)`;
    ui.fishZone.style.display = 'block'; ui.fishMarker.style.display = 'block';
    ui.fishZone.style.left = `${fishing.zone[0] * 100}%`;
    ui.fishZone.style.width = `${(fishing.zone[1] - fishing.zone[0]) * 100}%`;
    ui.fishMarker.style.left = `${fishing.marker * 100}%`;
    if (ui.fishProgress) ui.fishProgress.style.width = `${(fishing.progress || 0) * 100}%`;
  } else if (fishing.state === 'result' && fishing.result) {
    ui.fishbar.style.display = 'block';
    ui.fishZone.style.display = 'none'; ui.fishMarker.style.display = 'none';
    ui.fishLabel.textContent = fishing.result.ok
      ? `🎉 Dapat ${fishing.result.fish.name}! (${fmtRp(fishing.result.fish.price)})`
      : `💨 ${fishing.result.fish.name} lepas... coba lagi!`;
  } else {
    ui.fishbar.style.display = 'none';
  }
}

export function setPrompt(ui, text) {
  ui.prompt.textContent = text || '';
  ui.prompt.style.display = text ? 'block' : 'none';
}

export function showToast(ui, text) {
  ui.toast.textContent = text; ui.toast.style.display = 'block'; ui.toastT = 3;
}
export function showBanner(ui, text, sub) {
  ui.banner.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
  ui.banner.style.display = 'block'; ui.bannerT = 3.5;
}
export function updateTimers(ui, dt) {
  if (ui.toastT > 0) { ui.toastT -= dt; if (ui.toastT <= 0) ui.toast.style.display = 'none'; }
  if (ui.bannerT > 0) { ui.bannerT -= dt; if (ui.bannerT <= 0) ui.banner.style.display = 'none'; }
}

export function showPanel(ui, html) {
  ui.panelBody.innerHTML = html;
  ui.panel.style.display = 'flex';
}
export function hidePanel(ui) { ui.panel.style.display = 'none'; }

export function showEnd(ui, win, stats) {
  ui.endTitle.textContent = win ? '🏆 NELAYAN LEGENDARIS EREKE!' : '🌙 Perjalanan Berakhir';
  ui.endText.innerHTML = win
    ? `Kamu menangkap <b>12/12 ikan</b> dan menjadi legenda Ereke!<br><br>${stats}`
    : `7 hari berlalu dan buku koleksimu belum lengkap.<br><br>${stats}`;
  ui.end.style.display = 'flex';
}
export function hideEnd(ui) { ui.end.style.display = 'none'; }

/** Minimap: a zoomed top-down view of the area AROUND the player (radius ~70 m),
    with the player's arrow and the names of nearby places. */
export function drawMinimap(ui, player, visited, places, waypoint) {
  const cv = ui.minimap; if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width; const H = cv.height;
  const R = 75; // metres shown around the player
  const s = W / (2 * R);
  const sx = (x) => (x - player.x) * s + W / 2;
  const sy = (z) => (z - player.z) * s + H / 2;
  ctx.fillStyle = '#4a7a3d'; ctx.fillRect(0, 0, W, H);
  // Sea + sand (east edge).
  ctx.fillStyle = '#1e7f9e';
  ctx.fillRect(sx(170), 0, W, H);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(sx(150), 0, sx(170) - sx(150), H);
  ctx.fillStyle = '#2a9db5';
  ctx.beginPath(); ctx.arc(sx(-118), sy(82), 34 * s, 0, 7); ctx.fill();
  // Coast road.
  ctx.strokeStyle = '#4a4f55'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sx(155), sy(-165)); ctx.lineTo(sx(155), sy(165)); ctx.stroke();
  // Danger zones: thin red dashed circles (no label — the minimap is small).
  for (const z of DANGER_ZONES) {
    if (Math.abs(z.x - player.x) > R + z.r || Math.abs(z.z - player.z) > R + z.r) continue;
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(sx(z.x), sy(z.z), Math.max(3, z.r * s), 0, 7); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Waypoint marker.
  if (waypoint) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(sx(waypoint.x), sy(waypoint.z), 6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Nearby places: dot + readable name (BotW-style fog: unvisited places show '?').
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'left';
  for (const p of places) {
    if (p.minor) continue;
    const px = sx(p.x); const py = sy(p.z);
    if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
    const known = visited.has(p.id);
    ctx.fillStyle = known ? '#f1c40f' : '#888';
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
    const label = known ? p.name : '?';
    ctx.strokeText(label, px + 6, py + 4); ctx.fillText(label, px + 6, py + 4);
  }
  // Player arrow (faces the player's heading).
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(player.yaw);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** Full map: big pannable/zoomable top-down view of the whole of Ereke.
    Drag to pan, wheel / +/- buttons / pinch to zoom, click a place to set a waypoint. */
export function setupFullMap(ui) {
  ui.mapView = { cx: 35, cz: 0, scale: 1 };
  const cv = document.getElementById('mapcanvas');
  const wrap = document.getElementById('fullmap');
  ui.mapCanvas = cv; ui.fullmap = wrap;
  let drag = null; let pinch = null;
  const toWorld = (cx, cy) => {
    const r = cv.getBoundingClientRect();
    const base = Math.min(cv.width / 530, cv.height / 330) * ui.mapView.scale;
    // The canvas is drawn at 900x560 but CSS-scaled (much narrower on a
    // phone), so client pixels must be converted to canvas pixels first —
    // otherwise a tap on a phone maps to a world point far from the finger.
    const ax = (cx - r.left) * (cv.width / r.width);
    const ay = (cy - r.top) * (cv.height / r.height);
    return {
      x: ui.mapView.cx + (ax - cv.width / 2) / base,
      z: ui.mapView.cz + (ay - cv.height / 2) / base,
    };
  };
  cv.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: false, k: cv.width / cv.getBoundingClientRect().width };
    try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x; const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) {
      const base = Math.min(cv.width / 530, cv.height / 330) * ui.mapView.scale;
      ui.mapView.cx -= (dx * drag.k) / base; ui.mapView.cz -= (dy * drag.k) / base;
      drag.x = e.clientX; drag.y = e.clientY;
      ui.drawFullMapNow();
    }
  });
  cv.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved && ui.onWaypoint) {
      const w = toWorld(e.clientX, e.clientY);
      let best = null; let bestD = 16 / ui.mapView.scale + 6;
      for (const p of ui.mapPlaces || []) {
        const d = Math.hypot(p.x - w.x, p.z - w.z);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best) ui.onWaypoint(best);
    }
    drag = null;
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    ui.mapView.scale = Math.max(0.6, Math.min(4, ui.mapView.scale * (e.deltaY < 0 ? 1.2 : 0.83)));
    ui.drawFullMapNow();
  }, { passive: false });
  // Pinch zoom (two fingers).
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      ui.mapView.scale = Math.max(0.6, Math.min(4, ui.mapView.scale * (d / pinch)));
      pinch = d;
      ui.drawFullMapNow();
    }
  }, { passive: true });
  document.getElementById('map-zoom-in').addEventListener('click', () => { ui.mapView.scale = Math.min(4, ui.mapView.scale * 1.3); ui.drawFullMapNow(); });
  document.getElementById('map-zoom-out').addEventListener('click', () => { ui.mapView.scale = Math.max(0.6, ui.mapView.scale / 1.3); ui.drawFullMapNow(); });
  document.getElementById('map-close').addEventListener('click', () => { if (ui.onCloseMap) ui.onCloseMap(); });
  document.getElementById('map-close-x').addEventListener('click', () => { if (ui.onCloseMap) ui.onCloseMap(); });
}

export function drawFullMap(ui, player, places, waypoint) {
  ui.mapPlaces = places;
  ui.drawFullMapNow = () => {
    const cv = ui.mapCanvas; if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width; const H = cv.height;
    const base = Math.min(W / 530, H / 330) * ui.mapView.scale;
    const sx = (x) => (x - ui.mapView.cx) * base + W / 2;
    const sy = (z) => (z - ui.mapView.cz) * base + H / 2;
    ctx.fillStyle = '#4a7a3d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1e7f9e'; ctx.fillRect(sx(170), 0, W, H); // sea
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(sx(150), 0, sx(170) - sx(150), H); // sand
    ctx.fillStyle = '#2a9db5'; ctx.beginPath(); ctx.arc(sx(-118), sy(82), 34 * base, 0, 7); ctx.fill(); // lake
    ctx.fillStyle = '#3fae9e'; ctx.fillRect(sx(100), sy(146), 75 * base, 8 * base); // river to Bone
    // Roads: coast road + hill road.
    ctx.strokeStyle = '#4a4f55'; ctx.lineWidth = Math.max(2, 4 * base);
    ctx.beginPath(); ctx.moveTo(sx(155), sy(-165)); ctx.lineTo(sx(155), sy(165)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx(-110), sy(-56)); ctx.lineTo(sx(-185), sy(-60)); ctx.stroke();
    // Inland roads between villages (mirror of ROADS in src/world.js).
    const MAP_ROADS = [
      [[12, 34], [34, 39], [54, 40], [56, 44]],
      [[-24, 20], [-30, -8], [-34, -38], [-36, -44]],
      [[-2, 58], [-5, 66], [-36, 110], [-48, 116]],
      [[-18, 22], [-60, 18], [-100, 24], [-130, 20], [-148, 20]],
      [[-58, 132], [-50, 142]],
      [[134, -34], [152, -20]],
      [[134, 134], [150, 148]],
    ];
    for (const road of MAP_ROADS) {
      ctx.beginPath();
      road.forEach(([x, z], i) => { if (i === 0) ctx.moveTo(sx(x), sy(z)); else ctx.lineTo(sx(x), sy(z)); });
      ctx.stroke();
    }
    // Danger zones: red dashed circles + BAHAYA label, drawn UNDER the
    // place labels (places are drawn next) so no village name is covered.
    for (const z of DANGER_ZONES) {
      ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = Math.max(2, 2.5 * base);
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(sx(z.x), sy(z.z), z.r * base, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `bold ${Math.max(12, Math.round(14 * Math.min(ui.mapView.scale, 2)))}px system-ui, sans-serif`;
      ctx.fillStyle = '#ff6b5e'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4;
      // Forest label sits near the top of its circle (the forest's own name
      // is at the centre); the river label sits just below its circle.
      const lz = z.r > 20 ? z.z - z.r + 12 : z.z + z.r + 16;
      const lx = sx(z.x) - ctx.measureText(z.label).width / 2;
      ctx.strokeText(z.label, lx, sy(lz)); ctx.fillText(z.label, lx, sy(lz));
    }
    // Places (greedy label deconfliction: a label that would land on one
    // already drawn drops one line lower, so close villages stay readable).
    const drawn = [];
    for (const p of places) {
      const px = sx(p.x); const py = sy(p.z);
      ctx.fillStyle = p.minor ? '#bbb' : '#f1c40f';
      ctx.beginPath(); ctx.arc(px, py, p.minor ? 2.5 : 5, 0, 7); ctx.fill();
      if (!p.minor || ui.mapView.scale > 1.6) {
        const fs = Math.max(11, Math.round(13 * Math.min(ui.mapView.scale, 2)));
        ctx.font = `bold ${fs}px system-ui, sans-serif`;
        const w = ctx.measureText(p.name).width;
        let lx = px + 8; let ly = py + 4;
        for (let tries = 0; tries < 3; tries++) {
          const hit = drawn.some((b) => lx < b.x1 + 2 && lx + w > b.x0 - 2 && ly - fs < b.y1 + 2 && ly > b.y0 - 2);
          if (!hit) break;
          ly += fs + 4;
        }
        drawn.push({ x0: lx, y0: ly - fs, x1: lx + w, y1: ly + 2 });
        ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4;
        ctx.strokeText(p.name, lx, ly); ctx.fillText(p.name, lx, ly);
      }
    }
    // Waypoint.
    if (waypoint) {
      ctx.fillStyle = '#ffd700'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(waypoint.x), sy(waypoint.z), 9, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('★ ' + waypoint.name, sx(waypoint.x) + 12, sy(waypoint.z) - 8);
    }
    // Player arrow.
    ctx.save();
    ctx.translate(sx(player.x), sy(player.z));
    ctx.rotate(player.yaw);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  ui.drawFullMapNow();
}

export function collectionHTML(player) {
  const rows = FISH.map((f) => {
    const got = !!player.caught[f.id];
    return `<div class="fish-row ${got ? 'got' : ''}"><span>${got ? '🐟' : '❓'}</span><b>${got ? f.name : '???'}</b><span class="rar ${f.rarity === 'Legendaris' ? 'leg' : f.rarity === 'Langka' ? 'rare' : ''}">${f.rarity}</span><span>${got ? fmtRp(f.price) : '—'}</span><span>${player.fish[f.id] || 0}x</span></div>`;
  }).join('');
  return `<h2>📖 Buku Koleksi Ikan</h2><p>Tangkap 12 spesies untuk menjadi Nelayan Legendaris Ereke.</p><div class="fish-list">${rows}</div><button class="btn" data-close>Tutup (C)</button>`;
}

export function missionsHTML(missions, player, jobs = []) {
  const tierEmoji = { Mudah: '🟢 Mudah', Sedang: '🟡 Sedang', Sulit: '🔴 Sulit' };
  const next = nextMainMission(missions);
  const row = (m) => {
    const prog = missionProgress(m, player);
    const lock = m.status === 'available' ? missionUnlocked(m, missions, player) : { ok: true, reason: '' };
    const st = m.status === 'done' ? '✅ Selesai'
      : m.status === 'active' ? `🔶 Aktif (${prog.have}/${prog.need})`
      : !lock.ok ? lock.reason
      : '⚪ Belum diambil';
    const isNext = next && next.id === m.id && m.status !== 'done';
    return `<div class="fish-row mission-row ${m.status === 'done' ? 'done' : ''} ${isNext ? 'next' : ''} ${!lock.ok ? 'locked' : ''}"><b>${isNext ? '➡️ ' : ''}${m.title}</b><span>${tierEmoji[m.tier] || m.tier}</span><span>${m.giver} · ${m.place || ''}</span><span>${st}</span><span>${fmtRp(m.reward)}${m.rareBait ? ' +🎁' : ''}${m.fragment ? ' +🧩' : ''}</span></div>`;
  };
  const main = MAIN_CHAIN.map((id) => missions.find((m) => m.id === id)).filter(Boolean);
  const side = missions.filter((m) => m.kind !== 'utama');
  const jobRows = (jobs || []).map((j) => {
    const prog = jobProgress(j, player);
    const st = j.status === 'active' ? `🔶 Aktif (${prog.have}/${prog.need})` : '⚪ Tersedia (bisa diulang)';
    return `<div class="fish-row"><b>${j.title}</b><span>💼 Kerja</span><span>${j.giver}</span><span>${st}</span><span>${fmtRp(j.reward)}</span></div>`;
  }).join('');
  return `<h2>📜 Misi Desa</h2><p>🎯 <b>Tujuan:</b> Jadi <b>Nelayan Legendaris Ereke</b>! Tangkap <b>12 jenis ikan dalam 7 hari</b> (itu syarat menang), selesaikan <b>Misi Utama</b> satu per satu, dan raih gelar <b>Dewa</b>.</p>
  <h3>⭐ Misi Utama (Wajib) — selesaikan berurutan, satu per tingkatan</h3><div class="fish-list">${main.map(row).join('')}</div>
  <h3>🌿 Misi Sampingan — opsional, boleh diambil kalau tingkatanmu cukup</h3><div class="fish-list">${side.map(row).join('')}</div>
  ${jobRows ? `<h3>💼 Kerja — upah harian, bisa diulang</h3><div class="fish-list">${jobRows}</div>` : ''}
  <p><small>Bicara dengan warga (${IS_TOUCH ? 'ketuk AKSI di dekat mereka' : 'tekan E di dekat mereka'}) untuk mengambil misi. 🟢 Mudah Rp 10–25rb · 🟡 Sedang Rp 25–75rb · 🔴 Sulit Rp 75–200rb + hadiah langka.</small></p><button class="btn" data-close>Tutup</button>`;
}

/** Touch controls: virtual joystick (left), camera drag (right half), big action button. */
export function setupTouch(ui) {
  if (!IS_TOUCH) return;
  document.body.classList.add('touch'); // CSS moves the held button left, etc.
  ui.touch.style.display = 'block';
  const joy = ui.joy; const knob = ui.joyKnob;
  let joyId = null; let camId = null; let lastX = 0; let lastY = 0;
  const joyRect = () => joy.getBoundingClientRect();
  joy.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; joyId = t.identifier; e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const r = joyRect();
        let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        ui.joyVec = { x: dx, y: dy };
        knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
      } else if (t.identifier === camId) {
        if (ui.onCamDrag) ui.onCamDrag(t.clientX - lastX, t.clientY - lastY);
        lastX = t.clientX; lastY = t.clientY;
      }
    }
    if (joyId !== null || camId !== null) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; ui.joyVec = { x: 0, y: 0 }; knob.style.transform = 'translate(0,0)'; }
      if (t.identifier === camId) camId = null;
    }
  });
  // Camera drag starts on the right half of the screen, outside panels/buttons.
  // Multi-touch: the drag MAY start while the joystick is held (one finger
  // on the stick, another swiping right to steer). The joystick has its own
  // touchstart handler and is not a child of the canvas, so a touch that
  // starts on the stick never reaches this handler — no joyId guard needed.
  document.getElementById('game').addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (t.clientX > window.innerWidth * 0.45) {
      camId = t.identifier; lastX = t.clientX; lastY = t.clientY; e.preventDefault();
    }
  }, { passive: false });
  ui.actionBtn.addEventListener('touchstart', (e) => { e.preventDefault(); ui.actionHeld = true; if (ui.onAction) ui.onAction(); }, { passive: false });
  ui.actionBtn.addEventListener('touchend', (e) => { e.preventDefault(); ui.actionHeld = false; }, { passive: false });
  if (ui.jumpBtn) ui.jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (ui.onJump) ui.onJump(); }, { passive: false });
  if (ui.attackBtn) ui.attackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if (ui.onAttack) ui.onAttack(); }, { passive: false });
}
