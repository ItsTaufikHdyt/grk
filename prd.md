# PRD — Dashboard Emisi GRK Kota Bontang

## 1. Ringkasan Produk

Dashboard Emisi Gas Rumah Kaca (GRK) Kota Bontang adalah web app berbasis Google Apps Script yang menyajikan ringkasan, tren, perbandingan nasional, analisis sektor/subsektor, kehutanan, serta input data sesuai hak akses yang diterapkan aplikasi.

Sumber data runtime tetap Google Sheets. File `emisi_grk.xlsx` hanya digunakan sebagai contoh struktur data dan referensi pengembangan, bukan sebagai sumber data produksi.

## 2. Latar Belakang

Dashboard telah memiliki backend inti, autentikasi dasar, lima halaman dashboard publik, dan form input. Dataset baru memperkenalkan `DATA_EKONOMI_GRK` dengan kolom `tahun`, `kota`, `total_emisi_gg`, `total_emisi_ton`, `adhk`, dan `intensitas_grk`. Integrasi backend (`getEconomicData()`) dan visualisasinya **sudah diimplementasikan** sebagai 3 KPI + **dua chart terpisah** ("Tren ADHK per Tahun", "Tren Intensitas GRK per Tahun" — dipisah karena skala/satuan berbeda jauh, menggabungkan ke satu chart butuh normalisasi indeks yang kurang jelas dibaca) + **satu tabel gabungan** ("Data Tahunan Emisi dan Ekonomi Bontang", nilai asli) pada halaman **Emisi Bontang** — bukan halaman baru, bukan halaman Ringkasan. Lihat `status.md` untuk rincian verifikasi dan sisa gap (unit `adhk` belum terkonfirmasi, belum diuji di deployment Apps Script sungguhan).

Selain itu, tampilan angka perlu distandardisasi ke format Indonesia agar konsisten dan mudah dibaca oleh pengguna pemerintah daerah.

## 3. Tujuan

- Menampilkan metrik ADHK dan Intensitas GRK dari Google Sheets.
- Menyajikan tren Intensitas GRK per tahun.
- Memastikan penyajian angka konsisten dengan locale Indonesia.
- Menjaga fitur dashboard yang ada tetap berjalan.
- Menjaga dokumentasi dan status proyek sesuai kondisi implementasi aktual.

## 4. Pengguna dan Kebutuhan

- **Pimpinan/pengambil keputusan:** membutuhkan ringkasan emisi, tren, dan indikator ekonomi yang mudah dipahami.
- **Analis/perencana:** membutuhkan tren tahunan dan rincian data yang dapat diverifikasi.
- **Operator data:** membutuhkan alur input yang konsisten dengan struktur Google Sheets dan validasi yang jelas.
- **Publik:** membutuhkan visualisasi yang informatif tanpa mengungkap data sensitif atau kredensial.

## 5. Ruang Lingkup

### Termasuk
- Integrasi backend untuk membaca `DATA_EKONOMI_GRK`.
- Pemanfaatan `TABEL_NASIONAL` hanya berdasarkan header dan penggunaan aktual yang diverifikasi.
- KPI Total Emisi, ADHK, dan Intensitas GRK (nilai terbaru + perubahan vs tahun sebelumnya).
- **Dua** chart garis terpisah: "Tren ADHK per Tahun" dan "Tren Intensitas GRK per Tahun" — tidak digabung jadi satu chart karena skala/satuan Total Emisi, ADHK, dan Intensitas GRK berbeda jauh; menggabungkannya butuh normalisasi indeks yang membuat sumbu Y jadi angka abstrak, kurang jelas dibaca langsung.
- **Satu** tabel gabungan (kolom: Tahun, Total Emisi, ADHK, Intensitas GRK, nilai asli bukan indeks), data digabung berdasarkan `tahun`, bukan posisi baris.
- Filter tahun/kota jika sesuai dengan desain yang sudah ada.
- Format angka Indonesia pada KPI, axis chart, tooltip, tabel, dan insight — memakai pola formatter yang sama (`formatChartColumns`/`formatNumber`) seperti chart lain di aplikasi, tidak ada aturan format khusus untuk chart ekonomi.
- Pembaruan README serta dokumen proyek.

