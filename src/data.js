// data.js — all game content: fish, shop stock, missions, NPC lines, place facts.
// World coordinates: x east (+) / west (-), z south (+) / north (-), metres. Sea is east (x > 170).
export const WORLD = { minX: -230, maxX: 300, minZ: -165, maxZ: 165 };
export const SEA_X = 170; // tepi laut (pantai timur)
export const SEA_Y = 0.55; // tinggi permukaan laut (batch 4: dinaikkan supaya ombak tak tembus pasir)
export const SEA_MAX_X = 1200; // ujung laut yang diperluas (batch 4 item 9/10)
export const TITANIC_DECK_Y = 3.65; // tinggi geladak Kapal Raksasa di atas permukaan laut
// Batas jarak berlayar (koordinat x; jarak dari pantai = x − SEA_X). Perahu
// gratis HANCUR kalau lewat batas; perahu beli didorong kembali ombak.
export const FREE_BOAT_MAX_X = 230; // perahu kecil gratis: ~60 m dari pantai
export const FREE_BOAT_WARN_X = 220; // peringatan 10 m sebelum batas
export const BOAT_LIMIT_X = { 1: 320, 2: 470, 3: 770, 4: Infinity }; // kayu/motor/besar/raksasa
export const BOAT_WARN_X = { 1: 310, 2: 460, 3: 760 }; // 10 m sebelum batas
export const BOAT_WARN_TEXT = {
  1: '🌊 Ombak besar! Perahu kayu ini hanya sampai sini — beli perahu motor/besar untuk berlayar lebih jauh.',
  2: '🌊 Ombak besar! Perahu motor ini hanya sampai sini — beli perahu besar/kapal raksasa untuk berlayar lebih jauh.',
  3: '🌊 Ombak besar! Perahu besar ini hanya sampai sini — beli Kapal Raksasa untuk berlayar lebih jauh.',
};
// Tabel ikan menurut jarak dari pantai saat memancing dari perahu
// (x − SEA_X): Dekat 0–60 m, Menengah 60–150 m, Jauh 150–300 m, Dalam 300 m+.
export const BOAT_ZONE_TABLES = [
  { name: 'Perairan Dangkal', toast: '', table: [['kembung', 4, 3], ['tongkol', 3, 2], ['baronang', 2, 2], ['udang', 2, 2], ['kerapu', 1, 1]] },
  { name: 'Laut Menengah', toast: '🌊 Laut Menengah — ikan sedang ada di sini!', table: [['kerapu', 4, 3], ['kakap', 3, 2], ['cumi', 2, 2], ['tongkol', 2, 2], ['baronang', 1, 1]] },
  { name: 'Laut Jauh', toast: '🌊 Laut Jauh — ikan besar ada di sini!', table: [['tuna', 4, 3], ['kakap', 3, 2], ['kerapu', 2, 2], ['marlin', 1, 1], ['napoleon', 1, 1]] },
  { name: 'Laut Dalam', toast: '🌊 Zona Laut Dalam — ikan terbesar ada di sini!', table: [['marlin', 4, 3], ['pari', 3, 2], ['tuna', 2, 2], ['napoleon', 2, 2], ['hiu', 1, 1], ['mola', 1, 1]] },
];
export const TOTAL_DAYS = 7;
export const DAY_START_MIN = 6 * 60; // 06:00
export const DAY_END_MIN = 22 * 60; // 22:00

export const FISH = [
  { id: 'kembung', name: 'Ikan Kembung', price: 8000, rarity: 'Biasa', desc: 'Ikan laut paling umum di Ereke.' },
  { id: 'tongkol', name: 'Ikan Tongkol', price: 12000, rarity: 'Biasa', desc: 'Cepat dan kuat, favorit pasar.' },
  { id: 'baronang', name: 'Ikan Baronang', price: 10000, rarity: 'Biasa', desc: 'Suka berenang dekat karang Mowuru.' },
  { id: 'udang', name: 'Udang Windu', price: 15000, rarity: 'Biasa', desc: 'Udang besar dari Malalanda.' },
  { id: 'lele', name: 'Lele Danau', price: 9000, rarity: 'Biasa', desc: 'Penghuni Danau Pasarambolaea.' },
  { id: 'gurame', name: 'Ikan Gurame', price: 20000, rarity: 'Langka', desc: 'Ikan danau yang tenang dan gurih.' },
  { id: 'kakap', name: 'Ikan Kakap', price: 30000, rarity: 'Langka', desc: 'Muncul saat malam di perairan dalam.' },
  { id: 'kerapu', name: 'Ikan Kerapu', price: 35000, rarity: 'Langka', desc: 'Bersembunyi di karang Tebing Kampa.' },
  { id: 'cumi', name: 'Cumi-cumi', price: 28000, rarity: 'Langka', desc: 'Aktif berburu di malam hari.' },
  { id: 'tuna', name: 'Ikan Tuna', price: 45000, rarity: 'Langka', desc: 'Hanya di tengah laut, dari atas perahu.' },
  { id: 'marlin', name: 'Ikan Marlin', price: 75000, rarity: 'Legendaris', desc: 'Raja Laut Banda. Hanya malam, dari perahu.' },
  { id: 'pari', name: 'Ikan Pari Emas', price: 80000, rarity: 'Legendaris', desc: 'Berenang saat senja di Pantai Membuku.' },
  { id: 'napoleon', name: 'Ikan Napoleon', price: 100000, rarity: 'Langka', desc: 'Ikan karang besar laut dalam. Hanya di zona jauh dari pantai.' },
  { id: 'hiu', name: 'Hiu Karang', price: 150000, rarity: 'Legendaris', desc: 'Hiu karang laut dalam. Hanya di zona terdalam — tangkap dari kapal besar.' },
  { id: 'mola', name: 'Ikan Mola-Mola', price: 200000, rarity: 'Legendaris', desc: 'Ikan raksasa laut dalam. Sangat langka — hanya dari Kapal Raksasa di laut dalam.' },
];
export const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]));

