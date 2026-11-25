# VALIDATION.md — decision log + bukti run (SPEC §3.5 butir 3)

Semua angka di bawah ini berasal dari run nyata program atas snapshot kit
(`~/workspace/makefun/token-radar-01/kit/input/snapshot.json`, as_of
2026-11-14, 758 protokol), bukan dari ingatan. File `validation.json` di
output program memuat angka yang sama, dari struktur data yang sama dengan
yang di-render dashboard.

## 1. Snapshot yang diverifikasi

- 758 protokol, 40 watchlist, 128 fit set (mcap > 0 dan TVL > 0),
  342 pre-token, listed_at 645/758, change_7d 754/758, 55 kategori.
- Angka-angka ini dihitung ulang dari file oleh program di setiap run
  (bukan hardcode) dan cocok dengan §2.2 spec.

## 2. Decision table — value model (seleksi §3.2)

Baseline: T1 log TVL saja. H1 test n=40, H2 test n=2 (lihat DECISIONS.md
butir 1 — H2 tipis karena definisi spec), walk-forward 3 fold valid
(train 64/75/77, test 31/20/18). Ambang KEEP: gain median ≥ 0,02 di H1
DAN H2, within-2x turun ≤ 2 poin, memburuk > 0,02 di maksimal 1 fold.

| Term | H1 gain | H1 within-2x | H2 gain | WF (fold 1/2/3) | Keputusan |
|---|---|---|---|---|---|
| x2 log TVL² | +0,055 | −2,5 poin | −0,059 | +0,163 / +0,123 / +0,109 | DROP — gagal K1 (within-2x) dan K2 |
| x3 growth | −0,117 | 0 | +0,132 | −0,020 / +0,023 / +0,054 | DROP — gagal K1 |
| x4 log age | −0,046 | 0 | −0,002 | −1,029 / +0,170 / +0,267 | DROP — gagal K1 |
| x5 log chains | −0,033 | −2,5 | +0,105 | −0,089 / +0,014 / −0,039 | DROP — gagal K1 |
| x6 log TVL/chain | −0,046 | −2,5 | +0,068 | −0,065 / +0,007 / −0,046 | DROP — gagal K1 |
| x7 growth×TVL | −0,054 | 0 | +0,203 | −0,228 / +0,091 / +0,059 | DROP — gagal K1 |
| x8 age×growth | −0,001 | 0 | −0,003 | −0,369 / −0,578 / −0,458 | DROP — gagal K1 |
| x10 recency <180d | +0,005 | +2,5 | +0,001 | 0 / 0 / 0 | DROP — gagal K1 (gain < 0,02) |
| T9 kategori K=5 | +0,095 | −5,0 | +0,163 | 0 / −0,272 / −0,141 | DROP — gagal K1 (within-2x) |
| T9 kategori K=10 | −0,054 | 0 | +0,125 | 0 / −0,247 / −0,160 | DROP — gagal K1 |
| T9 kategori K=20 | −0,060 | 0 | +0,085 | 0 / −0,223 / −0,163 | DROP — gagal K1 |
| T9 kategori K=40 | −0,033 | 0 | +0,052 | 0 / −0,140 / −0,105 | DROP — gagal K1 |

**Hasil (§3.2.5): tidak ada term tambahan yang lolos. Model final = baseline
T1 saja**: `log(mcap/TVL) = 6,965 + −0,478 · log(TVL)`, residual std 2,077.
Median log error held-out final = baseline: H1 1,273, H2 2,968.
Walk-forward final vs baseline: 0 dari 3 fold dimenangkan (identik dengan
baseline, sesuai harapan — tidak ada term yang ditambahkan).
Dashboard cover menyatakan ini secara eksplisit; tidak ada ambang yang
dilonggarkan supaya ada yang lolos.

Catatan kejujuran: x2 adalah satu-satunya term yang dekat (gain H1 +0,055
dan memperbaiki ketiga fold walk-forward), tapi ia gagal di dua tempat
independen — within-2x H1 turun 2,5 poin dan H2 memburuk −0,059 — jadi
DROP mengikuti aturan, bukan mengikuti harapan.

## 3. Decision table — token-odds model (seleksi §3.3.2)

Baseline: logistik log-TVL saja (AUC H1 0,565, Brier 0,248; AUC H2 0,606,
Brier 0,246). H1 test n=244, H2 test n=56. Ambang KEEP: AUC +≥ 0,02 di
H1 DAN H2, Brier memburuk ≤ 0,01, tidak ada penurunan AUC > 0,02 di 2+
fold walk-forward.

