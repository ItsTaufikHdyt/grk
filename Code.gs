/**
 * DASHBOARD EMISI GRK KOTA BONTANG — BACKEND
 *
 * Perubahan utama dibanding versi sebelumnya:
 * - Sesi login diverifikasi di server (token acak di CacheService), bukan objek user dari browser.
 * - Hak tulis dicek berdasarkan role di server.
 * - Password bisa disimpan sebagai hash SHA-256 + salt (jalankan hashAllPasswords() sekali).
 * - Penulisan data memakai LockService (ID tidak bentrok) dan mencegah data ganda.
 * - Validasi tahun, nilai, sektor, dan subsektor dilakukan di server.
 * - Parsing angka format Indonesia diperbaiki ("1.234" = 1234, "1.234,5" = 1234,5).
 * - Pembacaan sheet di-cache 10 menit dan dibersihkan otomatis setiap ada data baru.
 */

/* =========================
   KONFIGURASI
========================= */
// ID spreadsheet bisa dipindah ke Script Properties dengan key SPREADSHEET_ID.
// Jika properti belum diisi, nilai default di bawah dipakai.
const DEFAULT_SPREADSHEET_ID = '1y_iGmLt5sOXkPkhs536KTgC8XJX3hTssYuvIya9pKjA';

// true = dashboard boleh di-embed di situs lain (misalnya geoportal).
// Ubah ke false jika dashboard tidak di-embed, agar terlindung dari clickjacking.
const ALLOW_EMBED = true;

const SESSION_TTL_SECONDS = 6 * 60 * 60; // maksimum CacheService = 6 jam
const DATA_CACHE_TTL_SECONDS = 10 * 60;
const MAX_CACHE_BYTES = 95000; // batas CacheService per key = 100 KB

// Role yang boleh menambah/mengubah data. 'user' dipertahankan karena itu
// role default di versi lama; hapus dari daftar jika ingin lebih ketat.
const WRITE_ROLES = ['admin', 'operator', 'user'];

const SHEETS = {
  SEKTOR: 'DATA_SEKTOR',
  SUBSEKTOR: 'DATA_SUBSEKTOR',
  MASTER_SEKTOR: 'MASTER_SEKTOR',
  MASTER_SUBSEKTOR: 'MASTER_SUBSEKTOR',
  NASIONAL: 'DATA_NASIONAL',
  EKONOMI_GRK: 'DATA_EKONOMI_GRK',
  USERS: 'USERS'
};

const WRITABLE_SHEETS = [SHEETS.SEKTOR, SHEETS.SUBSEKTOR, SHEETS.NASIONAL];
const BONTANG_SECTOR_ORDER = ['ENERGI', 'IPPU', 'PERTANIAN', 'KEHUTANAN', 'LIMBAH'];
const NATIONAL_SECTOR_ORDER = ['ENERGI', 'IPPU', 'PERTANIAN', 'FOLU', 'LIMBAH'];

/* =========================
   ENTRY POINT
========================= */
function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Dashboard Emisi GRK Kota Bontang')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(ALLOW_EMBED
      ? HtmlService.XFrameOptionsMode.ALLOWALL
      : HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* =========================
   AUTENTIKASI & SESI