// Fishing spots: [fishId, dayWeight, nightWeight]
export const SPOTS = [
  { id: 'membuku', name: 'Pantai Membuku', x: 158, z: -110, table: [['kembung', 5, 3], ['tongkol', 3, 2], ['kakap', 0, 2], ['pari', 0, 0]] },
  { id: 'kampa', name: 'Tebing Kampa', x: 158, z: -62, table: [['kembung', 4, 2], ['kerapu', 3, 2], ['baronang', 2, 2], ['kakap', 1, 2]] },
  { id: 'mowuru', name: 'Pantai Mowuru', x: 158, z: -12, table: [['baronang', 5, 3], ['kembung', 3, 2], ['kakap', 1, 3], ['cumi', 0, 2]] },
  { id: 'lipu', name: 'Pelabuhan Lipu', x: 158, z: 42, table: [['tongkol', 5, 3], ['kerapu', 2, 2], ['kembung', 3, 2], ['cumi', 0, 2]] },
  { id: 'malalanda', name: 'Pantai Malalanda', x: 158, z: 112, table: [['udang', 5, 3], ['baronang', 3, 2], ['kembung', 2, 2], ['cumi', 0, 2]] },
  { id: 'danau', name: 'Danau Pasarambolaea', x: -88, z: 78, table: [['lele', 5, 3], ['gurame', 3, 2]] },
  { id: 'laut', name: 'Tengah Laut Banda', x: 235, z: 10, boatOnly: true, table: [['tuna', 5, 3], ['cumi', 2, 3], ['marlin', 0, 2], ['kakap', 1, 2]] },
  { id: 'dermaga', name: 'Ujung Dermaga Ereke', x: 228, z: 43, table: [['tongkol', 5, 3], ['kerapu', 3, 2], ['cumi', 1, 3], ['kakap', 1, 2]] },
  { id: 'jembatan-bone', name: 'Jembatan Kayu Bone', x: 151, z: 157, table: [['lele', 3, 2], ['kembung', 4, 3], ['baronang', 2, 2], ['udang', 2, 2]] }, // river bank by the bridge, clear of the Buaya Sungai at (151,146)
  { id: 'danau-utara', name: 'Tepi Utara Danau', x: -118, z: 46, table: [['lele', 5, 3], ['gurame', 3, 2]] },
  { id: 'danau-selatan', name: 'Tepi Selatan Danau', x: -118, z: 120, table: [['lele', 4, 3], ['gurame', 4, 2]] },
  { id: 'danau-barat', name: 'Tepi Barat Danau', x: -156, z: 82, table: [['lele', 5, 2], ['gurame', 2, 2]] },
  { id: 'sungai-tengah', name: 'Tengah Sungai Bone', x: 120, z: 150, table: [['lele', 4, 3], ['kembung', 3, 2], ['baronang', 2, 2], ['udang', 1, 1]] },
  { id: 'sungai-muara', name: 'Muara Sungai Bone', x: 160, z: 150, table: [['lele', 3, 2], ['kembung', 4, 3], ['baronang', 3, 2], ['udang', 2, 2]] },
  { id: 'jembatan-lasora', name: 'Jembatan Lasora', x: 172, z: -140, table: [['kembung', 4, 3], ['tongkol', 3, 2], ['cumi', 1, 2]] },
];

