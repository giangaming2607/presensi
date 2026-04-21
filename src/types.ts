/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Admin' | 'Siswa' | 'Petugas Scan' | 'Guru' | 'Wali Kelas';

export interface User {
  id: string; // NISN or ID
  nama: string;
  kelas?: string;
  role: UserRole;
  password?: string;
  mapel?: string;
  jadwal?: { kelas: string; hari: string; jam: string }[];
}

export interface Attendance {
  id: string;
  nisn: string;
  nama: string;
  tanggal: string; // YYYY-MM-DD
  jamMasuk: string | null;
  jamPulang: string | null;
}

export interface Teacher {
  id: string;
  nama: string;
  mapel?: string;
}

export interface Class {
  id: string;
  nama: string;
}

export interface WaliKelas {
  id: string;
  namaGuru: string;
  idKelas: string;
}

export interface SubjectAttendance {
  id: string;
  teacherId: string;
  namaGuru: string;
  mapel: string;
  kelas: string;
  tanggal: string;
  fotoUrl?: string;
  dataSiswa: {
    nisn: string;
    nama: string;
    status: 'Hadir' | 'Sakit' | 'Alfa' | 'Izin';
  }[];
}
