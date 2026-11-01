# STATUS — Dashboard Emisi GRK Kota Bontang

> Status diperbarui setelah implementasi integrasi `DATA_EKONOMI_GRK` (ADHK & Intensitas GRK) dan format angka Indonesia. Verifikasi dilakukan via pembacaan diff `git diff`, pemeriksaan header sheet dari `emisi_grk.xlsx`, dan syntax-check lokal (lihat bagian Pengujian). Belum diverifikasi di lingkungan deployment Apps Script aktual.

## Ringkasan

- **Estimasi progres keseluruhan:** sekitar 90%. Integrasi ekonomi (backend + 2 chart terpisah + 1 tabel gabungan + KPI + format angka) selesai dan ditempatkan sebagai satu section pada halaman **Emisi Bontang** (bukan page terpisah); risiko keamanan/deployment lama (lihat Risiko) masih terbuka dan jadi blocker produksi.
- **Status:** tahap pengujian, belum siap produksi. Belum diuji di Apps Script deployment sungguhan (hanya syntax-check lokal + pembacaan kode).
- **Integrasi ADHK/Intensitas GRK:** diimplementasikan sebagai 3 KPI, **dua chart terpisah** ("Tren ADHK per Tahun", "Tren Intensitas GRK per Tahun") dan **satu tabel gabungan** ("Data Tahunan Emisi dan Ekonomi Bontang") pada halaman **Emisi Bontang** (`#page-trend`, nav "Emisi Bontang") — bukan halaman Ringkasan, bukan page baru. Chart sengaja dipisah (bukan digabung jadi 1 chart 3-seri, percobaan sebelumnya) karena Total Emisi/ADHK/Intensitas GRK beda skala/satuan jauh — gabung butuh normalisasi indeks yang bikin sumbu Y jadi angka abstrak, kurang jelas dibaca. Backend `getEconomicData()` di `Code.gs`, memfilter baris `kota` = Bontang tanpa peka huruf besar/kecil/spasi tepi.
- **Sumber runtime:** Google Sheets melalui Google Apps Script (tidak diubah; `emisi_grk.xlsx` tetap bukan sumber runtime).
- **File Excel:** contoh data/skema saja, dipakai untuk memverifikasi header sheet (`DATA_EKONOMI_GRK`, `TABEL_NASIONAL`) sebelum implementasi.

## Fitur yang tercatat sudah ada

- Dashboard publik dengan enam halaman: Ringkasan, Tren, Nasional, Sektor/Subsektor, Kehutanan, dan Input Data.
- Visualisasi menggunakan Google Charts, termasuk BarChart, LineChart, dan ComboChart; seluruh kolom numerik chart diformat lewat `google.visualization.NumberFormat` locale `id-ID`.
- Backend Apps Script untuk inisialisasi data, ringkasan, tren sektor, kategori, kehutanan, data emisi nasional, dan **data ekonomi/intensitas GRK (`getEconomicData`)**.
- Login dasar melalui `verifyLogin`.
- Form input melalui `saveEmissionData` dan generator ID.
- Dropdown subsektor yang dapat dicari.
- Pada halaman **Emisi Bontang**: satu section "Data Ekonomi & Intensitas GRK" dengan 3 KPI (Total Emisi, ADHK, Intensitas GRK terbaru + perubahan masing-masing vs tahun sebelumnya), **dua** line chart terpisah (`renderEconomicAdhkChart`, `renderEconomicIntensityChart`), dan **satu** tabel gabungan (`renderEconomicCombinedTable`, kolom Tahun/Total Emisi/ADHK/Intensitas GRK, urut tahun terbaru di atas).
- Helper format angka Indonesia (`formatID`, `formatPercentID`, `formatChartColumns`) dipakai di seluruh KPI/tabel/insight/chart, termasuk chart ADHK dan Intensitas GRK — tidak ada lagi formatter khusus/berbeda untuk chart ekonomi (sempat ada normalisasi indeks + tooltip HTML custom di iterasi sebelumnya, sudah dihapus). Kolom Tahun tidak diberi pemisah ribuan di manapun.

## Perubahan/data terbaru yang tercatat