========================= */
function verifyLogin(username, password) {
  try {
    const uname = String(username || '').trim().toLowerCase();
    const pass = String(password || '');
    if (!uname || !pass) {
      return { success: false, message: 'Username dan password wajib diisi.' };
    }

    // Sheet USERS sengaja tidak di-cache karena berisi kredensial.
    const users = getSheetObjects_(SHEETS.USERS, { noCache: true });
    const user = users.find(u => String(u.username || '').trim().toLowerCase() === uname);

    if (!user || !passwordMatches_(user, pass)) {
      Utilities.sleep(400); // memperlambat tebakan password
      return { success: false, message: 'Username atau password salah.' };
    }

    if (!isUserActive_(user)) {
      return { success: false, message: 'Akun ini tidak aktif. Hubungi admin.' };
    }

    const sessionUser = {
      username: String(user.username).trim(),
      nama: String(user.nama || user.username).trim(),
      role: String(user.role || 'user').trim().toLowerCase()
    };

    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    CacheService.getScriptCache().put('session:' + token, JSON.stringify(sessionUser), SESSION_TTL_SECONDS);

    return {
      success: true,
      token,
      user: sessionUser,
      canWrite: WRITE_ROLES.includes(sessionUser.role)
    };
  } catch (err) {
    console.error('verifyLogin gagal: ' + (err && err.stack || err));
    return { success: false, message: 'Login gagal karena kendala sistem. Coba lagi beberapa saat lagi.' };
  }
}

/** Dipanggil frontend saat halaman dibuka untuk memastikan token lama masih berlaku. */
function validateSession(token) {
  const user = getSessionUser_(token);
  if (!user) return null;
  return { user, canWrite: WRITE_ROLES.includes(user.role) };
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('session:' + String(token));
  return true;
}

function getSessionUser_(token) {
  if (!token || typeof token !== 'string' || token.length < 32) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('session:' + token);
  if (!raw) return null;
  cache.put('session:' + token, raw, SESSION_TTL_SECONDS); // perpanjang sesi aktif
  return JSON.parse(raw);
}

function requireWriter_(token) {
  const user = getSessionUser_(token);
  if (!user) throw new Error('Sesi login sudah berakhir. Silakan login kembali.');
  if (!WRITE_ROLES.includes(user.role)) {
    throw new Error('Akun Anda tidak memiliki izin untuk menambah data.');
  }
  return user;
}

function passwordMatches_(user, password) {
  const storedHash = String(user.password_hash || '').trim().toLowerCase();
  if (storedHash) {
    return hashPassword_(password, String(user.salt || '')) === storedHash;
  }
  // Kompatibilitas: password lama yang masih teks biasa.
  const plain = String(user.password || '');
  if (!plain) return false;
  console.warn('User "' + user.username + '" masih memakai password teks biasa. Jalankan hashAllPasswords().');
  return plain.trim() === password.trim();
}

function isUserActive_(user) {
  if (!Object.prototype.hasOwnProperty.call(user, 'aktif')) return true;
  const value = String(user.aktif).trim().toLowerCase();
  return !['false', 'tidak', 'nonaktif', 'no', '0'].includes(value);
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/**
 * JALANKAN MANUAL SEKALI dari editor Apps Script (Run > hashAllPasswords).
 * Menambahkan kolom password_hash & salt di sheet USERS, mengisinya dari
 * kolom password, lalu mengosongkan kolom password teks biasa.
 */
function hashAllPasswords() {
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.USERS);
  if (!sheet) throw new Error('Sheet USERS tidak ditemukan.');

  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase());

  ['password_hash', 'salt'].forEach(name => {
    if (!headers.includes(name)) {
      sheet.getRange(1, headers.length + 1).setValue(name);
      headers.push(name);
    }
  });

  const passCol = headers.indexOf('password');
  const hashCol = headers.indexOf('password_hash');
  const saltCol = headers.indexOf('salt');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || passCol < 0) return 'Tidak ada password yang perlu di-hash.';

  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const values = range.getValues();
  let count = 0;

  values.forEach(row => {
    const plain = String(row[passCol] || '').trim();
    if (!plain) return;
    const salt = Utilities.getUuid().replace(/-/g, '');
    row[saltCol] = salt;
    row[hashCol] = hashPassword_(plain, salt);
    row[passCol] = '';
    count++;
  });

  range.setValues(values);
  return count + ' password berhasil di-hash.';
}

/**
 * Bantuan admin: buat hash untuk password baru tanpa menyimpannya.
 * Contoh di editor: Logger.log(makePasswordHash('rahasia123'))
 */
