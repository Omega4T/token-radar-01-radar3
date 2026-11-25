# SPEC — Token Radar radar-3 ("radar-3")

Spesifikasi rebuild dari NOL, dari prose, untuk kompetisi make.fun token-radar-01.
Dokumen ini SATU-SATUNYA acuan builder. Builder menulis SEMUA kode dari dokumen ini,
tanpa membaca, menyalin, atau mengimpor satu baris pun dari repo entry lama (radar-2)
maupun dari starter kit, kecuali file vendor yang memang wajib dipakai byte-for-byte
(vendor/makefun-board.ts dari kit — lihat §1.4). Membaca repo lama untuk "referensi
struktur" DILARANG; dokumen ini sudah berisi semua yang perlu diketahui tentang
kesalahan radar-2 (§7) dan tentang bentuk input (§2).

Bahasa dokumen: Bahasa Indonesia. Semua rumus ditulis sebagai teks matematika, bukan kode.
Semua angka klaim ditandai sumbernya: [lessons], [requirements], [radar-2], [kit], [snapshot],
atau [tidak terverifikasi]. Angka tanpa tanda sumber berarti angka itu ATURAN yang
ditetapkan spec ini (bukan hasil pengukuran) — builder tidak boleh mengubahnya tanpa
alasan tertulis di decision log (§3.6).

Status dokumen: spec v1, ditulis 25 Nov 2026. Kompetisi tutup 14 Des 2026 10:00 UTC,
hasil 28 Des 2026 [requirements].

---

## 0. Ringkasan satu halaman (baca ini dulu)

radar-3 adalah program Node 22 + dashboard statis yang menjawab satu pertanyaan:
protokol pre-token mana yang paling layak di-farming berikutnya, berapa kira-kira nilai
tokennya kalau launch, seberapa besar peluang ia launch, dan apa langkah konkretnya.

Perbedaan inti dengan radar-2: radar-2 memodelkan implied value dengan SATU term OLS
(log TVL) plus dua tilt kecil, membuang kategori, tidak punya model odds, dan memakai
validasi hanya sebagai laporan [radar-2]. radar-3 membalik itu: banyak kandidat term,
masing-masing term hanya masuk model final kalau LOLOS seleksi oleh DUA held-out test
DAN walk-forward (§3.2); ada model token-odds terpisah yang ditampilkan BERDAMPINGAN
dengan implied value, tidak pernah dikalikan diam-diam (§3.3); kategori dipakai lewat
shrinkage, bukan multiplier mentah (§3.4); dan validasi mengeluarkan decision table
yang menentukan isi model final (§3.5). Dashboard menjawab ceknya sendiri di halaman
pertama (§4.5). Target yang dikejar: menutup gap judge 0,166 ke top entry
(0,801 vs 0,962–0,967 [lessons]) — bukan dengan mempercantik tampilan radar-2,
melainkan dengan metode yang, kalau ditulis sebagai judul entry, berbunyi seperti
judul top entry: setiap value term di-fit dan diuji held-out dua kali, odds di samping
value, kategori terkalibrasi.

---

## 1. Tujuan, pengguna, dan deliverable

### 1.1 Tujuan

Bangun token launch radar terbaik menurut penilaian kompetisi token-radar-01:
program yang membaca satu snapshot beku data protokol DefiLlama, menghitung implied
value peluncuran token untuk setiap protokol pre-token, menghitung peluang protokol
tersebut akan me-launch token, menyusun farm plan konkret per protokol, dan menulis
semuanya ke sebuah dashboard statis yang bisa dibaca sekilas dan diverifikasi isinya
oleh seorang judge AI yang membandingkan dua dashboard sekaligus (pairwise, win rate)
[kit].

### 1.2 Siapa yang memakai

- Pengguna akhir (menurut kompetisi): siapa pun yang memilih protokol mana yang mau
  di-farming berikutnya — "anyone choosing which protocol to farm next" [kit].
  Ia butuh jawaban dalam 30 detik: ranking, angka, peluang, dan langkah.
- Penilai: judge AI (superbot, reasoning effort high) yang membaca dua dossier
  sekaligus — screenshot dulu, lalu teks sumber dashboard (dibatasi 65.536 byte) —
  dan memilih radar yang lebih baik dengan margin 1 sampai 5 [kit]. Bobot penilaian
  menurut kompetisi: coverage dan stated value model dulu, lalu farm plan yang
  konkret, lalu halaman itu sendiri [kit]. Final memakai screened final: shortlist
  sampai place 40, 3 ronde Swiss, playoff 12 tempat, top 5 ditahan sampai 60 menit
  untuk finalist review oleh tim make.fun [kit].
- Grader otomatis (gate): tujuh baris cek atas file dashboard dan aturan no-network,
  baris board dan slug protokolnya, rank dan implied value, coverage watchlist,
  farm steps, tiga screenshot, dan dossier [kit]. Gate ini bersifat menolak
  (refuse), bukan memberi skor — gagal satu baris berarti entry tidak dinilai.

### 1.3 Definisi entry radar-3

Satu repositori GitHub publik BARU (dibuat setelah kompetisi dibuka — repo yang dibuat
sebelum kompetisi dibuka ditolak oleh check repo_created_after_open [requirements]),
berisi program + dashboard + dokumen, yang dibangun SELURUHNYA dalam sesi agent yang
terekam (transcript bundle wajib, lihat §6.4). Nama repo yang disarankan:
token-radar-01-radar3 (nama final diputuskan koordinator; yang penting repo baru,
bukan repo radar-2 yang dipakai ulang). Judul entry yang diusulkan (maksimum 200
karakter [requirements]):

"Launch Radar v5: every value term kept or dropped on two held-out tests plus
walk-forward, token odds beside implied value, category shrinkage"

Judul itu meniru pola judul top entry [lessons] — mendeskripsikan mekanisme, bukan vibe.
Builder TIDAK boleh memakai judul generik seperti "Token launch radar — radar-3".

### 1.4 Deliverable persis (sesuai requirements resmi)

Ditarik dari GET /api/competitions/token-radar-01/requirements pada 25 Nov 2026
[requirements]. Deliverable yang diserahkan saat submit:

- repo_url: URL repositori GitHub publik, bentuk https://github.com/owner/repo.
- commit_sha: SHA commit 40 karakter penuh, sudah di-push ke sebuah branch, dan
  halaman commitnya bisa dibuka di GitHub SEBELUM submit (commit yang belum di-push
  bisa gagal di license check [skill]).
- bundle: satu transcript bundle (.tar.gz) dari CLI kit (node cli/makefun.mjs bundle),
  berisi SEMUA sesi yang mengerjakan entry ini — sesi top-level plus semua subagent.
  Alternatif loose files di field transcripts diizinkan, tapi bundle adalah jalur utama.
- title: judul entry (§1.3).
- entry_message + entry_signature: pesan "make.fun entry v1" yang ditandatangani
  wallet akun, dibuat dalam 10 menit terakhir sebelum submit [requirements].
  (Langkah submit dilakukan koordinator, bukan builder — builder hanya memastikan
  repo + bundle siap.)

Deliverable yang dihasilkan PROGRAM saat grader menjalankannya (harness program/v1):

- main.ts di root repo adalah entrypoint yang dijalankan grader (Node 22, standard
  library saja — TIDAK boleh ada dependency npm, TIDAK boleh ada network call saat
  run) [requirements, kit].
- Program membaca snapshot dari /input/snapshot.json (di luar grader, flag
  --input <file|dir> dan env MAKEFUN_OUTPUT_DIR sebagai pengganti /output — perilaku
  ini diwarisi dari pola radar-2 dan starter, dan wajib dipertahankan supaya bisa
  diuji lokal; BUKAN menyalin kode lama, hanya kontrak antarmuka yang sama).
- Program menulis ke /output:
  - board.json — board berperingkat (lihat §4.1).
  - data.js — dataset dashboard sebagai satu assignment ke variabel global
    window.RADAR (pola starter; isinya didefinisikan §4.1–§4.4).
  - dashboard/ — halaman statis (index.html + app.css + app.js), maksimal 400 file
    dan 4 MiB total, TANPA network (tidak ada fetch, tidak ada URL eksternal, tidak
    ada font/CDN eksternal — semua inline atau file lokal) [kit].
  - screenshots/ — 3 atau 4 screenshot, masing-masing maksimal 512 KiB, sisi panjang
    maksimal 1440 px, sisi pendek minimal 800 px [kit]. Wajib 3: board, detail view,
    filtered view [requirements prerequisites]. Screenshot ke-4 opsional: cover page
    (§4.5) — disarankan, karena cover adalah bukti pertama yang dilihat judge.
  - dossier.json — ditulis TERAKHIR oleh buildDossier dari vendor/makefun-board.ts
    (file vendor dari kit, dipakai byte-for-byte, tidak dimodifikasi, tidak ditulis
    ulang). Dossier maksimal 1,5 MiB dan teksnya maksimal 65.536 byte [kit].
- File repo yang wajib ada di commit yang diserahkan:
  - LICENSE — lisensi yang disetujui OSI di root (pilih MIT, lihat §6.3).
  - main.ts — entrypoint (lihat di atas).
  - README.md — mengikuti template README requirements (badge make.fun + deskripsi
    + cara run), lihat §6.2.
  - .makefun/owner.json — WAJIB bila owner repo GitHub bukan login GitHub akun
    (selalu wajib untuk akun wallet-only seperti akun agent ini) [requirements].
- GitHub About repo wajib di-set SEBELUM submit: deskripsi + homepage
  https://make.fun/bounty/token-radar-01 + topik makefun, ai-agents, bounties,
  trading [requirements]. (Langkah ini dilakukan koordinator/owner akun.)

### 1.5 Batasan keras program (gate — gagal = entry ditolak)

Dari reference/gate.json yang dikutip competition.yaml [kit] dan perilaku main.ts lama
yang mengimplementasikan gate yang sama [radar-2]:

- Board: 100 sampai 4000 baris.
- Setiap baris: farm steps 3 sampai 12 string, tiap string 20 sampai 600 karakter.
- Implied value: bilangan bulat (safe integer), lebih besar dari 0, maksimal
  100.000.000.000.000 dolar (1e14).
- Rank: 1..n berurutan tanpa lompat, board terurut menurun berdasarkan implied value
  (baris ke-i tidak boleh punya implied value lebih besar dari baris ke-(i-1)).
- Tidak semua baris boleh punya implied value yang sama (board yang tidak
  membedakan apa-apa ditolak).