- Sheet `DATA_EKONOMI_GRK` (verifikasi dari workbook contoh `emisi_grk.xlsx`, sheet7): kolom `tahun`, `kota`, `total_emisi_gg`, `total_emisi_ton`, `adhk`, `intensitas_grk`. 16 baris data valid, tahun 2010–2025, `kota` selalu `"Bontang"` pada data contoh. Backend memfilter `kota` ke Bontang (tidak peka huruf besar/kecil, mengabaikan prefiks "KOTA " dan spasi tepi) agar siap bila data lain (mis. "KOTA BONTANG") masuk nanti.
- Sheet `TABEL_NASIONAL` (sheet3 pada workbook contoh): header `Tahun, ENERGI, IPPU, PERTANIAN, FOLU, LIMBAH, TOTAL` (format pivot). **Diverifikasi berisi data identik** dengan `DATA_NASIONAL` yang sudah dibaca `getNationalEmissionData()` (dicocokkan nilai per baris, mis. tahun 2000 ENERGI=321357.68 sama di keduanya). Keputusan: tidak ditambahkan fungsi backend untuk sheet ini — redundan, akan menduplikasi data yang sudah tersaji di halaman Nasional.
- `Index.html` memiliki perubahan unstaged pra-existing (label nav "Tren"→"Emisi Bontang", h2 "Tren Emisi GRK"→"Emisi GRK Bontang") — **dipertahankan**, tidak disentuh oleh pekerjaan integrasi ekonomi ini.
- Riwayat Git masih satu commit (`0b21e76`); seluruh perubahan integrasi ekonomi **belum di-commit** (sesuai instruksi, tidak ada commit otomatis).

## Pekerjaan yang sudah dilakukan (integrasi ekonomi — chart ADHK & Intensitas GRK dipisah)

- [x] Menambahkan konstanta `EKONOMI_GRK: 'DATA_EKONOMI_GRK'` ke `SHEETS` (`Code.gs:9`).
- [x] `getEconomicData()` (`Code.gs`): membaca `DATA_EKONOMI_GRK`, memfilter `kota` = Bontang (case/spasi-insensitive), memvalidasi baris bertahun valid tetap diikutkan walau sebagian kolom numerik kosong — kolom yang kosong/tidak valid dikembalikan `null` per kolom (bukan drop seluruh baris, bukan dijadikan `0`), dicatat via `console.log`. Urut tahun menaik, kembalikan `years`, `data[]`, `latestYear`, `latest`, `latestAdhk`, `latestIntensitasGrk`, `previousYear`, `adhkChangePercent`, `intensitasChangePercent`. Guard null ditambahkan di perhitungan `changePercent` agar tidak hasil `NaN`/`Infinity` saat nilai pembanding `null`.
- [x] **Chart ADHK dan Intensitas GRK dipisah jadi dua chart** (sebelumnya pernah digabung jadi 1 chart 3-seri dengan normalisasi indeks, lalu dibatalkan): `renderEconomicAdhkChart` (`#economicAdhkChart`) dan `renderEconomicIntensityChart` (`#economicIntensityChart`), masing-masing LineChart 1 seri dengan nilai asli, memakai `formatChartColumns`/`lineOptions()` — pola yang sama dengan chart lain di aplikasi. Mekanisme normalisasi indeks, basis nilai valid pertama, dan tooltip HTML custom (`economicTooltip`, `toIndex`, `firstValid`) sudah **dihapus** karena tidak diperlukan lagi.
- [x] Tabel gabungan **tetap satu**: "Data Tahunan Emisi dan Ekonomi Bontang" (`#economicCombinedTableBody`, `renderEconomicCombinedTable`), kolom Tahun/Total Emisi/ADHK/Intensitas GRK, nilai asli, urut tahun descending (terbaru di atas), sel `null` ditampilkan `—`.
- [x] Kolom "Total Emisi" yang dipakai adalah `totalEmisiGg` (`total_emisi_gg`, Gg CO₂e) — bukan `total_emisi_ton`, tidak dijumlahkan. Data digabung berdasarkan `tahun` dari satu sheet yang sama (tidak ada join lintas-sheet, jadi tidak ada risiko double counting).
- [x] Empty-state dan error-state terisolasi: kegagalan `getEconomicData()` menampilkan pesan di kedua chart ekonomi + mengosongkan tabel (`showEconomicEmptyState()`), tidak mempengaruhi chart lain di halaman Emisi Bontang (matriks sektor tetap tampil normal karena dimuat lewat `google.script.run` terpisah, paralel, bukan berantai). Pemanggilan `loadEconomicData()` paralel di `init()`, tidak blocking load awal.
- [x] README.md, prd.md, agents.md disinkronkan dengan pemisahan chart ADHK/Intensitas GRK.