function makePasswordHash(password) {
  const salt = Utilities.getUuid().replace(/-/g, '');
  return { salt, password_hash: hashPassword_(password, salt) };
}

/* =========================
   MASTER DATA FORM INPUT
========================= */
function getMasterFormData() {
  const masterSektor = getSheetObjects_(SHEETS.MASTER_SEKTOR);
  const masterSubsektor = getSheetObjects_(SHEETS.MASTER_SUBSEKTOR);

  const sektorList = masterSektor
    .map(s => ({
      sektorId: String(s.sektor_id || '').trim(),
      kode: normalizeSector_(s.kode_sektor),
      nama: String(s.nama_sektor || '').trim()
    }))
    .filter(s => s.kode);

  const sektorIdByKode = {};
  sektorList.forEach(s => { sektorIdByKode[s.kode] = s.sektorId; });

  // Catatan penamaan kolom MASTER_SUBSEKTOR (mengikuti struktur lama):
  // kategori_id = ID subsektor, subsektor = kode sektor induk,
  // nama_kategori = nama subsektor. Nama kolom alternatif tetap didukung.
  const subsektorList = masterSubsektor
    .map(k => {
      const sektor = normalizeSector_(k.subsektor || k.sektor);
      return {
        subsektorId: String(k.kategori_id || k.subsektor_id || '').trim(),
        sektor,
        sektorId: sektorIdByKode[sektor] || String(k.sektor_id || '').trim(),
        nama: String(k.nama_kategori || k.nama_subsektor || '').trim()
      };
    })
    .filter(k => k.subsektorId && k.sektor && k.nama);

  return { sektorList, subsektorList };
}

/* =========================
   SIMPAN DATA INPUT
========================= */
/**
 * @param {Object} formData {targetTabel, tahun, sektor, subsektorId, nilai, overwrite}
 * @param {string} token    token sesi dari verifyLogin
 */
function saveEmissionData(formData, token) {
  const user = requireWriter_(token);
  const input = validateEmissionInput_(formData || {});

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('Sistem sedang menyimpan data lain. Silakan coba lagi sebentar lagi.');
  }

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(input.targetTabel);
    if (!sheet) throw new Error('Sheet ' + input.targetTabel + ' tidak ditemukan.');

    const existing = findExistingRows_(sheet, input);

    if (existing.rows.length && !formData.overwrite) {
      return {
        success: false,
        duplicate: true,
        existingValue: existing.rows[0].value,
        message: 'Data untuk kombinasi ini sudah ada.'
      };
    }

    const jenisNilai = input.targetTabel === SHEETS.NASIONAL
      ? 'EMISI'
      : (input.nilai < 0 ? 'Serapan/Removal' : (input.targetTabel === SHEETS.SEKTOR ? 'Emisi/Net' : 'Emisi'));

    let recordId;
    let rowNumber;
    let updated = false;

    if (existing.rows.length) {
      const target = existing.rows[0];
      rowNumber = target.rowNumber;
      recordId = target.id;
      sheet.getRange(rowNumber, existing.valueCol + 1).setValue(input.nilai);
      if (existing.jenisCol >= 0 && input.targetTabel !== SHEETS.NASIONAL) {
        sheet.getRange(rowNumber, existing.jenisCol + 1).setValue(jenisNilai);
      }
      updated = true;
    } else {
      recordId = generateNextId_(ss, input.targetTabel);
      sheet.appendRow(buildRow_(recordId, input, jenisNilai));
      rowNumber = sheet.getLastRow();
    }

    writeAuditColumns_(sheet, existing.headers, rowNumber, user);
    SpreadsheetApp.flush();
    clearDataCache_([input.targetTabel]);

    console.log((updated ? 'UPDATE ' : 'INSERT ') + input.targetTabel + ' ' + recordId + ' oleh ' + user.username);

    let message = updated
      ? 'Data ' + recordId + ' berhasil diperbarui.'
      : 'Data berhasil disimpan dengan ID ' + recordId + '.';
    if (existing.rows.length > 1) {
      message += ' Perhatian: ada ' + (existing.rows.length - 1) +
        ' baris ganda lama untuk kombinasi ini di sheet ' + input.targetTabel + ', mohon dicek manual.';
    }

    return { success: true, updated, recordId, message };
  } finally {
    lock.releaseLock();
  }
}

