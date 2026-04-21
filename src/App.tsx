import React, { useState, useEffect } from 'react';
import { LogIn, User as UserIcon, QrCode, Scan, Users, BookOpen, GraduationCap, ChevronRight, LogOut, LayoutDashboard, Calendar, Download, Printer, Trash2, Keyboard, FileSpreadsheet, Settings, RotateCcw, Palette, Image as ImageIcon, RefreshCw, Menu, X, Check, CircleX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'react-qr-code';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, UserRole, Attendance, SubjectAttendance } from './types';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  addDoc, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

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
    
    // Firebase Implementation
    try {
      // 1. Check if user exists in Firestore first (to check role)
      const userDoc = await getDoc(doc(db, 'users', id));
      if (!userDoc.exists()) return { success: false, message: 'User tidak ditemukan' };
      
      const userData = userDoc.data() as User;
      if (userData.password !== pass) return { success: false, message: 'Password salah' };
      
      // 2. Sign in to Firebase Auth (using a dummy email mapped from ID)
      // Note: In production you should properly register users in Auth
      // Here we assume they exist or we use a fixed email per ID
      const email = `${id}@eduabsen.local`;
      try {
         await signInWithEmailAndPassword(auth, email, pass);
      } catch (e) {
         // Silently fail auth if not registered, but we still allow session for demo
         console.warn("Auth sign-in failed, continuing with Firestore session only.");
      }

      return { success: true, user: userData };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },
  getUsers: async () => {
    if (isGAS) return callGAS('getUsers');
    const q = query(collection(db, 'users'), orderBy('nama', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as User);
  },
  getAbsensi: async () => {
    if (isGAS) return callGAS('getAbsensi');
    const q = query(collection(db, 'absensi'), orderBy('tanggal', 'desc'), orderBy('jamMasuk', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Attendance));
  },
  scan: async (id: string, mode: string) => {
    if (isGAS) return callGAS('processScan', id, mode);
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('id-ID', { hour12: false });

    // Find student
    const studentDoc = await getDoc(doc(db, 'users', id));
    if (!studentDoc.exists() || studentDoc.data()?.role !== 'Siswa') {
      return { success: false, message: 'Siswa tidak ditemukan' };
    }
    const student = studentDoc.data() as User;

    // Check existing
    const q = query(collection(db, 'absensi'), where('nisn', '==', id), where('tanggal', '==', today));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docRef = doc(db, 'absensi', snapshot.docs[0].id);
      const existing = snapshot.docs[0].data() as Attendance;

      if (mode === 'masuk') {
        return { success: false, message: 'Siswa sudah absen masuk hari ini' };
      }

      if (mode === 'pulang') {
        if (existing.jamPulang) return { success: false, message: 'Siswa sudah absen pulang' };
        await updateDoc(docRef, { jamPulang: now });
        return { success: true, action: 'pulang', data: { ...existing, jamPulang: now } };
      }
    } else {
      if (mode === 'pulang') return { success: false, message: 'Siswa belum absen masuk' };
      
      const newEntry = {
        nisn: student.id,
        nama: student.nama,
        tanggal: today,
        jamMasuk: now,
        jamPulang: null
      };
      const docRef = await addDoc(collection(db, 'absensi'), newEntry);
      return { success: true, action: 'masuk', data: { ...newEntry, id: docRef.id } };
    }
  },
  addUser: async (user: any) => {
    if (isGAS) return callGAS('addUser', user);
    await setDoc(doc(db, 'users', user.id), user);
    return { success: true, user };
  },
  deleteAbsensi: async (id: string) => {
    if (isGAS) return callGAS('deleteAbsensi', id);
    await deleteDoc(doc(db, 'absensi', id));
    return { success: true };
  },
  resetToday: async () => {
    if (isGAS) return callGAS('resetToday');
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'absensi'), where('tanggal', '==', today));
    const snapshot = await getDocs(q);
    let count = 0;
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, 'absensi', d.id));
      count++;
    }
    return { success: true, count };
  },
  getBranding: async () => {
    if (isGAS) return callGAS('getBranding');
    const docSnap = await getDoc(doc(db, 'branding', 'config'));
    if (docSnap.exists()) return docSnap.data();
    return { appName: 'EduAbsen', logoUrl: '', announcements: [] };
  },
  saveSubjectAbsensi: async (data: any) => {
    if (isGAS) return callGAS('saveSubjectAbsensi', data);
    await addDoc(collection(db, 'subject_attendance'), data);
    return { success: true };
  },
  getSubjectAbsensi: async (teacherId?: string) => {
    if (isGAS) return callGAS('getSubjectAbsensi', teacherId);
    let q = query(collection(db, 'subject_attendance'), orderBy('tanggal', 'desc'));
    if (teacherId) {
      const snap = await getDocs(query(collection(db, 'subject_attendance'), where('teacherId', '==', teacherId), orderBy('tanggal', 'desc')));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as SubjectAttendance));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SubjectAttendance));
  },
  deleteSubjectAbsensi: async (id: string) => {
    if (isGAS) return callGAS('deleteSubjectAbsensi', id);
    await deleteDoc(doc(db, 'subject_attendance', id));
    return { success: true };
  },
  getSiswaByKelas: async (kelas: string) => {
    if (isGAS) return callGAS('getSiswaByKelas', kelas);
    const q = query(collection(db, 'users'), where('role', '==', 'Siswa'), where('kelas', '==', kelas));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as User).sort((a, b) => a.nama.localeCompare(b.nama));
  },
  updateBranding: async (data: any) => {
    if (isGAS) return callGAS('updateBranding', data.appName, data.logoUrl, data.announcements);
    await setDoc(doc(db, 'branding', 'config'), { 
      appName: data.appName, 
      logoUrl: data.logoUrl,
      announcements: data.announcements || []
    }, { merge: true });
    return { success: true };
  },
  updateUser: async (id: string, data: any) => {
    if (isGAS) return callGAS('updateUser', id, data);
    await updateDoc(doc(db, 'users', id), data);
    return { success: true };
  },
  deleteUser: async (id: string) => {
    if (isGAS) return callGAS('deleteUser', id);
    await deleteDoc(doc(db, 'users', id));
    return { success: true };
  },
  deleteMetadata: async (id: string) => {
    if (isGAS) return callGAS('deleteMetadata', id);
    await deleteDoc(doc(db, 'metadata', id));
    return { success: true };
  },
  changePassword: async (data: any) => {
    if (isGAS) return callGAS('changePassword', data.userId, data.oldPassword, data.newPassword);
    const userRef = doc(db, 'users', data.userId);
    await updateDoc(userRef, { password: data.newPassword });
    return { success: true };
  },
  getMetadata: async () => {
    if (isGAS) return callGAS('getMetadata');
    const q = query(collection(db, 'metadata'));
    const snap = await getDocs(q);
    const result: any = { kelas: [], guru: [], waliKelas: [] };
    snap.docs.forEach(d => {
      const data = d.data();
      if (data.type === 'kelas') result.kelas.push({ ...data, id: d.id });
      if (data.type === 'guru') result.guru.push({ ...data, id: d.id });
      if (data.type === 'waliKelas') result.waliKelas.push({ ...data, id: d.id });
    });
    return result;
  },
  addMetadata: async (type: string, data: any) => {
    if (isGAS) return callGAS('addMetadata', type, data);
    await addDoc(collection(db, 'metadata'), { ...data, type });
    return { success: true };
  }
};

