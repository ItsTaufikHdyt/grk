# Dashboard Emisi GRK Kota Bontang

Aplikasi web dashboard untuk **Inventarisasi Emisi Gas Rumah Kaca (GRK) Kota Bontang**.
Aplikasi menampilkan tren emisi per sektor, analisis subsektor, emisi nasional, serta
perhitungan serapan/removal pada sektor kehutanan, lengkap dengan form input data
untuk operator yang telah login.

Aplikasi dibangun sepenuhnya di atas **Google Apps Script + Google Sheets**
sebagai basis data, sehingga tidak memerlukan server, hosting, maupun database
terpisah.

> **Sumber data:** Inventarisasi Emisi GRK Kota Bontang (Provinsi Kalimantan Timur).

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Arsitektur & Struktur File](#arsitektur--struktur-file)
- [Teknologi](#teknologi)
- [Struktur Spreadsheet](#struktur-spreadsheet)
- [Alur Data](#alur-data)
- [Fungsi Backend (API)](#fungsi-backend-api)
- [Instalasi & Deployment](#instalasi--deployment)
- [Konvensi Kode](#konvensi-kode)
- [Satuan & Catatan Data](#satuan--catatan-data)
- [Keamanan & Keterbatasan](#keamanan--keterbatasan)
- [Pengembangan Lanjutan](#pengembangan-lanjutan)

---

## Fitur Utama

Aplikasi terdiri dari enam halaman yang diakses melalui sidebar.

| Halaman | ID Page | Deskripsi |
| --- | --- | --- |
| **Tren (Emisi Bontang)** | `trend` | Perbandingan emisi seluruh sektor dari tahun ke tahun dalam bentuk *combo chart* (batang = per sektor, garis = total emisi GRK) beserta tabel matriks emisi per tahun, filter tahun awal & tahun akhir. Dilanjutkan satu section data ekonomi khusus Kota Bontang: KPI Total Emisi/ADHK/Intensitas GRK terbaru, **dua** chart tren terpisah (ADHK, Intensitas GRK — dipisah karena beda skala/satuan), dan **satu** tabel data tahunan gabungan. |
| **Emisi Nasional** | `national` | Perkembangan emisi GRK Indonesia berdasarkan sektor (satuan kt CO₂e), dilengkapi KPI total, sektor terbesar, perubahan tahunan, *stacked combo chart*, dan tabel per tahun. |
| **Ringkasan** | `summary` | Gambaran umum emisi GRK Kota Bontang pada tahun terpilih: total emisi, sektor terbesar, jumlah sektor, perubahan tahunan, grafik sektor, tren total, dan *insight* otomatis. |
| **Analisis Subsektor** | `sector` | Analisis emisi per subsektor untuk kombinasi tahun + sektor terpilih, mencakup KPI, *bar chart*, tren subsektor, dan tabel kontribusi. |
| **Kehutanan** | `forestry` | Khusus sektor Kehutanan: nilai net emisi/serapan, total removal, emisi positif, grafik emisi vs serapan, tren net, dan detail per subsektor. |
| **Input Data** | `input` | Form penambahan data baru ke `DATA_SEKTOR`, `DATA_SUBSEKTOR`, atau `DATA_NASIONAL`. Hanya tampil setelah operator login. |

**Fitur pendukung:**

- **Login operator** – tombol `Login` pada sidebar membuka modal autentikasi; sesi disimpan di `sessionStorage` (`grk_user`) sehingga tetap aktif selama tab dibuka.
- **Filter tahun global** – dropdown tahun pada area *hero* memengaruhi halaman Ringkasan, Analisis Subsektor, dan Kehutanan secara bersamaan (disembunyikan pada halaman Tren & Emisi Nasional yang punya filter sendiri).
- **Pencarian subsektor interaktif** – input dengan pencarian langsung (*autocomplete*) pada form input data, difilter berdasarkan sektor yang dipilih.
- **ID record otomatis** – `EM00001` untuk data lokal (sektor & subsektor) dan `EN0001` untuk data nasional.
- **Responsif** – grafik digambar ulang saat ukuran jendela berubah (*debounce* 250 ms).

---

## Arsitektur & Struktur File

Proyek ini adalah sebuah **Google Apps Script project** (container-bound / standalone)
yang hanya terdiri dari empat file sumber. Tidak ada build step, tidak ada
`node_modules`, dan tidak ada dependency eksternal selain Google Charts.

```
grk/
├── Code.gs        # Logika server (Apps Script): baca sheet, agregasi, autentikasi, simpan data
├── Index.html     # Struktur halaman dashboard (template HTML + include Styles & Scripts)
├── Styles.html    # Seluruh CSS dashboard (variabel tema, layout, kartu, tabel, modal)
├── Scripts.html   # Logika klien: state aplikasi, navigasi, Chart API, form input
└── README.md
```

**Peran masing-masing file:**

| File | Peran |
| --- | --- |
| `Code.gs` | Berjalan di sisi server. Membuka spreadsheet berdasarkan `SPREADSHEET_ID`, membaca sheet menjadi array objek, mengagregasi data per tahun/sektor/subsektor, memverifikasi login, dan menambahkan baris baru ke sheet. |
| `Index.html` | Template HTML. Memuat `Styles` dan `Scripts` melalui helper `include()`, memuat Google Charts (`https://www.gstatic.com/charts/loader.js`), dan mendefinisikan sidebar, hero header, enam `<section class="page">`, footer, serta modal login. |
| `Styles.html` | Berisi satu blok `<style>`. Mendefinisikan CSS variable (`--primary`, `--green`, `--red`, dll.), layout sidebar tetap, grid KPI, kartu grafik, tabel matriks, dan modal. |
| `Scripts.html` | Berisi satu blok `<script>`. Menyimpan seluruh *state* pada objek global `app`, menangani navigasi halaman, memanggil fungsi server via `google.script.run`, menggambar grafik, dan menangani form input. |

### Mode tampilan

Aplikasi dievaluasi sebagai template (`createTemplateFromFile('Index').evaluate()`),
sehingga sintaks scriptlet `<?!= include('Styles'); ?>` dan `<?!= include('Scripts'); ?>`
menyisipkan CSS dan JS ke dalam satu halaman HTML saat dirender.

`XFrameOptionsMode.ALLOWALL` diaktifkan agar dashboard dapat ditampilkan juga di dalam
`iframe` (misalnya disematkan pada situs lain).

---

## Teknologi

| Komponen | Keterangan |
| --- | --- |
| Bahasa | JavaScript (ES6+ / V8 runtime Apps Script) + HTML + CSS |
| Backend | Google Apps Script – HTML Service & Spreadsheet Service |
| Basis data | Google Sheets (spreadsheet ID di-hardcode di `Code.gs`) |
| Grafik | Google Charts – paket `corechart` (`BarChart`, `LineChart`, `ComboChart`) |
| Penyimpanan sesi | `sessionStorage` browser (key `grk_user`) |
| Format angka | `Intl.NumberFormat("id-ID")` – 2 desimal untuk nilai, 1 desimal untuk persen |

---

## Struktur Spreadsheet

Seluruh data disimpan pada satu spreadsheet. ID-nya didefinisikan di baris pertama `Code.gs`:

```js
const SPREADSHEET_ID = '1y_iGmLt5sOXkPkhs536KTgC8XJX3hTssYuvIya9pKjA';
```

Nama sheet yang dipakai aplikasi:

```js
const SHEETS = {
  SEKTOR: 'DATA_SEKTOR',
  SUBSEKTOR: 'DATA_SUBSEKTOR',
  MASTER_SEKTOR: 'MASTER_SEKTOR',
  MASTER_SUBSEKTOR: 'MASTER_SUBSEKTOR',
  NASIONAL: 'DATA_NASIONAL',
  EKONOMI_GRK: 'DATA_EKONOMI_GRK',
  USERS: 'USERS'
};
```

> **Penting:** baris pertama setiap sheet adalah header. Helper `getSheetObjects_()`
> menurunkan (lowercase) dan memangkas spasi setiap header, lalu memakainya sebagai
> key objek. Karena itu **nama header wajib sama persis** dengan key yang dibaca
> kode (mis. `tahun`, `sektor`, `sektor_id`, `nilai_emisi`).

### 1. `MASTER_SEKTOR` — daftar sektor

| Header | Keterangan | Contoh |
| --- | --- | --- |
| `sektor_id` | ID internal sektor | `1` |
| `kode_sektor` | Kode sektor (dipakai sebagai value dropdown, otomatis di-uppercase) | `ENERGI` |
| `nama_sektor` | Nama tampilan sektor | `Energi` |

Kode sektor yang dikenali aplikasi: `ENERGI`, `IPPU`, `PERTANIAN`, `KEHUTANAN`, `FOLU`, `LIMBAH`.

### 2. `MASTER_SUBSEKTOR` — daftar subsektor/kategori

Helper `getMasterFormData()` membaca header berikut (mendukung dua penamaan kolom
agar kompatibel dengan data lama):

| Header | Keterangan |
| --- | --- |
| `kategori_id` **atau** `subsektor_id` | ID subsektor (prioritas: `kategori_id`) |
| `subsektor_id` **atau** `sektor_id` | ID sektor (prioritas: `subsektor_id`) |
| `subsektor` **atau** `sektor` | Kode sektor yang dipakai untuk memfilter subsektor per sektor |
| `nama_kategori` **atau** `nama_subsektor` | Nama subsektor yang ditampilkan |

### 3. `DATA_SEKTOR` — data emisi tingkat sektor (Kota Bontang)

Urutan kolom yang ditulis oleh `saveEmissionData()` (11 kolom):

| # | Kolom | Nilai yang diisi |
| --- | --- | --- |
| 1 | `id` | ID otomatis (`EM00001`, `EM00002`, ...) |
| 2 | `tahun` | Tahun data |
| 3 | `provinsi` | `Kalimantan Timur` |
| 4 | `kabupaten` | `Bontang` |
| 5 | `level_data` | `SEKTOR` |
| 6 | `sektor_id` | ID sektor dari master |
| 7 | `sektor` | Kode sektor (mis. `ENERGI`) |
| 8 | `subsektor_id` | *(kosong pada baris tingkat sektor)* |
| 9 | `subsektor` | *(kosong pada baris tingkat sektor)* |
| 10 | `nilai_emisi` | Nilai emisi (negatif = serapan/removal) |
| 11 | `jenis_nilai` | `Emisi/Net` atau `Serapan/Removal` (otomatis dari tanda nilai) |

### 4. `DATA_SUBSEKTOR` — data emisi tingkat subsektor/kategori

Struktur kolom identik dengan `DATA_SEKTOR`, dengan perbedaan:

| # | Kolom | Nilai yang diisi |
| --- | --- | --- |
| 5 | `level_data` | `KATEGORI` |
| 8 | `subsektor_id` | ID subsektor dari master |
| 9 | `subsektor` | Nama subsektor |
| 11 | `jenis_nilai` | `Emisi` atau `Serapan/Removal` |

### 5. `DATA_NASIONAL` — data emisi GRK nasional

Urutan kolom yang ditulis (8 kolom):

| # | Kolom | Nilai yang diisi |
| --- | --- | --- |
| 1 | `id` | ID otomatis (`EN0001`, `EN0002`, ...) |
| 2 | `tahun` | Tahun data |
| 3 | `negara` | `INDONESIA` |
| 4 | `level_data` | `SEKTOR` |
| 5 | `sektor_id` | ID sektor dari master |
| 6 | `sektor` | Kode sektor |
| 7 | `nilai_emisi` | Nilai emisi (satuan kt CO₂e) |
| 8 | `jenis_nilai` | `EMISI` |

Halaman nasional hanya menampilkan baris dengan `negara = INDONESIA`,
`level_data = SEKTOR`, dan `jenis_nilai = EMISI`.

### 6. `DATA_EKONOMI_GRK` — data ekonomi & intensitas emisi (Kota Bontang)

Dibaca oleh `getEconomicData()`. Ditampilkan sebagai satu section pada halaman **Tren/Emisi Bontang** (bukan halaman Ringkasan, bukan page baru): 3 KPI (Total Emisi, ADHK, Intensitas GRK terbaru), **dua** chart terpisah ("Tren ADHK per Tahun" dan "Tren Intensitas GRK per Tahun" — dipisah karena skala/satuan berbeda jauh, menggabungkan jadi satu chart butuh normalisasi indeks yang kurang jelas dibaca), dan **satu** tabel gabungan "Data Tahunan Emisi dan Ekonomi Bontang" (kolom Tahun/Total Emisi/ADHK/Intensitas GRK, nilai asli). Hanya baris dengan `kota` yang cocok "Bontang" (tidak peka huruf besar/kecil, mengabaikan prefiks "KOTA " dan spasi tepi) yang diikutkan. Kolom emisi yang dipakai sebagai "Total Emisi" adalah `total_emisi_gg` (satuan Gg CO₂e, konsisten dengan seluruh chart lain di aplikasi) — bukan `total_emisi_ton`, dan kedua kolom tidak dijumlahkan.

| Header | Keterangan |
| --- | --- |
| `tahun` | Tahun data |
| `kota` | Nama kota (saat ini selalu `Bontang` pada data yang ada; tidak ada filter kota di UI) |
| `total_emisi_gg` | Total emisi GRK Kota Bontang pada tahun tersebut, satuan **Gg CO₂e** |
| `total_emisi_ton` | Total emisi dalam satuan ton CO₂e (`total_emisi_gg × 1000`) |
| `adhk` | Nilai ekonomi (PDRB Atas Dasar Harga Konstan). **Satuan/skala belum terkonfirmasi dari sumber data** — jangan menampilkan label mata uang (mis. "Rp" / "Juta Rupiah") sampai dikonfirmasi oleh sumber resmi. Dashboard menampilkannya tanpa label satuan mata uang. |
| `intensitas_grk` | Intensitas emisi = `total_emisi_gg / adhk × 1000`. Ditampilkan dengan satuan **Gg CO₂e / ADHK** (rasio, bukan satuan mata uang pasti). |

> Baris dengan `tahun` kosong/non-numerik, atau salah satu kolom numerik wajib
> (`total_emisi_gg`, `total_emisi_ton`, `adhk`, `intensitas_grk`) kosong/non-numerik,
> **tidak diikutkan** dalam hasil (bukan dijadikan `0`). Bila seluruh baris tersaring,
> fungsi mengembalikan struktur kosong (`years: []`, `data: []`, `latestYear: null`)
> dan UI menampilkan *empty state*, bukan error atau angka nol palsu.

### 7. `TABEL_NASIONAL` — referensi, tidak dipakai aplikasi

Sheet ini ada pada workbook data (format pivot: kolom `Tahun, ENERGI, IPPU, PERTANIAN, FOLU, LIMBAH, TOTAL`).
Diverifikasi berisi **data yang identik** dengan yang sudah tersedia di `DATA_NASIONAL`
(format panjang, sudah dibaca oleh `getNationalEmissionData()`). Sheet ini adalah
tabel referensi/staging, **tidak dibaca oleh kode aplikasi** — tidak perlu dan tidak
ditambahkan fungsi backend untuk sheet ini agar tidak terjadi duplikasi sumber data.

### 8. `USERS` — akun operator

| Header | Keterangan |
| --- | --- |
| `username` | Username login (pencocokan tidak peka huruf besar/kecil, spasi dipangkas) |
| `password` | Password (dibandingkan sebagai teks biasa — lihat [Keamanan](#keamanan--keterbatasan)) |
| `nama` | Nama tampilan operator (fallback ke `username`) |
| `role` | Peran pengguna, mis. `admin` / `user` |

---

## Alur Data

Aplikasi menggunakan pola **request–response satu arah** melalui `google.script.run`.
Semua *state* di sisi klien disimpan di objek global `app` pada `Scripts.html`.

```
Browser (Index.html + Styles.html + Scripts.html)
        │
        │  google.script.run
        │    .withSuccessHandler(...)
        │    .withFailureHandler(...)
        ▼
Apps Script (Code.gs)
        │
        │  SpreadsheetApp.openById(SPREADSHEET_ID)
        ▼
Google Sheets (DATA_SEKTOR, DATA_SUBSEKTOR, DATA_NASIONAL,
               MASTER_SEKTOR, MASTER_SUBSEKTOR, USERS)
```

### Alur saat halaman dibuka

1. Google Charts dimuat, lalu `init()` dipanggil.
2. `getInitialData()` mengambil daftar tahun dan sektor dari `DATA_SEKTOR`.
3. `setupFilters()` mengisi seluruh dropdown (tahun global, tahun awal/akhir tren, tahun & sektor analisis subsektor).
4. `checkAuthSession()` memeriksa `sessionStorage` dan menampilkan/menyembunyikan menu **Input Data**.
5. `loadMasterFormData()` mengambil master sektor & subsektor untuk form input.
6. Halaman default `trend` dimuat melalui `loadTrendPage()`.

### Alur input data

1. Operator login → `verifyLogin(username, password)` → objek user disimpan di `sessionStorage`.
2. Operator mengisi form → `handleFormSubmit()` menyusun payload (target sheet, tahun, sektor, sektorId, nilai, dan subsektor bila perlu).
3. `saveEmissionData(payload, currentUser)` membuat ID otomatis dengan `generateNextId_()` lalu `appendRow()` ke sheet tujuan.
4. Nilai `< 0` otomatis ditandai sebagai `Serapan/Removal`; nilai `>= 0` sebagai `Emisi` / `Emisi/Net`.

### Objek state `app` (klien)

| Properti | Isi |
| --- | --- |
| `years`, `sectors`, `year` | Daftar tahun (menurun), daftar sektor, dan tahun aktif |
| `page` | Halaman aktif (`trend`, `national`, `summary`, `sector`, `forestry`, `input`) |
| `summary`, `allSectorTrend`, `category`, `categoryTrend`, `forestry`, `national` | Cache hasil pemanggilan server per halaman |
| `currentUser` | Data operator yang login (dibaca dari `sessionStorage`) |
| `masterForm` | `{ sektorList, subsektorList }` untuk form input |
| `activeSubsektors` | Subsektor yang lolos filter sektor pada form input |

---

## Fungsi Backend (API)

Fungsi publik pada `Code.gs` dapat dipanggil dari klien melalui `google.script.run`.

| Fungsi | Parameter | Kegunaan |
| --- | --- | --- |
| `doGet()` | – | Entry point web app. Merender `Index` sebagai template, menetapkan judul tab, dan mengizinkan embedding via `iframe`. |
| `include(filename)` | `filename` | Menyisipkan file HTML (`Styles`, `Scripts`) ke dalam template. |
| `getInitialData()` | – | Daftar tahun (menurun) & sektor dari `DATA_SEKTOR`, plus `latestYear`. |
| `getMasterFormData()` | – | Daftar sektor & subsektor dari `MASTER_SEKTOR` dan `MASTER_SUBSEKTOR` untuk dropdown form. |
| `getSummaryData(year)` | `year` | Data halaman Ringkasan: total, daftar sektor terurut, sektor terbesar, jumlah sektor, tahun & total pembanding, `changePercent`, dan tren total. |
| `getAllSectorTrend()` | – | Matriks emisi seluruh sektor per tahun untuk halaman Tren (urutan sektor: ENERGI, IPPU, PERTANIAN, KEHUTANAN, LIMBAH). |
| `getCategoryData(year, sector)` | `year`, `sector` | Data subsektor pada tahun & sektor tertentu: total, jumlah, subsektor terbesar, dan daftar subsektor. |
| `getCategoryTrend(sector)` | `sector` | Deret waktu emisi setiap subsektor dalam satu sektor. |
| `getForestryData(year)` | `year` | Data sektor Kehutanan: net emisi/serapan, total removal, emisi positif, daftar subsektor, dan tren net. |
| `getNationalEmissionData()` | – | Matriks emisi nasional per sektor: tahun, sektor, data per tahun, tahun terakhir, `changePercent`, dan sektor terbesar. |
| `getEconomicData()` | – | Data ekonomi & intensitas emisi Kota Bontang dari `DATA_EKONOMI_GRK` (sudah difilter `kota` = Bontang, case/spasi-insensitive), terurut tahun menaik: `years`, `data[]` (`tahun`, `kota`, `totalEmisiGg`, `totalEmisiTon`, `adhk`, `intensitasGrk` — tiap field numerik `null` bila sel kosong/tidak valid, bukan `0`), `latestYear`, `latest`, `latestAdhk`, `latestIntensitasGrk`, `previousYear`, `adhkChangePercent`, `intensitasChangePercent`. Mengembalikan struktur kosong (bukan error) bila tidak ada baris bertahun valid; baris/kolom yang dilewati dicatat via `console.log`. |
| `verifyLogin(username, password)` | `username`, `password` | Verifikasi akun pada sheet `USERS`; mengembalikan `{ success, user }` atau `{ success: false, message }`. |
| `saveEmissionData(formData, currentUser)` | `formData`, `currentUser` | Menambahkan baris baru ke `DATA_SEKTOR`, `DATA_SUBSEKTOR`, atau `DATA_NASIONAL`. Menolak jika sesi tidak valid. |

**Helper privat** (tanda garis bawah di akhir nama, tidak dipanggil dari klien):

| Helper | Kegunaan |
| --- | --- |
| `generateNextId_(ss, targetSheet)` | Membuat ID berikutnya: `EN####` untuk `DATA_NASIONAL`, `EM#####` untuk `DATA_SEKTOR`/`DATA_SUBSEKTOR` (memindai nilai maksimum dari kolom pertama). |
| `getSheetObjects_(sheetName)` | Membaca satu sheet menjadi array objek berdasarkan header baris pertama; melempar error bila sheet tidak ditemukan. |
| `toNumber_(value)` | Konversi nilai sel ke angka; mendukung format Indonesia (`1.234,56`) dan mengembalikan `0` untuk nilai tidak valid. |

---

## Instalasi & Deployment

Proyek ini dijalankan sebagai **Google Apps Script Web App**. Tidak ada langkah
build maupun instalasi dependency.

### Prasyarat

1. Akun Google dengan akses ke spreadsheet data.
2. Spreadsheet berisi tujuh sheet yang dipakai aplikasi: `DATA_SEKTOR`, `DATA_SUBSEKTOR`, `DATA_NASIONAL`, `DATA_EKONOMI_GRK`, `MASTER_SEKTOR`, `MASTER_SUBSEKTOR`, `USERS` (lihat [Struktur Spreadsheet](#struktur-spreadsheet)). Sheet `TABEL_NASIONAL`, bila ada, tidak dibaca aplikasi.

### Langkah manual (editor Apps Script)

1. Buka <https://script.google.com> → **New project**.
2. Buat file berikut di editor Apps Script, lalu salin isi dari repo ini:
   - `Code.gs` → ganti isi file `Code.gs` bawaan.
   - `Index` (HTML) → **File → New → HTML file**, beri nama `Index`, salin isi `Index.html`.
   - `Styles` (HTML) → buat file HTML bernama `Styles`.
   - `Scripts` (HTML) → buat file HTML bernama `Scripts`.

   > Nama file HTML **tanpa ekstensi** dan **peka huruf besar/kecil**, karena
   > dipanggil oleh `createTemplateFromFile('Index')` dan `include('Styles' | 'Scripts')`.
3. Sesuaikan `SPREADSHEET_ID` pada `Code.gs` bila memakai spreadsheet berbeda.
4. Simpan, lalu **Deploy → New deployment → Web app**:
   - *Execute as*: **Me** (agar Apps Script dapat membaca/menulis spreadsheet).
   - *Who has access*: sesuaikan kebutuhan (mis. **Anyone** untuk akses publik tanpa login Google).
5. Buka URL web app yang dihasilkan.

### Deployment via `clasp` (opsional)

Repo ini belum menyertakan `appsscript.json` maupun `.clasp.json`. Bila ingin
memakai `clasp`:

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "Dashboard Emisi GRK Kota Bontang" --rootDir .
clasp push
clasp deploy
```

Pastikan `appsscript.json` memuat setidaknya:

```json
{
  "timeZone": "Asia/Makassar",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

Setiap kali kode diubah, lakukan **deploy ulang** (atau buat *version* baru) agar
perubahan tampil di URL web app.

### Melihat log

Gunakan **Executions** / **Logger** pada editor Apps Script. Kesalahan sisi klien
juga dicatat di console browser melalui `handleError()` dan ditampilkan sebagai `alert`.

---

## Konvensi Kode

- **Bahasa data & UI:** istilah domain menggunakan Bahasa Indonesia
  (`tahun`, `sektor`, `subsektor`, `nilai_emisi`, `serapan/removal`, `kehutanan`).
- **Nama fungsi server:** `camelCase` untuk fungsi publik (`getSummaryData`) dan
  akhiran garis bawah untuk helper privat (`getSheetObjects_`, `toNumber_`,
  `generateNextId_`).
- **Nama fungsi klien:** `camelCase` dengan awalan kata kerja sesuai perannya —
  `load*` (memanggil server), `render*` (menggambar UI/grafik), `open*`/`close*`
  (modal & navigasi), `handle*` (event handler), `format*` (utilitas format).
- **Pemisahan server/klien:** semua akses data hanya melalui fungsi di `Code.gs`;
  `Scripts.html` tidak pernah mengakses spreadsheet secara langsung.
- **Angka & teks ditampilkan** melalui `formatNumber()` / `formatPercent()` dan
  selalu di-escape dengan `escapeHtml()` sebelum dimasukkan ke `innerHTML`.
- **Grafik** digambar dengan pola `new google.visualization.DataTable()` lalu
  `chart.draw(table, options)`, dengan opsi umum di `barOptions()` / `lineOptions()`.
- **Komentar:** fungsi-fungsi utama di `Code.gs` dan bagian-bagian di
  `Scripts.html` diberi komentar pembuka bergaya blok (`/** ... */` atau
  `/* ==== JUDUL ==== */`).
- **Chart ADHK dan Intensitas GRK** (`renderEconomicAdhkChart`/`renderEconomicIntensityChart` di
  `Scripts.html`) memakai pola `formatChartColumns()` yang sama dengan chart lain di aplikasi
  (axis + tooltip format `id-ID`). Tabel gabungan di bawahnya (`renderEconomicCombinedTable`)
  memakai `formatNumber()` pada nilai asli; sel `null` ditampilkan `—`.

---

## Satuan & Catatan Data

| Konteks | Satuan |
| --- | --- |
| Data Kota Bontang (`DATA_SEKTOR`, `DATA_SUBSEKTOR`) | **Gg CO₂e** |
| Data Nasional (`DATA_NASIONAL`) | **kt CO₂e** (kiloton) |
| `DATA_EKONOMI_GRK` — emisi | **Gg CO₂e** (`total_emisi_gg`) dan ton CO₂e (`total_emisi_ton`) |
| `DATA_EKONOMI_GRK` — `adhk` | PDRB Atas Dasar Harga Konstan; satuan/skala mata uang **belum terkonfirmasi**, tidak diberi label mata uang di UI/dokumentasi sampai dikonfirmasi sumber resmi |
| `DATA_EKONOMI_GRK` — `intensitas_grk` | Gg CO₂e / ADHK (rasio `total_emisi_gg / adhk × 1000`) |

- **Nilai negatif bukan kesalahan data.** Pada sektor Kehutanan, nilai negatif
  menunjukkan **serapan / removal** GRK. Halaman Kehutanan secara khusus memisahkan
  total removal (nilai absolut dari nilai negatif) dan emisi positif.
- Sektor `KEHUTANAN` tidak tersedia sebagai pilihan pada form input bertarget
  `DATA_NASIONAL`, dan sektor `FOLU` tidak tersedia untuk target data kota.
- Aplikasi mengurutkan sektor secara tetap sebagai
  `ENERGI → IPPU → PERTANIAN → KEHUTANAN → LIMBAH` (nasional memakai `FOLU`),
  dan menambahkan sektor lain di belakang bila ditemukan di sheet.
- `changePercent` dihitung terhadap **tahun terdekat sebelumnya yang tersedia**,
  bukan selalu tahun `n - 1`. Bila belum ada pembanding, ditampilkan sebagai `-`.
- Angka diparse oleh `toNumber_()` yang menerima format Indonesia (`1.234,56`)
  maupun format desimal biasa.

---

## Keamanan & Keterbatasan

> Catatan penting sebelum aplikasi dipakai secara luas:

1. **Password disimpan sebagai teks biasa** pada sheet `USERS` dan dibandingkan
   langsung di `verifyLogin()`. Disarankan memakai hashing, atau membatasi akses
   spreadsheet hanya untuk pengelola.
2. **`role` belum dipakai untuk otorisasi.** Semua akun yang berhasil login
   memiliki akses penuh ke halaman *Input Data*.
3. **Sesi disimpan di `sessionStorage`** dan hanya divalidasi di sisi klien;
   `saveEmissionData()` hanya memeriksa keberadaan `currentUser.username`.
4. **`SPREADSHEET_ID` di-hardcode** di `Code.gs`, sehingga aplikasi terikat pada
   satu spreadsheet. Untuk multi-lingkungan (uji/produksi), pindahkan ke
   *Script Properties*.
5. **Belum ada validasi duplikasi data.** Menyimpan tahun + sektor + subsektor yang
   sama dua kali akan menambah baris baru (nilai akan dijumlahkan saat agregasi).
6. **Belum ada fitur edit/hapus.** Koreksi data saat ini dilakukan manual pada
   spreadsheet.
7. Data dibaca ulang dari spreadsheet setiap kali halaman dibuka, sehingga
   performa bergantung pada ukuran sheet.
8. **Unit `adhk` belum terverifikasi** dari metadata/sumber resmi. Jangan menambah
   label mata uang pada UI/dokumentasi sebelum dikonfirmasi; nilai ditampilkan
   sebagai angka ADHK apa adanya.

---

## Pengembangan Lanjutan

Beberapa ide yang sejalan dengan struktur kode saat ini:

- Hashing password + pembatasan hak akses berbasis `role`.
- Fitur edit & hapus record melalui halaman *Input Data*.
- Validasi duplikasi (tahun + sektor + subsektor) sebelum `appendRow()`.
- Ekspor tabel/grafik ke Excel, CSV, atau PDF.
- Halaman target/indikator (mis. perbandingan dengan target penurunan emisi).
- Memindahkan `SPREADSHEET_ID` dan konfigurasi lain ke *Script Properties*.
- Pengujian otomatis untuk `toNumber_()` dan agregasi tahunan.
- Konfirmasi satuan/skala `adhk` dari sumber resmi (BPS/Bapperida) agar dapat
  ditampilkan dengan label satuan mata uang yang benar.
- Dukungan kota lain pada `getEconomicData()` bila suatu saat data mencakup
  lebih dari satu kota (saat ini difilter ke Bontang saja; data lain difilter,
  bukan ditolak dengan error).

---

## Lisensi

Belum ditentukan. Silakan tambahkan berkas `LICENSE` sesuai kebutuhan instansi
(mis. MIT, atau lisensi internal Pemerintah Kota Bontang).

