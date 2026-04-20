import React, { useState, useEffect } from 'react';
import { LogIn, User as UserIcon, QrCode, Scan, Users, BookOpen, GraduationCap, ChevronRight, LogOut, LayoutDashboard, Calendar, Download, Printer, Trash2, Keyboard, FileSpreadsheet, Settings, RotateCcw, Palette, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'react-qr-code';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, UserRole, Attendance } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- API CLIENT ---
declare const google: any;
const isGAS = typeof google !== 'undefined' && google.script && google.script.run;

const callGAS = (fnName: string, ...args: any[]): Promise<any> => {
  return new Promise((resolve, reject) => {
    (google.script.run as any)
      .withSuccessHandler((res: any) => resolve(res))
      .withFailureHandler((err: any) => reject(err))[fnName](...args);
  });
};

const api = {
  login: async (id: string, pass: string) => {
    if (isGAS) return callGAS('loginUser', id, pass);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: pass })
    });
    return res.json();
  },
  getUsers: () => {
    if (isGAS) return callGAS('getUsers');
    return fetch('/api/users').then(r => r.json());
  },
  getAbsensi: () => {
    if (isGAS) return callGAS('getAbsensi');
    return fetch('/api/absensi').then(r => r.json());
  },
  scan: (id: string, mode: string) => {
    if (isGAS) return callGAS('processScan', id, mode);
    return fetch('/api/absensi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, mode })
    }).then(r => r.json());
  },
  getMetadata: () => {
    if (isGAS) return callGAS('getMetadata');
    return fetch('/api/metadata').then(r => r.json());
  },
  addUser: (user: any) => {
    if (isGAS) return callGAS('addUser', user);
    return fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    }).then(r => r.json());
  },
  addMetadata: (type: string, data: any) => {
    if (isGAS) return callGAS('addMetadata', type, data);
    return fetch(`/api/metadata/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  deleteAbsensi: (id: string) => {
    if (isGAS) return callGAS('deleteAbsensi', id);
    return fetch(`/api/absensi/${id}`, { method: 'DELETE' }).then(r => r.json());
  },
  resetToday: () => {
    if (isGAS) return callGAS('resetToday');
    return fetch('/api/absensi/reset-today', { method: 'POST' }).then(r => r.json());
  },
  changePassword: (data: any) => {
    if (isGAS) return callGAS('changePassword', data.userId, data.oldPassword, data.newPassword);
    return fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
  getBranding: () => {
    if (isGAS) return callGAS('getBranding');
    return fetch('/api/branding').then(r => r.json());
  },
  updateBranding: (data: any) => {
    if (isGAS) return callGAS('updateBranding', data.appName, data.logoUrl);
    return fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json());
  },
};

// --- COMPONENTS ---

const Card = ({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("bg-white rounded-2xl p-6 shadow-sm border border-gray-100", className)}
  >
    {title && <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>}
    {children}
  </motion.div>
);

const Button = ({ children, onClick, variant = 'primary', className, disabled, type = 'button' }: any) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-red-200",
    orange: "bg-orange-600 text-white hover:bg-orange-700 shadow-orange-200",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2",
        variants[variant as keyof typeof variants],
        className
      )}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-gray-700 ml-1">{label}</label>}
    <input
      {...props}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
    />
  </div>
);

// --- MAIN APP ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [branding, setBranding] = useState({ appName: 'EduAbsen', logoUrl: '' });

  const fetchBranding = async () => {
    const data = await api.getBranding();
    setBranding(data);
  };

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) setCurrentUser(JSON.parse(saved));
    fetchBranding();
  }, []);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  if (!currentUser) {
    return <Login onLogin={(u) => {
      setCurrentUser(u);
      localStorage.setItem('user', JSON.stringify(u));
    }} />;
  }

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('user');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 p-6 flex flex-col gap-8 hidden md:flex">
        <div className="flex items-center gap-3 px-2">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-xl" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <GraduationCap size={24} />
            </div>
          )}
          <span className="font-bold text-xl tracking-tight text-gray-900 truncate">{branding.appName}</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <NavBtn icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          
          {currentUser.role === 'Admin' && (
            <>
              <NavBtn icon={<Users size={20} />} label="Data Siswa" active={activeTab === 'siswa'} onClick={() => setActiveTab('siswa')} />
              <NavBtn icon={<Calendar size={20} />} label="Data Absensi" active={activeTab === 'absensi'} onClick={() => setActiveTab('absensi')} />
              <NavBtn icon={<BookOpen size={20} />} label="Data Master" active={activeTab === 'master'} onClick={() => setActiveTab('master')} />
            </>
          )}

          {currentUser.role === 'Petugas Scan' && (
            <NavBtn icon={<Scan size={20} />} label="Scanner" active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} />
          )}

          {currentUser.role === 'Siswa' && (
            <NavBtn icon={<QrCode size={20} />} label="QR Saya" active={activeTab === 'myqr'} onClick={() => setActiveTab('myqr')} />
          )}

          <div className="mt-4 border-t border-gray-50 pt-4">
            <NavBtn icon={<Settings size={20} />} label="Pengaturan" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
              <UserIcon size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate text-gray-900">{currentUser.nama}</span>
              <span className="text-xs text-gray-500">{currentUser.role}</span>
            </div>
          </div>
          <Button variant="secondary" className="w-full justify-start" onClick={logout}>
            <LogOut size={18} /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header Mobile */}
          <div className="flex items-center justify-between md:hidden mb-6">
            <div className="flex items-center gap-2">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <GraduationCap className="text-blue-600" />
              )}
              <span className="font-bold text-xl">{branding.appName}</span>
            </div>
            <button onClick={logout} className="p-2 text-gray-500"><LogOut size={20} /></button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <Dashboard user={currentUser} branding={branding} />}
            {activeTab === 'siswa' && <AdminStudents showMsg={showMsg} />}
            {activeTab === 'absensi' && <AttendanceView />}
            {activeTab === 'master' && <DataMaster showMsg={showMsg} />}
            {activeTab === 'scanner' && <ScannerPage showMsg={showMsg} />}
            {activeTab === 'myqr' && <StudentQR user={currentUser} branding={branding} />}
            {activeTab === 'settings' && <SettingsPage user={currentUser} branding={branding} setBranding={setBranding} showMsg={showMsg} onLogout={logout} />}
          </AnimatePresence>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className={cn(
                "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl text-white font-medium z-50",
                message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              )}
            >
              {message.text}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all group",
        active 
          ? "bg-blue-50 text-blue-600 shadow-sm" 
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <span className={cn("transition-colors", active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

// --- LOGIC COMPONENTS ---

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await api.login(id, pass);
    setLoading(false);
    if (res.success) {
      onLogin(res.user);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 mx-auto mb-4">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Selamat Datang</h1>
          <p className="text-gray-500">Silakan login ke sistem EduAbsen</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="NISN / ID" placeholder="Masukkan ID anda" value={id} onChange={(e: any) => setId(e.target.value)} required />
          <Input label="Password" type="password" placeholder="••••••••" value={pass} onChange={(e: any) => setPass(e.target.value)} required />
          
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          
          <Button type="submit" className="w-full h-12 mt-4" disabled={loading}>
            {loading ? 'Logging in...' : 'Login Sekarang'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Dashboard({ user, branding }: { user: User, branding: any }) {
  const [stats, setStats] = useState({ totalSiswa: 0, absenHariIni: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const users = await api.getUsers();
      const absensi = await api.getAbsensi();
      const today = new Date().toISOString().split('T')[0];
      setStats({
        totalSiswa: users.filter((u: any) => u.role === 'Siswa').length,
        absenHariIni: absensi.filter((a: any) => a.tanggal === today).length
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-blue-700 to-indigo-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest mb-6 inline-block">Sistem {branding.appName}</span>
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">Halo, {user.nama}!</h1>
            <p className="text-blue-100 text-lg max-w-xl opacity-90">Selamat datang kembali di dashboard utama. Pantau kehadiran siswa dan staf secara real-time dengan presisi digital.</p>
          </motion.div>
        </div>
        {branding.logoUrl && (
          <img 
            src={branding.logoUrl} 
            alt="Dashboard Brand" 
            className="absolute bottom-0 right-0 w-48 h-48 opacity-10 -mr-8 -mb-8 rotate-12" 
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Siswa" value={stats.totalSiswa} icon={<Users className="text-blue-600" />} color="bg-blue-50" />
        <StatCard label="Kehadiran" value={stats.absenHariIni} icon={<GraduationCap className="text-emerald-600" />} color="bg-emerald-50" />
        <StatCard label="Guru Aktif" value="12" icon={<UserIcon className="text-violet-600" />} color="bg-violet-50" />
        <StatCard label="Efisiensi" value="95%" icon={<Calendar className="text-amber-600" />} color="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card title="Aktivitas Terbaru" className="lg:col-span-2">
          <div className="space-y-6">
             <ActivityItem time="08:15" action="Absen Masuk" user="Andi Wijaya" role="Siswa" color="bg-green-500" />
             <ActivityItem time="08:12" action="Absen Masuk" user="Budi Santoso" role="Petugas" color="bg-blue-500" />
             <ActivityItem time="08:05" action="Login Sistem" user="Admin" role="Administrator" color="bg-purple-500" />
          </div>
        </Card>

        <Card title="Pengumuman" className="bg-slate-900 text-white">
          <div className="space-y-6 pt-2">
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
               <span className="text-xs font-black text-blue-400 uppercase tracking-widest block mb-2">PENTING</span>
               <p className="text-sm font-medium leading-relaxed">Ujian tengah semester akan dilaksanakan pada tanggal 2 Mei 2026. Mohon pastikan kehadiran tepat waktu.</p>
            </div>
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
               <span className="text-xs font-black text-amber-400 uppercase tracking-widest block mb-2">UPDATE</span>
               <p className="text-sm font-medium leading-relaxed">Fitur export laporan excel kini tersedia untuk wali kelas dan admin.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <Card className="p-1 px-1 border-none shadow-xl shadow-gray-100/50 rounded-3xl overflow-hidden">
      <div className="p-6 flex items-center gap-5">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform hover:scale-110", color)}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">{label}</p>
          <p className="text-3xl font-black text-gray-900 tracking-tighter">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function ActivityItem({ time, action, user, role, color }: any) {
  return (
    <div className="flex items-center gap-4 group">
      <div className="w-1.5 h-12 bg-gray-50 rounded-full overflow-hidden">
        <div className={cn("w-full h-1/2 rounded-full", color)}></div>
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{user} <span className="text-gray-400 font-medium">({role})</span></p>
        <p className="text-xs text-gray-400 font-medium">{action}</p>
      </div>
      <span className="text-xs font-mono font-bold text-gray-300">{time}</span>
    </div>
  );
}

function AdminStudents({ showMsg }: any) {
  const [students, setStudents] = useState<User[]>([]);
  const [nisn, setNisn] = useState('');
  const [nama, setNama] = useState('');
  const [kelas, setKelas] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStudents = async () => {
    const data = await api.getUsers();
    setStudents(data.filter((u: any) => u.role === 'Siswa'));
  };

  useEffect(() => { fetchStudents(); }, []);

  const addStudent = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res = await api.addUser({ id: nisn, nama, kelas, role: 'Siswa', password: '123' });
    setLoading(false);
    if (res.success) {
      showMsg('Siswa berhasil ditambahkan');
      setNisn(''); setNama(''); setKelas('');
      fetchStudents();
    } else {
      showMsg(res.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Manajemen Siswa</h2>
      
      <Card title="Tambah Siswa Baru">
        <form onSubmit={addStudent} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <Input label="NISN" value={nisn} onChange={(e: any) => setNisn(e.target.value)} required />
          <Input label="Nama Lengkap" value={nama} onChange={(e: any) => setNama(e.target.value)} required />
          <Input label="Kelas" value={kelas} onChange={(e: any) => setKelas(e.target.value)} required />
          <Button type="submit" disabled={loading} className="h-12 w-full">Tambah Siswa</Button>
        </form>
      </Card>

      <Card title="Daftar Siswa">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-400 text-xs uppercase font-bold">
                <th className="py-4 px-2">NISN</th>
                <th className="py-4 px-2">Nama</th>
                <th className="py-4 px-2">Kelas</th>
                <th className="py-4 px-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {students.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-2 font-mono">{s.id}</td>
                  <td className="py-4 px-2 font-medium">{s.nama}</td>
                  <td className="py-4 px-2">{s.kelas}</td>
                  <td className="py-4 px-2">
                    <button className="text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AttendanceView() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const fetchRecords = async () => setRecords(await api.getAbsensi());
  useEffect(() => { fetchRecords(); }, []);

  const exportToExcel = () => {
    // Transform data for excel
    const dataToExport = records.map(r => ({
      'Nama Siswa': r.nama,
      'NISN': r.nisn,
      'Tanggal': r.tanggal,
      'Jam Masuk': r.jamMasuk,
      'Jam Pulang': r.jamPulang || '-',
      'Status': r.jamPulang ? 'Selesai' : 'Belum Pulang'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Absensi");

    // Set column widths
    const wscols = [
      { wch: 25 }, // Nama
      { wch: 15 }, // NISN
      { wch: 15 }, // Tanggal
      { wch: 12 }, // Masuk
      { wch: 12 }, // Pulang
      { wch: 15 }, // Status
    ];
    worksheet['!cols'] = wscols;

    // Trigger download
    XLSX.writeFile(workbook, `Laporan_Absensi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rekap Absensi</h2>
          <p className="text-gray-500 text-sm">Riwayat kehadiran seluruh siswa.</p>
        </div>
        <Button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 w-full sm:w-auto">
          <FileSpreadsheet size={18} /> Export Excel
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-400 text-xs uppercase font-bold">
                <th className="py-4 px-2">Nama Siswa</th>
                <th className="py-4 px-2 font-mono">NISN</th>
                <th className="py-4 px-2">Tanggal</th>
                <th className="py-4 px-2">Masuk</th>
                <th className="py-4 px-2">Pulang</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {records.map((r) => (
                <tr key={r.id} className="border-b transition-all hover:bg-gray-50/50">
                  <td className="py-4 px-2">
                    <div className="font-bold text-gray-900">{r.nama}</div>
                  </td>
                  <td className="py-4 px-2">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{r.nisn}</span>
                  </td>
                  <td className="py-4 px-2 text-gray-600">{r.tanggal}</td>
                  <td className="py-4 px-2">
                    <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg text-xs">{r.jamMasuk}</span>
                  </td>
                  <td className="py-4 px-2">
                    <span className={cn(
                      "font-bold px-2 py-1 rounded-lg text-xs",
                      r.jamPulang ? "text-orange-600 bg-orange-50" : "text-gray-400 bg-gray-50"
                    )}>
                      {r.jamPulang || '--:--'}
                    </span>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 italic">Belum ada data absensi yang tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ScannerPage({ showMsg }: any) {
  const [activeSubTab, setActiveSubTab] = useState<'qr' | 'manual'>('qr');
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'masuk' | 'pulang'>('masuk');
  const [manualNisn, setManualNisn] = useState('');
  const [recent, setRecent] = useState<Attendance[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const scannerRef = React.useRef<any>(null);
  const lastScanRef = React.useRef<string | null>(null);
  const scanModeRef = React.useRef<'masuk' | 'pulang'>(scanMode);
  const successAudio = React.useRef<HTMLAudioElement | null>(null);
  const errorAudio = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);

  useEffect(() => {
    // Using more stable storage URLs or CDN links
    successAudio.current = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');
    errorAudio.current = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');
    
    // Set properties for better compatibility
    successAudio.current.preload = 'auto';
    errorAudio.current.preload = 'auto';
    
    successAudio.current.load();
    errorAudio.current.load();
  }, []);

  const fetchRecent = async () => {
    const data = await api.getAbsensi();
    const today = new Date().toISOString().split('T')[0];
    setRecent(data.filter((a: any) => a.tanggal === today).reverse().slice(0, 10));
  };

  useEffect(() => { fetchRecent(); }, []);

  const startScan = () => {
    // Prime audio to unlock for current session with a very short playback
    if (successAudio.current) {
      successAudio.current.play().then(() => {
        successAudio.current?.pause();
        successAudio.current!.currentTime = 0;
      }).catch(e => console.warn('Audio priming failed (expected if no interaction):', e));
    }
    setScanning(true);
    setLastResult(null);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render((text) => onScanSuccess(text), onScanError);
      scannerRef.current = scanner;
    }, 100);
  };

  const playSound = (type: 'success' | 'error') => {
    const audio = type === 'success' ? successAudio.current : errorAudio.current;
    if (audio && audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
      audio.currentTime = 0;
      audio.play().catch(e => console.error('Audio play failed:', e));
    } else if (audio) {
      // If not ready, try to load and play once
      audio.load();
      audio.play().catch(e => console.error('Audio retry failed:', e));
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      window.speechSynthesis.speak(utterance);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (lastScanRef.current === decodedText) return;
    lastScanRef.current = decodedText;
    setTimeout(() => { lastScanRef.current = null; }, 3000);
    processAttendance(decodedText);
  };

  const processAttendance = async (nisn: string) => {
    const res = await api.scan(nisn, scanModeRef.current);
    if (res.success) {
      playSound('success');
      const actionText = res.action === 'masuk' ? 'masuk' : 'pulang';
      const msg = `Absen ${actionText} berhasil untuk ${res.data.nama}`;
      showMsg(msg);
      speak(msg);
      setLastResult({ type: 'success', name: res.data.nama, nisn, action: res.action, time: res.action === 'masuk' ? res.data.jamMasuk : res.data.jamPulang });
      fetchRecent();
      setManualNisn('');
    } else {
      playSound('error');
      showMsg(res.message, 'error');
      speak(res.message);
      setLastResult({ type: 'error', message: res.message, nisn });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualNisn) {
      setLastResult(null);
      processAttendance(manualNisn);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('Hapus data absensi ini? Siswa ini bisa melakukan absen kembali hari ini setelah dihapus.')) return;
    const res = await api.deleteAbsensi(id);
    if (res.success) {
      showMsg('Data absensi berhasil dihapus');
      fetchRecent();
    }
  };

  const resetToday = async () => {
    if (!confirm('PERINGATAN: Ini akan menghapus SELURUH data absen hari ini. Semua siswa harus absen ulang dari awal (Masuk & Pulang). Lanjutkan?')) return;
    const res = await api.resetToday();
    if (res.success) {
      showMsg(`Data hari ini berhasil direset. ${res.count} record dihapus.`);
      setRecent([]);
      setLastResult(null);
    }
  };

  const onScanError = (err: any) => {/* ignore */};

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Petugas Scan</h2>
        <div className="flex items-center gap-4">
          <Button variant="danger" onClick={resetToday} className="h-10 text-xs px-4 bg-red-50 text-red-600 border border-red-100 shadow-none hover:bg-red-600 hover:text-white">
            <RotateCcw size={14} /> Reset Hari Ini
          </Button>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveSubTab('qr')}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", activeSubTab === 'qr' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}
            >
              <Scan size={16} /> QR Scan
            </button>
            <button 
              onClick={() => setActiveSubTab('manual')}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", activeSubTab === 'manual' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}
            >
              <Keyboard size={16} /> Manual
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <Card title="Pilih Mode Absensi" className="p-4 border-2 border-blue-50">
            <div className="flex gap-4">
              <button 
                onClick={() => setScanMode('masuk')}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-bold transition-all border-2 flex flex-col items-center gap-2",
                  scanMode === 'masuk' ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-[1.02]" : "bg-white border-gray-100 text-gray-400"
                )}
              >
                <LogIn size={24} />
                <span>Absen Masuk</span>
              </button>
              <button 
                onClick={() => setScanMode('pulang')}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-bold transition-all border-2 flex flex-col items-center gap-2",
                  scanMode === 'pulang' ? "bg-orange-600 border-orange-600 text-white shadow-lg scale-[1.02]" : "bg-white border-gray-100 text-gray-400"
                )}
              >
                <LogOut size={24} />
                <span>Absen Pulang</span>
              </button>
            </div>
          </Card>

          <Card title={activeSubTab === 'qr' ? "Pindai Kode Siswa" : "Input Manual NISN"}>
            {activeSubTab === 'qr' ? (
              <div className="text-center">
                {!scanning ? (
                  <div className="py-12 flex flex-col items-center gap-6">
                    <div className={cn("w-32 h-32 rounded-full flex items-center justify-center transition-colors animate-pulse", scanMode === 'masuk' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600")}>
                      <Scan size={64} />
                    </div>
                    <Button onClick={startScan} className={cn("w-full max-w-xs h-14 text-lg", scanMode === 'pulang' ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700")}>Buka Kamera Scanner</Button>
                  </div>
                ) : (
                  <div className="py-4">
                    <div id="reader" className={cn("w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-4 shadow-inner", scanMode === 'masuk' ? "border-blue-100" : "border-orange-100")}></div>
                    <Button variant="secondary" className="mt-4" onClick={() => { scannerRef.current?.clear(); setScanning(false); }}>Tutup Kamera</Button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-6 py-4 max-w-sm mx-auto">
                <Input label="Nomor NISN / ID Siswa" placeholder="Masukkan ID di sini..." value={manualNisn} onChange={(e: any) => setManualNisn(e.target.value)} required />
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-500">
                  Siswa akan diabsenkan sebagai: <span className="font-bold text-gray-900 capitalize">{scanMode}</span>
                </div>
                <Button type="submit" variant={scanMode === 'masuk' ? 'primary' : 'orange'} className="w-full h-14 text-lg shadow-lg">
                  Submit Absensi {scanMode === 'masuk' ? 'Masuk' : 'Pulang'}
                </Button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          {lastResult && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className={cn("border-l-8", lastResult.type === 'success' ? "border-green-500 bg-green-50/30" : "border-red-500 bg-red-50/30")}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center", lastResult.type === 'success' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                    {lastResult.type === 'success' ? <Scan size={32} /> : <Trash2 size={32} />}
                  </div>
                  <div>
                    <h4 className={cn("text-xl font-bold", lastResult.type === 'success' ? "text-green-700" : "text-red-700")}>
                      {lastResult.type === 'success' ? 'Absensi Berhasil!' : 'Absensi Gagal!'}
                    </h4>
                    {lastResult.type === 'success' ? (
                      <p className="text-gray-600 font-medium">{lastResult.name} ({lastResult.nisn}) telah absen {lastResult.action} jam {lastResult.time}</p>
                    ) : (
                      <p className="text-red-600 font-medium">{lastResult.message}</p>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          <Card title="Daftar Siswa Baru Absen">
            <div className="space-y-3">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all group">
                   <div className="flex items-center gap-4">
                     <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg", r.jamPulang ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600")}>
                       {r.nama.charAt(0)}
                     </div>
                     <div>
                       <p className="font-bold text-gray-900 leading-tight text-lg">{r.nama}</p>
                       <p className="text-xs text-gray-500 font-mono flex items-center gap-2">
                         <span className="bg-gray-100 px-1.5 rounded uppercase font-bold text-[10px] text-gray-400">ID</span> {r.nisn}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <div className="text-right">
                       <p className={cn("text-[10px] font-bold uppercase tracking-tighter mb-0.5", r.jamPulang ? "text-orange-600" : "text-blue-600")}>
                         {r.jamPulang ? 'TERCATAT PULANG' : 'TERCATAT MASUK'}
                       </p>
                       <p className="text-base font-black font-mono">{r.jamPulang || r.jamMasuk}</p>
                     </div>
                     <button 
                       onClick={() => deleteRecord(r.id)} 
                       className="p-3 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                       title="Hapus untuk absen ulang"
                     >
                       <Trash2 size={20} />
                     </button>
                   </div>
                </div>
              ))}
              {recent.length === 0 && <p className="text-center text-gray-400 py-12 italic">Belum ada aktivitas absensi tercacat hari ini.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StudentQR({ user, branding }: { user: User, branding: any }) {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">QR Code Saya</h2>
      <Card className="text-center py-10 max-w-md mx-auto">
        <p className="text-gray-500 mb-6">Tunjukkan QR Code ini kepada petugas di pintu masuk/pulang.</p>
        <div className="bg-white p-6 rounded-3xl inline-block border-8 border-gray-50 shadow-sm mb-6">
          <QRCode value={user.id} size={200} />
        </div>
        <h3 className="text-xl font-bold text-gray-900">{user.nama}</h3>
        <p className="text-gray-400 mb-8 font-mono">{user.id}</p>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="secondary" className="w-full">
            <Printer size={18} /> Cetak
          </Button>
          <Button className="w-full">
            <Download size={18} /> Download
          </Button>
        </div>
      </Card>

      <Card title="Jadwal Pelajaran Hari Ini">
        <div className="space-y-1">
          <JadwalRow jam="07:30 - 09:00" matkul="Matematika" guru="Budi Santoso" />
          <JadwalRow jam="09:00 - 10:30" matkul="Bhs. Indonesia" guru="Siti Aminah" />
          <JadwalRow jam="11:00 - 12:30" matkul="Fisika" guru="Rahmat Hidayat" />
        </div>
      </Card>
    </div>
  );
}

function JadwalRow({ jam, matkul, guru }: any) {
  return (
    <div className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-gray-50 transition-colors">
       <span className="text-sm font-mono text-blue-600 font-bold whitespace-nowrap">{jam}</span>
       <div className="flex-1">
         <p className="font-bold text-gray-900">{matkul}</p>
         <p className="text-xs text-gray-500">{guru}</p>
       </div>
       <ChevronRight className="text-gray-300" size={16} />
    </div>
  );
}

function SettingsPage({ user, branding, setBranding, showMsg, onLogout }: any) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Branding states
  const [appName, setAppName] = useState(branding.appName);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl);

  const handleUpdatePassword = async (e: any) => {
    e.preventDefault();
    if (newPass !== confirmPass) return showMsg('Konfirmasi password tidak cocok', 'error');
    if (newPass.length < 3) return showMsg('Password minimal 3 karakter', 'error');

    setLoading(true);
    const res = await api.changePassword({ userId: user.id, oldPassword: oldPass, newPassword: newPass });
    setLoading(false);

    if (res.success) {
      showMsg('Password berhasil diubah. Silakan login kembali.');
      setTimeout(() => onLogout(), 1500);
    } else {
      showMsg(res.message, 'error');
    }
  };

  const handleUpdateBranding = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res = await api.updateBranding({ appName, logoUrl });
    setLoading(false);
    if (res.success) {
      setBranding({ appName, logoUrl });
      showMsg('Branding berhasil diperbarui untuk semua pengguna!');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Pengaturan Sistem</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="space-y-8 lg:col-span-1">
          <Card className="text-center overflow-hidden border-none shadow-2xl">
            <div className="h-24 bg-blue-600 -mx-6 -mt-6 mb-12 relative">
               <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-24 h-24 bg-white border-4 border-white rounded-[2rem] shadow-lg flex items-center justify-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl font-black">
                    {user.nama.charAt(0)}
                  </div>
               </div>
            </div>
            <h3 className="font-black text-2xl text-gray-900 mb-1">{user.nama}</h3>
            <p className="text-blue-600 text-xs font-black uppercase tracking-widest mb-6">{user.role}</p>
            <div className="flex justify-center gap-4">
               <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col min-w-[100px]">
                  <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">ID USER</span>
                  <span className="font-mono text-sm font-black text-gray-700">{user.id}</span>
               </div>
            </div>
          </Card>

          {user.role === 'Admin' && (
            <Card title="Kustomisasi Aplikasi" className="border-2 border-blue-50">
               <form onSubmit={handleUpdateBranding} className="space-y-5">
                  <div className="flex justify-center mb-6">
                    <div className="relative group">
                       <div className="w-24 h-24 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                          {logoUrl ? <img src={logoUrl} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : <ImageIcon className="text-gray-300" size={32} />}
                       </div>
                       <div className="absolute inset-0 bg-blue-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-3xl cursor-pointer">
                          <Palette size={20} className="text-white" />
                       </div>
                    </div>
                  </div>
                  <Input label="Nama Aplikasi" placeholder="E.g. Absensi Digital SMKN" value={appName} onChange={(e: any) => setAppName(e.target.value)} required />
                  <Input label="URL Logo (Link Gambar)" placeholder="https://domain.com/logo.png" value={logoUrl} onChange={(e: any) => setLogoUrl(e.target.value)} />
                  <p className="text-[10px] text-gray-400 italic font-medium leading-relaxed">Logo akan berubah di seluruh dashboard semua user (Admin, Siswa, Petugas).</p>
                  <Button type="submit" disabled={loading} className="w-full h-12 shadow-xl shadow-blue-200">Simpan Branding</Button>
               </form>
            </Card>
          )}
        </div>

        <Card title="Keamanan Akun" className="lg:col-span-2 shadow-2xl">
           <div className="max-w-md">
             <form onSubmit={handleUpdatePassword} className="space-y-6">
               <Input label="Password Lama" type="password" placeholder="••••••••" value={oldPass} onChange={(e: any) => setOldPass(e.target.value)} required />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Input label="Password Baru" type="password" placeholder="••••••••" value={newPass} onChange={(e: any) => setNewPass(e.target.value)} required />
                 <Input label="Konfirmasi Baru" type="password" placeholder="••••••••" value={confirmPass} onChange={(e: any) => setConfirmPass(e.target.value)} required />
               </div>
               
               <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-4">
                  <div className="w-10 h-10 bg-amber-200 rounded-full flex-shrink-0 flex items-center justify-center text-amber-700">
                    <RotateCcw size={18} />
                  </div>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">Demi keamanan, Anda akan di-logout setelah password diubah agar bisa masuk kembali menggunakan kredensial baru.</p>
               </div>

               <Button type="submit" disabled={loading} className="w-full md:w-fit px-8 h-12">
                 {loading ? 'Menyimpan...' : 'Perbarui Katasandi Akun'}
               </Button>
             </form>
           </div>
        </Card>
      </div>
    </div>
  );
}

function DataMaster({ showMsg }: any) {
  const [data, setData] = useState({ kelas: [], guru: [], waliKelas: [] });
  const [type, setType] = useState('kelas');
  const [name, setName] = useState('');

  const fetchData = async () => setData(await api.getMetadata());
  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    await api.addMetadata(type, { nama: name });
    setName('');
    showMsg(`Data ${type} berhasil ditambahkan`);
    fetchData();
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Manajemen Data Master</h2>
      
      <Card title="Input Data Baru">
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
          <button onClick={() => setType('kelas')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", type === 'kelas' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}>Kelas</button>
          <button onClick={() => setType('guru')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", type === 'guru' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}>Guru</button>
          <button onClick={() => setType('waliKelas')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", type === 'waliKelas' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}>Wali Kelas</button>
        </div>

        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <Input className="flex-1" label={`Nama ${type.charAt(0).toUpperCase() + type.slice(1)}`} value={name} onChange={(e: any) => setName(e.target.value)} required />
          <Button variant="primary" type="submit" className="h-12 px-8">Tambahkan</Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DataList title="Daftar Kelas" items={data.kelas} />
        <DataList title="Daftar Guru" items={data.guru} />
        <DataList title="Wali Kelas" items={data.waliKelas} />
      </div>
    </div>
  );
}

function DataList({ title, items }: any) {
  return (
    <Card title={title}>
      <ul className="space-y-2">
        {items.map((it: any) => (
          <li key={it.id} className="text-sm border-b py-2 flex justify-between">
            <span>{it.nama || it.namaGuru}</span>
            <span className="text-gray-400 text-xs">ID: {it.id.substr(0,4)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
