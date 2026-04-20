const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";

/**
 * Fungsi untuk melayani file HTML
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('EduAbsen QR System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inisialisasi Database (Auto-Generate Sheets)
 */
function initDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const sheets = {
    "Users": ["ID", "Nama", "Kelas", "Role", "Password"],
    "Absensi": ["NISN", "Nama", "Tanggal", "Jam Masuk", "Jam Pulang"],
    "Kelas": ["ID", "Nama"],
    "Guru": ["ID", "Nama", "Mapel"],
    "WaliKelas": ["ID", "NamaGuru", "IDKelas"],
    "Branding": ["AppName", "LogoURL"]
  };
  
  for (let name in sheets) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
    }
  }
  
  // Admin Default
  const userSheet = ss.getSheetByName("Users");
  if (userSheet.getLastRow() === 1) {
    userSheet.appendRow(["admin", "Administrator", "-", "Admin", "admin123"]);
  }
  
  // Branding Default
  const brandSheet = ss.getSheetByName("Branding");
  if (brandSheet.getLastRow() === 1) {
    brandSheet.appendRow(["EduAbsen", "https://cdn-icons-png.flaticon.com/512/3135/3135810.png"]);
  }
  
  return "Database & Branding Berhasil Diinisialisasi!";
}

/**
 * LOGIN
 */
function loginUser(id, password) {
  const data = getData("Users");
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == id && data[i][4] == password) {
      return {
        success: true,
        user: { id: data[i][0], nama: data[i][1], kelas: data[i][2], role: data[i][3] }
      };
    }
  }
  return { success: false, message: "ID atau Password salah" };
}

/**
 * CETAK ABSENSI (SCAN)
 */
function processScan(nisn, mode) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const users = getData("Users");
  let student = null;
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == nisn && users[i][3] == "Siswa") {
      student = { id: users[i][0], nama: users[i][1] };
      break;
    }
  }
  
  if (!student) return { success: false, message: "Siswa tidak ditemukan" };
  
  const absensiSheet = ss.getSheetByName("Absensi");
  const data = absensiSheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  const now = Utilities.formatDate(new Date(), "GMT+7", "HH:mm:ss");
  
  let rowIndex = -1;
  let existingData = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == nisn && data[i][2] == today) {
      rowIndex = i + 1;
      existingData = data[i];
      break;
    }
  }

  if (mode === 'masuk') {
    if (rowIndex > -1) {
      return { success: false, message: existingData[4] ? "Sudah absen masuk & pulang" : "Siswa sudah absen masuk" };
    }
    absensiSheet.appendRow([nisn, student.nama, today, now, ""]);
    return { success: true, action: "masuk", data: { nama: student.nama, jamMasuk: now } };
  } else {
    if (rowIndex === -1) return { success: false, message: "Siswa belum absen masuk" };
    if (existingData[4]) return { success: false, message: "Sudah absen pulang" };
    absensiSheet.getRange(rowIndex, 5).setValue(now);
    return { success: true, action: "pulang", data: { nama: student.nama, jamPulang: now } };
  }
}

/**
 * PASSWORD & RESET
 */
function changePassword(userId, oldPass, newPass) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == userId && data[i][4] == oldPass) {
      sheet.getRange(i + 1, 5).setValue(newPass);
      return { success: true };
    }
  }
  return { success: false, message: "Password lama salah atau user tidak ditemukan" };
}

function resetToday() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Absensi");
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  let count = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][2] == today) {
      sheet.deleteRow(i + 1);
      count++;
    }
  }
  return { success: true, count: count };
}

/**
 * BRANDING
 */
function getBranding() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Branding");
  const data = sheet.getRange(2, 1, 1, 2).getValues();
  return { appName: data[0][0], logoUrl: data[0][1] };
}

function updateBranding(appName, logoUrl) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Branding");
  sheet.getRange(2, 1).setValue(appName);
  sheet.getRange(2, 2).setValue(logoUrl);
  return { success: true };
}

/**
 * HELPERS
 */
function getData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  return sheet.getDataRange().getValues();
}

function getUsers() {
  const data = getData("Users");
  return data.slice(1).map(r => ({ id: r[0], nama: r[1], kelas: r[2], role: r[3] }));
}

function getAbsensi() {
  const data = getData("Absensi");
  return data.slice(1).map((r, i) => ({ 
    id: i.toString(), 
    nisn: r[0], 
    nama: r[1], 
    tanggal: r[2], 
    jamMasuk: r[3], 
    jamPulang: r[4] 
  }));
}

function addUser(userData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Users");
  sheet.appendRow([userData.id, userData.nama, userData.kelas, userData.role, userData.password]);
  return { success: true };
}

function deleteAbsensi(id) {
  // Dalam GAS id ini index jika pake getAbsensi
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Absensi");
  sheet.deleteRow(parseInt(id) + 2);
  return { success: true };
}

function addMetadata(type, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (type === 'kelas') ss.getSheetByName("Kelas").appendRow([Math.random().toString(36).substr(2, 5), data.nama]);
  if (type === 'guru') ss.getSheetByName("Guru").appendRow([Math.random().toString(36).substr(2, 5), data.nama, "-"]);
  if (type === 'waliKelas') ss.getSheetByName("WaliKelas").appendRow([Math.random().toString(36).substr(2, 5), data.nama, "-"]);
  return { success: true };
}

function getMetadata() {
  return {
    kelas: getData("Kelas").slice(1).map(r => ({ id: r[0], nama: r[1] })),
    guru: getData("Guru").slice(1).map(r => ({ id: r[0], nama: r[1] })),
    waliKelas: getData("WaliKelas").slice(1).map(r => ({ id: r[0], namaGuru: r[1] }))
  };
}
