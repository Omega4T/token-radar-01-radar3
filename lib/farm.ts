// Farm plans (§4.3). Every board row gets 9 steps. Steps 1-8 follow the
// fixed framework; step 9 is protocol-specific. Every step names a
// concrete number (dollars, days or minutes) derived from that protocol's
// own data, and the capital and hold rules are the spec's rules, not
// tuned numbers.
import { METHOD } from './constants.ts';
import type { Protocol, ValueFeatures } from './features.ts';

export function holdDays(age: number | null): number {
  if (age === null) return METHOD.HOLD_MID_DAYS;
  if (age < METHOD.HOLD_YOUNG_MAX_AGE) return METHOD.HOLD_YOUNG_DAYS;
  if (age < METHOD.HOLD_MID_MAX_AGE) return METHOD.HOLD_MID_DAYS;
  return METHOD.HOLD_OLD_DAYS;
}

export function capitalUsd(tvl: number): number {
  if (tvl >= METHOD.CAPITAL_HUGE_MIN_TVL) return METHOD.CAPITAL_HUGE;
  if (tvl >= METHOD.CAPITAL_LARGE_MIN_TVL) return METHOD.CAPITAL_LARGE;
  if (tvl >= METHOD.CAPITAL_MID_MIN_TVL) return METHOD.CAPITAL_MID;
  return METHOD.CAPITAL_SMALL;
}

export const fmtUsd = (n: number): string =>
  '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Primary and secondary actions per category. The map covers the
// categories that appear on the board; anything else falls back to a
// generic two-sided DeFi action that still names the protocol's own
// category, chain and numbers.
interface CategoryPlay {
  primary: string;
  secondary: string;
  deepening: string;
}

