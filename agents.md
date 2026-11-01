# AGENTS — Panduan untuk Coding Agent

Instruksi ini berlaku untuk OpenCode, Claude Code, Codex CLI, atau coding agent lain yang bekerja pada repository dashboard GRK.

## Prinsip utama

1. Baca kode dan dokumentasi sebelum mengubah apa pun.
2. Pertahankan arsitektur Google Apps Script + Google Sheets yang sudah ada.
3. `emisi_grk.xlsx` hanya workbook contoh untuk memeriksa data/schema; bukan sumber runtime.
4. Kerjakan perubahan kecil dan terfokus. Hindari rewrite besar tanpa kebutuhan.
5. Jangan menghapus atau menimpa perubahan pengguna yang belum di-commit.
6. Jangan membuat commit, push, deploy, atau mengubah data produksi tanpa instruksi eksplisit.
7. Jangan mengarang schema, unit, rumus, data, atau hasil pengujian.
8. Jangan menyebut fitur selesai sebelum memeriksa implementasi dan menjalankan verifikasi yang relevan.

## Protokol awal

Sebelum coding, jalankan dan periksa:

```bash
git status --short
git diff -- Index.html Code.gs Scripts.html Styles.html README.md
git log -5 --oneline
```

Periksa file instruksi dan dokumentasi yang ada, termasuk variasi kapitalisasi nama:
- `AGENTS.md` / `agents.md`
- `README.md`
- `prd.md` / `PRD.md`
- `status.md` / `STATUS.md`

Jangan melakukan `git checkout --`, `git reset --hard`, `git clean`, atau perintah destruktif lain untuk menghilangkan perubahan kerja.

## Arsitektur dan sumber data

- Runtime data harus tetap melalui `SpreadsheetApp` atau helper Google Sheets yang sudah dipakai.
- Jangan menggunakan `xlsx` sebagai backend runtime.
- Ikuti pola backend yang sudah ada, khususnya fungsi data nasional dan pola pemanggilan `google.script.run`.
- Verifikasi nama sheet dan header aktual sebelum menambahkan mapping.
- Sheet ekonomi: `DATA_EKONOMI_GRK`, sudah dibaca oleh `getEconomicData()` (`Code.gs`), difilter ke `kota` Bontang (case/spasi-insensitive). Kolom: `tahun`, `kota`, `total_emisi_gg`, `total_emisi_ton`, `adhk`, `intensitas_grk`. Nilai numerik kosong/tidak valid dikembalikan sebagai `null` per kolom (baris tidak di-drop total hanya karena satu kolom kosong), bukan `0`. UI-nya adalah 3 KPI + **dua chart terpisah** (`renderEconomicAdhkChart`, `renderEconomicIntensityChart`) + **satu tabel gabungan** (`renderEconomicCombinedTable`) pada halaman Emisi Bontang (`#page-trend`), bukan halaman Ringkasan.
- Kolom "Total Emisi" yang dipakai adalah `total_emisi_gg` (satuan Gg CO₂e, konsisten dengan chart lain), bukan `total_emisi_ton`. Jangan menjumlahkan kedua kolom itu.
- Chart ADHK dan Intensitas GRK **sengaja dipisah** (bukan digabung jadi satu chart 3-seri) karena skala/satuan Total Emisi, ADHK, dan Intensitas GRK berbeda jauh — menggabungkannya butuh normalisasi indeks yang membuat sumbu Y jadi angka abstrak, kurang jelas dibaca. Kedua chart memakai nilai asli dan pola `formatChartColumns`/`lineOptions()` yang sama dengan chart lain di aplikasi — jangan menambah mekanisme normalisasi/tooltip custom kembali tanpa alasan baru.
- Sheet `TABEL_NASIONAL`: header terverifikasi `Tahun, ENERGI, IPPU, PERTANIAN, FOLU, LIMBAH, TOTAL`, data identik dengan `DATA_NASIONAL`. **Sengaja tidak diintegrasikan** — jangan tambahkan fungsi backend baru untuknya tanpa alasan baru, akan menduplikasi `getNationalEmissionData()`.
- Jangan mencampur total sektor dengan total kategori jika menyebabkan double counting.
- Jangan mengasumsikan unit ADHK atau definisi Intensitas GRK; unit `adhk` masih belum terkonfirmasi dari sumber resmi — jangan menambahkan label mata uang di kode/dokumentasi manapun sampai dikonfirmasi.

## Format angka

Gunakan format angka Indonesia untuk semua angka yang ditampilkan:
- Pemisah ribuan titik.
- Pemisah desimal koma.
- Contoh `187.635,13`.

Aturan:
- Gunakan `Intl.NumberFormat('id-ID')` untuk teks, KPI, tabel, dan insight.
- Gunakan formatter Google Charts dengan grouping symbol `.` dan decimal symbol `,` untuk kolom, axis, tooltip, dan label yang relevan.
- Pertahankan angka internal sebagai number.
- Jangan memakai string berformat sebagai input kalkulasi/chart.
- Uji nilai positif, negatif, nol, kosong, dan desimal.
- Pastikan persentase menggunakan jumlah digit desimal yang masuk akal dan konsisten.

## Keamanan

- Jangan menambahkan password plaintext, token, atau secret baru.
- Jangan memindahkan secret ke HTML/frontend.
- Jangan mengklaim role-based authorization berjalan jika pemeriksaan role tidak dilakukan server-side pada setiap fungsi sensitif.
- Jangan menganggap session yang hanya disimpan/ditinjau client-side sebagai mekanisme otorisasi yang aman.
- Jika memindahkan Spreadsheet ID ke Script Properties, dokumentasikan nama property dan cara konfigurasi; pastikan jalur deployment yang ada tidak rusak.
- Jangan menulis data produksi saat pengujian tanpa persetujuan.
- Catat risiko keamanan yang belum ditangani di `status.md`.

## Standar implementasi

- Gunakan nama fungsi dan gaya yang konsisten dengan codebase.
- Validasi sheet/header/tipe data dan tampilkan error yang dapat ditindaklanjuti.
- Hindari nilai default `0` untuk data yang sebenarnya hilang atau invalid, kecuali semantik nol memang benar.
- Tampilkan empty state saat data tidak tersedia.
- Pertahankan responsive design dan navigasi halaman lama.
- Hindari menambah dependency bila kemampuan bawaan Apps Script/Google Charts cukup.
- Perhatikan performa; jangan menambahkan pembacaan sheet berulang yang tidak perlu.

## Pengujian dan pelaporan

Jalankan test atau pemeriksaan yang tersedia. Jika automated test tidak ada, jangan berpura-pura test otomatis telah dijalankan; berikan checklist manual.

Laporan akhir harus mencantumkan:
1. Ringkasan perubahan.
2. Daftar file yang berubah.
3. Perintah/pengujian yang benar-benar dijalankan beserta hasilnya.
4. Hal yang belum selesai.
5. Risiko yang tersisa.
6. Konfirmasi bahwa tidak ada deploy/commit/push jika memang tidak dilakukan.

## Dokumen yang wajib dipelihara

- `prd.md`: tujuan, ruang lingkup, kontrak data, kebutuhan, acceptance criteria.
- `status.md`: status aktual, perubahan, pengujian, gap, dan risiko.
- `agents.md`: aturan kerja coding agent.
- `README.md`: instruksi penggunaan, struktur spreadsheet aktual, konfigurasi dan deployment.

Jika repository sudah memiliki dokumen dengan nama/kapitalisasi berbeda, hindari membuat duplikat yang membingungkan. Periksa kebiasaan repo lalu selaraskan dokumen yang menjadi sumber utama.