## Pekerjaan yang belum/tidak dilakukan (tetap gap)

- Memverifikasi satuan/skala `adhk` dari sumber resmi (BPS/Bapperida) — UI sengaja tidak menampilkan label mata uang sampai ini dikonfirmasi.
- Verifikasi end-to-end di Google Apps Script deployment sungguhan (lihat bagian Pengujian — belum dilakukan).

## Blocker produksi yang diketahui (wajib dibaca sebelum go-live)

- Tidak ada `appsscript.json`, `.clasp.json`, `.claspignore` — deployment config absen total.
- Password tersimpan plaintext di sheet `USERS`, dibandingkan sebagai teks biasa di `verifyLogin()`.
- `role` belum ditegakkan sebagai authorization server-side — semua akun yang login punya akses penuh ke Input Data.
- `SPREADSHEET_ID` hardcoded langsung di `Code.gs`, bukan di Script Properties.
- Validasi sesi hanya di sisi client (`sessionStorage`); `saveEmissionData()` hanya memeriksa keberadaan `currentUser.username`, tidak ada pengecekan role/permission server-side.
- Belum ada validasi duplikasi sebelum `appendRow()` — input tahun+sektor+subsektor yang sama dua kali akan menambah baris, bukan menolak/menimpa.
- Belum ada fitur edit/hapus data — koreksi harus manual di spreadsheet.
- Belum ada caching — setiap page load membaca ulang seluruh sheet terkait.
- Belum ada automated test (tidak ada framework test di repo).

Fitur ekonomi (ADHK/Intensitas GRK) ini **tidak menambah** risiko baru ke daftar di atas — hanya menambah fungsi baca (`getEconomicData`, read-only), tidak menyentuh `verifyLogin`, sesi, atau password.

## Risiko produksi yang tercatat

- Password tersimpan plaintext.
- Role belum ditegakkan sebagai authorization server-side.
- Validasi session hanya di sisi client.
- Spreadsheet ID ditulis langsung dalam kode.
- Belum ada validasi duplikasi yang memadai sebelum append.
- Belum tersedia fungsi edit/delete data.
- Pembacaan sheet berulang tanpa caching yang terukur.
- Konfigurasi deployment (`appsscript.json`, `.clasp.json`, `.claspignore`) tercatat belum tersedia.
- Belum ada automated test.

Semua butir di atas harus diverifikasi pada repo saat ini. Jangan menyatakan keamanan produksi siap sebelum risiko kritis ditangani dan diuji.

**Tidak ada risiko baru ditambahkan oleh fitur ekonomi ini.** `getEconomicData()` hanya baca (tidak menulis), tidak menambah kredensial/secret, dan tidak mengekspos `SPREADSHEET_ID` baru ke UI. `verifyLogin`, sesi, dan password tidak disentuh pada revisi ini.

## Pengujian yang dijalankan (aktual)

- `git diff -- Code.gs Index.html Scripts.html Styles.html` — dibaca penuh untuk memverifikasi isi perubahan sebelum dan sesudah implementasi.
- `node -c Code.gs` / `node --check < Code.gs` — syntax-check, **lulus**.
- Formatter `formatID`/`formatPercentID` diuji isolasi dengan `node` untuk nilai positif, negatif, nol, null, undefined, desimal, persen — semua output sesuai format Indonesia yang diharapkan.
- Pembacaan header sheet `DATA_EKONOMI_GRK` dan `TABEL_NASIONAL` langsung dari XML internal `emisi_grk.xlsx` (bukan tebakan) untuk memastikan nama kolom dan menemukan duplikasi `TABEL_NASIONAL` vs `DATA_NASIONAL`.

