import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'db.json');

// Initial data structure
const INITIAL_DATA = {
  users: [
    { id: 'admin', nama: 'Administrator', role: 'Admin', password: 'admin' },
    { id: '12345', nama: 'Siswa Contoh', kelas: 'XC', role: 'Siswa', password: '123' },
    { id: 'petugas', nama: 'Petugas Scan', role: 'Petugas Scan', password: 'scan' },
    { id: 'guru1', nama: 'Budi Santoso', role: 'Guru', password: 'guru' },
    { id: 'wali1', nama: 'Siti Aminah', role: 'Wali Kelas', password: 'wali' }
  ],
  absensi: [],
  kelas: [{ id: '1', nama: 'XA' }, { id: '2', nama: 'XB' }, { id: '3', nama: 'XC' }],
  guru: [{ id: 'guru1', nama: 'Budi Santoso' }],
  waliKelas: [{ id: '1', namaGuru: 'Siti Aminah', idKelas: '3' }],
  branding: {
    appName: 'EduAbsen',
    logoUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135810.png'
  }
};

// Initialize DB if not exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeDB(data: any) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // Login
  app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    const db = readDB();
    const user = db.users.find((u: any) => u.id === id && u.password === password);
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json({ success: true, user: userWithoutPassword });
    } else {
      res.status(401).json({ success: false, message: 'ID atau Password salah' });
    }
  });

  // Get Branding
  app.get('/api/branding', (req, res) => {
    const db = readDB();
    res.json(db.branding || { appName: 'EduAbsen', logoUrl: '' });
  });

  // Update Branding
  app.post('/api/branding', (req, res) => {
    const { appName, logoUrl } = req.body;
    const db = readDB();
    db.branding = { appName, logoUrl };
    writeDB(db);
    res.json({ success: true, data: db.branding });
  });

  // Get Users
  app.get('/api/users', (req, res) => {
    const db = readDB();
    res.json(db.users.map((u: any) => {
      const { password, ...safe } = u;
      return safe;
    }));
  });

  // Add User
  app.post('/api/users', (req, res) => {
    const newUser = req.body;
    const db = readDB();
    if (db.users.some((u: any) => u.id === newUser.id)) {
      return res.status(400).json({ success: false, message: 'ID sudah ada' });
    }
    db.users.push(newUser);
    writeDB(db);
    res.json({ success: true, user: newUser });
  });

  // Get Attendance
  app.get('/api/absensi', (req, res) => {
    const db = readDB();
    res.json(db.absensi);
  });

  // Add Attendance (Scan Logic)
  app.post('/api/absensi', (req, res) => {
    const { id, mode } = req.body; // Student ID (NISN) and mode ('masuk'|'pulang')
    const db = readDB();
    const student = db.users.find((u: any) => u.id === id && u.role === 'Siswa');
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('id-ID', { hour12: false });
    
    // Check if already has entry for today
    const existingIndex = db.absensi.findIndex((a: any) => a.nisn === id && a.tanggal === today);

    if (existingIndex > -1) {
      const existing = db.absensi[existingIndex];
      
      if (mode === 'masuk') {
        if (existing.jamMasuk) {
          return res.status(400).json({ success: false, message: existing.jamPulang ? 'Anda sudah melakukan absen 2 kali' : 'Siswa sudah absen masuk hari ini' });
        }
      }

      if (mode === 'pulang') {
        if (existing.jamPulang) {
          return res.status(400).json({ success: false, message: 'Anda sudah melakukan absen 2 kali' });
        }
        if (!existing.jamMasuk) {
          return res.status(400).json({ success: false, message: 'Siswa belum absen masuk' });
        }
        // Update jam pulang
        existing.jamPulang = now;
        db.absensi[existingIndex] = existing;
        writeDB(db);
        return res.json({ success: true, action: 'pulang', data: existing });
      }
      
      return res.status(400).json({ success: false, message: 'Siswa sudah melakukan absen' });
    } else {
      if (mode === 'pulang') {
        return res.status(400).json({ success: false, message: 'Siswa belum absen masuk' });
      }

      // Create new jam masuk
      const newEntry = {
        id: Math.random().toString(36).substr(2, 9),
        nisn: student.id,
        nama: student.nama,
        tanggal: today,
        jamMasuk: now,
        jamPulang: null
      };
      db.absensi.push(newEntry);
      writeDB(db);
      return res.json({ success: true, action: 'masuk', data: newEntry });
    }
  });

  // Delete Attendance
  app.delete('/api/absensi/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const initialLength = db.absensi.length;
    db.absensi = db.absensi.filter((a: any) => a.id !== id);
    if (db.absensi.length < initialLength) {
      writeDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }
  });

  // Reset Today's Attendance
  app.post('/api/absensi/reset-today', (req, res) => {
    const db = readDB();
    const today = new Date().toISOString().split('T')[0];
    const initialCount = db.absensi.length;
    db.absensi = db.absensi.filter((a: any) => a.tanggal !== today);
    writeDB(db);
    res.json({ success: true, count: initialCount - db.absensi.length });
  });

  // Change Password
  app.post('/api/change-password', (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    const db = readDB();
    const userIndex = db.users.findIndex((u: any) => u.id === userId);
    
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    if (db.users[userIndex].password !== oldPassword) {
      return res.status(400).json({ success: false, message: 'Password lama salah' });
    }

    db.users[userIndex].password = newPassword;
    writeDB(db);
    res.json({ success: true });
  });

  // Other metadata routes
  app.get('/api/metadata', (req, res) => {
    const db = readDB();
    res.json({
      kelas: db.kelas,
      guru: db.guru,
      waliKelas: db.waliKelas
    });
  });

  // Add Metadata (Kelas, Guru, Wali)
  app.post('/api/metadata/:type', (req, res) => {
    const { type } = req.params;
    const db = readDB();
    if (db[type]) {
      db[type].push({ ...req.body, id: Math.random().toString(36).substr(2, 9) });
      writeDB(db);
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