### Tidak termasuk kecuali diminta terpisah
- Mengganti Google Sheets dengan file Excel atau database lain.
- Menulis ulang seluruh aplikasi.
- Membuat halaman baru jika metrik dapat ditempatkan secara wajar sebagai section pada halaman Emisi Bontang (keputusan aktual: ditempatkan di halaman Emisi Bontang/`page-trend`).
- Mengklaim pengamanan autentikasi/otorisasi telah selesai tanpa implementasi dan pengujian.
- Deploy atau mengubah data produksi secara otomatis.
- Mengubah definisi indikator ekonomi tanpa sumber resmi.

## 6. Sumber Data dan Kontrak

### `DATA_EKONOMI_GRK`
Kolom yang diketahui dari contoh:
- `tahun`
- `kota`
- `total_emisi_gg`
- `total_emisi_ton`
- `adhk`
- `intensitas_grk`

Terverifikasi dari header aktual workbook contoh (sheet `DATA_EKONOMI_GRK`): 16 baris data tahun 2010–2025, `kota` selalu `"Bontang"` (unik per tahun, satu kota). Unit `adhk` **belum terkonfirmasi** dari sumber resmi — backend/UI tidak mengasumsikan mata uang. `intensitas_grk` secara aritmetis konsisten dengan `total_emisi_gg / adhk × 1000` (diverifikasi dari nilai contoh), ditampilkan sebagai rasio "Gg CO₂e / ADHK".

### `TABEL_NASIONAL`
Header aktual terverifikasi: `Tahun, ENERGI, IPPU, PERTANIAN, FOLU, LIMBAH, TOTAL` (format pivot per tahun). **Keputusan:** sheet ini berisi data yang identik dengan `DATA_NASIONAL` (format panjang, sudah dibaca `getNationalEmissionData()`) — dicocokkan nilai per baris. Sheet ini adalah referensi/staging, **tidak diintegrasikan ke backend/UI** karena akan menduplikasi data yang sudah tersaji di halaman Nasional.

### Sumber runtime
Semua pembacaan data produksi dilakukan melalui Google Apps Script dan Google Sheets. Excel hanya bahan referensi untuk pengembangan/pemeriksaan skema.

## 7. Kebutuhan Fungsional

1. Sistem membaca data ekonomi dari `DATA_EKONOMI_GRK`.
2. Sistem memvalidasi keberadaan sheet, kolom wajib, tahun, dan nilai numerik.
3. Sistem dapat menyajikan ADHK dan Intensitas GRK untuk tahun/kota yang relevan.
4. Sistem menampilkan tren Intensitas GRK dengan urutan tahun menaik.
5. Sistem menampilkan empty state jika data tidak tersedia.
6. Sistem mempertahankan fungsi Ringkasan, Tren, Nasional, Sektor/Subsektor, Kehutanan, login, dan form input.
7. Sistem tidak menjumlahkan total sektor dan kategori ke dalam total yang sama sehingga terjadi double counting.
8. Nilai negatif kehutanan tetap dipertahankan dan dijelaskan sesuai definisi data sebagai removal/serapan jika memang itu makna datanya.
9. Angka tampilan mengikuti format Indonesia: `1.234,56`.
10. Nilai numerik internal tetap bertipe number untuk kalkulasi dan chart.

## 8. Kebutuhan Nonfungsional

