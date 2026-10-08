const SPREADSHEET_ID = '1y_iGmLt5sOXkPkhs536KTgC8XJX3hTssYuvIya9pKjA';

const SHEETS = {
  SEKTOR: 'DATA_SEKTOR',
  SUBSEKTOR: 'DATA_SUBSEKTOR',
  MASTER_SEKTOR: 'MASTER_SEKTOR',
  MASTER_SUBSEKTOR: 'MASTER_SUBSEKTOR',
  NASIONAL: 'DATA_NASIONAL',
  USERS: 'USERS'
};

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Dashboard Emisi GRK Kota Bontang')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

/**
 * MASTER DATA UNTUK FORM INPUT
 */
function getMasterFormData() {
  const masterSektor = getSheetObjects_(SHEETS.MASTER_SEKTOR);
  const masterSubsektor = getSheetObjects_(SHEETS.MASTER_SUBSEKTOR);

  return {
    sektorList: masterSektor.map(s => ({
      sektorId: s.sektor_id,
      kode: String(s.kode_sektor || '').trim().toUpperCase(),
      nama: s.nama_sektor
    })),
    subsektorList: masterSubsektor.map(k => ({
      subsektorId: k.kategori_id || k.subsektor_id,
      sektorId: k.subsektor_id || k.sektor_id,
      sektor: String(k.subsektor || k.sektor || '').trim().toUpperCase(),
      nama: k.nama_kategori || k.nama_subsektor
    }))
  };
}

/**
 * GENERATOR RECORD ID OTOMATIS
 */
function generateNextId_(ss, targetSheet) {
  if (targetSheet === SHEETS.NASIONAL) {
    const sheet = ss.getSheetByName(SHEETS.NASIONAL);
    let max = 0;
    if (sheet && sheet.getLastRow() > 1) {
      const vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
      vals.forEach(id => {
        if (typeof id === 'string' && id.startsWith('EN')) {
          const num = parseInt(id.replace('EN', ''), 10);
          if (!isNaN(num) && num > max) max = num;
        }
      });
    }
    return 'EN' + String(max + 1).padStart(4, '0');
  } else {
    let max = 0;
    [SHEETS.SEKTOR, SHEETS.SUBSEKTOR].forEach(shName => {
      const sh = ss.getSheetByName(shName);
      if (sh && sh.getLastRow() > 1) {
        const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat();
        vals.forEach(id => {
          if (typeof id === 'string' && id.startsWith('EM')) {
            const num = parseInt(id.replace('EM', ''), 10);
            if (!isNaN(num) && num > max) max = num;
          }
        });
      }
    });
    return 'EM' + String(max + 1).padStart(5, '0');
  }
}

/**
 * VERIFIKASI LOGIN
 */