| Fitur | H1 AUC gain | H1 Brier | H2 AUC gain | H2 Brier | WF AUC gain | Keputusan |
|---|---|---|---|---|---|---|
| x2 log TVL² | +0,008 | +0,002 | 0,000 | 0,000 | 0 / 0 / 0 | DROP |
| x3 growth | −0,004 | +0,001 | −0,099 | +0,002 | +0,077 / +0,118 / +0,131 | DROP |
| x4 log age | **+0,110** | −0,015 | **+0,026** | −0,004 | +0,133 / +0,152 / +0,162 | **KEEP** |
| x5 log chains | −0,027 | +0,002 | +0,013 | −0,001 | +0,017 / +0,004 / −0,004 | DROP |
| x6 log TVL/chain | −0,028 | +0,002 | +0,013 | −0,001 | +0,016 / +0,012 / +0,008 | DROP |
| T9 kategori K=5 | **+0,080** | −0,016 | **+0,049** | −0,017 | +0,197 / +0,288 / +0,298 | **KEEP (K=5)** |
| T9 kategori K=10/20/40 | +0,083/+0,085/+0,087 | −0,018/−0,019/−0,020 | +0,050/+0,047/+0,049 | −0,016/−0,015/−0,014 | lolos semua | tidak dipakai (K=5 terkecil yang lolos) |

**Hasil: odds final = log TVL + log age + efek kategori (K=5).**
Kalibrasi held-out 5 band (prediksi vs aktual bertoken): tidak ada band
yang selisihnya > 15 poin pada KEDUA test, jadi tidak ada peringatan
kalibrasi. Band terburuk: 0–20% H2 selisih −15,0 poin (H1 −8,3).
Median odds board 45,8%; 87 baris High, 73 Sedang, 40 Rendah; 3 baris
dengan implied value ≥ 50% baris teratas tapi odds Rendah.

## 4. Board

- 200 baris (40 watchlist + 160 early), rank 1–200 berurutan, implied
  value menurun, semua berbeda. Implied value $4.035.115 – $90.185.322.
- Rank 1: sentora-curator $90.185.322, odds 12,4% Rendah. Rank 2:
  steakhouse-financial $90.123.744. Watchlist tertinggi: rank 2.
- Setiap baris 9 farm steps, tiap langkah 20–600 karakter (diperiksa
  program sebelum menulis output; run gagal bila ada yang melanggar).
- Live-token view: 24 baris teratas berdasarkan market cap, kategori
  bukan CEX, terpisah dari board.

## 5. Determinisme (§5) — run nyata, 25 Nov 2026

- Dua run atas snapshot yang sama ke direktori berbeda: **byte-identik**
  (`diff -r` kosong) untuk board.json, data.js, validation.json dan
  dossier.json.
  - board.json sha256 `a0472614e27360b3ad4c7c3e7bdfe4f9541f40b3be8d642fd687d9ba241749b4`
  - data.js sha256 `1c22a8d59590ace62cf159928bf9c9a05b86c5b87012889befffeeaaa38a65b1`
  - validation.json sha256 `eae17ce9bffe29f0100728f1f74bfe21aa921fd5c166144a3e2191ea70ccd3d7`
  - dossier.json sha256 `27fd0bb165b8000f32118391fbb85c279beccc6d39fa134191623ef766faf6c9`
- Uji shuffle (array protocols diacak, seed 42, di luar repo): output
  **byte-identik** dengan run atas snapshot asli.
- Tidak ada timestamp/waktu-jalan di output yang dinilai; satu-satunya
  tanggal adalah as_of/source dari snapshot. Semua file output mode 0644,
  folder 0755 (program mengeset umask 022 + chmod eksplisit).

## 6. Gate check lokal (§6.5, script di luar repo)

Semua PASS atas output run final: 200 baris, slug unik, watchlist 40/40,
rank berurutan, implied menurun dan berbeda, implied integer dalam
rentang, farm steps 9 × 20–600 karakter, dossier 686.071 byte (≤ 1,5 MiB),
teks dossier 23.636 byte (≤ 65.536 — dashboard source utuh), dashboard
23.371 byte (≤ 4 MiB, 3 file), 4 screenshot JPEG 1440×900, masing-masing
74–164 KiB (≤ 512 KiB), tidak ada URL http(s) di atribut HTML / CSS /
import JS dashboard. Kit `check` (node cli/makefun.mjs check) BELUM
dijalankan — diserahkan ke koordinator.

## 7. Yang kurang / belum diverifikasi

- Kit check belum dijalankan (lihat §6).
- Submit BUKAN bagian tugas ini; quota saat cek terakhir: day 5/5,
  hard 36/40 — tidak dipakai.
- H2 value test n=2 (DECISIONS.md butir 1): K2 diputuskan 2 protokol.
  Itu definisi spec, bukan bug — tapi artinya seleksi value praktis
  diputuskan H1 + walk-forward.