export const SHOP_ITEMS = [
  { id: 'rod2', kind: 'rod', tier: 2, name: 'Joran Fiberglass', price: 100000, desc: 'Lebih kuat. Ikan langka lebih sering menggigit.' },
  { id: 'rod3', kind: 'rod', tier: 3, name: 'Joran Carbon', price: 250000, desc: 'Joran terbaik. Membuka peluang ikan legendaris.' },
  { id: 'bait', kind: 'bait', name: 'Umpan Udang (5x)', price: 5000, desc: 'Sekali pakai per lemparan: peluang ikan bagus naik.' },
];

// Buyable houses (bought at Bank BNI Ereke) — each owned house is a save point.
export const HOUSES = [
  { id: 'ereke', name: 'Rumah di Kota Ereke', price: 120000, x: 24, z: 44, perk: 'Gudang ikan: harga jual ikan +10%' },
  { id: 'membuku', name: 'Rumah Pantai Membuku', price: 250000, x: 140, z: -95, perk: 'Bangun pagi dengan +2 umpan gratis' },
];
export const RENT_PRICE = 2000; // kamar sewa di Ereke, per malam
export const BOATS = [
  { id: 'boat1', tier: 1, name: 'Perahu Kayu', price: 500000, desc: 'Perahu nelayan kayu. Cukup untuk memancing di tengah laut. Jarak tempuh: 150 m dari pantai.' },
  { id: 'boat2', tier: 2, name: 'Perahu Motor', price: 900000, desc: 'Mesin tempel, lebih cepat. Ikan langka lebih sering menggigit. Jarak tempuh: 300 m dari pantai.' },
  { id: 'boat3', tier: 3, name: 'Kapal Besar', price: 1500000, desc: 'Kapal besar tercepat. Peluang terbaik untuk ikan legendaris. Jarak tempuh: 600 m dari pantai.' },
  { id: 'boat4', tier: 4, name: '🚢 Kapal Raksasa', price: 100000000, desc: 'Kapal sebesar Titanic — lambung panjang, geladak bertingkat, 2 cerobong asap. Kapal terbesar di Ereke. Jarak tempuh: tanpa batas.' },
];