function verifyLogin(username, password) {
  try {
    const users = getSheetObjects_(SHEETS.USERS);
    const user = users.find(u => 
      String(u.username).trim().toLowerCase() === String(username).trim().toLowerCase() && 
      String(u.password).trim() === String(password).trim()
    );

    if (user) {
      return {
        success: true,
        user: {
          username: user.username,
          nama: user.nama || user.username,
          role: user.role || 'user'
        }
      };
    }
    return { success: false, message: 'Username atau password salah!' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * SIMPAN DATA INPUT
 */
function saveEmissionData(formData, currentUser) {
  if (!currentUser || !currentUser.username) {
    throw new Error('Sesi tidak valid. Silakan login kembali.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const targetSheetName = formData.targetTabel;
  const sheet = ss.getSheetByName(targetSheetName);

  if (!sheet) {
    throw new Error(`Sheet ${targetSheetName} tidak ditemukan.`);
  }

  const recordId = generateNextId_(ss, targetSheetName);
  const tahun = Number(formData.tahun);
  const nilai = Number(formData.nilai);

  if (targetSheetName === SHEETS.NASIONAL) {
    sheet.appendRow([
      recordId,
      tahun,
      'INDONESIA',
      'SEKTOR',
      formData.sektorId,
      formData.sektor,
      nilai,
      'EMISI'
    ]);
  } else if (targetSheetName === SHEETS.SEKTOR) {
    const jenisNilai = nilai < 0 ? 'Serapan/Removal' : 'Emisi/Net';
    sheet.appendRow([
      recordId,
      tahun,
      'Kalimantan Timur',
      'Bontang',
      'SEKTOR',
      formData.sektorId,
      formData.sektor,
      '',
      '',
      nilai,
      jenisNilai
    ]);
  } else if (targetSheetName === SHEETS.SUBSEKTOR) {
    const jenisNilai = nilai < 0 ? 'Serapan/Removal' : 'Emisi';
    sheet.appendRow([
      recordId,
      tahun,
      'Kalimantan Timur',
      'Bontang',
      'KATEGORI',
      formData.sektorId,
      formData.sektor,
      formData.subsektorId,
      formData.subsektor,
      nilai,
      jenisNilai
    ]);
  }

  return {
    success: true,
    message: `Data berhasil ditambahkan ke ${targetSheetName} dengan ID: ${recordId}`
  };
}

/**
 * DATA AWAL DASHBOARD
 */
function getInitialData() {
  const sectorRows = getSheetObjects_(SHEETS.SEKTOR);

  const years = [...new Set(
    sectorRows
      .map(row => Number(row.tahun))
      .filter(Boolean)
  )].sort((a, b) => b - a);

  const sectors = [...new Set(
    sectorRows
      .map(row => String(row.sektor || '').trim())
      .filter(Boolean)
  )].sort();

  return {
    years,
    sectors,
    latestYear: years[0] || null
  };
}

/**
 * PAGE 1 — RINGKASAN
 */
function getSummaryData(year) {
  year = Number(year);
  const rows = getSheetObjects_(SHEETS.SEKTOR);

  const selectedRows = rows
    .filter(row => Number(row.tahun) === year)
    .map(row => ({
      sektorId: row.sektor_id,
      sektor: String(row.sektor || '').trim(),
      nilai: toNumber_(row.nilai_emisi)
    }))
    .sort((a, b) => b.nilai - a.nilai);

  const total = selectedRows.reduce((sum, item) => sum + item.nilai, 0);
  const positiveRows = selectedRows.filter(item => item.nilai > 0);
  const largestSector = positiveRows.length
    ? positiveRows.reduce((max, item) => item.nilai > max.nilai ? item : max)
    : null;

  const availableYears = [...new Set(rows.map(row => Number(row.tahun)))].filter(Boolean).sort((a, b) => a - b);
  const previousYear = availableYears.filter(item => item < year).pop();

  let previousTotal = null;
  let changePercent = null;

  if (previousYear) {
    previousTotal = rows
      .filter(row => Number(row.tahun) === previousYear)
      .reduce((sum, row) => sum + toNumber_(row.nilai_emisi), 0);

    if (previousTotal !== 0) {
      changePercent = ((total - previousTotal) / Math.abs(previousTotal)) * 100;
    }
  }

  const trendMap = {};
  rows.forEach(row => {
    const rowYear = Number(row.tahun);
    if (!trendMap[rowYear]) trendMap[rowYear] = 0;
    trendMap[rowYear] += toNumber_(row.nilai_emisi);
  });

  const totalTrend = Object.keys(trendMap)
    .map(itemYear => ({
      tahun: Number(itemYear),
      nilai: trendMap[itemYear]
    }))
    .sort((a, b) => a.tahun - b.tahun);

  return {
    year,
    total,
    sectors: selectedRows,
    sectorCount: selectedRows.length,
    largestSector,
    previousYear,
    previousTotal,
    changePercent,
    totalTrend
  };
}

/**
 * PAGE 2 — TREND SEMUA SEKTOR
 */
function getAllSectorTrend() {
  const rows = getSheetObjects_(SHEETS.SEKTOR);
  const preferredOrder = ['ENERGI', 'IPPU', 'PERTANIAN', 'KEHUTANAN', 'LIMBAH'];

  const years = [...new Set(rows.map(row => Number(row.tahun)).filter(Boolean))].sort((a, b) => a - b);
  const availableSectors = [...new Set(rows.map(row => String(row.sektor || '').trim().toUpperCase()).filter(Boolean))];

  const sectors = [
    ...preferredOrder.filter(sector => availableSectors.includes(sector)),
    ...availableSectors.filter(sector => !preferredOrder.includes(sector))
  ];

  const dataMap = {};
  years.forEach(year => {
    dataMap[year] = {};
    sectors.forEach(sector => { dataMap[year][sector] = 0; });
  });

  rows.forEach(row => {
    const year = Number(row.tahun);
    const sector = String(row.sektor || '').trim().toUpperCase();
    const value = toNumber_(row.nilai_emisi);

    if (!year || !sector || !dataMap[year]) return;
    if (dataMap[year][sector] === undefined) dataMap[year][sector] = 0;
    dataMap[year][sector] += value;
  });

  const data = years.map(year => {
    const values = dataMap[year];
    const total = sectors.reduce((sum, sector) => sum + (values[sector] || 0), 0);
    return { tahun: year, values, total };
  });

  return { years, sectors, data };
}

/**
 * PAGE 3 — ANALISIS SUBSEKTOR
 */
function getCategoryData(year, sector) {
  year = Number(year);
  const rows = getSheetObjects_(SHEETS.SUBSEKTOR);

  const filtered = rows
    .filter(row => Number(row.tahun) === year && String(row.sektor || '').trim().toUpperCase() === String(sector || '').trim().toUpperCase())
    .map(row => ({
      tahun: Number(row.tahun),
      sektorId: row.sektor_id,
      kategoriId: row.subsektor_id || row.kategori_id,
      sektor: String(row.sektor || '').trim(),
      kategori: String(row.subsektor || row.kategori || '').trim(),
      nilai: toNumber_(row.nilai_emisi)
    }))
    .sort((a, b) => b.nilai - a.nilai);

  const total = filtered.reduce((sum, item) => sum + item.nilai, 0);
  const largestCategory = filtered.length
    ? filtered.reduce((max, item) => item.nilai > max.nilai ? item : max)
    : null;

  return {
    year,
    sector,
    total,
    categoryCount: filtered.length,
    largestCategory,
    categories: filtered
  };
}

/**
 * TREND SUBSEKTOR DALAM SEKTOR
 */
function getCategoryTrend(sector) {
  const rows = getSheetObjects_(SHEETS.SUBSEKTOR);

  const filtered = rows.filter(row => 
    String(row.sektor || '').trim().toUpperCase() === String(sector || '').trim().toUpperCase()
  );

  const categories = [...new Set(filtered.map(row => String(row.subsektor || row.kategori || '').trim()).filter(Boolean))];
  const map = {};

  filtered.forEach(row => {
    const year = Number(row.tahun);
    const category = String(row.subsektor || row.kategori || '').trim();
    const value = toNumber_(row.nilai_emisi);

    if (!map[year]) map[year] = {};
    map[year][category] = (map[year][category] || 0) + value;
  });

  const data = Object.keys(map)
    .map(year => ({ tahun: Number(year), values: map[year] }))
    .sort((a, b) => a.tahun - b.tahun);

  return { sector, categories, data };
}

/**
 * PAGE 4 — KEHUTANAN
 */
function getForestryData(year) {
  year = Number(year);
  const rows = getSheetObjects_(SHEETS.SUBSEKTOR);

  const forestryRows = rows
    .filter(row => Number(row.tahun) === year && String(row.sektor || '').trim().toUpperCase() === 'KEHUTANAN')
    .map(row => ({
      kategori: String(row.subsektor || row.kategori || '').trim(),
      nilai: toNumber_(row.nilai_emisi)
    }))
    .sort((a, b) => a.nilai - b.nilai);

  const netValue = forestryRows.reduce((sum, item) => sum + item.nilai, 0);
  const totalRemoval = forestryRows.filter(item => item.nilai < 0).reduce((sum, item) => sum + Math.abs(item.nilai), 0);
  const totalEmission = forestryRows.filter(item => item.nilai > 0).reduce((sum, item) => sum + item.nilai, 0);

  const allForestry = rows.filter(row => String(row.sektor || '').trim().toUpperCase() === 'KEHUTANAN');
  const trendMap = {};

  allForestry.forEach(row => {
    const rowYear = Number(row.tahun);
    if (!trendMap[rowYear]) trendMap[rowYear] = 0;
    trendMap[rowYear] += toNumber_(row.nilai_emisi);
  });

  const trend = Object.keys(trendMap)
    .map(rowYear => ({ tahun: Number(rowYear), nilai: trendMap[rowYear] }))
    .sort((a, b) => a.tahun - b.tahun);

  return {
    year,
    categories: forestryRows,
    netValue,
    totalRemoval,
    totalEmission,
    trend
  };
}

/**
 * DATA EMISI GRK NASIONAL
 */
function getNationalEmissionData() {
  const rows = getSheetObjects_(SHEETS.NASIONAL);

  const filtered = rows.filter(row => {
    const country = String(row.negara || '').trim().toUpperCase();
    const level = String(row.level_data || '').trim().toUpperCase();
    const type = String(row.jenis_nilai || '').trim().toUpperCase();
    return country === 'INDONESIA' && level === 'SEKTOR' && type === 'EMISI';
  });

  const preferredSectors = ['ENERGI', 'IPPU', 'PERTANIAN', 'FOLU', 'LIMBAH'];
  const years = [...new Set(filtered.map(row => Number(row.tahun)).filter(Boolean))].sort((a, b) => a - b);
  const availableSectors = [...new Set(filtered.map(row => String(row.sektor || '').trim().toUpperCase()).filter(Boolean))];

  const sectors = [
    ...preferredSectors.filter(sector => availableSectors.includes(sector)),
    ...availableSectors.filter(sector => !preferredSectors.includes(sector))
  ];

  const dataMap = {};
  years.forEach(year => {
    dataMap[year] = {};
    sectors.forEach(sector => { dataMap[year][sector] = 0; });
  });

  filtered.forEach(row => {
    const year = Number(row.tahun);
    const sector = String(row.sektor || '').trim().toUpperCase();
    const value = toNumber_(row.nilai_emisi);

    if (!year || !sector || !dataMap[year]) return;
    if (dataMap[year][sector] === undefined) dataMap[year][sector] = 0;
    dataMap[year][sector] += value;
  });

  const data = years.map(year => {
    const values = dataMap[year];
    const total = sectors.reduce((sum, sector) => sum + (values[sector] || 0), 0);
    return { tahun: year, values, total };
  });

  const latest = data.length ? data[data.length - 1] : null;
  const previous = data.length > 1 ? data[data.length - 2] : null;
  let changePercent = null;

  if (latest && previous && previous.total !== 0) {
    changePercent = ((latest.total - previous.total) / Math.abs(previous.total)) * 100;
  }

  let largestSector = null;
  if (latest) {
    sectors.forEach(sector => {
      const value = latest.values[sector] || 0;
      if (!largestSector || value > largestSector.nilai) {
        largestSector = { sektor: sector, nilai: value };
      }
    });
  }

  return {
    years,
    sectors,
    data,
    latestYear: latest ? latest.tahun : null,
    latestTotal: latest ? latest.total : 0,
    previousYear: previous ? previous.tahun : null,
    changePercent,
    largestSector
  };
}

/**
 * HELPER BACA SHEET KE OBJEK
 */
function getSheetObjects_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan.`);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header).trim().toLowerCase());

  return values
    .slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const object = {};
      headers.forEach((header, index) => { object[header] = row[index]; });
      return object;
    });
}

/**
 * HELPER FORMAT ANGKA
 */
function toNumber_(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return 0;

  let text = String(value).trim();
  if (text.includes('.') && text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',') && !text.includes('.')) {
    text = text.replace(',', '.');
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}