- **Kompatibilitas:** mengikuti pola Apps Script, HTML/CSS/JavaScript, Google Charts, dan `google.script.run` yang sudah ada.
- **Responsif:** tampilan tetap dapat digunakan pada layar desktop dan perangkat lebih kecil.
- **Keandalan:** sheet/kolom yang hilang menghasilkan pesan yang jelas, bukan angka palsu.
- **Keamanan:** tidak mengekspos kredensial atau menambah rahasia ke frontend; otorisasi harus diverifikasi di server.
- **Pemeliharaan:** kode mengikuti struktur repository dan perubahan seminimal mungkin.
- **Dokumentasi:** README dan status mencerminkan implementasi aktual.

## 9. Format Angka

Contoh format yang diharapkan:
- `1234` → `1.234`
- `1234.56` → `1.234,56`
- `-1234.56` → `-1.234,56`
- Persentase `0.125` jika memang berupa proporsi → `12,5%`

Gunakan `Intl.NumberFormat('id-ID')` untuk teks dan formatter Google Charts yang sesuai untuk axis, tooltip, serta label. Jangan memformat nilai menjadi string sebelum kalkulasi.

## 10. Kriteria Penerimaan

- [x] `DATA_EKONOMI_GRK` dibaca melalui Spreadsheet service (`getEconomicData()`, tidak membaca Excel), difilter ke `kota` Bontang (case/spasi-insensitive).
- [x] Halaman Emisi Bontang punya 3 KPI, **dua** chart terpisah (ADHK, Intensitas GRK — tidak digabung karena beda skala/satuan), dan **satu** tabel gabungan untuk Total Emisi, ADHK, dan Intensitas GRK.
- [x] Data digabung berdasarkan `tahun` dari satu sheet (`DATA_EKONOMI_GRK`), bukan posisi baris; tidak ada risiko double counting karena tidak digabung dengan `DATA_SEKTOR`/`DATA_NASIONAL`.
- [x] Chart ADHK dan Intensitas GRK memakai nilai asli (bukan indeks ternormalisasi) dan formatter yang sama dengan chart lain di aplikasi (`formatChartColumns`, format Indonesia pada axis/tooltip).
- [x] Tabel gabungan memakai `formatNumber()` (format Indonesia) pada nilai asli.
- [x] Nilai kosong/tidak valid per kolom dikembalikan backend sebagai `null` (bukan `0`), ditampilkan tabel sebagai `—`; KPI/perubahan persen menampilkan "Belum ada tahun pembanding" bila data pembanding `null`.
- [x] Kolom "Total Emisi" yang dipakai adalah `total_emisi_gg` (Gg CO₂e), bukan `total_emisi_ton`, tidak dijumlahkan.
- [x] Tren diurutkan ascending untuk chart (dijamin backend), tabel diurutkan descending (tahun terbaru di atas) sesuai permintaan keterbacaan.
- [x] Data kosong: struktur kosong + empty-state UI pada chart dan tabel. Sheet hilang/header salah: error dari `getSheetObjects_` diteruskan ke `withFailureHandler`, ditampilkan sebagai pesan informatif, bukan crash diam-diam.
- [x] Halaman dan fitur lama tidak rusak (diverifikasi via code review diff dan syntax-check, bukan uji end-to-end di browser/deployment — lihat `status.md`).
- [x] README, PRD, status, agents diperbarui.
- [x] Tidak ada klaim test otomatis/deployment yang tidak dijalankan — lihat `status.md` bagian Pengujian untuk daftar yang benar-benar dijalankan vs belum.

## 11. Risiko dan Asumsi

- Unit dan definisi ADHK/Intensitas GRK perlu dikonfirmasi dari metadata atau sumber data.
- Skema `TABEL_NASIONAL` perlu diverifikasi.
- Catatan proyek menunjukkan password plaintext, otorisasi berbasis role belum ditegakkan, session hanya divalidasi di client, Spreadsheet ID hardcoded, serta belum ada test otomatis. Risiko ini harus tetap terlihat dan tidak dianggap selesai hanya karena fitur ekonomi ditambahkan.