export const MISSIONS = [
  // MUDAH — same village, Rp 10.000–25.000
  // kind: 'utama' = main chain (one per rank, sequential), 'sampingan' = optional.
  // rank/rankMin: the player rank needed to accept the mission.
  { id: 'm1', kind: 'utama', rank: 'Pemula', rankMin: 1, tier: 'Mudah', giver: 'Bu Sari', place: 'Warung, Kota Ereke', title: 'Kerapu untuk Warung', text: 'Warungku kehabisan kerapu! Bawakan 3 Ikan Kerapu, ya.', need: { fish: 'kerapu', count: 3 }, reward: 25000, energy: 20, done: 'Terima kasih! Warung ramai lagi berkat kamu.' },
  { id: 'm2', kind: 'utama', rank: 'Junior', rankMin: 10, tier: 'Mudah', giver: 'Pak Laode', place: 'Pelabuhan Ereke', title: 'Tongkol Segar', text: 'Anakku minta tongkol bakar. Tangkap 1 Ikan Tongkol untukku.', need: { fish: 'tongkol', count: 1 }, reward: 20000, energy: 10, done: 'Tongkolnya segar sekali. Kamu nelayan sungguhan!' },
  { id: 'm5', kind: 'sampingan', rank: 'Pemula', rankMin: 1, tier: 'Mudah', giver: 'Nelayan Muda', place: 'Pantai Membuku', title: 'Kelapa untuk Es Kelapa', text: 'Aku mau jualan es kelapa. Kumpulkan 3 kelapa di Pantai Membuku!', need: { coconuts: 3 }, reward: 15000, energy: 10, done: 'Es kelapanya laris! Ini upahmu.' },
  // SEDANG — nearby village/beach, Rp 25.000–75.000
  { id: 'm3', kind: 'sampingan', rank: 'Junior', rankMin: 10, tier: 'Sedang', giver: 'Pak Budi', place: 'Desa Loji Pantai', title: 'Joran yang Hilang', text: 'Joranku tertinggal di Pantai Membuku, dekat pohon kelapa. Cari, lalu kembalikan padaku.', need: { find: 'rod', at: 'membuku' }, reward: 30000, energy: 20, done: 'Itu dia joran kesayanganku! Kamu baik sekali.' },
  { id: 'm4', kind: 'utama', rank: 'Senior', rankMin: 20, tier: 'Sedang', giver: 'Imam Haji', place: 'Masjid Al Muhadjirin, Ereke', title: 'Kakap untuk Kenduri', text: 'Masjid mengadakan kenduri malam Jumat. Kami butuh 1 Ikan Kakap.', need: { fish: 'kakap', count: 1 }, reward: 40000, energy: 15, done: 'Semoga berkah. Kenduri kita jadi meriah.' },
  { id: 'm6', kind: 'sampingan', rank: 'Senior', rankMin: 20, tier: 'Sedang', giver: 'Ibu Linsowu', place: 'Desa Linsowu', title: 'Tongkol untuk Linsowu', text: 'Desa kami mengadakan makan bersama. Bawakan 3 Ikan Tongkol ke Linsowu.', need: { fish: 'tongkol', count: 3 }, reward: 50000, energy: 15, done: 'Warga Linsowu senang sekali. Terima kasih!' },
  // SULIT — far village / mid-sea rare fish, Rp 75.000–200.000 + rare item
  { id: 'm7', kind: 'utama', rank: 'Master', rankMin: 30, tier: 'Sulit', giver: 'Nelayan Bone', place: 'Desa Malalanda', title: 'Tuna untuk Malalanda', text: 'Pesta di Malalanda butuh 1 Ikan Tuna dari tengah laut. Berani?', need: { fish: 'tuna', count: 1 }, reward: 100000, energy: 20, rareBait: 1, done: 'Tuna segar dari laut dalam! Kamu memang legenda.' },
  { id: 'm8', kind: 'utama', rank: 'Grandmaster', rankMin: 40, tier: 'Sulit', giver: 'Nelayan Bone', place: 'Desa Malalanda', title: 'Marlin Tengah Laut', text: 'Katanya ada Marlin raksasa di Laut Banda. Tangkap 1 untukku — hadiah besar menanti.', need: { fish: 'marlin', count: 1 }, reward: 200000, energy: 25, rareBait: 1, done: 'MARLIN! Seluruh desa membicarakanmu sekarang!' },
  // Forest missions — defeat monsters (tap-to-attack, rod = weapon).
  { id: 'm9', kind: 'sampingan', rank: 'Pemula', rankMin: 1, tier: 'Mudah', giver: 'Pak Budi', place: 'Desa Loji Pantai', title: 'Usir Babi Hutan', text: 'Babi hutan merusak kebun warga di Hutan Loji! Usir dia (kalahkan dengan pancinganmu).', need: { monster: 'babi' }, reward: 20000, energy: 10, done: 'Kebun aman lagi. Terima kasih!' },
  { id: 'm10', kind: 'sampingan', rank: 'Junior', rankMin: 10, tier: 'Sedang', giver: 'Nelayan Bone', place: 'Desa Malalanda', title: 'Ular Penjaga Peti', text: 'Ada ular menjaga peti harta di Hutan Loji. Kalahkan dia, petinya jadi milikmu.', need: { monster: 'ular' }, reward: 50000, energy: 15, fragment: 1, done: 'Ularnya kabur! Peti itu sekarang aman digali.' },
  { id: 'm11', kind: 'sampingan', rank: 'Senior', rankMin: 20, tier: 'Sedang', giver: 'Ibu Linsowu', place: 'Desa Linsowu', title: 'Buah Tanpa Diganggu Kera', text: 'Kera hutan selalu mengganggu saat memetik buah. Kalahkan kera itu dulu!', need: { monster: 'kera' }, reward: 60000, energy: 15, done: 'Sekarang bisa memetik buah dengan tenang!' },
  { id: 'm12', kind: 'utama', rank: 'Legenda', rankMin: 50, tier: 'Sulit', giver: 'Pak Laode', place: 'Pelabuhan Ereke', title: 'Kalahkan Buaya Sungai', text: 'Buaya besar di sungai bawah Jembatan Kayu Bone menakut-nakuti warga. Kalahkan dia!', need: { monster: 'buaya' }, reward: 150000, energy: 25, rareBait: 1, done: 'Sungai aman lagi! Kamu pahlawan Ereke!' },
  { id: 'm13', kind: 'utama', rank: 'Dewa', rankMin: 100, tier: 'Sulit', giver: 'Pak Budi', place: 'Desa Loji Pantai', title: 'Raja Hutan Terakhir', text: 'Raja Hutan Lv50 mengancam seluruh desa! Kalahkan dia dan jadilah legenda sejati Ereke.', need: { monster: 'raja' }, reward: 500000, energy: 25, rareBait: 2, fragment: 2, done: 'Raja Hutan tumbang! Ereke aman — kamu memang Dewa Nelayan!' },
];

// Paid work jobs ("kerja") — repeatable income alongside fishing.
export const JOBS = [
  { id: 'j1', giver: 'Pak Laode', title: 'Kerja di Pelabuhan', text: 'Bantu angkut 3 peti ikan di dermaga. Upah harian.', kind: 'carry', count: 3, reward: 25000, at: { x: 178, z: 43 } },
  { id: 'j2', giver: 'Bu Sari', title: 'Antar Ikan ke Warung', text: 'Antar 2 Ikan Kembung segar ke warungku.', kind: 'deliver', fish: 'kembung', count: 2, reward: 15000, at: { x: -10, z: 42 } },
  { id: 'j3', giver: 'Pak Laode', title: 'Perbaiki Jala', text: 'Jala-jala di dermaga robek. Perbaiki 3 jala untukku.', kind: 'carry', count: 3, reward: 12000, at: { x: 160, z: 30 } },
  { id: 'j4', giver: 'Bu Sari', title: 'Angkut Peti di Pasar', text: 'Peti dagangan menumpuk di pasar. Angkut 3 peti ke warung.', kind: 'carry', count: 3, reward: 18000, at: { x: 4, z: 34 } },
];