const PLAYS: Record<string, CategoryPlay> = {
  Dexs: {
    primary: 'sediakan likuiditas di pool utama (pasangan dengan volume tertinggi) dalam rentang harga sempit',
    secondary: 'lakukan 3 swap taker dengan ukuran berbeda di pair yang sama supaya wallet tercatat sebagai trader aktif',
    deepening: 'pindahkan 25% likuiditas ke pool kedua dengan fee tier berbeda dan catat selisih fee yang diterima selama 7 hari',
  },
  Lending: {
    primary: 'supply aset utama sebagai collateral lalu pinjam 40% dari limit borrow dalam satu sesi',
    secondary: 'supply aset kedua yang berbeda dan lakukan 1 borrow kecil tambahan supaya tercatat dua posisi aktif',
    deepening: 'lunasi 50% pinjaman pertama lalu pinjam ulang dalam 48 jam untuk menunjukkan siklus borrow yang lengkap',
  },
  Yield: {
    primary: 'deposit ke vault yield utama dan biarkan posisi meng-compound tanpa ditarik',
    secondary: 'deposit ke vault kedua dengan strategi berbeda supaya wallet tercatat di dua vault',
    deepening: 'klaim reward vault pertama setelah 14 hari lalu deposit ulang reward itu ke vault yang sama',
  },
  'Yield Aggregator': {
    primary: 'deposit ke vault agregator utama dan aktifkan auto-compound bila tersedia',
    secondary: 'deposit ke vault kedua dengan aset berbeda untuk menunjukkan diversifikasi strategi',
    deepening: 'bandingkan APY vault pertama dan kedua setelah 7 hari lalu pindahkan 30% dana ke vault yang lebih baik',
  },
  Derivatives: {
    primary: 'buka 1 posisi long kecil dengan leverage maksimal 2x dan pasang stop-loss 5% di bawah entry',
    secondary: 'buka 1 posisi short kecil di pasar berbeda sebagai hedge dengan ukuran setengah posisi pertama',
    deepening: 'tutup posisi long setelah 7 hari dengan profit atau loss maksimal 10%, lalu buka posisi baru dengan ukuran sama',
  },
  Bridge: {
    primary: 'bridge aset dari chain asal ke chain tujuan dan gunakan aset itu di satu aplikasi di chain tujuan',
    secondary: 'bridge kembali setengah aset ke chain asal (round trip) dalam 72 jam',
    deepening: 'ulangi bridge dengan aset kedua yang berbeda dan catat biaya gas serta waktu konfirmasi tiap leg',
  },
  'Liquid Staking': {
    primary: 'stake aset dan pegang receipt token tanpa menjualnya selama masa hold',
    secondary: 'gunakan receipt token sebagai collateral di satu lending market dengan borrow kecil',
    deepening: 'tambah stake 25% dari modal awal setelah 14 hari dan bandingkan yield receipt token sebelum dan sesudah',
  },
  CDP: {
    primary: 'buka vault CDP dengan collateral ratio minimal 200% dan mint stablecoin senilai 30% dari collateral',
    secondary: 'tambah collateral 20% setelah 7 hari lalu mint tambahan 10% dari nilai collateral baru',
    deepening: 'bayar kembali 50% utang CDP setelah 21 hari dan catat perubahan collateral ratio di tiap langkah',
  },
  RWA: {
    primary: 'beli token RWA utama dan pegang di wallet yang sama selama masa hold penuh',
    secondary: 'gunakan token RWA itu di satu vault atau lending market yang menerimanya sebagai collateral',
    deepening: 'tambah posisi RWA 25% setelah 14 hari dan simpan bukti transaksi pembelian kedua di farm log',
  },
  'Restaking': {
    primary: 'restake aset lewat operator yang aktif dan delegasikan ke 1 operator dengan komisi di bawah 10%',
    secondary: 'ganti delegasi ke operator kedua setelah 14 hari untuk menunjukkan partisipasi aktif',
    deepening: 'klaim reward restaking setelah 21 hari lalu restake reward itu ke operator yang sama',
  },
  'Liquid Restaking': {
    primary: 'restake aset dan pegang receipt token restaking tanpa menjualnya selama masa hold',
    secondary: 'deposit receipt token ke satu vault DeFi dan catat yield tambahannya selama 7 hari',
    deepening: 'tambah restake 25% dari modal awal setelah 14 hari dan bandingkan yield sebelum dan sesudah',
  },
  Perps: {
    primary: 'buka 1 posisi perpetual kecil dengan leverage maksimal 2x dan stop-loss 5% di bawah entry',
    secondary: 'buka 1 posisi berlawanan arah di pasar berbeda dengan ukuran setengah posisi pertama',
    deepening: 'tutup posisi pertama setelah 7 hari dengan hasil maksimal 10% lalu buka posisi baru dengan ukuran sama',
  },
  Options: {
    primary: 'beli 1 call option out-of-the-money dengan expiry 14 hari dan ukuran 10% dari modal',
    secondary: 'jual 1 put option covered dengan strike 10% di bawah harga saat ini dan expiry 14 hari',
    deepening: 'tutup atau biarkan expiry option pertama, lalu beli option baru dengan expiry 30 hari dan ukuran sama',
  },
  'Basis Trading': {
    primary: 'buka 1 posisi basis (long spot, short perps) dengan ukuran 50% dari modal dan catat funding rate awal',
    secondary: 'tutup dan buka ulang posisi basis setelah funding rate berubah 0,05% untuk menunjukkan manajemen aktif',
    deepening: 'tambah 25% ukuran posisi basis setelah 14 hari bila funding rate masih positif selama 7 hari berturut-turut',
  },
  'Prediction Market': {
    primary: 'beli 1 posisi di pasar prediksi dengan probabilitas 40-60% dan ukuran 10% dari modal',
    secondary: 'beli 1 posisi di pasar kedua dengan topik berbeda dan ukuran yang sama',
    deepening: 'tutup posisi pertama setelah 7 hari bila probabilitas bergerak 10 poin, lalu buka posisi baru di pasar ketiga',
  },
  'NFT Marketplace': {
    primary: 'beli 1 NFT floor di koleksi utama marketplace dan pegang selama masa hold penuh',
    secondary: 'listing NFT itu 20% di atas harga beli selama 7 hari lalu batalkan listing bila tidak terjual',
    deepening: 'beli NFT kedua dari koleksi berbeda setelah 14 hari dan catat selisih harga floor keduanya',
  },
  'Onchain Capital Allocator': {
    primary: 'deposit ke vault allocator utama dan catat strategi alokasi yang dipilih vault itu',
    secondary: 'deposit ke vault kedua dengan strategi alokasi berbeda dan bandingkan hasilnya setelah 7 hari',
    deepening: 'pindahkan 30% dana ke vault dengan hasil 7 hari terbaik dan simpan perbandingan APY di farm log',
  },
  'Risk Curators': {
    primary: 'deposit ke vault kurasi risiko utama dengan limit risiko yang tertera di halaman vault',
    secondary: 'deposit ke vault kurasi kedua dengan profil risiko berbeda dan catat selisih APY-nya',
    deepening: 'tarik 25% dari vault pertama setelah 14 hari lalu deposit ulang ke vault kedua bila APY-nya lebih tinggi 1 poin',
  },
  'Canonical Bridge': {
    primary: 'bridge aset lewat bridge kanonikal ke chain tujuan dan pakai aset itu di satu aplikasi di sana',
    secondary: 'bridge kembali setengah aset ke chain asal dalam 72 jam sebagai round trip',
    deepening: 'ulangi bridge dengan aset kedua dan catat biaya gas serta waktu konfirmasi tiap leg',
  },
};

