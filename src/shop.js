// shop.js — Pasar Ereke (rods/bait) and Galangan Kapal (boats): buy gear, sell fish.
import { SHOP_ITEMS, BOATS, FISH_BY_ID, fmtRp } from './data.js';

export function shopList(player) {
  return SHOP_ITEMS.map((item) => {
    let owned = false; let note = '';
    if (item.kind === 'rod') { owned = player.rod >= item.tier; note = owned ? 'Dimiliki' : ''; }
    if (item.kind === 'bait') note = `Punya ${player.bait}x`;
    return { ...item, owned, note };
  });
}

export function boatList(player) {
  return BOATS.map((b) => ({
    ...b,
    owned: player.boatTier >= b.tier,
    note: player.boatTier === b.tier ? 'Perahu yang kamu pakai' : player.boatTier > b.tier ? 'Sudah punya yang lebih besar' : '',
  }));
}

export function buyBoat(player, id) {
  const b = BOATS.find((x) => x.id === id);
  if (!b) return 'Perahu tidak ada.';
  if (player.boatTier >= b.tier) return 'Kamu sudah punya perahu setara atau lebih besar.';
  if (player.money < b.price) return `Uang tidak cukup. Butuh ${fmtRp(b.price)}.`;
  player.money -= b.price;
  player.boatTier = b.tier; player.boat = true;
  return `Berhasil membeli ${b.name}! Naik dari dermaga dengan tombol B.`;
}

export function buyItem(player, id) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return 'Barang tidak ada.';
  if (item.kind === 'rod' && player.rod >= item.tier) return 'Joran itu sudah kamu miliki.';
  if (player.money < item.price) return `Uang tidak cukup. Butuh ${fmtRp(item.price)}.`;
  player.money -= item.price;
  if (item.kind === 'rod') player.rod = item.tier;
  if (item.kind === 'bait') player.bait += 5;
  return `Berhasil membeli ${item.name}!`;
}

export function fishPrices() {
  return Object.fromEntries(Object.entries(FISH_BY_ID).map(([id, f]) => [id, f.price]));
}