## Belum diuji / tidak bisa diuji di sesi ini

- Eksekusi nyata `getEconomicData()` terhadap spreadsheet produksi (`SpreadsheetApp.openById` butuh lingkungan Apps Script, tidak tersedia secara lokal).
- Rendering kedua chart dan tabel di browser sungguhan (Google Charts butuh DOM nyata; `node` hanya memverifikasi syntax, bukan rendering SVG/canvas Google Charts).
- Deployment/Web App end-to-end.
- Checklist manual yang disarankan sebelum go-live:
  1. Login sebagai operator → buka halaman **Emisi Bontang** → konfirmasi matriks sektor (chart+tabel lama) tampil seperti biasa.
  2. Scroll ke section "Data Ekonomi & Intensitas GRK" → konfirmasi 3 KPI (Total Emisi, ADHK, Intensitas GRK) tampil dengan nilai tahun terbaru dan format `1.234,56`.
  3. Konfirmasi **dua** chart terpisah tampil: "Tren ADHK per Tahun" dan "Tren Intensitas GRK per Tahun", masing-masing 1 garis, axis Y format `id-ID`, tooltip default Google Charts menunjukkan nilai asli.
  4. Konfirmasi **satu** tabel "Data Tahunan Emisi dan Ekonomi Bontang" di bawah kedua chart, urut tahun terbaru di atas, format `id-ID` pada isi sel.
  5. Hapus/kosongkan sementara sheet `DATA_EKONOMI_GRK` di spreadsheet uji → reload → konfirmasi kedua chart + tabel menampilkan empty state ("Data ekonomi belum tersedia"), sementara chart/tabel sektor di atasnya tetap normal (bukti isolasi kegagalan).
  6. Di sheet uji, kosongkan kolom `adhk` pada satu baris (tahun tetap terisi) → reload → konfirmasi baris itu tetap tampil di tabel dengan sel ADHK berisi `—`, bukan `0` dan bukan baris yang hilang total.
  7. Rename sheet `DATA_EKONOMI_GRK` → reload → konfirmasi pesan error informatif tampil, bukan crash console, dan halaman lain tetap berfungsi.
  8. Tambahkan baris dengan `kota` = "KOTA BONTANG" atau " bontang " di sheet uji → reload → konfirmasi baris tersebut ikut tampil (filter case/spasi-insensitive bekerja).

## Urutan prioritas (sisa)

1. Jalankan verifikasi manual di Apps Script deployment sungguhan (lihat checklist Pengujian) — belum dilakukan, hanya syntax-check lokal.
2. Konfirmasi unit/skala `adhk` dari sumber resmi, lalu update label KPI bila sudah pasti.
3. Tangani blocker produksi (lihat daftar di atas: `appsscript.json`/`.clasp.json`, password plaintext, authz role, session server-side, `SPREADSHEET_ID` hardcoded, validasi duplikasi, edit/hapus data, caching, test otomatis) sebelum go-live — di luar scope fitur ekonomi ini, sengaja tidak disentuh.

## Log implementasi