const FALLBACK_PLAY: CategoryPlay = {
  primary: 'gunakan fungsi utama protokol (deposit atau swap pertama) dengan 50% dari modal dalam satu sesi',
  secondary: 'gunakan fungsi kedua protokol yang berbeda jenisnya supaya wallet tercatat di dua sisi penggunaan',
  deepening: 'ulangi fungsi utama dengan 25% modal tambahan setelah 14 hari dan catat hasilnya di farm log',
};

function playFor(category: string | null): CategoryPlay {
  if (category && PLAYS[category]) return PLAYS[category]!;
  return FALLBACK_PLAY;
}

export interface FarmInput {
  protocol: Protocol;
  feat: ValueFeatures;
  oddsPct: number;
  oddsBand: 'Rendah' | 'Sedang' | 'Tinggi';
  fittedRatio: number;
}

export function farmPlan(input: FarmInput): string[] {
  const p = input.protocol;
  const chains = p.chains.length > 0 ? p.chains : ['Ethereum'];
  const mainChain = chains[0]!;
  const nChains = chains.length;
  const capital = capitalUsd(p.tvl_usd);
  const hold = holdDays(input.feat.ageDays);
  const weeks = Math.max(2, Math.round(hold / 7));
  const play = playFor(p.category);
  const catName = p.category ?? 'tanpa kategori tercatat';
  const tvlStr = fmtUsd(p.tvl_usd);
  const ageStr = input.feat.ageDays === null ? 'umur tidak tercatat di snapshot' : `berumur ${input.feat.ageDays} hari`;
  const steps: string[] = [
    `Siapkan wallet fresh khusus farming ${p.name} (seed ditulis di kertas dan disimpan offline, jangan pernah difoto); isi tepat ${fmtUsd(capital)} dan jangan campur dana lain; sisihkan 15 menit untuk setup sebelum transaksi pertama di ${mainChain}.`,
    `Aksi inti (${catName}, TVL ${tvlStr}, ${ageStr}): ${play.primary}; lakukan dalam 1 sesi dan simpan hash transaksi pertama sebagai bukti mulai farming.`,
    `Aksi kualifikasi kedua: ${play.secondary}; jeda minimal 24 jam dari aksi inti supaya wallet menunjukkan 2 hari aktivitas yang berbeda, bukan 1 sesi borongan.`,
    `Cadence mingguan: ulangi 1 aksi kualifikasi tiap minggu selama ${weeks} minggu (total ${weeks} aksi), ganti jenis aksi tiap minggu antara deposit, swap, dan borrow sesuai kategori ${catName}, dan catat tanggal tiap aksi.`,
    `Hold period: tahan posisi utama minimal ${hold} hari tanpa menarik modal; bila harga aset turun lebih dari 30% dalam 7 hari, evaluasi ulang di hari ke-${Math.min(hold, 14)} sebelum memutuskan lanjut atau keluar.`,
    `Modal: ${fmtUsd(capital)} total untuk wallet ini (TVL protokol ${tvlStr} di ${nChains} chain); jangan tambah modal di luar ${fmtUsd(capital)} sebelum hold ${hold} hari selesai, dan sisihkan ${fmtUsd(Math.max(5, capital * 0.1))} untuk gas di ${mainChain}.`,
    `Klaim dan keamanan: cek halaman points atau rewards resmi ${p.name} 1 kali seminggu; klaim hanya dari link yang diterbitkan protokol itu sendiri, jangan pernah membayar untuk klaim, dan abaikan DM atau situs yang mengaku mewakili ${p.name}.`,
    `Farm log dan exit: catat wallet, tanggal, dan hash tiap dari ${weeks + 2} transaksi di 1 file log; rencana keluar sebelum menarik: tarik reward dulu, lalu 50% posisi, lalu sisanya dalam 2 hari, dan jangan tarik semuanya dalam 1 transaksi.`,
  ];
  // Step 9: protocol-specific. Low odds gets the re-evaluation rule;
  // otherwise the category deepening action.
  if (input.oddsBand === 'Rendah') {
    steps.push(
      `Sinyal launch lemah (token odds ${input.oddsPct.toFixed(1)}%, band Rendah): rencana ini berasumsi token launch; bila tidak ada sinyal launch dalam 90 hari, evaluasi ulang dan jangan tambah modal di atas ${fmtUsd(capital)}.`,
    );
  } else {
    steps.push(
      `Pendalaman (${catName}): ${play.deepening}; targetkan 3 bukti aktivitas tambahan dalam ${hold} hari supaya wallet tercatat sebagai pengguna berulang, bukan sekali pakai.`,
    );
  }
  return steps;
}