function validateEmissionInput_(formData) {
  const targetTabel = String(formData.targetTabel || '').trim();
  if (!WRITABLE_SHEETS.includes(targetTabel)) {
    throw new Error('Tujuan penyimpanan tidak valid.');
  }

  const tahun = Number(formData.tahun);
  if (!Number.isInteger(tahun) || tahun < 1990 || tahun > 2100) {
    throw new Error('Tahun harus berupa angka antara 1990 dan 2100.');
  }

  const nilai = parseNumber_(formData.nilai);
  if (nilai === null) {
    throw new Error('Nilai emisi harus berupa angka.');
  }

  const master = getMasterFormData();
  const sektorKode = normalizeSector_(formData.sektor);
  const sektor = master.sektorList.find(s => s.kode === sektorKode);
  if (!sektor) throw new Error('Sektor "' + formData.sektor + '" tidak terdaftar di MASTER_SEKTOR.');

  if (targetTabel === SHEETS.NASIONAL && sektorKode === 'KEHUTANAN') {
    throw new Error('Untuk data nasional gunakan sektor FOLU, bukan KEHUTANAN.');
  }
  if (targetTabel !== SHEETS.NASIONAL && sektorKode === 'FOLU') {
    throw new Error('Untuk data Kota Bontang gunakan sektor KEHUTANAN, bukan FOLU.');
  }

  const result = {
    targetTabel,
    tahun,
    nilai,
    sektor: sektor.kode,
    sektorId: sektor.sektorId
  };

  if (targetTabel === SHEETS.SUBSEKTOR) {
    const subId = String(formData.subsektorId || '').trim();
    const sub = master.subsektorList.find(k => k.subsektorId === subId);
    if (!sub) throw new Error('Subsektor tidak ditemukan. Pilih subsektor dari daftar.');
    if (sub.sektor !== sektor.kode) throw new Error('Subsektor yang dipilih bukan bagian dari sektor ' + sektor.kode + '.');
    result.subsektorId = sub.subsektorId;
    result.subsektor = sub.nama;
  }

  return result;
}

function buildRow_(recordId, input, jenisNilai) {
  if (input.targetTabel === SHEETS.NASIONAL) {
    return [recordId, input.tahun, 'INDONESIA', 'SEKTOR', input.sektorId, input.sektor, input.nilai, jenisNilai];
  }
  if (input.targetTabel === SHEETS.SEKTOR) {
    return [recordId, input.tahun, 'Kalimantan Timur', 'Bontang', 'SEKTOR',
      input.sektorId, input.sektor, '', '', input.nilai, jenisNilai];
  }
  return [recordId, input.tahun, 'Kalimantan Timur', 'Bontang', 'KATEGORI',
    input.sektorId, input.sektor, input.subsektorId, input.subsektor, input.nilai, jenisNilai];
}