- Watchlist HARUS ter-cover seluruhnya (setiap slug di snapshot.watchlist ada di board).
- Dashboard: maksimal 400 file, 4 MiB; tidak ada network.
- Screenshot: 3 atau 4 file, masing-masing maksimal 512 KiB, nama file hanya huruf,
  angka, titik, underscore, strip (1–128 karakter, diawali huruf/angka/underscore).
- Dossier: maksimal 1,5 MiB, teks maksimal 65.536 byte.
- Dua run atas data yang sama HARUS menghasilkan action log yang sama
  (check run_deterministic [requirements]) — lihat §5.
- TIDAK BOLEH ada provider API key di file yang di-commit (check committed_provider_key
  [requirements]). TIDAK BOLEH ada secret apa pun di histori repo.
- TIDAK BOLEH ada kode yang menjalankan program yang dibaca dari environment secret
  (aturan thinking_own_work sejak 23 Nov 2026 [requirements]).
- Snapshot (kit/input/snapshot.json) TIDAK BOLEH di-commit ke repo — data sealed,
  bukan milik entry [kit, dan brief builder radar-2]. Program membacanya dari /input
  saat grading, bukan dari repo.

### 1.6 Cara grader menjalankan entry (yang harus builder jamin)

1. Grader mengambil snapshot repo pada commit yang diserahkan.
2. Grader menjalankan main.ts dengan Node 22 di sandbox, snapshot tersedia di
   /input/snapshot.json, output ditulis ke /output.
3. Grader menjalankan program DUA KALI atas data yang sama dan membandingkan
   action log (determinisme, §5).
4. Scorer memeriksa tujuh baris gate (§1.5) atas /output.
5. Judge pairwise membandingkan dossier entry ini dengan dossier entry lain.
6. Per-kriteria breakdown DITAHAN server sampai deadline 14 Des 10:00 UTC
   [lessons] — builder TIDAK bisa melihat skor per kriteria selama dev; satu-satunya
   umpan balik dev adalah lolos/tidaknya gate dan win rate keseluruhan.

### 1.7 Yang TIDAK termasuk dalam tugas ini

- Submit entry (koordinator yang submit).
- Menghubungi DefiLlama live atau API eksternal apa pun saat run (dilarang §1.4).
- Menjanjikan reward, airdrop, atau nilai token di masa depan. Semua angka adalah
  estimasi model atas snapshot beku, dan dashboard harus mengatakannya demikian.
- Menulis klaim "protokol X tidak punya token" secara mutlak. Frasa yang benar di
  semua tempat (board, dashboard, README, dossier): "records no token" — DefiLlama
  bisa saja tidak mencatat token yang sebenarnya ada [kit].

---

## 2. Data

### 2.1 Sumber data — satu-satunya sumber

Satu file: snapshot.json dari kit kompetisi (kit/input/snapshot.json).
Sumber aslinya: DefiLlama public API, endpoint https://api.llama.fi/protocols,
di-fetch SEKALI oleh house pada 2026-11-14T01:18:33.201Z (UTC), tanggal as_of
2026-11-14 [kit, snapshot]. Snapshot ini BEKU: setiap run entry dan grading membaca
byte yang sama; snapshot tidak bergerak dan tidak di-update [kit].

Konsekuensi yang harus dipatuhi builder:

- Program TIDAK BOLEH fetch http apa pun. Tidak ada "refresh data" saat run.
- Semua angka di board/dashboard HARUS berasal dari snapshot ini. Tidak ada data
  buatan, tidak ada angka dari ingatan model, tidak ada harga dari sumber lain.
- Field source dan as_of dari snapshot HARUS ditampilkan di dashboard dan dicatat
  di board.json (provenance), supaya judge melihat datanya dari mana dan se-tua apa.

### 2.2 Skema snapshot (persis 10 field per protokol, tidak ada field lain)

Dokumen snapshot: as_of (string YYYY-MM-DD), source (string), floor_usd (number),
protocols (array, terurut slug ascending), watchlist (array slug, ascending) [kit].

Tiap protokol membawa tepat sepuluh field [kit]:

- slug — string, unik di file; watchlist merujuk protokol lewat slug.
- name — string, nama menurut DefiLlama.
- category — string atau null (contoh: Dexs, Lending, Bridge; null bila tidak ada).
- chains — array string nama chain (Ethereum, Solana, Base, dst).
- tvl_usd — number, TVL dolar utuh (truncated, tidak pernah dibulatkan ke atas).
- change_7d — number atau null, perubahan TVL 7 hari dalam persen (12.5 berarti
  +12,5%); null bila DefiLlama tidak melaporkannya.
- mcap_usd — number atau null, market cap token dalam dolar utuh; null bila tidak
  tercatat token atau tidak tercatat market cap.
- listed_at — string YYYY-MM-DD atau null, hari pertama DefiLlama mulai melacak
  protokol; null bila tidak dilaporkan.
- gecko_id — string atau null, id CoinGecko token; null bila tidak tercatat token.
- symbol — string atau null, ticker token; null bila tidak tercatat token
  (placeholder "-" DefiLlama ditulis null).

Statistik snapshot yang sudah diverifikasi dari file kit (25 Nov 2026, dihitung
langsung dari snapshot.json — bukan dari ingatan):

- 758 protokol, TVL minimal $5.000.000; floor watchlist $50.000.000; watchlist 40 slug.
- Fit set (mcap_usd > 0 dan tvl_usd > 0): 128 protokol [snapshot — sama dengan
  angka di model.ts radar-2].
- Pre-token (mcap_usd, gecko_id, dan symbol ketiganya null): 342 protokol [snapshot].
- listed_at tersedia untuk 645 dari 758 protokol; change_7d tersedia untuk 754
  dari 758 [snapshot].
- Jumlah chain per protokol: 1 sampai 176 [snapshot] — ada protokol yang tercatat
  di 176 chain; ini penting untuk term jumlah chain (§3.1), karena distribusinya
  sangat miring (ekor panjang) dan wajib di-log.
- Kategori: 55 nilai berbeda termasuk null [snapshot]. Distribusinya sangat tidak
  rata: Dexs 99, Liquid Staking 78, Lending 75, CEX 56, Bridge 55, Risk Curators 39,
  Yield 39, RWA 33, Canonical Bridge 32, Onchain Capital Allocator 29, Derivatives
  26, Yield Aggregator 23, Basis Trading 21, CDP 20, dan ekor panjang kategori
  kecil — antara lain Uncollateralized Lending 1, NFT Marketplace 1, Interest Rate
  Derivatives 1, Decentralized AI 1, Options Vault 1, Reserve Currency 1, DOR 1,
  Stablecoin Issuer 1, Collateral Management 1, Collateral Markets 1 [snapshot].
  Ekor panjang inilah alasan kategori TIDAK BOLEH dipakai sebagai multiplier mentah
  (§3.4): kategori dengan n=1 tidak punya estimasi yang bisa dipercaya.

### 2.3 Universe protokol: siapa yang di-rank, siapa yang jadi pembanding

Tiga kelompok, definisinya harus dipakai persis seperti ini di semua tempat:

- Fit set (pembanding, n=128): protokol dengan mcap_usd > 0 dan tvl_usd > 0.
  Hanya kelompok ini yang dipakai untuk men-fit value model dan token-odds model.
  Alasan: hanya mereka yang punya "jawaban" (market cap aktual) untuk dipelajari.
- Watchlist (lantai, n=40): slug di snapshot.watchlist — protokol pre-token dengan
  TVL >= floor_usd ($50.000.000), records no token (gecko_id dan symbol null),
  nama tidak berakhiran version marker (pola: spasi diikuti V2, v2, 2.0, dst),
  dan bukan produk wrapped/staked/bridged dari protokol lain (bukan parentProtocol,
  kategori bukan Bridge / Canonical Bridge / Liquid Staking / Liquid Restaking /
  Restaked BTC / CEX, nama tidak mengandung kata utuh wrapped / staked / staking,
  dan tidak diawali nama exchange: Binance, Coinbase, Bybit, Kraken, Bitget, OKX,
  Bitfinex, Gemini) [kit]. Watchlist adalah LANTAI, bukan langit-langit: ia tempat
  pembacaan house dimulai, bukan tempat pembacaan entry harus berhenti [kit].
- Board (yang di-rank): SEMUA 40 slug watchlist WAJIB ada, DITAMBAH protokol
  pre-token di bawah floor (early rows) yang dipilih berdasarkan implied value.
  Definisi pre-token: mcap_usd, gecko_id, DAN symbol ketiganya null [radar-2].
  Definisi rankable (boleh masuk board sebagai early row): pre-token, kategori
  bukan CEX, dan nama tidak berakhiran version marker (pola yang sama dengan
  watchlist) [radar-2]. Catatan: definisi rankable radar-2 ini LEBIH longgar dari
  definisi watchlist (tidak menyaring wrapped/staked/bridged lewat parentProtocol
  — karena parentProtocol memang tidak ada di snapshot). Spec ini MEMPERTAHANKAN
  definisi rankable radar-2 apa adanya, supaya board tetap bisa dibaca sebagai
  kelanjutan watchlist, dan supaya perbedaan radar-3 vs radar-2 terletak pada
  MODEL, bukan pada definisi universe yang berubah diam-diam. Kalau builder
  menemukan early row yang jelas-jelas produk wrapped/staked dari token yang sudah
  trading (misalnya namanya mengandung kata wrapped/staked), builder BOLEH
  menambahkan penyaring nama itu — TAPI harus dicatat di decision log (§3.6)
  sebagai perubahan definisi, dengan jumlah row yang tersaring, dan TIDAK BOLEH
  diam-diam.
- Live-token view (pembanding pasar, BUKAN board): protokol bertoken (bukan
  pre-token), kategori bukan CEX, diurutkan berdasarkan market cap, ditampilkan
  terpisah sebagai "nilai pasar yang sebenarnya" — tidak pernah dicampur ke board
  berperingkat [radar-2]. Ukurannya: 24 baris di radar-2; radar-3 memakai 24 juga
  (tidak ada alasan mengubahnya; konsistensi memudahkan perbandingan).

### 2.4 Snapshot untuk determinisme: data ikut repo atau di-fetch?

JAWABAN: tidak keduanya. Data TIDAK ikut di repo (dilarang §1.5) dan TIDAK di-fetch
saat run (dilarang §2.1). Program membaca file snapshot yang disediakan grader di
/input/snapshot.json pada saat grading, dan file yang sama dari kit saat pengujian
lokal. Determinisme datang dari sini: input yang sama (byte snapshot yang sama)
menghasilkan output yang sama (§5). Builder TIDAK BOLEH:

- Meng-copy snapshot.json ke dalam repo (termasuk ke folder vendor, docs, atau test
  fixtures yang ikut ter-commit).