| Tanggal | Perubahan | Verifikasi |
|---|---|---|
| Belum dicatat | Baseline dokumen dibuat dari ringkasan audit | Harus diverifikasi oleh coding agent |
| 2026-10-19 | Tambah `EKONOMI_GRK` ke `SHEETS` + `getEconomicEmissionData()` di `Code.gs` | `grep -n "EKONOMI_GRK\|getEconomicEmissionData" Code.gs` (ditemukan); `node --check < Code.gs` (lulus, tanpa output) |
| 2026-10-19 | KPI ADHK & Intensitas GRK + chart tren di `Index.html`/`Scripts.html`/`Styles.html` (lokasi awal: halaman Ringkasan); helper format Indonesia diterapkan ke seluruh chart lama & baru | Re-read penuh ketiga file; `node` test formatter lokal |
| 2026-10-19 | README.md, prd.md, agents.md disinkronkan (iterasi pertama) | Pembacaan manual seluruh file setelah edit |
| 2026-10-19 | **Revisi:** rename `getEconomicEmissionData` → `getEconomicData` di `Code.gs`; tambah filter `kota` Bontang case/spasi-insensitive; tambah `console.log` per baris dilewati; pecah `changePercent` jadi `adhkChangePercent`/`intensitasChangePercent` | `node --check < Code.gs` (lulus); `grep -n "getEconomicEmissionData" Code.gs` (kosong, nama lama sudah tidak ada) |
| 2026-10-19 | **Revisi:** pindahkan section ekonomi dari halaman Ringkasan ke halaman Emisi Bontang (`#page-trend`); tambah tabel ADHK dan tabel Intensitas GRK (sebelumnya hanya KPI+chart); isolasi empty/error-state per section | Re-read penuh `Index.html`/`Scripts.html`; `grep -n 'id="economic'` di `Index.html` (tidak ada id duplikat); `node -e` syntax-check `Scripts.html` via `new Function()` (lulus); `grep -n "toFixed\|toLocaleString"` di `Scripts.html` (kosong) |
| 2026-10-19 | README.md, prd.md, agents.md, status.md disinkronkan ulang dengan lokasi UI dan nama fungsi hasil revisi | Pembacaan manual seluruh file setelah edit |
| 2026-10-19 | **Revisi:** gabungkan 2 chart + 2 tabel (ADHK, Intensitas GRK) jadi 1 chart 3-seri + 1 tabel 4-kolom di `Index.html`/`Scripts.html`; backend `getEconomicData()` diubah agar kolom kosong per baris jadi `null` (bukan drop seluruh baris); guard null ditambah di perhitungan `changePercent`; chart pakai normalisasi indeks (basis = nilai valid pertama per indikator) + tooltip HTML custom nilai asli; axis pakai pattern `"#.#"` (bukan `"decimal"`, untuk hindari grouping locale `id` tak diinginkan) | `node --check < Code.gs` (lulus); `node -e` syntax-check `Scripts.html` (lulus); simulasi logic `firstValid`/`toIndex` dengan data mengandung `null` via `node` — 4 assert lulus (base skip null awal, index null saat value/base null, index 100 pas di basis); simulasi `sort`+`cell` tabel via `node` — 3 assert lulus (urut descending, `null`→`—`, format `id-ID` benar); `grep` id Index.html vs Scripts.html (semua cocok, tidak ada sisa id lama) |
| 2026-10-19 | README.md, prd.md, agents.md, status.md disinkronkan ulang dengan penggabungan chart/tabel dan aturan 3 formatter berbeda | Pembacaan manual seluruh file setelah edit |
| 2026-10-20 | **Revisi:** pisah kembali chart gabungan 3-seri jadi 2 chart terpisah (`renderEconomicAdhkChart`, `renderEconomicIntensityChart`) di `Index.html`/`Scripts.html` karena skala/satuan Total Emisi/ADHK/Intensitas GRK terlalu beda untuk 1 sumbu Y; tabel gabungan ("Data Tahunan Emisi dan Ekonomi Bontang") **tetap satu**, tidak dipecah. Hapus `renderEconomicCombinedChart`, `economicTooltip`, `toIndex`, `firstValid`. Backend `getEconomicData()` tidak diubah. | `node --check < Code.gs` (lulus); `node -e` syntax-check `Scripts.html` via `new Function()` (lulus); `grep -n "economicCombinedChart\|toIndex\|firstValid\|economicTooltip"` di `Index.html`/`Scripts.html` (kosong/bersih); `grep` id `economic*` Index.html vs Scripts.html (semua cocok) |
| 2026-10-20 | README.md, prd.md, agents.md, status.md disinkronkan ulang: hapus narasi "1 chart gabungan 3-seri dengan normalisasi indeks", ganti jadi "2 chart terpisah + 1 tabel gabungan" | Pembacaan manual seluruh file setelah edit |

## Template laporan setelah pekerjaan

- **Selesai:** daftar perubahan aktual.
- **File berubah:** daftar path.
- **Pengujian dijalankan:** perintah dan hasil sebenarnya.
- **Belum selesai:** daftar gap.
- **Risiko:** dampak dan mitigasi.
- **Deploy:** tidak dilakukan kecuali diminta secara eksplisit.