/** Mencari baris yang sudah ada untuk kombinasi tahun + sektor (+ subsektor). */
function findExistingRows_(sheet, input) {
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(h => String(h).trim().toLowerCase());
  const col = names => names.map(n => headers.indexOf(n)).find(i => i >= 0);

  const tahunCol = col(['tahun']);
  const sektorCol = col(['sektor']);
  const subCol = col(['subsektor_id', 'kategori_id']);
  const valueCol = col(['nilai_emisi']);
  const jenisCol = col(['jenis_nilai']);
  const negaraCol = col(['negara']);
  const levelCol = col(['level_data']);

  if (tahunCol === undefined || sektorCol === undefined || valueCol === undefined) {
    throw new Error('Header sheet ' + input.targetTabel + ' harus memuat kolom tahun, sektor, dan nilai_emisi.');
  }

  const rows = [];
  values.slice(1).forEach((row, i) => {
    if (Number(row[tahunCol]) !== input.tahun) return;
    if (normalizeSector_(row[sektorCol]) !== input.sektor) return;
    if (input.targetTabel === SHEETS.SUBSEKTOR) {
      if (subCol === undefined || String(row[subCol]).trim() !== input.subsektorId) return;
    }
    if (input.targetTabel === SHEETS.NASIONAL) {
      if (negaraCol !== undefined && String(row[negaraCol]).trim().toUpperCase() !== 'INDONESIA') return;
      if (levelCol !== undefined && String(row[levelCol]).trim().toUpperCase() !== 'SEKTOR') return;
    }
    rows.push({ rowNumber: i + 2, id: String(row[0]), value: parseNumber_(row[valueCol]) });
  });

  return { rows, headers, valueCol, jenisCol: jenisCol === undefined ? -1 : jenisCol };
}

/** Mengisi kolom audit jika sheet memilikinya (opsional): diinput_oleh, diinput_pada. */
function writeAuditColumns_(sheet, headers, rowNumber, user) {
  const byCol = headers.indexOf('diinput_oleh');
  const atCol = headers.indexOf('diinput_pada');
  if (byCol >= 0) sheet.getRange(rowNumber, byCol + 1).setValue(user.username);
  if (atCol >= 0) sheet.getRange(rowNumber, atCol + 1).setValue(new Date());
}

/** Harus dipanggil di dalam lock. */
function generateNextId_(ss, targetSheet) {
  const isNational = targetSheet === SHEETS.NASIONAL;
  const prefix = isNational ? 'EN' : 'EM';
  const pad = isNational ? 4 : 5;
  const sheetNames = isNational ? [SHEETS.NASIONAL] : [SHEETS.SEKTOR, SHEETS.SUBSEKTOR];

  let max = 0;
  sheetNames.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat().forEach(id => {
      const text = String(id || '');
      if (!text.startsWith(prefix)) return;
      const num = parseInt(text.slice(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    });
  });

  return prefix + String(max + 1).padStart(pad, '0');
}

/* =========================
   DATA AWAL DASHBOARD
========================= */
function getInitialData() {
  const rows = getSheetObjects_(SHEETS.SEKTOR);

  const years = [...new Set(rows.map(r => Number(r.tahun)).filter(Boolean))].sort((a, b) => b - a);
  const available = [...new Set(rows.map(r => normalizeSector_(r.sektor)).filter(Boolean))];

  return {
    years,
    sectors: orderSectors_(available, BONTANG_SECTOR_ORDER),
    latestYear: years[0] || null
  };
}

/* =========================
   RINGKASAN
========================= */
function getSummaryData(year) {
  year = Number(year);
  const rows = getSheetObjects_(SHEETS.SEKTOR);

  const byYear = groupSectorTotals_(rows);
  const yearMap = byYear[year] || {};

  const sectors = Object.keys(yearMap)
    .map(sektor => ({ sektor, nilai: yearMap[sektor] }))
    .sort((a, b) => b.nilai - a.nilai);

  const total = sectors.reduce((sum, s) => sum + s.nilai, 0);
  const grossEmission = sectors.filter(s => s.nilai > 0).reduce((sum, s) => sum + s.nilai, 0);
  const totalRemoval = sectors.filter(s => s.nilai < 0).reduce((sum, s) => sum + Math.abs(s.nilai), 0);

  const positive = sectors.filter(s => s.nilai > 0);
  const largestSector = positive.length ? positive[0] : null;

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const previousYear = years.filter(y => y < year).pop() || null;

  let previousTotal = null;
  let changePercent = null;
  if (previousYear) {
    previousTotal = sumValues_(byYear[previousYear]);
    if (previousTotal !== 0) changePercent = ((total - previousTotal) / Math.abs(previousTotal)) * 100;
  }

  const totalTrend = years.map(y => ({ tahun: y, nilai: sumValues_(byYear[y]) }));

  return {
    year,
    total,
    grossEmission,
    totalRemoval,
    sectors,
    sectorCount: sectors.length,
    largestSector,
    previousYear,
    previousTotal,
    changePercent,
    totalTrend
  };
}