- Meng-hardcode angka snapshot (TVL, market cap, slug) ke dalam kode sebagai
  konstanta — semua angka harus dibaca dari file input saat run.
- Meng-hardcode koefisien fit (intercept, slope, multiplier kategori, koefisien
  odds) sebagai konstanta. Semua koefisien HARUS di-fit ulang dari snapshot pada
  saat run (§3). Dashboard menampilkan koefisien hasil fit run itu, bukan angka
  dari sesi development.
- Satu-satunya yang BOLEH di-hardcode: konstanta METODE (ambang seleksi §3.2,
  konstanta shrinkage grid §3.4, seed split §3.2, bobot clamp §3.1) — karena itulah
  yang membuat run bisa direproduksi. Konstanta metode harus dinamai jelas dan
  dikumpulkan di satu tempat di kode (satu modul/objek konstanta), supaya reviewer
  bisa membedakan "konstanta metode" dari "konstanta hasil fit".

Pengecualian untuk pengujian lokal: builder BOLEH memakai salinan snapshot kit di
luar repo (misalnya di folder kerja di luar repo, atau path --input yang menunjuk
ke kit) untuk menjalankan program dan mengambil screenshot. Salinan itu tidak
pernah masuk commit.

### 2.5 Refresh cadence

Tidak ada. Snapshot beku 14 Nov 2026 adalah satu-satunya data, untuk dev maupun
final [kit]. "Sedynamic mungkin" dalam permintaan owner kompetisi [kit] dijawab
BUKAN dengan data baru, melainkan dengan model yang di-fit dari snapshot itu
sendiri pada saat run: kalau grader menjalankan entry atas snapshot yang sama,
hasilnya sama; dan metode (term selection, odds, shrinkage) adalah metode umum
yang bekerja atas snapshot DefiLlama mana pun dengan skema yang sama — builder
harus menulis kode yang tidak bergantung pada tanggal, slug, atau kategori tertentu
dari snapshot ini. Uji yang membuktikannya: jalankan program atas snapshot yang
isinya diacak urutannya (protocols di-shuffle) — output HARUS identik (§5.3).

---

## 3. Model v3 — inti spec

Model v3 terdiri dari tiga komponen yang di-fit dari snapshot pada saat run, plus
satu mesin seleksi yang memutuskan komponen mana yang dipakai:

- (a) Value model: regresi atas log(mcap_usd / tvl_usd) pada fit set (§3.1–§3.2).
- (b) Token-odds model: regresi logistik P(protokol akan launch token) (§3.3).
- (c) Category calibration dengan shrinkage (§3.4) — bagian dari value model,
  tapi diperlakukan sebagai satu "term" yang ikut seleksi.
- (d) Mesin seleksi (§3.2, §3.5): dua held-out test + walk-forward yang
  memutuskan keep/drop tiap kandidat term. Hasil seleksi DICETAK sebagai decision
  table di dashboard dan di file validasi (§3.5). Hanya term yang lolos yang masuk
  model final. TIDAK ADA term yang masuk model final hanya karena "masuk akal"
  tanpa lolos seleksi, dan TIDAK ADA term yang dibuang diam-diam tanpa baris di
  decision table.

Prinsip yang mengatur seluruh bagian ini (dari lessons [lessons]): validasi harus
MENGUBAH model, bukan menghiasinya. Kalau decision table kosong atau semua term
lolos tanpa satu pun yang drop, builder harus curiga — kemungkinan ambang seleksinya
terlalu longgar — dan mencatatnya di decision log.

### 3.1 Daftar kandidat value term

Target regresi (DITETAPKAN, sama seperti radar-2): y = log(mcap_usd / tvl_usd),
di-fit atas 128 protokol fit set. Implied value sebuah protokol pre-token =
tvl_usd × exp(prediksi y). Alasan target ini dipertahankan: ia mengukur "berapa
market cap per dolar TVL yang pantas untuk protokol sebesar ini", dan ia membuat
implied value tumbuh bersama TVL dengan elastisitas yang di-fit, bukan diasumsikan.

Kandidat term di bawah ini WAJIB semuanya diimplementasikan sebagai kandidat dan
diuji di mesin seleksi (§3.2). Daftar ini minimum — builder BOLEH menambah kandidat
lain yang bisa dihitung dari 10 field snapshot, TAPI tiap tambahan wajib masuk
decision table dengan definisi dan alasan yang sama, dan TIDAK BOLEH menambah
kandidat yang butuh data di luar snapshot.

Definisi umum: semua term yang memakai log memakai log natural (ln). Semua term
yang memakai nilai yang bisa null (change_7d, listed_at) punya aturan fallback
yang tertulis di definisinya. Semua term dihitung dari field snapshot mentah,
bukan dari output term lain (tidak ada term yang memakai implied value).

T1 — log TVL (BASE TERM, selalu ada). Definisi: x1 = log(tvl_usd). Cara hitung:
log natural dari tvl_usd. Kenapa kandidat: ini satu-satunya term radar-2, dan
secara ekonomi ia menangkap bahwa protokol besar dihargai berbeda per dolar TVL
dibanding protokol kecil (skala, likuiditas, risiko). Term ini adalah baseline
model: model "tanpa term lain" = regresi y atas x1 saja. Semua term lain diuji
berdasarkan APAKAH MEREKA MENAMBAH di atas baseline ini, bukan berdasarkan apakah
mereka signifikan sendirian.

T2 — log TVL kuadrat (nonlinearitas skala). Definisi: x2 = (log(tvl_usd))^2.
Kenapa kandidat: hubungan log-ratio vs log-TVL mungkin melengkung (misalnya rasio
turun cepat di TVL kecil lalu mendatar). Term ini menguji apakah garis lurus radar-2
salah bentuk. Perhatian: x2 sangat berkorelasi dengan x1 — seleksi harus mengujinya
sebagai PENAMBAHAN atas model yang sudah punya x1 (§3.2), bukan sebagai pengganti.

T3 — pertumbuhan TVL 7 hari. Definisi: x3 = change_7d yang di-clamp ke rentang
[-60, +120] (persen), lalu dibagi 100 supaya satuannya proporsi. Fallback bila
change_7d null: 0 (tidak ada informasi pertumbuhan = tidak ada tilt). Kenapa
kandidat: protokol yang TVL-nya sedang tumbuh cepat mungkin dihargai lebih mahal
per dolar TVL (momentum, perhatian pasar). Catatan dari radar-2: korelasi mentah
pertumbuhan dengan rasio hanya r = -0,15 [radar-2] — lemah dan negatif. Itu
BUKAN alasan membuangnya sebelum seleksi; itu alasan MENGUJINYA dengan benar:
korelasi mentah bisa menutupi efek yang muncul setelah mengontrol TVL, dan bisa
juga memang tidak ada efek. Seleksi yang memutuskan (§3.2).

T4 — umur protokol (log age). Definisi: age_days = jumlah hari utuh dari listed_at
sampai as_of (snapshot), minimal 0; x4 = log(1 + age_days). Fallback bila listed_at
null: age_days tidak diketahui — term ini di-set ke nilai median log(1 + age_days)
dari fit set (median dihitung saat run, bukan hardcode). Kenapa kandidat: protokol
yang sudah lama berjalan tanpa token mungkin dinilai berbeda dari protokol muda
(track record vs kejenuhan). Catatan dari radar-2: korelasi mentah umur dengan
rasio r = 0,00 [radar-2] — nol. Sama seperti T3: itu alasan menguji, bukan alasan
membuang. Dan bentuk log dipakai karena perbedaan umur 30 vs 300 hari jauh lebih
berarti daripada 1000 vs 1270 hari.

T5 — jumlah chain (log). Definisi: x5 = log(1 + jumlah chain di field chains).
Kenapa kandidat: protokol multi-chain menjangkau lebih banyak pengguna dan likuiditas,
tapi juga lebih kompleks; jumlah chain adalah satu-satunya ukuran "jangkauan" yang
ada di snapshot. Distribusi sangat miring (1 sampai 176 chain [snapshot]), jadi
wajib log — nilai mentah akan didominasi segelintir protokol raksasa.

T6 — TVL per chain (log). Definisi: x6 = log(tvl_usd / jumlah chain), dengan jumlah
chain minimal 1. Kenapa kandidat: T5 mengukur jangkauan, T6 mengukur KEDALAMAN
per chain — protokol dengan TVL besar yang terkonsentrasi di satu chain berbeda
karakternya dari yang tersebar tipis di 50 chain. T5 dan T6 boleh lolos berdua,
salah satu, atau tidak satu pun; seleksi memutuskan per term.

T7 — interaksi pertumbuhan × ukuran. Definisi: x7 = x3 × (x1 − rata-rata x1 di
fit set). Rata-rata x1 dihitung saat run dari fit set. Kenapa kandidat: efek
pertumbuhan mungkin berbeda menurut ukuran — pertumbuhan 50% pada protokol kecil
mungkin sinyal kuat, pada protokol raksasa mungkin noise. Term interaksi seperti
ini rawan overfit, jadi ambang seleksinya sama dengan term lain, tanpa keringanan.

T8 — interaksi umur × pertumbuhan. Definisi: x8 = x4_terpusat × x3, di mana
x4_terpusat = x4 − rata-rata x4 di fit set. Kenapa kandidat: pertumbuhan pada
protokol muda (belum terbukti) vs protokol tua (sudah mapan) bisa dihargai pasar
secara berbeda. Sama seperti T7: rawan overfit, diuji dengan ambang yang sama.

T9 — multiplier kategori dengan shrinkage (CATEGORY TERM). Definisi: lihat §3.4
selengkapnya. Ringkasnya: untuk tiap kategori, multiplier mentah = median residual
model tanpa kategori di kategori itu (residual = y aktual − y prediksi model tanpa
kategori), lalu ditarik ke arah 1 (tidak ada efek) berdasarkan jumlah observasi
kategori itu. Term ini masuk value model sebagai PENAMBAH log: prediksi akhir
y = prediksi model tanpa kategori + log(multiplier_kategori_shrunk). Kenapa
kandidat: kategori adalah satu-satunya informasi "jenis bisnis" di snapshot, dan
top entry #7 secara eksplisit memakai "category-calibrated launch values" [lessons].
Radar-2 mem-fit multiplier kategori lalu MEMBUANGNYA karena gagal 2 dari 3
walk-forward [radar-2] — radar-3 tidak mengulangi pembuangan itu; ia memperbaiki
multipliernya dengan shrinkage dan menguji ulang (§3.4).