// --- COMPONENTS ---

const Card = ({ children, className, title }: any) => (
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

const StatusModal = ({ show, type, title, message, onClose }: any) => (
  <AnimatePresence>
    {show && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={onClose}
           className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="relative bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center border border-gray-100"
        >
          <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6",
            type === 'success' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          )}>
            {type === 'success' ? <Check size={48} strokeWidth={3} /> : <CircleX size={48} strokeWidth={3} />}
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2 leading-tight">{title}</h3>
          <p className="text-gray-500 font-medium mb-8 leading-relaxed">{message}</p>
          <Button 
            variant={type === 'success' ? 'primary' : 'danger'} 
            className="w-full h-14 text-lg"
            onClick={onClose}
          >
            Tutup
          </Button>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- MAIN APP ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [statusModal, setStatusModal] = useState<{ show: boolean, type: 'success' | 'error', title: string, message: string }>({ show: false, type: 'success', title: '', message: '' });
  const [branding, setBranding] = useState({ appName: 'EduAbsen', logoUrl: '', announcements: [] as any[] });
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const fetchBranding = async () => {
    const data = await api.getBranding();
    setBranding(data);
  };

  useEffect(() => {
    const seedAdmin = async () => {
      const branding = await api.getBranding();
      setBranding(branding);
      
      const res = await api.getUsers();
      if (res.length === 0) {
        await api.addUser({ id: 'admin', nama: 'Administrator', role: 'Admin', password: 'admin' });
        await api.addUser({ id: 'petugas', nama: 'Petugas Scan', role: 'Petugas Scan', password: 'scan' });
        await api.addUser({ 
          id: 'guru', 
          nama: 'Budi Santoso', 
          role: 'Guru', 
          password: 'guru',
          mapel: 'Matematika',
          jadwal: [
            { kelas: 'X-IPA-1', hari: 'Senin', jam: '08:00 - 10:00' },
            { kelas: 'X-IPA-2', hari: 'Selasa', jam: '10:00 - 12:00' }
          ]
        });
      }
    };

    const saved = localStorage.getItem('user');
    if (saved) setCurrentUser(JSON.parse(saved));
    seedAdmin();

    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (branding.appName) {
      document.title = branding.appName;
    }
    if (branding.logoUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = branding.logoUrl;
    }
  }, [branding]);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const showStatus = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setStatusModal({ show: true, type, title, message });
    setTimeout(() => setStatusModal(prev => ({ ...prev, show: false })), 3000);
  };

  if (!currentUser) {
    return <Login 
      branding={branding}
      onLogin={(u) => {
        setCurrentUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      }} 
    />;
  }

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('user');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex relative">
      {/* Sidebar Desktop */}
      <aside className={cn(
        "bg-white border-r border-gray-100 flex flex-col transition-all duration-300 z-30",
        sidebarOpen ? "w-64 p-6" : "w-0 p-0 overflow-hidden opacity-0 border-none",
        "hidden md:flex"
      )}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 px-2 overflow-hidden">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="w-10 h-10 min-w-[40px] object-contain rounded-xl" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 min-w-[40px] bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <GraduationCap size={24} />
              </div>
            )}
            <span className="font-bold text-xl tracking-tight text-gray-900 truncate">{branding.appName}</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <NavBtn icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          
          {currentUser.role === 'Admin' && (
            <>
              <NavBtn icon={<Users size={20} />} label="Data Siswa" active={activeTab === 'siswa'} onClick={() => setActiveTab('siswa')} />
              <NavBtn icon={<QrCode size={20} />} label="Cetak QR" active={activeTab === 'print_qr'} onClick={() => setActiveTab('print_qr')} />
              <NavBtn icon={<Calendar size={20} />} label="Data Absensi" active={activeTab === 'absensi'} onClick={() => setActiveTab('absensi')} />
              <NavBtn icon={<BookOpen size={20} />} label="Laporan Mapel" active={activeTab === 'subject_absensi_admin'} onClick={() => setActiveTab('subject_absensi_admin')} />
              <NavBtn icon={<Settings size={20} />} label="Data Master" active={activeTab === 'master'} onClick={() => setActiveTab('master')} />
            </>
          )}

          {currentUser.role === 'Petugas Scan' && (
            <NavBtn icon={<Scan size={20} />} label="Scanner" active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} />
          )}

          {currentUser.role === 'Siswa' && (
            <NavBtn icon={<QrCode size={20} />} label="QR Saya" active={activeTab === 'myqr'} onClick={() => setActiveTab('myqr')} />
          )}

          {currentUser.role === 'Guru' && (
            <>
              <NavBtn icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavBtn icon={<BookOpen size={20} />} label="Absen Pelajaran" active={activeTab === 'absen_mapel'} onClick={() => setActiveTab('absen_mapel')} />
            </>
          )}

          <div className="mt-4 border-t border-gray-50 pt-4">
            <NavBtn icon={<Settings size={20} />} label="Pengaturan" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 mb-6 overflow-hidden">
            <div className="w-8 h-8 min-w-[32px] bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
              <UserIcon size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate text-gray-900">{currentUser.nama}</span>
              <span className="text-xs text-gray-500 truncate">{currentUser.role}</span>
            </div>
          </div>
          <Button variant="secondary" className="w-full justify-start overflow-hidden whitespace-nowrap" onClick={logout}>
            <LogOut size={18} /> Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 bottom-0 left-0 w-64 bg-white z-50 p-6 flex flex-col gap-8 md:hidden shadow-2xl"
      >
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             {branding.logoUrl ? (
               <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-lg" referrerPolicy="no-referrer" />
             ) : (
               <GraduationCap className="text-blue-600" />
             )}
             <span className="font-bold text-lg">{branding.appName}</span>
           </div>
           <button onClick={() => setSidebarOpen(false)} className="p-2 bg-gray-50 rounded-xl text-gray-500 hover:text-gray-900">
             <X size={20} />
           </button>
        </div>

        <nav className="flex flex-col gap-1">
          <NavBtn icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} />
          {currentUser.role === 'Admin' && (
            <>
              <NavBtn icon={<Users size={20} />} label="Data Siswa" active={activeTab === 'siswa'} onClick={() => { setActiveTab('siswa'); setSidebarOpen(false); }} />
              <NavBtn icon={<QrCode size={20} />} label="Cetak QR" active={activeTab === 'print_qr'} onClick={() => { setActiveTab('print_qr'); setSidebarOpen(false); }} />
              <NavBtn icon={<Calendar size={20} />} label="Data Absensi" active={activeTab === 'absensi'} onClick={() => { setActiveTab('absensi'); setSidebarOpen(false); }} />
              <NavBtn icon={<BookOpen size={20} />} label="Laporan Mapel" active={activeTab === 'subject_absensi_admin'} onClick={() => { setActiveTab('subject_absensi_admin'); setSidebarOpen(false); }} />
              <NavBtn icon={<Settings size={20} />} label="Data Master" active={activeTab === 'master'} onClick={() => { setActiveTab('master'); setSidebarOpen(false); }} />
            </>
          )}
          {currentUser.role === 'Petugas Scan' && (
            <NavBtn icon={<Scan size={20} />} label="Scanner" active={activeTab === 'scanner'} onClick={() => { setActiveTab('scanner'); setSidebarOpen(false); }} />
          )}
          {currentUser.role === 'Siswa' && (
            <NavBtn icon={<QrCode size={20} />} label="QR Saya" active={activeTab === 'myqr'} onClick={() => { setActiveTab('myqr'); setSidebarOpen(false); }} />
          )}
          {currentUser.role === 'Guru' && (
            <>
              <NavBtn icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} />
              <NavBtn icon={<BookOpen size={20} />} label="Absen Pelajaran" active={activeTab === 'absen_mapel'} onClick={() => { setActiveTab('absen_mapel'); setSidebarOpen(false); }} />
            </>
          )}
          <div className="mt-4 border-t border-gray-50 pt-4">
            <NavBtn icon={<Settings size={20} />} label="Pengaturan" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }} />
          </div>
        </nav>

        <div className="mt-auto">
          <Button variant="secondary" className="w-full justify-start" onClick={logout}>
            <LogOut size={18} /> Logout
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen relative">
        {/* Toggle Button Global (Desktop) */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden md:flex fixed top-8 z-50 px-3 py-3 bg-white hover:bg-gray-50 rounded-xl shadow-xl border border-gray-100 text-gray-600 transition-all hover:scale-110 active:scale-95"
          style={{ left: sidebarOpen ? '240px' : '32px' }}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className="max-w-6xl mx-auto pt-12 md:pt-0">
          {/* Header Mobile */}
          <div className="flex items-center justify-between md:hidden mb-10 bg-white p-4 -mx-4 -mt-4 shadow-sm border-b border-gray-50 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 bg-gray-50 rounded-xl text-blue-600"
              >
                <Menu size={24} />
              </button>
              <span className="font-black text-xl tracking-tighter bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {branding.appName}
              </span>
            </div>
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
               <UserIcon size={20} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              currentUser.role === 'Guru' 
                ? <TeacherDashboard user={currentUser} branding={branding} />
                : <Dashboard user={currentUser} branding={branding} />
            )}
            {activeTab === 'absen_mapel' && <TeacherAbsen user={currentUser} showMsg={showMsg} showStatus={showStatus} />}
            {activeTab === 'siswa' && <AdminStudents showMsg={showMsg} showStatus={showStatus} />}
            {activeTab === 'print_qr' && <AdminPrintQR branding={branding} />}
            {activeTab === 'absensi' && <AttendanceView />}
            {activeTab === 'subject_absensi_admin' && <SubjectAttendanceAdminView />}
            {activeTab === 'master' && <DataMaster showMsg={showMsg} showStatus={showStatus} />}
            {activeTab === 'scanner' && <ScannerPage showMsg={showMsg} showStatus={showStatus} branding={branding} />}
            {activeTab === 'myqr' && <StudentQR user={currentUser} branding={branding} />}
            {activeTab === 'settings' && <SettingsPage user={currentUser} branding={branding} setBranding={setBranding} showMsg={showMsg} showStatus={showStatus} onLogout={logout} />}
          </AnimatePresence>

          <StatusModal 
            show={statusModal.show} 
            type={statusModal.type}
            title={statusModal.title}
            message={statusModal.message}
            onClose={() => setStatusModal({ ...statusModal, show: false })}
          />

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