/* =========================
   TREN SEMUA SEKTOR (BONTANG)
========================= */
function getAllSectorTrend() {
  const rows = getSheetObjects_(SHEETS.SEKTOR);
  return buildSectorMatrix_(rows, BONTANG_SECTOR_ORDER);
}

/* =========================
   ANALISIS SUBSEKTOR
========================= */
function getCategoryData(year, sector) {
  year = Number(year);
  const sectorCode = normalizeSector_(sector);
  const rows = getSheetObjects_(SHEETS.SUBSEKTOR);

  const map = {};
  rows.forEach(row => {
    if (Number(row.tahun) !== year || normalizeSector_(row.sektor) !== sectorCode) return;
    const kategori = String(row.subsektor || row.kategori || '').trim();
    if (!kategori) return;
    map[kategori] = (map[kategori] || 0) + toNumber_(row.nilai_emisi);
  });

  const categories = Object.keys(map)
    .map(kategori => ({ kategori, nilai: map[kategori] }))
    .sort((a, b) => b.nilai - a.nilai);

  const total = categories.reduce((sum, c) => sum + c.nilai, 0);
  const grossEmission = categories.filter(c => c.nilai > 0).reduce((sum, c) => sum + c.nilai, 0);
  const positive = categories.filter(c => c.nilai > 0);

  return {
    year,
    sector: sectorCode,
    total,
    grossEmission,
    categoryCount: categories.length,
    largestCategory: positive.length ? positive[0] : null,
    categories
  };
}

function getCategoryTrend(sector) {
  const sectorCode = normalizeSector_(sector);
  const rows = getSheetObjects_(SHEETS.SUBSEKTOR)
    .filter(row => normalizeSector_(row.sektor) === sectorCode);

  const categories = [...new Set(rows.map(r => String(r.subsektor || r.kategori || '').trim()).filter(Boolean))];
  const map = {};

  rows.forEach(row => {
    const year = Number(row.tahun);
    const category = String(row.subsektor || row.kategori || '').trim();
    if (!year || !category) return;
    if (!map[year]) map[year] = {};
    map[year][category] = (map[year][category] || 0) + toNumber_(row.nilai_emisi);
  });

  const data = Object.keys(map)
    .map(year => ({ tahun: Number(year), values: map[year] }))
    .sort((a, b) => a.tahun - b.tahun);

  return { sector: sectorCode, categories, data };
}

/* =========================
   KEHUTANAN
========================= */
function getForestryData(year) {
  year = Number(year);
  const rows = getSheetObjects_(SHEETS.SUBSEKTOR)
    .filter(row => normalizeSector_(row.sektor) === 'KEHUTANAN');

  const map = {};
  rows.filter(row => Number(row.tahun) === year).forEach(row => {
    const kategori = String(row.subsektor || row.kategori || '').trim();
    if (!kategori) return;
    map[kategori] = (map[kategori] || 0) + toNumber_(row.nilai_emisi);
  });

  const categories = Object.keys(map)
    .map(kategori => ({ kategori, nilai: map[kategori] }))
    .sort((a, b) => a.nilai - b.nilai);

  const trendMap = {};
  rows.forEach(row => {
    const y = Number(row.tahun);
    if (!y) return;
    trendMap[y] = (trendMap[y] || 0) + toNumber_(row.nilai_emisi);
  });

  const trend = Object.keys(trendMap)
    .map(y => ({ tahun: Number(y), nilai: trendMap[y] }))
    .sort((a, b) => a.tahun - b.tahun);

  return {
    year,
    categories,
    netValue: categories.reduce((sum, c) => sum + c.nilai, 0),
    totalRemoval: categories.filter(c => c.nilai < 0).reduce((sum, c) => sum + Math.abs(c.nilai), 0),
    totalEmission: categories.filter(c => c.nilai > 0).reduce((sum, c) => sum + c.nilai, 0),
    trend
  };
}