// Daily login rewards (real days, 7-day cycle; streak resets if a day is missed).
export const LOGIN_REWARDS = [
  { money: 10000, bait: 0, rareBait: 0 },
  { money: 15000, bait: 0, rareBait: 0 },
  { money: 20000, bait: 5, rareBait: 0 },
  { money: 25000, bait: 0, rareBait: 0 },
  { money: 30000, bait: 5, rareBait: 0 },
  { money: 50000, bait: 0, rareBait: 0 },
  { money: 100000, bait: 0, rareBait: 1 },
];

// Forest monsters — simple tap-to-attack combat. Threat colours: Rendah green,
// Sedang yellow, Tinggi orange, Bahaya red. Rod tier adds damage.
export const MONSTERS = [
  { id: 'babi', name: 'Babi Hutan', level: 5, threat: 'Rendah', threatColor: 0x2ecc71, hp: 60, x: -100, z: 130, reward: 20000, xp: 60 },
  { id: 'ular', name: 'Ular Hutan', level: 12, threat: 'Sedang', threatColor: 0xf1c40f, hp: 120, x: -88, z: 136, reward: 50000, xp: 120, fragment: 1 },
  { id: 'kera', name: 'Kera Hutan', level: 18, threat: 'Sedang', threatColor: 0xf1c40f, hp: 150, x: -75, z: 145, reward: 60000, xp: 150, steals: true },
  { id: 'buaya', name: 'Buaya Sungai', level: 30, threat: 'Tinggi', threatColor: 0xe67e22, hp: 300, x: 151, z: 146, reward: 150000, xp: 300, rareBait: 1 },
  { id: 'buaya-danau', name: 'Buaya Danau', level: 28, threat: 'Tinggi', threatColor: 0xe67e22, hp: 280, x: -95, z: 108, reward: 120000, xp: 260, rareBait: 1 },
  { id: 'raja', name: 'Raja Hutan', level: 50, threat: 'Bahaya', threatColor: 0xe74c3c, hp: 800, x: -112, z: 152, reward: 300000, xp: 600, fragment: 2 },
];
export const THREAT_DAMAGE = { Rendah: 5, Sedang: 8, Tinggi: 12, Bahaya: 18 };

// Danger zones (drawn on the full map + minimap, red dashed circles).
// Hutan Loji holds the 4 forest monsters; the Bone river holds Buaya Lv30.
export const DANGER_ZONES = [
  { x: -94, z: 141, r: 35, label: '⚠️ BAHAYA' },
  { x: 151, z: 146, r: 15, label: '⚠️ BAHAYA' },
];

// Held items (the hand selector). All available from the start in this build.
// Rod damage scales with rod tier (8 + rod*6); the rest are fixed tiers.
export const HELD_ITEMS = [
  { id: 'rod', icon: '🎣', name: 'Pancing', note: 'memancing' },
  { id: 'hand', icon: '👊', name: 'Tangan kosong', note: 'dmg 6' },
  { id: 'pisau', icon: '🔪', name: 'Pisau', note: 'dmg 24' },
  { id: 'pedang', icon: '🗡️', name: 'Pedang', note: 'dmg 32' },
  { id: 'obor', icon: '🔥', name: 'Obor', note: 'dmg 16 · cahaya hangat' },
  { id: 'kayu', icon: '🪵', name: 'Kayu', note: 'dmg 10' },
  { id: 'senter', icon: '🔦', name: 'Senter', note: 'sorotan malam' },
];
export const WEAPON_DMG = { hand: 6, kayu: 10, obor: 16, pisau: 24, pedang: 32, senter: 6 };
export const WEAPONS = new Set(['kayu', 'obor', 'pisau', 'pedang']); // show the SERANG button

// Hidden treasure chests (3 map fragments combine to reveal one).
export const TREASURE_CHESTS = [
  { id: 'c1', name: 'Harta Pantai Membuku', x: 148, z: -98, reward: 80000 },
  { id: 'c2', name: 'Harta Benteng Kalisusu', x: -132, z: -72, reward: 120000 },
  { id: 'c3', name: 'Harta Tebing Kampa', x: 172, z: -58, reward: 100000 },
  { id: 'c4', name: 'Harta Jembatan Kayu Bone', x: 146, z: 150, reward: 150000 },
  { id: 'c5', name: 'Harta Puncak Gunung', x: -203, z: 113, reward: 200000 },
  { id: 'c6', name: 'Harta Hutan Loji', x: -88, z: 138, reward: 180000 },
];