function Login({ onLogin, branding }: { onLogin: (u: User) => void, branding: any }) {
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
          <div className="mb-4">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="w-16 h-16 mx-auto object-contain rounded-2xl shadow-xl shadow-blue-100" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 mx-auto">
                <GraduationCap size={32} />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Selamat Datang</h1>
          <p className="text-gray-500">Silakan login ke sistem {branding.appName}</p>
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

function TeacherDashboard({ user, branding }: { user: User, branding: any }) {
  const [recentAbsen, setRecentAbsen] = useState<SubjectAttendance[]>([]);
  
  useEffect(() => {
    const fetch = async () => {
      const data = await api.getSubjectAbsensi(user.id);
      setRecentAbsen(data);
    };
    fetch();
  }, [user.id]);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-teal-600 to-emerald-800 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <BookOpen size={180} />
        </div>
        <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter">Halo, Guru {user.nama}!</h1>
        <p className="text-teal-50/80 text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
          Selamat datang di panel pengajar. Kelola kehadiran siswa per mata pelajaran dengan mudah dan cepat.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Jadwal Mengajar Anda">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(user.jadwal || []).map((j, i) => (
                <div key={i} className="p-5 bg-teal-50 rounded-2xl border border-teal-100 flex items-center justify-between group hover:shadow-md transition-all">
                  <div>
                    <p className="font-black text-teal-900 text-lg">{j.kelas}</p>
                    <p className="text-xs text-teal-600 font-bold uppercase tracking-widest">{j.hari} • {j.jam}</p>
                  </div>
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-teal-600 shadow-sm border border-teal-50">
                    <BookOpen size={24} />
                  </div>
                </div>
              ))}
              {(user.jadwal || []).length === 0 && (
                <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-dashed">
                   <p className="text-gray-400 italic">Belum ada jadwal yang ditetapkan oleh Admin.</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Riwayat Absen Pelajaran Terakhir">
             <div className="space-y-3">
               {recentAbsen.slice(0, 5).map(a => (
                 <div key={a.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      {a.fotoUrl ? (
                         <img src={a.fotoUrl} alt="Class" className="w-12 h-12 rounded-lg object-cover" referrerPolicy="no-referrer" />
                      ) : (
                         <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300">
                           <ImageIcon size={20} />
                         </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 leading-tight">{a.mapel}</p>
                        <p className="text-xs text-gray-500 font-medium">Kelas {a.kelas} • {a.tanggal}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                        {a.dataSiswa.length} Siswa
                      </span>
                    </div>
                 </div>
               ))}
               {recentAbsen.length === 0 && (
                 <div className="py-12 text-center text-gray-300 italic">
                   <RotateCcw className="mx-auto mb-2 opacity-50" size={32} />
                   <p>Belum ada aktivitas mengajar yang tercatat.</p>
                 </div>
               )}
             </div>
          </Card>
        </div>

        <div className="space-y-6">
          <AnnouncementList announcements={branding.announcements} />
        </div>
      </div>
    </div>
  );
}

function TeacherAbsen({ user, showMsg, showStatus }: { user: User, showMsg: any, showStatus: any }) {
  const [selectedKelas, setSelectedKelas] = useState('');
  const [subjectTitle, setSubjectTitle] = useState(user.mapel || '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [students, setStudents] = useState<User[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, 'Hadir' | 'Sakit' | 'Alfa' | 'Izin'>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedKelas) {
      const fetch = async () => {
        const data = await api.getSiswaByKelas(selectedKelas);
        setStudents(data);
        const initial: Record<string, any> = {};
        data.forEach(s => initial[s.id] = 'Hadir');
        setAttendanceData(initial);
      };
      fetch();
    }
  }, [selectedKelas]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStatusChange = (nisn: string, status: any) => {
    setAttendanceData(prev => ({ ...prev, [nisn]: status }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKelas) return showMsg('Silakan pilih kelas terlebih dahulu', 'error');
    if (!subjectTitle) return showMsg('Masukkan judul atau materi pelajaran', 'error');
    
    setLoading(true);
    const payload: SubjectAttendance = {
      id: '',
      teacherId: user.id,
      namaGuru: user.nama,
      mapel: subjectTitle,
      kelas: selectedKelas,
      tanggal: new Date().toISOString().split('T')[0],
      fotoUrl: photo || '',
      dataSiswa: students.map(s => ({
        nisn: s.id,
        nama: s.nama,
        status: attendanceData[s.id] || 'Hadir'
      }))
    };

    const res = await api.saveSubjectAbsensi(payload);
    setLoading(false);
    if (res.success) {
      showStatus('Berhasil Disimpan', 'Absensi pelajaran berhasil disimpan ke sistem!', 'success');
      setSelectedKelas('');
      setPhoto(null);
      setAttendanceData({});
      setSubjectTitle(user.mapel || '');
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Input Absen Pelajaran</h2>
          <p className="text-gray-500 text-sm">Catat kehadiran siswa untuk pertemuan hari ini.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
          <Card title="Informasi Pelajaran" className="sticky top-24">
            <form className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
                <select 
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all"
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                >
                  <option value="">-- Pilih Kelas --</option>
                  {(user.jadwal || []).map((j, i) => (
                    <option key={i} value={j.kelas}>{j.kelas}</option>
                  ))}
                </select>
              </div>

              <Input 
                label="Judul / Materi Pelajaran" 
                value={subjectTitle} 
                onChange={(e: any) => setSubjectTitle(e.target.value)} 
                placeholder="Contoh: Aljabar Linear"
              />

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1">Foto Kelas</label>
                <div className="relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="h-44 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center bg-gray-50 group-hover:border-teal-400 group-hover:bg-teal-50 transition-all overflow-hidden">
                    {photo ? (
                      <div className="relative w-full h-full">
                        <img src={photo} alt="Preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <span className="bg-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg">Ganti Foto</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-300 shadow-sm border border-gray-100 mb-2">
                           <ImageIcon size={24} />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pilih Foto</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card 
            title={selectedKelas ? `Daftar Siswa Kelas ${selectedKelas}` : "Daftar Siswa"}
            className="border-t-4 border-teal-500"
          >
            {!selectedKelas ? (
              <div className="py-32 text-center">
                 <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-200 mx-auto mb-6 border border-gray-100">
                   <Users size={40} />
                 </div>
                 <p className="text-gray-400 font-medium max-w-xs mx-auto">Silakan pilih salah satu kelas di panel kiri untuk memunculkan daftar absen siswa.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  {students.map(s => (
                    <div key={s.id} className="p-4 border border-gray-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-teal-100 hover:bg-teal-50/10 transition-all">
                      <div>
                        <p className="font-bold text-gray-900 group-hover:text-teal-900 transition-colors">{s.nama}</p>
                        <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{s.id}</p>
                      </div>
                      
                      <div className="flex bg-gray-100/50 p-1 rounded-xl w-full sm:w-auto">
                        {(['Hadir', 'Izin', 'Sakit', 'Alfa'] as const).map(status => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(s.id, status)}
                            className={cn(
                              "flex-1 sm:w-20 py-2 text-[10px] font-black uppercase rounded-lg transition-all",
                              attendanceData[s.id] === status 
                                ? (status === 'Hadir' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : status === 'Sakit' ? "bg-amber-500 text-white shadow-md shadow-amber-100" : status === 'Izin' ? "bg-teal-500 text-white shadow-md shadow-teal-100" : "bg-red-500 text-white shadow-md shadow-red-100")
                                : "text-gray-400 hover:text-gray-600"
                            )}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-8 mt-8 border-t border-gray-100">
                   <Button 
                    onClick={handleSubmit} 
                    disabled={loading} 
                    className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700 shadow-teal-100"
                   >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <RotateCcw className="animate-spin" size={20} />
                          <span>Menyimpan...</span>
                        </div>
                      ) : 'Simpan Absensi Pertemuan'}
                   </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, branding }: { user: User, branding: any }) {
  const [stats, setStats] = useState({ totalSiswa: 0, absenHariIni: 0 });
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const users = await api.getUsers();
      const absensi = await api.getAbsensi();
      const today = new Date().toISOString().split('T')[0];
      setStats({
        totalSiswa: users.filter((u: any) => u.role === 'Siswa').length,
        absenHariIni: absensi.filter((a: any) => a.tanggal === today).length
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-blue-700 to-indigo-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center justify-between mb-6">
              <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest inline-block">Sistem {branding.appName}</span>
              <button 
                onClick={fetchStats} 
                disabled={loading}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={18} className={cn(loading && "animate-spin")} />
              </button>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">Halo, {user.nama}!</h1>
            <p className="text-blue-100 text-lg max-w-xl opacity-90">Selamat datang kembali di dashboard utama. Pantau kehadiran siswa dan staf secara real-time.</p>
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
             <ActivityItem time="08:15" action="Absen Masuk" user="Siswa A" role="Siswa" color="bg-green-500" />
             <ActivityItem time="08:12" action="Absen Masuk" user="Siswa B" role="Siswa" color="bg-blue-500" />
             <ActivityItem time="08:05" action="Login Sistem" user="Admin" role="Administrator" color="bg-purple-500" />
          </div>
        </Card>

        <AnnouncementList announcements={branding.announcements} />
      </div>
    </div>
  );
}

function AnnouncementList({ announcements }: { announcements: any[] }) {
  return (
    <Card title="Pengumuman" className="bg-slate-900 text-white h-full min-h-[300px]">
      <div className="space-y-4 pt-2">
        {(announcements || []).length > 0 ? (
          announcements.map((ann: any, i: number) => (
            <div key={i} className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest block mb-1.5",
                ann.type === 'PENTING' ? "text-red-400" : 
                ann.type === 'UPDATE' ? "text-amber-400" :
                "text-blue-400"
              )}>
                {ann.type || 'PENGUMUMAN'}
              </span>
              <p className="text-sm font-medium leading-relaxed opacity-90">{ann.text}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-12 opacity-30">
            <LayoutDashboard size={48} className="mx-auto mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest">Belum ada pengumuman</p>
          </div>
        )}
      </div>
    </Card>
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

function AdminStudents({ showMsg, showStatus }: any) {
  const [students, setStudents] = useState<User[]>([]);
  const [nisn, setNisn] = useState('');
  const [nama, setNama] = useState('');
  const [kelas, setKelas] = useState('');
  const [password, setPassword] = useState('123');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setStudents(data.filter((u: any) => u.role === 'Siswa'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const studentData = { id: nisn, nama, kelas, role: 'Siswa', password };
    
    let res;
    if (editingId) {
      res = await api.updateUser(editingId, studentData);
    } else {
      res = await api.addUser(studentData);
    }

    if (res.success) {
      showStatus('Berhasil', editingId ? 'Data siswa diperbarui' : 'Siswa berhasil ditambahkan', 'success');
      setNisn(''); setNama(''); setKelas(''); setPassword('123'); setEditingId(null);
      fetchStudents();
    } else {
      showMsg(res.message, 'error');
      setLoading(false);
    }
  };

  const startEdit = (s: User) => {
    setEditingId(s.id);
    setNisn(s.id);
    setNama(s.nama);
    setKelas(s.kelas || '');
    setPassword(s.password || '123');
  };

  const deleteStudent = async (id: string) => {
    if (!confirm('Hapus siswa ini?')) return;
    setLoading(true);
    await api.deleteUser(id);
    fetchStudents();
    showMsg('Siswa berhasil dihapus');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Manajemen Siswa</h2>
        <Button onClick={fetchStudents} disabled={loading} variant="secondary" className="px-3">
          <RefreshCw size={18} className={cn(loading && "animate-spin")} />
        </Button>
      </div>
      
      <Card title={editingId ? "Edit Data Siswa" : "Tambah Siswa Baru"}>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <Input label="NISN" value={nisn} onChange={(e: any) => setNisn(e.target.value)} required disabled={!!editingId} />
          <Input label="Nama Lengkap" value={nama} onChange={(e: any) => setNama(e.target.value)} required />
          <Input label="Kelas" value={kelas} onChange={(e: any) => setKelas(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required />
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="h-12 flex-1">{editingId ? 'Simpan' : 'Tambah'}</Button>
            {editingId && <Button variant="secondary" onClick={() => { setEditingId(null); setNisn(''); setNama(''); setKelas(''); setPassword('123'); }} className="h-12">Batal</Button>}
          </div>
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
                <th className="py-4 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {students.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-2 font-mono">{s.id}</td>
                  <td className="py-4 px-2 font-medium">{s.nama}</td>
                  <td className="py-4 px-2">{s.kelas}</td>
                  <td className="py-4 px-2">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => startEdit(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">Edit</button>
                      <button onClick={() => deleteStudent(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
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

function AdminPrintQR({ branding }: any) {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterKelas, setFilterKelas] = useState('');
  const [filterNama, setFilterNama] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setStudents(data.filter((u: any) => u.role === 'Siswa'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const filtered = students.filter(s => {
    const matchKelas = filterKelas ? (s.kelas || '').toLowerCase().includes(filterKelas.toLowerCase()) : true;
    const matchNama = filterNama ? s.nama.toLowerCase().includes(filterNama.toLowerCase()) : true;
    return matchKelas && matchNama;
  });

  const downloadQR = (nisn: string, nama: string) => {
    const svg = document.getElementById("qr-" + nisn);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      canvas.width = 1000;
      canvas.height = 1000;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 100, 100, 800, 800);
        
        // Add label
        ctx.fillStyle = "black";
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(nama, 500, 940);
        ctx.fillText(nisn, 500, 980);
      }
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${nama.replace(/ /g, '_')}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-8 pb-32">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Cetak ID QR Siswa</h2>
          <p className="text-gray-500 text-sm">Cari siswa dan unduh QR Code untuk kartu absensi.</p>
        </div>
        <Button onClick={fetchStudents} disabled={loading} variant="secondary" className="px-4">
           <RefreshCw size={18} className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      <Card title="Filter Pencarian">
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Filter Kelas" placeholder="Contoh: X-IPA-1" value={filterKelas} onChange={(e: any) => setFilterKelas(e.target.value)} />
            <Input label="Cari Nama Siswa" placeholder="Nama lengkap siswa" value={filterNama} onChange={(e: any) => setFilterNama(e.target.value)} />
         </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(s => (
          <Card key={s.id} className="flex flex-col items-center p-8 group">
            <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 mb-6 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-all">
              <QRCode 
                id={"qr-" + s.id}
                value={s.id}
                size={180}
                level="H"
                className="w-full h-auto"
              />
            </div>
            <div className="text-center mb-6">
              <h3 className="font-bold text-gray-900 line-clamp-1">{s.nama}</h3>
              <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mt-1">{s.id}</p>
              <span className="inline-block mt-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase">{s.kelas || 'No Class'}</span>
            </div>
            <Button 
              onClick={() => downloadQR(s.id, s.nama)}
              className="w-full bg-blue-600 hover:bg-blue-700 shadow-blue-100"
            >
              <Download size={18} /> Download PNG
            </Button>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-300 italic bg-white rounded-3xl border border-dashed">
            <QrCode className="mx-auto mb-2 opacity-30" size={48} />
            <p>Tidak ada siswa ditemukan dengan filter tersebut.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceView() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getAbsensi();
      setRecords(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleResetToday = async () => {
    if (!confirm('PERINGATAN: Ini akan menghapus SELURUH data absen hari ini. Semua siswa harus absen ulang dari awal. Lanjutkan?')) return;
    setLoading(true);
    try {
      const res = await api.resetToday();
      if (res.success) {
        alert(`Berhasil menghapus ${res.count} data hari ini.`);
        fetchRecords();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Hapus data absensi ini? Siswa ini bisa melakukan absen kembali setelah dihapus.')) return;
    setLoading(true);
    try {
      const res = await api.deleteAbsensi(id);
      if (res.success) {
        fetchRecords();
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
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
    XLSX.writeFile(workbook, `Laporan_Absensi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rekap Absensi</h2>
          <p className="text-gray-500 text-sm">Riwayat kehadiran seluruh siswa secara real-time.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button onClick={fetchRecords} disabled={loading} variant="secondary" className="px-3">
             <RefreshCw size={18} className={cn(loading && "animate-spin")} />
          </Button>
          <Button onClick={handleResetToday} disabled={loading} variant="danger" className="text-xs bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 shadow-none">
             <RotateCcw size={16} /> Reset Hari Ini
          </Button>
          <Button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100">
            <FileSpreadsheet size={18} /> Export Excel
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b text-gray-400 text-[10px] uppercase font-black tracking-widest">
                <th className="py-4 px-6">Nama Siswa</th>
                <th className="py-4 px-6 font-mono text-center">NISN</th>
                <th className="py-4 px-6 text-center">Tanggal</th>
                <th className="py-4 px-6 text-center text-blue-600">Masuk</th>
                <th className="py-4 px-6 text-center text-orange-600">Pulang</th>
                <th className="py-4 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-50">
              {records.slice().reverse().map((r) => (
                <tr key={r.id} className="transition-all hover:bg-blue-50/20">
                  <td className="py-4 px-6">
                    <div className="font-bold text-gray-800">{r.nama}</div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">{r.nisn}</span>
                  </td>
                  <td className="py-4 px-6 text-center text-gray-500 font-medium">{r.tanggal}</td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-blue-600 font-black bg-blue-50 px-3 py-1.5 rounded-xl text-xs">{r.jamMasuk}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={cn(
                      "font-black px-3 py-1.5 rounded-xl text-xs",
                      r.jamPulang ? "text-orange-600 bg-orange-50" : "text-gray-300 bg-gray-50 italic"
                    )}>
                      {r.jamPulang || '--:--'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button 
                      onClick={() => handleDeleteRecord(r.id)}
                      disabled={loading}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 grayscale opacity-30">
                      <FileSpreadsheet size={48} />
                      <p className="font-bold text-gray-400">Belum ada data absensi tercatat.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SubjectAttendanceAdminView() {
  const [records, setRecords] = useState<SubjectAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterKelas, setFilterKelas] = useState('');
  const [filterGuru, setFilterGuru] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getSubjectAbsensi();
      setRecords(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan absensi pelajaran ini?')) return;
    setLoading(true);
    await api.deleteSubjectAbsensi(id);
    fetchRecords();
  };

  const exportToExcel = () => {
    const flatData = records.flatMap(record => 
      record.dataSiswa.map(s => ({
        Tanggal: record.tanggal,
        Guru: record.namaGuru,
        Mapel: record.mapel,
        Kelas: record.kelas,
        NISN: s.nisn,
        Siswa: s.nama,
        Status: s.status
      }))
    );

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi Mapel");
    XLSX.writeFile(wb, `Laporan_Absen_Mapel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filtered = records.filter(r => {
    const matchKelas = filterKelas ? r.kelas.toLowerCase().includes(filterKelas.toLowerCase()) : true;
    const matchGuru = filterGuru ? r.namaGuru.toLowerCase().includes(filterGuru.toLowerCase()) : true;
    return matchKelas && matchGuru;
  });

  return (
    <div className="space-y-8 pb-32">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Laporan Absensi Mapel</h2>
          <p className="text-gray-500 text-sm">Kelola dan ekspor data kehadiran siswa per mata pelajaran.</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={fetchRecords} disabled={loading} variant="secondary" className="px-4">
             <RefreshCw size={18} className={cn(loading && "animate-spin")} />
           </Button>
           <Button onClick={exportToExcel} disabled={records.length === 0} className="bg-green-600 hover:bg-green-700 shadow-green-100">
             <Download size={18} /> Ekspor Excel
           </Button>
        </div>
      </div>

      <Card title="Filter & Pencarian">
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Cari Kelas" placeholder="Contoh: X-IPA-1" value={filterKelas} onChange={(e: any) => setFilterKelas(e.target.value)} />
            <Input label="Cari Guru" placeholder="Nama Guru" value={filterGuru} onChange={(e: any) => setFilterGuru(e.target.value)} />
         </div>
      </Card>

      <Card title="Riwayat Pertemuan">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-400 text-[10px] uppercase font-black tracking-widest">
                <th className="py-4 px-6">Tanggal</th>
                <th className="py-4 px-6">Guru / Mapel</th>
                <th className="py-4 px-6 text-center">Kelas</th>
                <th className="py-4 px-6 text-center">Kehadiran</th>
                <th className="py-4 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.map((r) => {
                const hadir = r.dataSiswa.filter(s => s.status === 'Hadir').length;
                const total = r.dataSiswa.length;
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td className="py-4 px-6">
                       <span className="font-mono text-xs font-bold text-gray-500">{r.tanggal}</span>
                    </td>
                    <td className="py-4 px-6">
                       <p className="font-black text-gray-900 leading-tight">{r.namaGuru}</p>
                       <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{r.mapel}</p>
                    </td>
                    <td className="py-4 px-6 text-center">
                       <span className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-black text-gray-600">{r.kelas}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                       <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-gray-900">{hadir} / {total}</span>
                          <span className="text-[10px] text-gray-400">Hadir</span>
                       </div>
                    </td>
                    <td className="py-4 px-6">
                       <div className="flex items-center justify-center gap-2">
                          {r.fotoUrl && (
                            <a href={r.fotoUrl} target="_blank" rel="noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                               <ImageIcon size={18} />
                            </a>
                          )}
                          <button 
                            onClick={() => handleDelete(r.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                             <Trash2 size={18} />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                   <td colSpan={5} className="py-24 text-center text-gray-300 italic">
                      <FileSpreadsheet className="mx-auto mb-2 opacity-30" size={40} />
                      <p>Tidak ada data pertemuan yang ditemukan.</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ScannerPage({ showMsg, showStatus, branding }: any) {
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
    successAudio.current = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');
    errorAudio.current = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');
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
    if (successAudio.current) {
      successAudio.current.play().then(() => {
        successAudio.current?.pause();
        successAudio.current!.currentTime = 0;
      }).catch(e => console.warn('Audio priming failed:', e));
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
    if (audio && audio.readyState >= 2) {
      audio.currentTime = 0;
      audio.play().catch(e => console.error('Audio play failed:', e));
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
      const actionText = res.action === 'masuk' ? 'Masuk' : 'Pulang';
      const detailMsg = `Siswa: ${res.data.nama}\nNISN: ${nisn}\nJam: ${res.action === 'masuk' ? res.data.jamMasuk : res.data.jamPulang}`;
      showStatus(`Absen ${actionText} Berhasil`, detailMsg, 'success');
      speak(`Absen ${actionText} berhasil untuk ${res.data.nama}`);
      setLastResult({ type: 'success', name: res.data.nama, nisn, action: res.action, time: res.action === 'masuk' ? res.data.jamMasuk : res.data.jamPulang });
      fetchRecent();
      setManualNisn('');
    } else {
      playSound('error');
      showStatus('Absen Gagal', res.message, 'error');
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
    if (!confirm('Hapus data absensi ini?')) return;
    const res = await api.deleteAbsensi(id);
    if (res.success) {
      showMsg('Data absensi dihapus');
      fetchRecent();
    }
  };

  const resetToday = async () => {
    if (!confirm('Hapus SELURUH data absen hari ini?')) return;
    const res = await api.resetToday();
    if (res.success) {
      showMsg(`Data hari ini direset.`);
      setRecent([]);
      setLastResult(null);
    }
  };

  const onScanError = (err: any) => {/* ignore */};

  return (
    <div className="space-y-8 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Scanner Absensi</h2>
          <p className="text-gray-500 text-sm">Pindai QR Code siswa untuk mencatat kehadiran.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="danger" onClick={resetToday} className="h-10 text-xs px-4 bg-red-50 text-red-600 border border-red-100 shadow-none hover:bg-red-600 hover:text-white">
            <RotateCcw size={14} /> Reset Hari Ini
          </Button>
          <div className="flex bg-gray-100 p-1 rounded-xl">
             <button onClick={() => setActiveSubTab('qr')} className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", activeSubTab === 'qr' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}><Scan size={16} /> QR</button>
             <button onClick={() => setActiveSubTab('manual')} className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", activeSubTab === 'manual' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}><Keyboard size={16} /> Manual</button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
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
                <Input label="Nomor NISN / ID Siswa" placeholder="Masukkan ID..." value={manualNisn} onChange={(e: any) => setManualNisn(e.target.value)} required />
                <Button type="submit" variant={scanMode === 'masuk' ? 'primary' : 'orange'} className="w-full h-14 text-lg shadow-lg">
                  Submit Absensi {scanMode === 'masuk' ? 'Masuk' : 'Pulang'}
                </Button>
              </form>
            )}
          </Card>

          {lastResult && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className={cn("border-l-8 shadow-xl", lastResult.type === 'success' ? "border-green-500 bg-green-50/30" : "border-red-500 bg-red-50/30")}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center", lastResult.type === 'success' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                    {lastResult.type === 'success' ? <Scan size={32} /> : <RotateCcw size={32} />}
                  </div>
                  <div>
                    <h4 className={cn("text-xl font-bold", lastResult.type === 'success' ? "text-green-700" : "text-red-700")}>
                      {lastResult.type === 'success' ? 'Berhasil!' : 'Gagal!'}
                    </h4>
                    {lastResult.type === 'success' ? (
                      <p className="text-gray-600 font-medium">{lastResult.name} telah absen {lastResult.action} jam {lastResult.time}</p>
                    ) : (
                      <p className="text-red-600 font-medium">{lastResult.message}</p>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        <div className="space-y-8 lg:col-span-1">
          <AnnouncementList announcements={branding.announcements} />
          
          <Card title="Baru Saja Absen">
            <div className="space-y-3">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all group">
                   <div className="flex items-center gap-3 text-sm">
                     <p className="font-bold text-gray-900 leading-tight">{r.nama}</p>
                   </div>
                   <div className="flex items-center gap-3">
                     <p className="text-xs font-black font-mono">{r.jamPulang || r.jamMasuk}</p>
                     <button onClick={() => deleteRecord(r.id)} className="p-1 text-gray-300 hover:text-red-600"><Trash2 size={16} /></button>
                   </div>
                </div>
              ))}
              {recent.length === 0 && <p className="text-center text-gray-400 py-8 text-xs italic">Belum ada absen.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StudentQR({ user, branding }: { user: User, branding: any }) {
  return (
    <div className="space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">QR Code Saya</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="text-center py-10">
          <p className="text-gray-500 mb-6 text-sm font-medium">Tunjukkan QR Code ini kepada petugas untuk scan absensi Kamu.</p>
          <div className="bg-white p-6 rounded-3xl inline-block border-8 border-gray-50 shadow-sm mb-6">
            <QRCode value={user.id} size={220} level="H" />
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900">{user.nama}</h3>
            <p className="text-blue-600 font-bold uppercase tracking-widest text-xs">{user.id} • {user.kelas}</p>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-50 flex justify-center gap-8">
             <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Status Hari Ini</p>
                <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase">Online</span>
             </div>
             <div className="text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Role Akun</p>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase">{user.role}</span>
             </div>
          </div>
        </Card>

        <AnnouncementList announcements={branding.announcements} />
      </div>

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

function SettingsPage({ user, branding, setBranding, showMsg, showStatus, onLogout }: any) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Branding & Announcements
  const [appName, setAppName] = useState(branding.appName);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl);
  const [anns, setAnns] = useState(branding.announcements || []);

  const handleUpdatePassword = async (e: any) => {
    e.preventDefault();
    if (newPass !== confirmPass) return showMsg('Konfirmasi password tidak cocok', 'error');
    if (newPass.length < 3) return showMsg('Password minimal 3 karakter', 'error');

    setLoading(true);
    const res = await api.changePassword({ userId: user.id, oldPassword: oldPass, newPassword: newPass });
    setLoading(false);

    if (res.success) {
      showStatus('Password Diperbarui', 'Password berhasil diubah. Akun akan di-logout otomatis.', 'success');
      setTimeout(() => onLogout(), 3000);
    } else {
      showStatus('Gagal Update', res.message, 'error');
    }
  };

  const handleUpdateBranding = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res = await api.updateBranding({ appName, logoUrl, announcements: anns });
    setLoading(false);
    if (res.success) {
      setBranding({ appName, logoUrl, announcements: anns });
      showStatus('Branding Diperbarui', 'Nama aplikasi, logo, dan pengumuman telah disimpan.', 'success');
    }
  };

  const addAnn = () => setAnns([...anns, { type: 'PENGUMUMAN', text: '' }]);
  const removeAnn = (i: number) => setAnns(anns.filter((_: any, idx: number) => idx !== i));
  const updateAnn = (i: number, field: string, val: string) => {
    const next = [...anns];
    next[i] = { ...next[i], [field]: val };
    setAnns(next);
  };

  return (
    <div className="space-y-8 pb-32">
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
                  <Input label="URL Logo" placeholder="https://domain.com/logo.png" value={logoUrl} onChange={(e: any) => setLogoUrl(e.target.value)} />
                  <Button type="submit" disabled={loading} className="w-full h-12 shadow-xl shadow-blue-200">Simpan Perubahan</Button>
               </form>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-8">
          {user.role === 'Admin' && (
            <Card title="Kelola Pengumuman Dashboard" className="border-2 border-amber-50">
               <div className="space-y-6">
                 {anns.map((ann: any, idx: number) => (
                   <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                     <div className="flex justify-between items-center">
                        <select 
                          className="text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 rounded-lg px-2 py-1"
                          value={ann.type}
                          onChange={(e) => updateAnn(idx, 'type', e.target.value)}
                        >
                          <option value="PENGUMUMAN">PENGUMUMAN</option>
                          <option value="PENTING">PENTING</option>
                          <option value="UPDATE">UPDATE</option>
                          <option value="INFO">INFO</option>
                        </select>
                        <button onClick={() => removeAnn(idx)} className="text-red-400 hover:text-red-600 truncate"><Trash2 size={14} /></button>
                     </div>
                     <textarea 
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Isi pengumuman..."
                        rows={2}
                        value={ann.text}
                        onChange={(e) => updateAnn(idx, 'text', e.target.value)}
                     />
                   </div>
                 ))}
                 
                 <div className="flex gap-4">
                   <Button variant="secondary" onClick={addAnn} className="flex-1 h-12 border-dashed border-2 border-gray-200">
                     + Tambah Pengumuman
                   </Button>
                   <Button onClick={handleUpdateBranding} disabled={loading} className="flex-1 h-12">
                     Simpan Semua
                   </Button>
                 </div>
               </div>
            </Card>
          )}

          <Card title="Keamanan Akun" className="shadow-2xl">
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
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">Demi keamanan, Anda akan di-logout setelah password diubah.</p>
                 </div>

                 <Button type="submit" disabled={loading} className="w-full md:w-fit px-8 h-12">
                   {loading ? 'Menyimpan...' : 'Perbarui Katasandi'}
                 </Button>
               </form>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DataMaster({ showMsg, showStatus }: any) {
  const [data, setData] = useState({ kelas: [], guru: [], waliKelas: [] });
  const [teachers, setTeachers] = useState<User[]>([]);
  const [type, setType] = useState('kelas');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Teacher specific state
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('123');
  const [mapel, setMapel] = useState('');
  const [schedule, setSchedule] = useState<{ kelas: string; hari: string; jam: string }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const meta = await api.getMetadata();
      setData(meta);
      const allUsers = await api.getUsers();
      setTeachers(allUsers.filter(u => u.role === 'Guru'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleMetadataSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    await api.addMetadata(type, { nama: name });
    setName('');
    showStatus('Berhasil', `Data ${type} berhasil ditambahkan`, 'success');
    fetchData();
  };

  const deleteMeta = async (id: string) => {
    if (!confirm('Hapus data ini?')) return;
    await api.deleteMetadata(id);
    fetchData();
    showMsg('Data berhasil dihapus');
  };

  const handleTeacherSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const tData = { id: teacherId, nama: teacherName, role: 'Guru', mapel, jadwal: schedule, password: teacherPassword };
    let res;
    if (editingId) {
      res = await api.updateUser(editingId, tData);
    } else {
      res = await api.addUser(tData);
    }
    
    if (res.success) {
      showStatus('Berhasil', editingId ? 'Data guru diperbarui' : 'Guru berhasil didaftarkan', 'success');
      setTeacherId(''); setTeacherName(''); setTeacherPassword('123'); setMapel(''); setSchedule([]); setEditingId(null);
      fetchData();
    } else {
      showStatus('Gagal', 'Gagal memproses data guru', 'error');
    }
    setLoading(false);
  };

  const addSchedule = () => setSchedule([...schedule, { kelas: '', hari: '', jam: '' }]);
  const updateSched = (idx: number, field: string, val: string) => {
    const next = [...schedule];
    next[idx] = { ...next[idx], [field]: val };
    setSchedule(next);
  };
  const removeSched = (idx: number) => setSchedule(schedule.filter((_, i) => i !== idx));

  const startEditTeacher = (t: User) => {
    setEditingId(t.id);
    setTeacherId(t.id);
    setTeacherName(t.nama);
    setTeacherPassword(t.password || '123');
    setMapel(t.mapel || '');
    setSchedule(t.jadwal || []);
    setType('guru_manage');
  };

  const deleteTeacher = async (id: string) => {
    if (!confirm('Hapus guru ini?')) return;
    await api.deleteUser(id);
    fetchData();
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Manajemen Data Master</h2>
        <Button onClick={fetchData} disabled={loading} variant="secondary" className="px-3">
          <RefreshCw size={18} className={cn(loading && "animate-spin")} />
        </Button>
      </div>
      
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button onClick={() => setType('kelas')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", type === 'kelas' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}>Kelas</button>
        <button onClick={() => setType('guru_manage')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", type === 'guru_manage' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}>Manajemen Guru</button>
        <button onClick={() => setType('waliKelas')} className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", type === 'waliKelas' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500")}>Wali Kelas</button>
      </div>

      {(type === 'kelas' || type === 'waliKelas') && (
        <Card title={`Tambah ${type}`}>
          <form onSubmit={handleMetadataSubmit} className="flex gap-4 items-end">
            <Input className="flex-1" label={`Nama ${type}`} value={name} onChange={(e: any) => setName(e.target.value)} required />
            <Button variant="primary" type="submit" className="h-12 px-8">Tambahkan</Button>
          </form>
        </Card>
      )}

      {type === 'guru_manage' && (
        <Card title={editingId ? "Edit Guru" : "Pendaftaran Guru & Jadwal"}>
          <form onSubmit={handleTeacherSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Input label="NIP / ID Guru" value={teacherId} onChange={(e: any) => setTeacherId(e.target.value)} disabled={!!editingId} required />
              <Input label="Nama Lengkap" value={teacherName} onChange={(e: any) => setTeacherName(e.target.value)} required />
              <Input label="Mata Pelajaran" value={mapel} onChange={(e: any) => setMapel(e.target.value)} required />
              <Input label="Password" type="password" value={teacherPassword} onChange={(e: any) => setTeacherPassword(e.target.value)} required />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Jadwal Pengajaran</h4>
                <Button variant="secondary" onClick={addSchedule} className="text-xs h-8"><BookOpen size={14} /> Tambah Jadwal</Button>
              </div>
              
              <div className="grid gap-3">
                {schedule.map((s, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Kelas</label>
                      <select 
                        className="w-full h-11 px-3 rounded-lg border border-gray-200 bg-white" 
                        value={s.kelas} 
                        onChange={(e) => updateSched(idx, 'kelas', e.target.value)}
                      >
                        <option value="">Pilih Kelas</option>
                        {data.kelas.map((k: any) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
                      </select>
                    </div>
                    <Input label="Hari" className="w-full sm:w-32" placeholder="Senin" value={s.hari} onChange={(e: any) => updateSched(idx, 'hari', e.target.value)} />
                    <Input label="Jam" className="w-full sm:w-32" placeholder="08:00 - 10:00" value={s.jam} onChange={(e: any) => updateSched(idx, 'jam', e.target.value)} />
                    <button onClick={() => removeSched(idx)} className="p-3 text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                  </div>
                ))}
                {schedule.length === 0 && <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl border border-dashed">Belum ada jadwal yang diinput.</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="px-10 h-12">{editingId ? 'Simpan Perubahan' : 'Daftarkan Guru'}</Button>
              {editingId && <Button variant="secondary" onClick={() => { setEditingId(null); setTeacherId(''); setTeacherName(''); setMapel(''); setSchedule([]); }} className="h-12">Batal</Button>}
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DataList title="Daftar Kelas" items={data.kelas} onDelete={deleteMeta} />
        <Card title="Daftar Guru">
           <div className="space-y-4">
             {teachers.map(t => (
               <div key={t.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-2 relative group">
                 <div className="flex justify-between items-start">
                   <div>
                     <p className="font-bold text-gray-900 leading-none">{t.nama}</p>
                     <p className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-wider">{t.id}</p>
                   </div>
                   <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => startEditTeacher(t)} className="p-1 px-2 text-blue-600 text-xs font-bold hover:underline">Edit</button>
                     <button onClick={() => deleteTeacher(t.id)} className="p-1 px-2 text-red-600 text-xs font-bold hover:underline">Hapus</button>
                   </div>
                 </div>
                 <div className="flex flex-col gap-1">
                   <span className="text-xs font-bold text-blue-600">{t.mapel}</span>
                   <p className="text-[10px] text-gray-400 italic">Jadwal: {(t.jadwal || []).length} Sesi</p>
                 </div>
               </div>
             ))}
             {teachers.length === 0 && <p className="text-center text-sm text-gray-300 py-8">Belum ada data guru.</p>}
           </div>
        </Card>
        <DataList title="Wali Kelas" items={data.waliKelas} onDelete={deleteMeta} />
      </div>
    </div>
  );
}

function DataList({ title, items, onDelete }: any) {
  return (
    <Card title={title}>
      <ul className="space-y-2">
        {items.map((it: any) => (
          <li key={it.id} className="text-sm border-b py-3 flex justify-between items-center group">
            <span className="font-medium text-gray-700">{it.nama || it.namaGuru}</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-300 text-[10px] font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">ID: {it.id.substr(0,4)}</span>
              <button onClick={() => onDelete(it.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && <p className="text-center text-xs text-gray-300 py-4 italic">Tidak ada data</p>}
      </ul>
    </Card>
  );
}