/* =========================
   EMISI NASIONAL
========================= */
function getNationalEmissionData() {
  const rows = getSheetObjects_(SHEETS.NASIONAL).filter(row =>
    String(row.negara || '').trim().toUpperCase() === 'INDONESIA' &&
    String(row.level_data || '').trim().toUpperCase() === 'SEKTOR' &&
    String(row.jenis_nilai || '').trim().toUpperCase() === 'EMISI'
  );

  const matrix = buildSectorMatrix_(rows, NATIONAL_SECTOR_ORDER);
  const data = matrix.data;
  const latest = data.length ? data[data.length - 1] : null;
  const previous = data.length > 1 ? data[data.length - 2] : null;

  let changePercent = null;
  if (latest && previous && previous.total !== 0) {
    changePercent = ((latest.total - previous.total) / Math.abs(previous.total)) * 100;
  }

  let largestSector = null;
  if (latest) {
    matrix.sectors.forEach(sector => {
      const value = latest.values[sector] || 0;
      if (!largestSector || value > largestSector.nilai) largestSector = { sektor: sector, nilai: value };
    });
  }

  return {
    years: matrix.years,
    sectors: matrix.sectors,
    data,
    latestYear: latest ? latest.tahun : null,
    latestTotal: latest ? latest.total : null,
    previousYear: previous ? previous.tahun : null,
    changePercent,
    largestSector
  };
}

/* =========================
   EKONOMI (ADHK) & INTENSITAS GRK — KOTA BONTANG
========================= */
function getEconomicData() {
  const rows = getSheetObjects_(SHEETS.EKONOMI_GRK);
  const requiredColumns = ['tahun', 'kota', 'total_emisi_gg', 'adhk', 'intensitas_grk'];
  const isBontang = kota => String(kota || '').trim().toUpperCase().replace(/^KOTA\s+/, '') === 'BONTANG';

  if (rows.length && !requiredColumns.every(c => Object.prototype.hasOwnProperty.call(rows[0], c))) {
    throw new Error('Sheet ' + SHEETS.EKONOMI_GRK + ' wajib memiliki kolom: ' + requiredColumns.join(', '));
  }

  const data = rows
    .filter(row => isBontang(row.kota) && Number(row.tahun))
    .map(row => ({
      tahun: Number(row.tahun),
      totalEmisiGg: parseNumber_(row.total_emisi_gg),
      adhk: parseNumber_(row.adhk),
      intensitasGrk: parseNumber_(row.intensitas_grk)
    }))
    .sort((a, b) => a.tahun - b.tahun);

  return {
    years: data.map(r => r.tahun),
    data,
    latestYear: data.length ? data[data.length - 1].tahun : null
  };
}

/* =========================
   HELPER AGREGASI
========================= */
function groupSectorTotals_(rows) {
  const map = {};
  rows.forEach(row => {
    const year = Number(row.tahun);
    const sector = normalizeSector_(row.sektor);
    if (!year || !sector) return;
    if (!map[year]) map[year] = {};
    map[year][sector] = (map[year][sector] || 0) + toNumber_(row.nilai_emisi);
  });
  return map;
}