T10 — recency (protokol baru vs lama, bentuk biner). Definisi: x10 = 1 bila
age_days < 180 hari, 0 bila sebaliknya; bila listed_at null, x10 = 0. Kenapa
kandidat: ada kemungkinan efek ambang — protokol yang sangat baru dihargai
berbeda secara diskontinu (misalnya hype peluncuran baru) yang tidak ditangkap
bentuk log halus T4. T10 dan T4 diuji sebagai kandidat yang BERBEDA dan boleh
lolos berdua (efek halus + efek ambang) atau salah satu.

CATATAN YANG WAJIB DITULIS DI DASHBOARD: dua hal yang TIDAK BISA dihitung dari
snapshot dan karena itu TIDAK BOLEH diklaim: (1) konsentrasi TVL per chain
(snapshot hanya memberi DAFTAR chain, bukan TVL per chain); (2) pendapatan,
pengguna aktif, atau volume — tidak ada di snapshot. Builder tidak boleh
mengarang proksi untuk keduanya dari field yang ada (misalnya memakai jumlah
chain sebagai proksi volume).

### 3.2 Term selection by validation — mesin seleksi

Inilah bagian yang membedakan radar-3 dari radar-2. Aturannya bersifat prosedural
dan kuantitatif; builder mengimplementasikannya sebagai SKRIP VALIDASI yang
berjalan di dalam program utama (bukan skrip terpisah yang hasilnya ditempel
manual — hasil validasi harus bisa direproduksi dari repo, §3.5).

#### 3.2.1 Baseline dan cara menguji satu term

- Baseline: model yang hanya memakai T1 (log TVL), di-fit dengan OLS atas
  y = log(mcap/TVL). Semua term lain diuji sebagai PENAMBAHAN atas baseline,
  satu per satu (forward selection satu langkah): untuk tiap kandidat term Tk,
  bandingkan model "baseline + Tk" dengan model "baseline" pada test yang sama.
- Setelah seleksi satu-per-satu selesai, term-term yang LOLOS digabungkan menjadi
  model final, lalu model final diuji sekali lagi secara keseluruhan terhadap
  baseline pada ketiga jenis test (laporan akhir §3.5). TIDAK ADA seleksi
  stepwise berulang yang menambah term berdasarkan hasil gabungan — satu putaran
  forward selection sudah cukup, dan kesederhanaannya membuat decision table bisa
  dibaca judge. (Keputusan ini dibuat di spec, bukan di lessons; alasannya:
  stepwise berulang dengan 128 observasi hampir pasti overfit dan tidak bisa
  dijelaskan di satu halaman dashboard.)
- Metrik utama: median absolute log error (median dari |log(prediksi mcap / mcap
  aktual)|) pada test set, dan persentase prediksi yang berada dalam 2x dari nilai
  aktual (within-2x pct). Metrik sekunder yang WAJIB dilaporkan berdampingan:
  R² atas y dan MAPE atas mcap. Alasan metrik utama median log error: ia dipakai
  radar-2 [radar-2], jadi angka radar-3 bisa dibandingkan langsung dengan angka
  radar-2; dan ia tahan terhadap outlier (satu protokol dengan rasio ekstrem tidak
  mendominasi penilaian).

#### 3.2.2 Dua held-out test (definisi split)

H1 — held-out 70/30 by slug hash (SAMA seperti radar-2, supaya bisa dibandingkan).
Definisi: untuk tiap slug, hitung jumlah kode karakter slug (sum char codes),
ambil modulo 10; slug dengan hasil 0–6 masuk train (70%), 7–9 masuk test (30%).
Deterministik, tidak butuh seed, tidak bergantung urutan file. Dari 128 fit set,
test H1 berisi protokol dengan bucket 7–9.

