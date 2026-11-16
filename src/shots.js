// shots.js — deterministic ?shot= scenes for screenshots.
// Each scene sets the clock, player position, camera and game state directly,
// then main.js renders it a few times and sets window.__shotReady.
import { FISH } from './data.js';
import { addFish, placePlayer } from './player.js';
import { showEnd } from './ui.js';

function setCam(player, yaw, pitch, x, z) {
  player.camYaw = yaw; player.camPitch = pitch;
  if (x !== undefined) placePlayer(player, x, z);
}

export function stageShot(name, g) {
  const { player, clock, missions, fishing, world } = g;
  if (name === 'play') {
    // Mid-game: player fishing at Pantai Membuku at sunset, a few fish already caught.
    clock.day = 2; clock.minutes = 17 * 60 + 20;
    player.money = 45000; player.earned = 45000; player.energy = 68; player.rod = 2; player.bait = 3;
    addFish(player, 'kembung'); addFish(player, 'tongkol'); addFish(player, 'baronang'); addFish(player, 'kerapu');
    setCam(player, -1.9, 0.35, 152, -104);
    player.yaw = 1.4;
    fishing.state = 'bite'; fishing.spot = { id: 'membuku', name: 'Pantai Membuku' };
    fishing.marker = 0.5; fishing.zone = [0.38, 0.66]; fishing.fish = FISH.find((f) => f.id === 'kakap');
    fishing.biteT = 8; fishing.progress = 0.45; // mid-catch: bar half full, 8 s left
    g.screen('play');
  } else if (name === 'shop') {
    // Market view: player at Pasar Ereke, shop panel open.
    clock.day = 1; clock.minutes = 10 * 60;
    player.money = 62000; player.earned = 62000; player.energy = 90;
    addFish(player, 'kembung'); addFish(player, 'tongkol'); addFish(player, 'tongkol');
    setCam(player, 2.6, 0.3, 8, 34);
    g.screen('shop'); // main.js opens the shop panel right after staging.
  } else if (name === 'end') {
    // Win screen: full collection book, sunset over the sea.
    clock.day = 5; clock.minutes = 18 * 60 + 10;
    player.money = 180000; player.earned = 310000; player.energy = 40; player.rod = 3; player.boatTier = 3; player.boat = true;
    for (const f of FISH) addFish(player, f.id);
    setCam(player, -1.9, 0.3, 152, -104);
    g.endGame(true);
  } else {
    // start (default): title over a scenic Membuku sunset view.
    clock.day = 1; clock.minutes = 17 * 60 + 30;
    setCam(player, -2.2, 0.28, 140, -90);
    player.yaw = 1.2;
    player.mesh.visible = false; // clean scenic title — the hero appears when play starts
    g.screen('title');
  }
  // Hide the lost-rod marker in staged scenes where it would distract.
  if (name === 'play' || name === 'end') world.lostRod.visible = false;
}