function buildSectorMatrix_(rows, preferredOrder) {
  const grouped = groupSectorTotals_(rows);
  const years = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const available = [...new Set(rows.map(r => normalizeSector_(r.sektor)).filter(Boolean))];
  const sectors = orderSectors_(available, preferredOrder);

  const data = years.map(year => {
    const values = {};
    sectors.forEach(sector => { values[sector] = grouped[year][sector] || 0; });
    return { tahun: year, values, total: sumValues_(values) };
  });

  return { years, sectors, data };
}

function orderSectors_(available, preferredOrder) {
  return [
    ...preferredOrder.filter(s => available.includes(s)),
    ...available.filter(s => !preferredOrder.includes(s)).sort()
  ];
}

function sumValues_(obj) {
  return Object.keys(obj || {}).reduce((sum, key) => sum + (obj[key] || 0), 0);
}

function normalizeSector_(value) {
  return String(value || '').trim().toUpperCase();
}

/* =========================
   HELPER SPREADSHEET & CACHE
========================= */
let spreadsheet_ = null;

function getSpreadsheet_() {
  if (!spreadsheet_) {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
    spreadsheet_ = SpreadsheetApp.openById(id);
  }
  return spreadsheet_;
}

function getSheetObjects_(sheetName, options) {
  const noCache = options && options.noCache;
  const cache = CacheService.getScriptCache();
  const cacheKey = 'sheet:' + sheetName;

  if (!noCache) {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" tidak ditemukan.');

  const values = sheet.getDataRange().getValues();
  let objects = [];

  if (values.length >= 2) {
    const headers = values[0].map(h => String(h).trim().toLowerCase());
    objects = values
      .slice(1)
      .filter(row => row.some(cell => cell !== '' && cell !== null))
      .map(row => {
        const obj = {};
        headers.forEach((header, i) => { if (header) obj[header] = row[i]; });
        return obj;
      });
  }

  if (!noCache) {
    const json = JSON.stringify(objects);
    if (json.length < MAX_CACHE_BYTES) cache.put(cacheKey, json, DATA_CACHE_TTL_SECONDS);
  }

  return objects;
}

function clearDataCache_(sheetNames) {
  CacheService.getScriptCache().removeAll((sheetNames || Object.values(SHEETS)).map(n => 'sheet:' + n));
}

/** Jalankan manual jika data diedit langsung di spreadsheet dan ingin segera tampil. */
function clearDataCache() {
  clearDataCache_();
  return 'Cache data dibersihkan.';
}

/* =========================
   HELPER ANGKA
========================= */
/**
 * Mengubah nilai sel menjadi angka. Mengembalikan null jika kosong/tidak valid.
 * Mendukung format Indonesia (1.234.567,89) dan internasional (1,234,567.89).
 * Teks seperti "1.234" (satu titik + tepat 3 digit) dibaca sebagai ribuan = 1234,
 * sesuai konvensi angka Indonesia.
 */
function parseNumber_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  let text = String(value).trim().replace(/\s/g, '');
  if (!text) return null;

  const hasDot = text.includes('.');
  const hasComma = text.includes(',');

  if (hasDot && hasComma) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')   // 1.234,56
      : text.replace(/,/g, '');                     // 1,234.56
  } else if (hasComma) {
    text = /^-?\d{1,3}(,\d{3}){2,}$/.test(text)
      ? text.replace(/,/g, '')                      // 1,234,567
      : text.replace(',', '.');                     // 12,5
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(text) && !/^-?0\./.test(text)) {
    text = text.replace(/\./g, '');                 // 1.234 atau 1.234.567
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** Untuk penjumlahan: sel kosong = 0, teks tidak valid dicatat di log lalu dianggap 0. */
function toNumber_(value) {
  const number = parseNumber_(value);
  if (number === null) {
    if (value !== '' && value !== null && value !== undefined) {
      console.warn('Nilai tidak valid diabaikan (dianggap 0): ' + value);
    }
    return 0;
  }
  return number;
}