export const NPC_LINES = {
  sari: ['Selamat datang di Pasar Ereke! Ikan segar, harga bersahabat.', 'Joran bagus bikin tangkapan bagus. Lihat daganganku.'],
  laode: ['Laut sedang tenang hari ini. Waktu yang bagus untuk memancing.', 'Kalau mau tuna, kamu butuh perahu. Nabung dulu!'],
  budi: ['Desa Loji Pantai rumah kita. Jaga lautnya, ya.', 'Joranku hilang di Membuku... kamu lihat?'],
  imam: ["Assalamu'alaikum. Masjid Ereke selalu terbuka untukmu.", 'Kenduri Jumat butuh kakap. Bantu kami, ya.'],
  muda: ['Pantai Membuku paling cantik saat senja, sekitar jam 5 sore!', 'Katanya ada Pari Emas muncul saat matahari terbenam...'],
  linsowu: ['Selamat datang di Linsowu! Pantai Mowuru milik kami.', 'Tongkol dari sini paling segar, katanya.'],
  bone: ['Malalanda, kampung nelayan sejati. Laut di sini dalam dan kaya.', 'Marlin? Hanya nelayan paling berani yang mengejarnya.'],
};

export const PLACES = [
  { id: 'loji', name: 'Desa Loji Pantai', sub: 'Kampung halamanmu', x: 62, z: 62 },
  { id: 'ereke', name: 'Kota Ereke', sub: 'Kel. Bangkudu — Pasar & Masjid Al Muhadjirin', x: 0, z: 28 },
  { id: 'membuku', name: 'Pantai Membuku', sub: 'Pasir putih ±3 km', x: 158, z: -110 },
  { id: 'kampa', name: 'Tebing Kampa', sub: 'Tebing batu karang', x: 158, z: -62 },
  { id: 'mowuru', name: 'Pantai Mowuru', sub: 'Desa Linsowu', x: 158, z: -12 },
  { id: 'lipu', name: 'Pelabuhan Lipu', sub: 'Kel. Lipu — Dermaga perahu', x: 158, z: 42 },
  { id: 'malalanda', name: 'Pantai Malalanda', sub: 'Desa Malalanda / Pantai Bone', x: 158, z: 112 },
  { id: 'kalisusu', name: 'Benteng Kalisusu', sub: 'Benteng tua', x: -140, z: -80 },
  { id: 'danau', name: 'Danau Pasarambolaea', sub: 'Danau pedalaman', x: -118, z: 82 },
  { id: 'laut', name: 'Tengah Laut Banda', sub: 'Hanya dengan perahu', x: 235, z: 10 },
  // Kecamatan Kulisusu — main villages (full detail on the map)
  { id: 'lokonea', name: 'Kelurahan Lokonea', sub: 'Perkampungan pedalaman', x: -40, z: -60, r: 26 },
  { id: 'linsowu', name: 'Desa Linsowu', sub: 'Kampung di balik Mowuru', x: 120, z: -40, r: 26 },
  { id: 'malalanda-desa', name: 'Desa Malalanda', sub: 'Kampung pesisir selatan', x: 120, z: 130, r: 26 },
  { id: 'kalibu', name: 'Desa Kalibu', sub: 'Jl. Poros Kalibu', x: -60, z: 120, r: 26 },
  { id: 'kadacua', name: 'Desa Kadacua', sub: 'Perkampungan barat', x: -160, z: 20, r: 26 },
  // Kecamatan Kulisusu — extra villages (small labelled clusters)
  { id: 'laangke', name: 'Desa Laangke', sub: '', x: -180, z: -120, r: 16, minor: true },
  { id: 'lantagi', name: 'Desa Lantagi', sub: '', x: -100, z: -130, r: 16, minor: true },
  { id: 'lemoea', name: 'Desa Lemo Ea', sub: '', x: -40, z: 140, r: 16, minor: true },
  { id: 'rombo', name: 'Desa Rombo', sub: '', x: 40, z: -130, r: 16, minor: true },
  { id: 'tomoahi', name: 'Desa Tomoahi', sub: '', x: -200, z: 60, r: 16, minor: true },
  { id: 'wasalabose', name: 'Desa Wasalabose', sub: '', x: 100, z: -140, r: 16, minor: true },
  { id: 'eelahaji', name: 'Desa Eelahaji', sub: '', x: -140, z: 140, r: 16, minor: true },
  { id: 'jampaka', name: 'Desa Jampaka', sub: '', x: 60, z: 150, r: 16, minor: true },
  { id: 'lemo', name: 'Kelurahan Lemo', sub: '', x: 30, z: -90, r: 16, minor: true },
  { id: 'bonelipu', name: 'Kelurahan Bonelipu', sub: '', x: 140, z: 80, r: 16, minor: true },
  // Landmarks
  { id: 'lapangan', name: 'Lapangan Raja Jin', sub: 'Lapangan bola Ereke', x: -20, z: -10, r: 22 },
  { id: 'rsud', name: 'RSUD Buton Utara', sub: 'Jl. Poros Kalibu, Desa Loji', x: 95, z: 95, r: 20 },
  { id: 'stadion', name: 'Stadion Bahteramas', sub: 'SOR Bukit Lamoliandu — kandang PS Buton Utara', x: -185, z: -60, r: 26 },
  { id: 'gor', name: 'GOR Lamoliandu', sub: 'Gedung olahraga — Piala Lamoliandu', x: -128, z: -18, r: 20 },
  { id: 'basket', name: 'Lapangan Basket', sub: 'SOR Bukit Lamoliandu', x: -158, z: -30, r: 16 },
  { id: 'takraw', name: 'Lapangan Takraw', sub: 'SOR Bukit Lamoliandu', x: -212, z: -40, r: 16 },
  { id: 'benteng-lipu', name: 'Benteng Lipu', sub: 'Situs budaya di kaki bukit', x: -120, z: -100, r: 20 },
  // Bridges (walkable)
  { id: 'pelabuhan-ereke', name: 'Pelabuhan Ereke', sub: 'Dermaga Mina-Minanga, Lipu', x: 200, z: 43, r: 24 },
  { id: 'jembatan-lasora', name: 'Jembatan Lasora', sub: 'Dekat Pelabuhan Lasora, Teluk Koro', x: 172, z: -140, r: 20 },
  { id: 'jembatan-bone', name: 'Jembatan Kayu Bone', sub: 'Jembatan kayu tua ke Pantai Bone', x: 151, z: 150, r: 20 },
  // Bank + houses (save points)
  { id: 'bni', name: 'BNI Ereke', sub: 'Bank BNI KCP Ereke — Jl. Raya Bumi Sara\'ea', x: -14, z: 10, r: 18 },
  { id: 'rumah-ereke', name: 'Rumah Ereke', sub: 'Rumah beli — titik simpan', x: 24, z: 44, r: 16 },
  { id: 'rumah-membuku', name: 'Rumah Pantai Membuku', sub: 'Rumah beli — titik simpan', x: 140, z: -95, r: 16 },
  { id: 'sewa', name: 'Kamar Sewa Ereke', sub: 'Sewa Rp 2.000/malam — titik simpan', x: 30, z: 20, r: 16 },
  // Adventure zones: mountain + forest.
  { id: 'gunung', name: 'Gunung Butur', sub: 'Puncak tertinggi — pemandangan seluruh Ereke', x: -205, z: 115, r: 24 },
  { id: 'hutan', name: 'Hutan Loji', sub: 'Jalur hutan — kayu, buah & jamur', x: -90, z: 135, r: 24 },
  // Salon + papan pengumuman event
  { id: 'salon-ereke', name: 'Salon Ereke', sub: 'Potong rambut & ganti baju', x: 14, z: 52, r: 16 },
  { id: 'salon-loji', name: 'Salon Loji', sub: 'Potong rambut & ganti baju', x: 78, z: 60, r: 16 },
  { id: 'papan', name: 'Papan Pengumuman', sub: 'Event mingguan Ereke', x: 2, z: 18, r: 14 },
];