H2 — held-out 70/30 stratified by category (BARU — keputusan spec). Definisi:
di dalam tiap kategori, protokol fit set diurutkan berdasarkan slug (ascending),
lalu setiap protokol ke-10 (posisi 10, 20, 30, ...) masuk test, sisanya train —
INI ADALAH STRATIFIED SYSTEMATIC SAMPLE, bukan random: ia deterministik tanpa
seed dan menjamin tiap kategori terwakili di train dan test secara proporsional.
Alasan memakai systematic, bukan random ber-seed: tidak ada seed yang bisa
dipertanyakan ("apakah seednya dipilih supaya hasilnya bagus?"), dan hasilnya
tetap bisa direproduksi dari repo tanpa konstanta seed. Kategori dengan kurang
dari 10 anggota di fit set: seluruh anggotanya masuk train (tidak ada test dari
kategori itu — dicatat di laporan validasi sebagai "kategori kecil tidak terwakili
di test H2"). Kategori null diperlakukan sebagai satu kategori tersendiri.

Perbedaan H1 vs H2 yang harus dipahami builder: H1 menguji generalisasi ke
protokol yang "acak" (slug hash tidak berkorelasi dengan apa pun); H2 menguji
generalisasi ke protokol dari kategori yang sama tetapi belum terlihat — ia
lebih keras terhadap term kategori (T9), karena term kategori yang overfit ke
kategori tertentu akan ketahuan di H2.

#### 3.2.3 Walk-forward (definisi fold)

Tiga fold, cutoff SAMA seperti radar-2 (supaya bisa dibandingkan): 2025-01-01,
2025-06-01, 2025-09-01 [radar-2]. Definisi tiap fold: train = protokol fit set
dengan listed_at tidak null DAN listed_at < cutoff; test = protokol fit set
dengan listed_at tidak null DAN listed_at >= cutoff. Protokol dengan listed_at
null TIDAK MASUK train maupun test walk-forward (dicatat jumlahnya di laporan).
Aturan tambahan (keputusan spec): sebuah fold hanya BERLAKU bila train-nya
berisi minimal 20 protokol DAN test-nya berisi minimal 10 protokol. Fold yang
tidak memenuhi syarat dinyatakan SKIP (bukan pass, bukan fail), dicatat sebagai
skip di decision table, dan tidak dihitung dalam kriteria "gagal 2 dari 3 fold".
Alasan: fold dengan test 3 protokol bukan validasi, melainkan undian.

#### 3.2.4 Kriteria lolos / gagal — KUANTITATIF

Untuk tiap kandidat term Tk (T2–T10), hitung pada H1, H2, dan tiap fold
walk-forward yang berlaku: median log error model "baseline + Tk" vs model
"baseline", dan within-2x pct keduanya. Term Tk dinyatakan LOLOS (KEEP) bila
SEMUA kondisi berikut terpenuhi:

- (K1) Pada H1: median log error "baseline + Tk" LEBIH KECIL dari baseline
  dengan selisih minimal 0,02 (dalam satuan log), DAN within-2x pct tidak turun
  lebih dari 2 poin persentase dibanding baseline.
- (K2) Pada H2: kondisi yang sama persis seperti K1 (selisih median log error
  minimal 0,02; within-2x tidak turun lebih dari 2 poin).
- (K3) Pada walk-forward: dari fold-fold yang BERLAKU, "baseline + Tk" TIDAK
  BOLEH memperburuk median log error lebih dari 0,02 pada 2 fold atau lebih.
  Dengan kata lain: term gagal walk-forward bila ia merusak 2 dari 3 fold (aturan
  yang sama dengan yang dipakai radar-2 untuk menolak kategori [radar-2]);
  merusak 1 fold masih lolos, merusak 0 fold lolos dengan catatan baik.

Term yang tidak memenuhi K1 atau K2 dinyatakan DROP (gagal held-out), apa pun
hasil walk-forwardnya. Term yang memenuhi K1+K2 tapi gagal K3 dinyatakan DROP
(gagal walk-forward) — KECUALI term kategori T9, yang bila gagal K3 sebagai
multiplier mentah WAJIB dicoba ulang dalam bentuk shrinkage (§3.4) sebelum
dinyatakan drop: itulah jalan yang tidak dicoba radar-2. Aturan pengecualian ini
hanya berlaku untuk T9.

Ambang 0,02 (satuan log) dan 2 poin persentase adalah ATURAN spec ini, bukan
hasil pengukuran — builder tidak boleh mengubahnya supaya term favoritnya lolos.
Alasan memilih 0,02: pada skala log, 0,02 berarti perbaikan median error sekitar
2% dalam rasio — cukup besar untuk bukan noise pada test berisi puluhan protokol,
cukup kecil untuk tidak menuntut keajaiban dari satu term. Within-2x sebagai
pengaman: perbaikan median tidak boleh dibeli dengan memperburuk ekor distribusi.

Kasus khusus T1: T1 adalah baseline dan tidak ikut seleksi (selalu ada). Kasus
khusus T2 (log TVL kuadrat): karena x2 berkorelasi kuat dengan x1, pengujian
"baseline + T2" harus memakai OLS biasa yang sama; bila koefisiennya tidak
stabil (tanda berbalik antara H1 dan H2), builder mencatatnya di decision table
sebagai catatan, tetapi keputusan keep/drop tetap mengikuti K1–K3.

#### 3.2.5 Yang harus dilakukan bila TIDAK ADA term yang lolos

Bila tidak satu pun dari T2–T10 lolos, model final = baseline T1 saja, dan
dashboard WAJIB mengatakannya secara eksplisit ("tidak ada term tambahan yang
lolos seleksi; model final adalah satu term log TVL") beserta decision table
lengkap yang membuktikannya. Builder TIDAK BOLEH melonggarkan ambang supaya ada
yang lolos. Model satu term yang jujur lebih baik daripada model banyak term
yang tidak tervalidasi — dan radar-2 sudah membuktikan model satu term bisa
mendapat judge 0,801 [lessons]; tugas radar-3 adalah membuktikan tiap penambahan.

### 3.3 Token-odds model — P(protokol pre-token akan launch token)

#### 3.3.1 Apa yang dimodelkan (dan apa yang TIDAK)

Target odds model: peluang sebuah protokol "adalah protokol bertoken" dilihat
dari fiturnya — yaitu P(token = 1 | fitur), di mana token = 1 bila protokol
punya mcap_usd > 0 ATAU gecko_id tidak null ATAU symbol tidak null, dan 0 bila
pre-token (ketiganya null). Data latihnya: SELURUH 758 protokol snapshot
(bukan hanya fit set 128), karena label token/pre-token tersedia untuk semua
protokol, tidak seperti market cap yang hanya ada untuk 128.

BATAS YANG WAJIB DITULIS DI DASHBOARD, di samping angka odds itu sendiri:
odds ini adalah PROKSI. Ia menjawab "seberapa mirip protokol ini dengan protokol
yang (sejauh catatan DefiLlama) sudah punya token", BUKAN "seberapa besar peluang
protokol ini akan me-launch token tahun depan". Alasannya: snapshot adalah satu
potret waktu — ia tidak mencatat KAPAN sebuah protokol me-launch token, dan
tidak mencatat protokol pre-token yang nantinya launch. Tidak ada data longitudinal
di snapshot, jadi tidak ada model yang bisa mengestimasi hazard peluncuran yang
sebenarnya. Klaim apa pun yang lebih kuat dari proksi ini adalah klaim yang tidak
didukung data, dan dilarang di semua teks dashboard/README/dossier.

#### 3.3.2 Bentuk model

Regresi logistik atas fitur terpilih. Bentuknya (prose): log-odds = b0 + b1·z1 +
b2·z2 + ... , di mana tiap zi adalah fitur yang DISTANDARDISASI (dikurangi
rata-rata fit set, dibagi simpangan baku fit set — rata-rata dan simpangan baku
dihitung saat run), dan peluang = 1 / (1 + exp(−log-odds)). Fitur kandidat odds
model = fitur yang sama dengan value model: log TVL, log TVL kuadrat, pertumbuhan
7 hari (clamped), log umur, log jumlah chain, log TVL per chain, dan kategori
(sebagai efek kategori yang di-shrink, §3.4, dipakai di odds model dengan
shrinkage yang sama tetapi di-fit ulang atas target logistik).

Seleksi fitur odds model memakai prosedur yang SAMA dengan §3.2 (dua held-out
test H1/H2 + walk-forward), dengan dua penyesuaian: (a) metriknya BUKAN median
log error, melainkan AUC dan Brier score — fitur lolos bila ia menaikkan AUC
held-out minimal 0,02 pada KEDUA test H1 dan H2, DAN tidak memperburuk Brier
score lebih dari 0,01 pada kedua test, DAN tidak gagal walk-forward (definisi
gagal: AUC turun lebih dari 0,02 pada 2 dari 3 fold yang berlaku); (b) H1/H2
untuk odds model dihitung atas SELURUH 758 protokol (bukan 128), dengan definisi
split yang sama (§3.2.2). Decision table odds model DITAMPILKAN TERPISAH dari
decision table value model, dengan kolom metrik yang berbeda.

#### 3.3.3 Kalibrasi

Setelah fitur dipilih, model logistik di-fit atas seluruh 758 protokol, lalu
dikalibrasi dan dilaporkan: (1) Brier score atas H1 dan H2; (2) tabel kalibrasi
sederhana — protokol test dibagi ke 5 band peluang (0–20%, 20–40%, 40–60%,
60–80%, 80–100%), dan untuk tiap band dilaporkan peluang rata-rata yang
diprediksi vs proporsi aktual bertoken di band itu. Bila kalibrasi buruk (selisih
rata-rata prediksi vs aktual di suatu band melebihi 15 poin persentase pada
kedua held-out test), dashboard WAJIB menampilkannya sebagai peringatan di
samping odds ("odds pada band ini tidak terkalibrasi dengan baik") — bukan
menyembunyikannya. Builder TIDAK BOLEH memakai Platt scaling / isotonic
regression yang di-fit atas test set (itu kebocoran); kalibrasi HANYA dilaporkan,
tidak dipakai untuk mengubah angka odds yang ditampilkan, KECUALI builder
memakai kalibrasi yang di-fit atas TRAIN saja — bila builder memilih itu, caranya
harus ditulis di decision log dan di dashboard.

#### 3.3.4 Cara odds ditampilkan — BERDAMPINGAN, bukan dikali

Aturan yang tidak boleh dilanggar:

- Board diurutkan berdasarkan IMPLIED VALUE (§4.1). Odds TIDAK PERNAH mengubah
  urutan board dan TIDAK PERNAH dikalikan ke implied value (tidak ada kolom
  "expected value = implied × odds" — kolom seperti itu dilarang, karena ia
  mencampur dua estimasi yang satuannya berbeda dan menyembunyikan asumsi).
- Setiap baris board menampilkan KEDUA angka secara berdampingan: implied value
  (dolar) dan token odds (persen, satu desimal), plus band odds (Rendah / Sedang /
  Tinggi — batas band: Rendah < 20%, Sedang 20–50%, Tinggi > 50%; batas ini
  aturan spec, bukan hasil fit).
- Dashboard menyediakan pengurutan (sort) berdasarkan odds sebagai TOGGLE yang
  dipilih pengguna — tampilan default tetap implied value, dan toggle itu harus
  terlihat jelas (bukan tersembunyi di menu).
- Detail view per protokol (§4.2) menampilkan kontribusi tiap fitur odds (tanda
  dan arah: fitur apa yang menaikkan/menurunkan odds protokol ini dibanding
  rata-rata), dalam bahasa prose, bukan koefisien mentah.
- Ringkasan odds di KPI strip (§4.4): berapa protokol board yang ber-odds Tinggi,
  berapa median odds board, dan berapa protokol yang implied value-nya tinggi
  TAPI odds-nya Rendah (ketegangan yang paling informatif: "bernilai besar kalau
  launch, tapi kecil kemungkinan launch").

### 3.4 Category calibration dengan shrinkage

#### 3.4.1 Kenapa multiplier mentah gagal (penjelasan yang harus ada di dashboard)

Radar-2 mem-fit multiplier kategori sebagai median residual per kategori
(kategori dengan n >= 3) dan menolaknya: membantu held-out sedikit, gagal 2 dari
3 walk-forward [radar-2]. Penyebabnya — yang harus ditulis di dashboard sebagai
penjelasan, bukan sekadar "kami menolaknya" — adalah: kategori kecil mendominasi
kegagalan. Median residual dari 3 protokol adalah estimasi yang sangat berisik;
ketika protokol-protokol baru dari kategori yang sama muncul di fold walk-forward
berikutnya, median itu bergeser jauh, dan multiplier yang di-fit atas masa lalu
justru merusak prediksi masa depan. Kategori besar (Dexs 99, Lending 75) punya
estimasi yang stabil; kategori kecil (n = 1–6, yang jumlahnya puluhan kategori
di snapshot [snapshot]) tidak. Multiplier mentah memperlakukan keduanya sama —
itulah cacatnya.

#### 3.4.2 Rumus shrinkage (prose)

Untuk tiap kategori k, hitung dulu multiplier mentah m_k (median residual kategori
itu, dalam skala log-ratio — yaitu berapa log poin rasio kategori itu di atas atau
di bawah prediksi model tanpa kategori; multiplier dalam skala rasio adalah
exp dari angka itu). Lalu TARIK multiplier itu ke arah 1 (tidak ada efek kategori)
dengan bobot yang bergantung pada jumlah observasi kategori itu, n_k:

- multiplier_shrunk_k = 1 + (n_k / (n_k + K)) × (m_k − 1), di mana K adalah
  konstanta shrinkage (lihat §3.4.3), dan m_k dalam skala rasio.
- Bila n_k kecil dibanding K, faktor (n_k / (n_k + K)) mendekati 0, sehingga
  multiplier_shrunk mendekati 1 — kategori hampir tidak menggerakkan implied value.
- Bila n_k besar dibanding K, faktor mendekati 1, sehingga multiplier_shrunk
  mendekati estimasi mentah m_k — kategori besar dipercaya mendekati apa adanya.
- Aturan lantai: kategori dengan n_k < 3 mendapat multiplier TEPAT 1 (tidak ada
  estimasi sama sekali, bukan shrinkage — dengan 1–2 observasi, median residual
  bukan estimasi, melainkan anekdot).
- Kategori null (tidak ada kategori tercatat) diperlakukan sebagai satu kategori
  dengan n_k = jumlah protokol fit set yang kategorinya null.
- Multiplier yang di-shrink dipakai sebagai PENAMBAH log pada prediksi value model:
  prediksi akhir y = prediksi model tanpa kategori + log(multiplier_shrunk_k).
  Dalam skala dolar: implied value dikali multiplier_shrunk_k.

#### 3.4.3 Memilih K dari data, bukan dari tebakan

K TIDAK BOLEH ditebak. Builder memilih K dari grid K ∈ {5, 10, 20, 40} dengan
cara: untuk tiap nilai K, jalankan T9 (kategori dengan shrinkage K itu) melalui
mesin seleksi §3.2 (H1, H2, walk-forward); K yang dipakai adalah K TERKECIL
yang membuat T9 LOLOS kriteria K1–K3 — bila tidak ada K yang membuat T9 lolos,
T9 dinyatakan DROP dan K tidak dipakai. Bila beberapa K membuat T9 lolos, pilih
yang terkecil (shrinkage paling kuat yang masih lolos = pilihan paling konservatif).
Grid dan aturan "K terkecil yang lolos" ini adalah aturan spec; builder mencatat
hasil tiap K di decision table T9 (satu baris per K, atau satu baris T9 dengan
kolom per-K — pilih salah satu, yang penting keempat K terlihat).

#### 3.4.4 Shrinkage di odds model

Efek kategori di odds model memakai shrinkage yang sama (rumus yang sama, K yang
dipilih ulang dari grid yang sama atas target logistik, dengan kriteria §3.3.2).
Builder TIDAK BOLEH memakai K value model untuk odds model tanpa mengujinya —
K yang tepat untuk regresi log-ratio belum tentu tepat untuk regresi logistik.

### 3.5 Validasi sebagai SELEKSI — apa yang harus dikeluarkan program

Program WAJIB mengeluarkan, pada setiap run, tiga artefak validasi (semuanya
dihitung saat run dari snapshot, bukan ditempel dari sesi development):

1. validation.json (di /output, berdampingan dengan board.json): berisi, untuk
   tiap kandidat term (T2–T10) dan tiap K di grid T9: hasil H1, H2, dan tiap fold
   walk-forward (median log error model dengan term vs baseline, within-2x pct
   keduanya, R² dan MAPE sekunder), status fold (berlaku/skip), dan keputusan
   KEEP/DROP beserta alasan singkat yang merujuk kriteria (misalnya "gagal K2:
   H2 membaik 0,01 < 0,02"). Plus hasil yang sama untuk odds model (AUC, Brier,
   tabel kalibrasi 5 band). Plus ringkasan model final (daftar term yang lolos,
   koefisien hasil fit atas SELURUH fit set, residual std, K yang terpilih,
   jumlah kategori yang multipliernya ≠ 1).
2. Decision table di dashboard (lihat §4.5): tabel yang sama, dalam bentuk yang
   bisa dibaca manusia, di halaman pertama (cover) — term × test → KEEP/DROP +
   angka. Tabel ini BUKAN lampiran; ia adalah bukti utama bahwa model dipilih
   oleh validasi.
3. Decision log di repo (file VALIDATION.md di root repo — ditulis oleh BUILDER
   selama development, BUKAN oleh program): catatan keputusan yang dibuat builder
   saat development yang tidak ada di spec ini (misalnya: bila builder menambah
   kandidat term di luar T1–T10, bila builder mengubah definisi rankable, bila
   builder menemukan anomali data). Setiap entri: apa keputusannya, kenapa, dan
   angka apa yang mendasarinya. VALIDATION.md ini ikut di-commit dan ikut dibaca
   judge lewat teks dashboard? TIDAK — ia dibaca reviewer manusia dan koordinator;
   yang dibaca judge adalah decision table di dashboard. Keduanya harus konsisten
   (tidak boleh ada klaim di dashboard yang bertentangan dengan VALIDATION.md).

Reproduksibilitas: siapa pun yang menjalankan program atas snapshot yang sama
HARUS mendapatkan validation.json yang byte-identik (lihat §5). Angka validasi
yang ditampilkan di dashboard HARUS sama dengan angka di validation.json dari
run yang sama — program menulis keduanya dari satu struktur data yang sama,
bukan dari dua perhitungan yang berbeda.

### 3.6 Hal yang masih diputuskan builder (dan harus dicatat)

Spec ini sengaja tidak menetapkan: (a) library OLS/logistik yang dipakai
(builder menulis sendiri dengan standard library saja — TIDAK ADA dependency;
implementasi OLS dan regresi logistik dari rumus dasar adalah bagian dari tugas
builder); (b) urutan pengujian term bila dua term berkorelasi kuat (T5 vs T6,
T4 vs T10) — builder menguji keduanya secara independen sebagai penambahan atas
baseline, dan bila keduanya lolos, keduanya masuk model final (tidak ada
penyingkiran karena korelasi — korelasi antar term BUKAN kriteria drop di spec
ini); (c) pembulatan angka yang ditampilkan (satu desimal untuk persen, tiga
desimal untuk koefisien log — usulan, boleh disesuaikan selama konsisten).
Setiap hal yang builder putuskan di luar spec ini WAJIB masuk VALIDATION.md.

---

## 4. Output — board, farm plans, KPI strip, cover page

### 4.1 Board / radar (board.json + tampilan)

Board adalah daftar berperingkat protokol pre-token. Spesifikasi isinya:

- Jumlah baris: 200 baris (40 watchlist + 160 early row) — SAMA seperti radar-2
  [radar-2]. Alasan mempertahankan 200: gate mengizinkan 100–4000 [kit], tetapi
  200 sudah cukup padat untuk dibaca dan cukup dalam untuk membuktikan early radar;
  menambah baris tanpa menambah kualitas model hanya menambah noise. Builder
  BOLEH menaikkan sampai 300 bila farm plan dan detail view tetap berkualitas
  untuk semua baris — keputusan itu dicatat di VALIDATION.md dengan alasan.
  TIDAK BOLEH di bawah 200 (di bawah itu coverage early radar dipertanyakan).
- Urutan default: implied value menurun; ties (implied value sama persis)
  dipecah berdasarkan slug ascending — deterministik (§5).
- Setiap baris board.json WAJIB membawa kolom-kolom ini (nama kolom boleh
  disesuaikan builder selama maknanya sama dan konsisten di board.json, data.js,
  dan dashboard):
  - rank, slug, name, category, chains (array), tvl_usd, change_7d, mcap_usd
    (akan null untuk baris pre-token), listed_at, gecko_id (null), symbol (null).
  - token_status: selalu "pre-token" untuk baris board.
  - age_days (atau null bila listed_at null).
  - implied_value_usd (integer > 0).
  - token_odds_pct (satu desimal) dan odds_band (Rendah/Sedang/Tinggi, §3.3.4).
  - model breakdown: fitted_ratio (rasio mcap/TVL hasil fit), kontribusi tiap
    term yang LOLOS (dalam log poin dan dalam dolar — lihat §4.2), multiplier
    kategori yang di-shrink (atau 1 bila kategori tidak berpengaruh / tidak lolos),
    dan daftar term yang dipakai model final (supaya tiap baris bisa diaudit).
  - farm_steps: array string farm plan (§4.3).
- Board HARUS memuat seluruh 40 slug watchlist (§1.5) — program memeriksa ini
  sendiri sebelum menulis output dan GAGAL (exit non-zero, pesan jelas) bila ada
  yang hilang. Early rows: pre-token rankable di bawah floor, dipilih berdasarkan
  implied value tertinggi, maksimal 160, tidak pernah menggantikan baris watchlist.
- Tampilan board di dashboard: tabel yang bisa dibaca sekilas — kolom rank, nama
  (+ kategori), TVL, change 7d, implied value, token odds (+ band), dan tombol
  detail per baris. Filter yang WAJIB ada: berdasarkan kategori, berdasarkan chain,
  berdasarkan rentang TVL, dan berdasarkan odds band. Sort yang WAJIB ada: implied
  value (default), TVL, umur, dan token odds (toggle §3.3.4). Pencarian berdasarkan
  nama/slug WAJIB ada. Semua filter/sort/pencarian berjalan lokal di browser tanpa
  network (data sudah ada di data.js).

### 4.2 Detail view per protokol

Setiap baris board punya detail view (satu halaman/panel per protokol) yang
menampilkan, minimal:

- Identitas: nama, slug, kategori, chains, TVL, change 7d, listed_at + umur hari,
  status "records no token" (BUKAN "tidak punya token" — §1.7).
- Implied value dengan BREAKDOWN per term: tiap term yang lolos ditampilkan
  dengan kontribusinya — berapa log poin yang disumbang term itu, dan berapa
  dolar implied value yang berasal dari term itu (kontribusi dolar = implied
  value × (exp(kontribusi log term) − 1) / (jumlah faktor) — builder memilih
  rumus dekomposisi yang konsisten dan MENULISKAN rumusnya di dashboard;
  yang penting breakdown-nya dijumlahkan kembali ke implied value yang
  ditampilkan, supaya judge bisa memeriksa aritmetikanya).
- Token odds dengan breakdown arah fitur (§3.3.4): fitur apa yang menaikkan dan
  menurunkan odds protokol ini, dalam prose.
- Multiplier kategori yang di-shrink + n kategori itu (supaya judge melihat
  kategori kecil hampir tidak bergerak — §3.4).
- Farm plan lengkap protokol itu (§4.3).
- Perbandingan: rasio mcap/TVL hasil fit vs median rasio kategori itu (bila
  kategori punya cukup observasi) vs median global — supaya pembaca melihat di
  mana posisi protokol ini relatif terhadap pasar.

### 4.3 Farm plans — kedalaman minimal

Konteks: top entry #9 menulis "66 farm plans" di judulnya [lessons] — arti
angka itu TIDAK TERVERIFIKASI (tidak diketahui apakah itu 66 rencana yang dalam,
atau 66 baris yang punya rencana). Spec ini TIDAK meniru angka 66; spec ini
menetapkan kedalaman yang bisa dipertahankan untuk SEMUA baris, bukan angka
judul. Aturannya:

- SETIAP baris board (200 baris) mendapat farm plan. Tidak ada baris tanpa rencana.
- Setiap farm plan berisi 8 sampai 10 langkah (gate mengizinkan 3–12 [kit];
  radar-2 memakai 6 langkah template [radar-2] — radar-3 menaikkan floor ke 8
  karena 6 langkah terbukti dangkal). Setiap langkah 20–600 karakter (gate).
- Kedelapan langkah WAJIB mengikuti kerangka ini (urutan boleh disesuaikan,
  tetapi kedelapan jenis langkah harus ada):
  1. Persiapan wallet: wallet fresh, seed offline, dana hanya sebesar rencana.
  2. Aksi inti kategori: aksi utama yang sesuai kategori protokol (lending:
     supply + borrow; DEX: LP narrow range; bridge: bridge + pakai di tujuan;
     liquid staking: stake + pegang receipt token; perps: margin + hedge kecil;
     dst — profil per kategori diturunkan dari kategori + chain + TVL protokol
     itu, bukan template yang sama untuk semua).
  3. Aksi kualifikasi kedua: aksi kedua yang berbeda jenisnya (taker + maker,
     dua vault, round trip, ganti delegasi, dst) supaya wallet menunjukkan
     lebih dari satu sisi penggunaan.
  4. Cadence mingguan: satu aksi kualifikasi tiap minggu, jenis aksinya
     disebutkan (deposit/borrow/swap/vote — sesuai kategori).
  5. Hold period: jumlah hari menahan posisi, diturunkan dari umur protokol
     (protokol muda → hold lebih lama; aturan radar-2: umur < 180 hari → 60
     hari, < 365 hari → 45 hari, sisanya 30 hari [radar-2] — dipertahankan
     sebagai aturan, bukan sebagai kode yang disalin).
  6. Modal: jumlah dolar modal yang disarankan, diturunkan dari TVL protokol
     (aturan radar-2: TVL >= $5 miliar → $250, >= $1 miliar → $150,
     >= $100 juta → $100, sisanya $50 [radar-2] — dipertahankan sebagai aturan).
  7. Klaim dan keamanan: cek halaman points/rewards resmi protokol, klaim hanya
     dari link yang diterbitkan protokol itu sendiri, JANGAN PERNAH membayar
     untuk klaim, waspada phishing.
  8. Farm log dan exit: catat wallet, tanggal, dan setiap transaksi; rencana
     keluar (kapan menarik, dalam urutan apa) SEBELUM menarik.
- Langkah 9–10 (bila builder memakai 9–10 langkah): langkah tambahan yang
  SPESIFIK untuk protokol itu — misalnya memakai fitur kedua protokol itu
  (bila kategorinya punya dua sisi), atau langkah yang terkait odds-nya
  (misalnya bila odds Rendah: "rencana ini berasumsi token launch; bila tidak
  ada sinyal launch dalam 90 hari, evaluasi ulang dan jangan tambah modal").
- Setiap langkah WAJIB menyebut angka konkret (dolar modal, hari hold, menit
  waktu) yang diturunkan dari data protokol itu — langkah tanpa angka konkret
  (misalnya "gunakan protokol ini secara rutin") TIDAK BOLEH ada.
- Dashboard TIDAK BOLEH men-generate farm plan di dalam halaman dengan logika
  yang berbeda dari program: farm plan yang tampil di dashboard HARUS berasal
  dari board.json/data.js yang ditulis program (satu sumber kebenaran). Bila
  dashboard menampilkan farm plan yang dihitung ulang di JavaScript halaman,
  rumus di halaman dan rumus di program harus SAMA dan keduanya harus berasal
  dari definisi di spec ini — dan builder harus membuktikannya dengan uji
  (board.json vs tampilan halaman untuk 5 protokol acak, dicatat di VALIDATION.md).

### 4.4 KPI strip

Strip KPI di atas board (selalu terlihat tanpa scroll), berisi minimal:

- Jumlah protokol di snapshot (758), jumlah fit set (128), jumlah watchlist (40),
  jumlah baris board (200), jumlah pre-token (342) — semuanya dari run itu.
- Persamaan fit model final (dalam bentuk prose/rumus: log(mcap/TVL) = a + b·log(TVL)
  + ... dengan koefisien hasil fit run itu, tiga desimal) dan residual std.
- Ringkasan validasi: median log error held-out H1 dan H2 (model final vs baseline),
  dan jumlah fold walk-forward yang dimenangkan model final.
- Ringkasan odds: median odds board, jumlah baris ber-odds Tinggi, jumlah baris
  "implied tinggi tapi odds Rendah" (§3.3.4).
- Provenance: "Data: DefiLlama https://api.llama.fi/protocols, fetched
  2026-11-14T01:18:33Z; snapshot beku; as_of 2026-11-14" (nilai persis dari
  snapshot yang dibaca saat run — JANGAN hardcode tanggalnya, baca dari field
  source/as_of snapshot).
- Live-token view: 24 protokol bertoken teratas berdasarkan market cap, terpisah
  dari board, dengan label jelas "nilai pasar aktual, bukan estimasi model".

### 4.5 Cover page — menjawab ceknya sendiri di halaman pertama

Halaman pertama dashboard (yang terlihat sebelum scroll, dan yang direkam
screenshot ke-4 bila builder memakai 4 screenshot) WAJIB berisi, dalam urutan ini:

1. Judul + satu kalimat apa yang dilakukan radar ini + untuk siapa (§1.1).
2. KPI strip (§4.4).
3. Fit model: persamaan + n fit set + residual std.
4. Decision table validasi (§3.5): term × test → KEEP/DROP + angka (median log
   error dan within-2x, atau AUC/Brier untuk odds). Tabel ini harus MUAT di
   halaman pertama (boleh ringkas: satu baris per term, kolom H1/H2/WF/keputusan).
5. Batas model (ditulis jujur, tidak disembunyikan di footer atau halaman dalam):
   - Data beku 14 Nov 2026; tidak ada data yang lebih baru.
   - Implied value adalah estimasi atas rasio pasar historis, bukan prediksi harga.
   - Token odds adalah proksi kemiripan dengan protokol bertoken (§3.3.1), bukan
     peluang peluncuran yang sebenarnya.
   - Kategori kecil hampir tidak menggerakkan implied value karena shrinkage (§3.4).
   - Term yang gagal seleksi DIBUANG dan namanya ada di decision table — model
     tidak mengklaim memakai term yang tidak lolos.
   - "Records no token" bukan "tidak punya token" (§1.7).
6. Cara membaca board: urutan default implied value, odds di sampingnya, toggle
   sort odds, dan arti band Rendah/Sedang/Tinggi.

Alasan: top entry #10 secara eksplisit "answers its own checks on the cover"
[lessons] — judge yang membandingkan dua dossier akan melihat halaman pertama
dulu, dan radar yang menjawab keberatannya sendiri di halaman pertama lebih
dipercaya daripada radar yang menyembunyikan validasinya di halaman dalam.

### 4.6 Screenshot

Tiga screenshot wajib [requirements prerequisites]: (1) board, (2) detail view
satu protokol, (3) filtered view (board dengan satu filter aktif, misalnya satu
kategori atau satu odds band). Keempat (disarankan): cover page (§4.5). Semua
screenshot diambil dari dashboard yang di-render dari data.js hasil run program
atas snapshot kit — BUKAN mockup, BUKAN gambar yang digambar manual. Ukuran dan
nama mengikuti §1.5. Screenshot diambil dengan browser (Chrome/Chromium/Firefox)
yang tersedia — prasyarat "A browser" di requirements [requirements].

---

## 5. Determinisme

Aturan-aturan ini bersifat menolak (check run_deterministic [requirements]):

1. Input sama → output sama. Program tidak boleh membaca jam (Date.now, waktu
   jalan), tidak boleh memakai Math.random tanpa seed tetap, tidak boleh memakai
   urutan iterasi yang bergantung pada urutan file atau hash map yang tidak
   terurut. Semua pengurutan memakai kunci eksplisit (implied value menurun,
   lalu slug ascending sebagai tie-break; protokol diurutkan slug ascending
   sebelum di-fit).
2. Uji dua run identik: builder WAJIB menjalankan program dua kali atas snapshot
   yang sama ke dua direktori output berbeda, lalu membandingkan board.json,
   data.js, validation.json, dan dossier.json byte-per-byte (diff). Hasil uji
   (identik / tidak, dan bila tidak, file apa yang berbeda) dicatat di
   VALIDATION.md. Uji ini HARUS lolos sebelum submit.
3. Uji shuffle: jalankan program atas salinan snapshot yang array protocols-nya
   diacak urutannya (di luar repo, file sementara) — output HARUS identik dengan
   run atas snapshot asli. Uji ini membuktikan tidak ada ketergantungan pada
   urutan input (§2.5). Dicatat di VALIDATION.md.
4. File output permission 0644, folder output 0755. Program WAJIB mengeset umask
   022 sebelum menulis, DAN meng-chmod setiap file output ke 0644 secara eksplisit
   setelah menulisnya (file yang dibuat lewat mkstemp/tempfile tetap 0600 apa pun
   umask-nya — peringatan ini ada di skill make.fun [skill]). Alasan: grader
   mengumpulkan output sebagai user lain; file 0600 tidak terbaca dan entry gagal.
5. Tidak ada timestamp / waktu-jalan di output yang dihitung grader: board.json,
   data.js, validation.json, dan dossier.json TIDAK BOLEH berisi waktu run,
   tanggal run, atau nomor build. Satu-satunya tanggal yang boleh muncul adalah
   as_of dan source dari snapshot (data, bukan waktu run).
6. JSON ditulis dengan key yang terurut secara deterministik (urutan key yang sama
   di setiap run — builder memakai satu fungsi serialisasi yang sama untuk semua
   file output) dan diakhiri newline. Angka floating point dibulatkan ke jumlah
   desimal yang TETAP (tiga desimal untuk koefisien log dan median log error,
   empat desimal untuk rasio — builder menetapkan dan konsisten) supaya tidak ada
   perbedaan byte karena representasi float.

---

## 6. Repo

### 6.1 Layout file

Repo BARU, root berisi:

- main.ts — entrypoint (Node 22, standard library saja).
- lib/ — modul model dan validasi, ditulis builder dari spec ini. Nama modul
  bebas (misalnya model.ts, validation.ts, odds.ts, farm.ts, snapshot.ts),
  tetapi: (a) SATU modul hanya berisi konstanta metode (§2.4); (b) SATU modul
  berisi fit + seleksi; (c) SATU modul berisi farm plan; (d) TIDAK ADA modul
  yang namanya sama persis dengan struktur repo lama yang dipakai sebagai
  "pengganti" — builder menulis struktur sendiri.
- vendor/makefun-board.ts — dari kit, byte-for-byte, tidak dimodifikasi.
- dashboard/ — index.html, app.css, app.js (statis, tanpa network).
- screenshots/ — 3 atau 4 file PNG (lihat §4.6).
- README.md — lihat §6.2.
- LICENSE — MIT (lihat §6.3).
- VALIDATION.md — decision log builder (§3.5 butir 3).
- .makefun/owner.json — bila diperlukan (§1.4).
- .gitignore — WAJIB mengecualikan snapshot.json, folder out/, dan file kredensial
  apa pun. (Snapshot tidak pernah masuk repo — §1.5.)

Yang TIDAK BOLEH ada di repo: snapshot.json (di mana pun), file .env, API key,
seed phrase, private key, file bundle/transcript (transcript diserahkan TERPISAH
saat submit, bukan di-commit ke repo entry), dan kode yang di-copy dari repo lama
atau dari starter kit selain vendor/makefun-board.ts. Starter kit adalah "starting
point, not a winner" [brief builder radar-2] — builder radar-3 tidak memakai
starter sebagai dasar; starter hanya dipakai untuk MEMASTIKAN kontrak antarmuka
(main.ts membaca /input, menulis /output, memanggil buildDossier) — dan kontrak
itu sudah ditulis lengkap di spec ini (§1.4–§1.6), jadi builder tidak perlu
membuka starter sama sekali.

### 6.2 README

README mengikuti template README requirements [requirements]: badge make.fun
(token-radar-01, rank, reward), deskripsi singkat, dan bagian "Run it" dengan
perintah persis yang bisa dijalankan (membaca snapshot dari kit, menulis ke
folder out). Isi yang WAJIB ada di README (di luar template):

- Satu paragraf metode: value model multi-term dengan seleksi (§3.2), odds model
  (§3.3), shrinkage kategori (§3.4) — dalam prose, dengan rujukan ke VALIDATION.md
  untuk decision table lengkap.
- Provenance data: DefiLlama https://api.llama.fi/protocols, snapshot beku
  2026-11-14 (nilai persis dibaca dari snapshot; tanggal di README harus cocok
  dengan snapshot kit — builder memeriksa, bukan mengarang).
- Cara verifikasi lokal: perintah run + perintah uji determinisme (§5 butir 2–3).
- Batas model (§4.5 butir 5) dalam bentuk ringkas.
- Catatan "records no token" (§1.7).
- Footer make.fun dari template (Entered on make.fun ...).

### 6.3 LICENSE

MIT (dipilih spec ini; Apache-2.0 juga memenuhi syarat OSI, tetapi MIT yang
dipakai starter dan radar-2, dan satu lisensi yang konsisten memudahkan check
license_osi [requirements]). File LICENSE di root repo, teks MIT standar lengkap,
dan commit yang diserahkan HARUS sudah mengandung LICENSE yang ter-push
(commit yang belum di-push bisa gagal license check [skill]).

### 6.4 About repo + transcripts (tugas koordinator, builder menyiapkan isinya)

- GitHub About: deskripsi "{ringkasan} Built by an AI agent for make.fun's
  'Build the best token launch radar' bounty, $1,325 in USDC." (maksimum 254
  karakter untuk ringkasan [requirements]), homepage
  https://make.fun/bounty/token-radar-01, topik makefun, ai-agents, bounties,
  trading [requirements]. Builder menyiapkan kalimat ringkasan (satu kalimat,
  mendeskripsikan metode §1.3, bukan vibe) untuk dipakai koordinator.
- Transcripts: builder BEKERJA dalam sesi yang terekam sejak awal (sesi ini
  adalah sesi pembangunan entry — JANGAN membangun di sesi yang tidak terekam,
  JANGAN menulis kode lalu membuat sesi palsu sesudahnya). Semua file entry
  harus bisa dipertanggungjawabkan oleh transcript: authored lines atas counted
  lines harus memenuhi ambang thinking_reproduces yang diterbitkan requirements,
  dan tiap entrypoint harus punya minimal satu authored line [requirements].
  Praktiknya: builder menulis kode DALAM sesi ini lewat tool tulis file
  (bukan lewat tempel dari luar sesi), merevisi file yang sama minimal 2 kali
  (thinking_revised mensyaratkan min 2 pesan assistant yang menulis/mengedit
  file yang sama [requirements]), dan TIDAK MENYALIN file dari repo lama
  (thinking_own_work menolak deliverable yang di-copy [requirements]).
  Bundle dibuat koordinator dengan node cli/makefun.mjs bundle dari dalam kit,
  setelah semua subagent selesai, dengan --muse-usage yang mencakup semua
  agent id yang bekerja (top-level + subagent) [skill].
- Peringatan authored share: radar-2 hanya 34,6% authored share [lessons] —
  angka itu rendah dan berisiko di thinking_reproduces. Builder radar-3 harus
  menulis SEMUA kode dari nol di sesi ini (itulah gunanya rebuild dari prose),
  supaya authored share setinggi mungkin. Menyalin satu file dari repo lama
  akan langsung merusak angka ini.

### 6.5 Verifikasi lokal sebelum diserahkan ke koordinator

Builder menjalankan, dalam urutan ini, dan mencatat hasilnya di VALIDATION.md:

1. node main.ts atas snapshot kit → /output terisi (board.json, data.js,
   dashboard/, screenshots/, dossier.json).
2. board.json: 200 baris, seluruh 40 watchlist ter-cover, rank 1..200 berurutan,
   implied value menurun, tidak semua sama, tiap baris 8–10 farm steps
   20–600 karakter, implied value integer > 0.
3. Uji determinisme dua run (§5 butir 2) dan uji shuffle (§5 butir 3).
4. Buka dashboard di browser lokal (Chrome): board, detail view, filtered view
   tampil benar; ambil 3–4 screenshot sesuai §4.6; periksa ukuran file dan
   dimensi (§1.5).
5. Jalankan kit check (node cli/makefun.mjs check) atas bundle — bila kit
   tersedia di tangan builder; bila tidak, serahkan ke koordinator dengan
   catatan eksplisit bahwa check belum dijalankan.
6. Periksa tidak ada file terlarang di repo: snapshot.json, .env, API key,
   secret, file 0600 di output (periksa dengan ls -l).

---

## 7. Anti-requirements — kesalahan radar-2 yang TIDAK BOLEH diulang

Daftar ini bersifat larangan. Setiap butir merujuk pada fakta yang dibaca dari
lib/model.ts radar-2 [radar-2] dan lessons [lessons]:

1. SATU term OLS TVL. radar-2: log(mcap/TVL) = a + b·log(TVL) atas 128 protokol,
   itu saja [radar-2]. DILARANG: model final radar-3 yang hanya punya satu term
   (kecuali bila TIDAK ADA term lain yang lolos seleksi — §3.2.5 — dan itu
   dinyatakan eksplisit di cover, bukan disembunyikan).
2. Kategori di-fit lalu DIBUANG. radar-2: multiplier kategori membantu held-out
   sedikit, gagal 2 dari 3 walk-forward, lalu dibuang — tidak ada kategori yang
   menggerakkan implied value [radar-2]. DILARANG: membuang kategori tanpa
   mencoba shrinkage (§3.4) dan tanpa baris di decision table.
3. Tanpa odds. radar-2: tidak ada model P(launch) sama sekali [lessons].
   DILARANG: entry tanpa token-odds model (§3.3).
4. Validasi cuma laporan. radar-2: 1 held-out 70/30 + 3 walk-forward dipakai
   untuk laporan, bukan untuk seleksi (kecuali penolakan kategori) [lessons].
   DILARANG: validasi yang tidak mengubah isi model final. Decision table
   (§3.5) adalah buktinya — tanpa decision table, validasi dianggap laporan.
5. Farm plan template dangkal 6 langkah. radar-2: 6 langkah per kategori untuk
   ratusan row [lessons]. DILARANG: farm plan di bawah 8 langkah, langkah tanpa
   angka konkret, dan langkah yang sama persis untuk semua protokol tanpa
   diturunkan dari data protokol itu (§4.3).
6. Judul generik. radar-2: "Token launch radar — radar-2" (generik, tidak
   mendeskripsikan mekanisme) [lessons]. DILARANG: judul yang tidak menyebut
   metode (§1.3).
7. Growth dan age sebagai tilt kecil yang tidak diuji. radar-2: growth weight
   0,25 dan maturity 0,6–1,0 dimasukkan sebagai tilt berdasarkan korelasi mentah
   (r = −0,15 dan r = 0,00) tanpa seleksi [radar-2]. DILARANG: memasukkan term
   apa pun sebagai "tilt" di luar mesin seleksi — semua term lewat §3.2 atau
   tidak masuk model.
8. Menyembunyikan validasi dan batas model di halaman dalam. radar-2:
   validasi "ditampilkan di dashboard" tetapi tidak di halaman pertama sebagai
   jawaban atas ceknya sendiri [radar-2, lessons]. DILARANG: cover tanpa decision
   table dan tanpa batas model (§4.5).
9. Mengulang resep yang sama dengan bungkus baru. Pelajaran news-image yang
   berlaku di sini [lessons]: jangan submit radar-2 dengan tampilan baru.
   DILARANG: memakai kembali file, struktur, atau konstanta radar-2 (growth
   weight 0,25, maturity 0,6–1,0, EARLY_ROWS, cutoff yang sama BOLEH dipakai
   hanya bila spec ini secara eksplisit mempertahankannya — dan spec ini
   mempertahankan cutoff walk-forward serta aturan modal/hold farm plan
   sebagai ATURAN, bukan sebagai kode yang disalin; konstanta lain radar-2
   tidak boleh dipakai tanpa disebutkan di VALIDATION.md).
10. Mengklaim "tidak punya token" secara mutlak. DILARANG di semua teks (§1.7).

---

## 8. Sumber dan status verifikasi

- [requirements] GET https://make.fun/api/competitions/token-radar-01/requirements,
  ditarik 25 Nov 2026 (tanpa key, curl): deliverables, checks (57 checks),
  deadlines (tutup 14 Des 2026 10:00 UTC, final 14 Des 10:10–22:10 UTC, hasil
  28 Des 2026 22:10 UTC), payout (total $1.325; #1 $1.000, #2–5 $50, #6–10 $25),
  quota (max 5/hari, max 40/akun, hard limit 20 — per skill make.fun; baca
  quota requirements untuk tier negara), prerequisites (Node 22.18+, browser
  untuk 3 screenshot), escrow (terdanai penuh, status open).
- [lessons] ~/workspace/makefun/top-leaderboard-lessons.md, ditarik 25 Nov 2026
  ~22:30 WIB: top token-radar judge 0,962–0,967, ORZS 0,801123 interval
  [0,755–0,847], rank dev #12.232, authored share 34,6%, judul top 10,
  breakdown per-kriteria DITAHAN sampai 14 Des 10:00 UTC.
- [radar-2] ~/workspace/makefun/token-radar-01-repo/lib/model.ts (30.435 byte,
  dibaca penuh 25 Nov 2026) + main.ts + README.md: satu term OLS, kategori
  di-fit lalu dibuang, growth r=−0,15 weight 0,25, age r=0,00 maturity 0,6–1,0,
  held-out 70/30 slug hash + 3 walk-forward (cutoff 2025-01-01, 2025-06-01,
  2025-09-01), 200 baris (40 + 160), farm plan 6 langkah, LIVE_ROWS 24.
- [kit] ~/workspace/makefun/token-radar-01/kit/competition.yaml + input/README.md
  + kit.json: harness program/v1, gate (board 100–4000, farm steps 3–12 × 20–600
  karakter, implied ≤ 1e14, dashboard ≤ 400 file / 4 MiB, screenshot 3–4 ×
  ≤512 KiB, sisi panjang ≤1440, sisi pendek ≥800, dossier ≤1,5 MiB, teks
  ≤65.536 byte), judge pairwise superbot reasoning high margin 1–5, final
  screened (shortlist place 40, 3 ronde Swiss, playoff 12, top 5 finalist
  review ≤60 menit), tie-break (head-to-head, lalu dossier.json terkecil, lalu
  receipt terawal), owner ask verbatim, definisi watchlist, skema snapshot.
- [snapshot] ~/workspace/makefun/token-radar-01/kit/input/snapshot.json,
  diverifikasi langsung 25 Nov 2026: 758 protokol, 40 watchlist, 128 fit set,
  342 pre-token, listed_at 645/758, change_7d 754/758, chain 1–176, 55 kategori.
- [skill] ~/workspace/custom-skills/makefun/SKILL.md v1.5.236: bundle/transcripts,
  thinking checks, license (commit harus ter-push sebelum submit), output
  permission 0644/0755 (file mkstemp/tempfile tetap 0600 apa pun umask),
  repo_about, quota tiers.
- [tidak terverifikasi]: (a) isi rubrik judge lima kriteria kata-per-kata
  (disebut ada di judge/prompt.txt di dalam harness kit yang tersegel — tidak
  diekstrak saat penulisan spec ini; yang diketahui dari competition.yaml hanya
  urutan bobotnya: coverage + stated value model dulu, lalu farm plan, lalu
  halaman); (b) arti "66 farm plans" di judul top #9 (kemungkinan rencana yang
  lebih dalam per protokol — inferensi dari judul, bukan fakta); (c) ambang
  numerik exact thinking checks (min_reproduced, min_assistant_turns = 5
  menurut deskripsi check, min_file_writes = 2 menurut deskripsi check —
  angka-angka itu dari teks deskripsi check di requirements, bukan dari
  pengukuran; builder memverifikasi lewat kit check); (d) apakah snapshot
  final sama byte-nya dengan snapshot dev (input/README.md menyatakan setiap
  run dan grading membaca byte yang sama — diasumsikan sama, builder
  memverifikasi lewat grade-local bila tersedia); (e) skor judge top entry
  adalah win rate pairwise yang terkuantisasi per bucket (pengelompokan skor
  identik #1–3, #4–5, dst — observasi dari leaderboard, bukan pernyataan API).

---

*Akhir spec radar-3 v1.*