export const MAIN_PLACES = PLACES.filter((p) => !p.minor);

// LEVEL TITLES — plain rank tiers, the whole ladder in one table (easy to change).
export const LEVEL_TITLES = [
  { min: 1, max: 9, title: 'Pemula' },
  { min: 10, max: 19, title: 'Junior' },
  { min: 20, max: 29, title: 'Senior' },
  { min: 30, max: 39, title: 'Master' },
  { min: 40, max: 49, title: 'Grandmaster' },
  { min: 50, max: 99, title: 'Legenda' },
  { min: 100, max: 999, title: 'Dewa' }, // max rank
];
export const EVENT_TITLES = {
  fishingChamp: 'Juara Mancing',
  raceChamp: 'Juara Balapan',
  treasureChamp: 'Pemburu Harta Karun',
};
// SKINS — every skin (shop + rank-exclusive) in one table: visuals + its effect.
// Effect types: sell (harga jual ikan), fishSpeed (mancing lebih cepat),
// walkSpeed (jalan lebih cepat), rare (ikan langka lebih sering),
// motoSpeed (motor lebih cepat), xp (XP lebih banyak).
export const SKIN_DEFS = {
  // Shop skins (bought at Pasar Ereke — effect shown on the card before buying).
  nelayan: { name: 'Baju Nelayan', shirt: 0x2e7d32, hat: null, cloak: false, glow: false, effect: { type: 'sell', value: 1.10, text: '+10% harga jual ikan' } },
  topi: { name: 'Topi Pantai', shirt: 0x3498db, hat: 'straw', cloak: false, glow: false, effect: { type: 'fishSpeed', value: 1.10, text: 'Mancing 10% lebih cepat' } },
  sepatu: { name: 'Sepatu Lari', shirt: 0xe67e22, hat: null, cloak: false, glow: false, effect: { type: 'walkSpeed', value: 1.10, text: 'Jalan 10% lebih cepat' } },
  penyelam: { name: 'Rompi Penyelam', shirt: 0x1565c0, hat: null, cloak: false, glow: false, vest: true, effect: { type: 'rare', value: 1.5, text: 'Ikan langka 50% lebih sering muncul' } },
  balap: { name: 'Jaket Balap', shirt: 0xc62828, hat: null, cloak: false, glow: false, trim: 0xffd700, effect: { type: 'motoSpeed', value: 1.10, text: 'Motor 10% lebih cepat' } },
  festival: { name: 'Baju Festival', shirt: 0x8e24aa, hat: null, cloak: true, glow: false, effect: { type: 'xp', value: 1.15, text: '+15% XP dari semua aktivitas' } },
  // Rank-exclusive skins (only from ranking up — never sold; stronger effects).
  junior: { name: 'Pakaian Pantai Biru + Topi Nelayan', shirt: 0x2196f3, hat: 'straw', cloak: false, glow: false, effect: { type: 'sell', value: 1.15, text: '+15% harga jual ikan' } },
  senior: { name: 'Rompi Nelayan', shirt: 0x6d4c41, hat: null, cloak: false, glow: false, vest: true, effect: { type: 'fishSpeed', value: 1.15, text: 'Mancing 15% lebih cepat' } },
  master: { name: 'Pakaian Merah-Emas', shirt: 0xc62828, hat: null, cloak: false, glow: false, trim: 0xffd700, effect: { type: 'sell', value: 1.20, text: '+20% harga jual ikan' } },
  grandmaster: { name: 'Pakaian Emas', shirt: 0xffd700, hat: 'gold', cloak: false, glow: false, trim: 0xffffff, effect: { type: 'rare', value: 2.0, text: 'Ikan langka 2x lebih sering muncul' } },
  legenda: { name: 'Jubah Legendaris', shirt: 0x4a148c, hat: null, cloak: true, glow: false, effect: { type: 'xp', value: 1.25, text: '+25% XP dari semua aktivitas' } },
  dewa: { name: 'Pakaian Dewa Bercahaya', shirt: 0xffd700, hat: 'crown', cloak: true, glow: true, effect: { type: 'xp', value: 1.25, text: '+25% XP & +25% harga jual ikan' } },
};
export const SHOP_SKINS = [
  { id: 'nelayan', price: 50000 },
  { id: 'topi', price: 30000 },
  { id: 'sepatu', price: 40000 },
  { id: 'penyelam', price: 150000 },
  { id: 'balap', price: 120000 },
  { id: 'festival', price: 200000 },
];
// RANK-UP REWARDS — one per rank-up (never sold in shops). Skin = outfit parts.
// Junior 25k, Senior 50k, Master 100k, Grandmaster 200k, Legenda 500k, Dewa 1jt.
export const RANK_REWARDS = {
  Junior: { bonus: 25000, skinId: 'junior' },
  Senior: { bonus: 50000, skinId: 'senior' },
  Master: { bonus: 100000, skinId: 'master' },
  Grandmaster: { bonus: 200000, skinId: 'grandmaster' },
  Legenda: { bonus: 500000, skinId: 'legenda' },
  Dewa: { bonus: 1000000, skinId: 'dewa' },
};
export function levelFromXp(xp) { return 1 + Math.floor(Math.max(0, xp) / 100); }
export function levelTitle(level) {
  const row = LEVEL_TITLES.find((r) => level >= r.min && level <= r.max);
  return row ? row.title : 'Legenda Butur';
}
export function isNight(minutes) { return minutes >= 18 * 60; }
export function isSunset(minutes) { return minutes >= 17 * 60 && minutes < 18 * 60 + 30; }

/** Fish of the Day: each day one beach pays 3x for one specific fish. Deterministic per day. */
export function fishOfTheDay(day) {
  const beachSpots = SPOTS.filter((s) => !s.boatOnly);
  const spot = beachSpots[(day - 1) % beachSpots.length];
  const fishId = spot.table[(day * 2 + 1) % spot.table.length][0];
  return { fish: FISH_BY_ID[fishId], spot, mult: 3 };
}
export function fmtClock(minutes) {
  const h = Math.floor(minutes / 60); const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function fmtRp(n) { return 'Rp ' + n.toLocaleString('id-ID'); }
