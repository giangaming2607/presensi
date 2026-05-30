# Tutorial Membuat Bot Telegram dan Mendapatkan Token

Untuk mengirim pesan absensi secara otomatis ke Telegram orang tua, Anda perlu membuat Bot Telegram dan mendapatkan HTTP API Token-nya. Ikuti langkah-langkah di bawah ini:

## Langkah 1: Buat Bot di BotFather
1. Buka aplikasi **Telegram** di HP atau komputer Anda.
2. Cari di kolom pencarian (search): `@BotFather`. Pastikan Anda memilih akun yang memiliki centang biru (resmi dari Telegram).
3. Mulai chat dengan BotFather dan ketik perintah `/start`.
4. Ketik perintah `/newbot` untuk membuat bot baru.
5. BotFather akan meminta Anda memberikan **Nama** untuk bot Anda (Contoh: `Bot Absensi Sekolah`).
6. BotFather kemudian akan meminta Anda memberikan **Username** untuk bot. Username harus diakhiri dengan kata "bot" (Contoh: `absensismabackbot` atau `NamaSekolah_Bot`).
7. Jika berhasil, BotFather akan memberikan **HTTP API Token**. 
   - Token ini bentuknya panjang seperti: `123456789:ABCDefGhIjKlMnOpQrStUvWxYz`.
   - **Simpan token ini baik-baik!** Jangan bagikan ke orang yang tidak berkepentingan.

## Langkah 2: Masukkan Token ke Aplikasi Absensi
1. Buka aplikasi absensi dan login sebagai **Admin**.
2. Masuk ke menu **Pengaturan Notif (WA & Telegram)** di sidebar kiri.
3. Gulir ke bagian **Pengaturan Telegram**.
4. Masukkan **HTTP API Token** yang didapat dari BotFather ke kolom yang tersedia lalu klik Simpan.

## Langkah 3: Mendapatkan Chat ID (ID Akun Telegram Orang Tua)
Agar sistem bisa mengirim pesan ke orang tua secara spesifik, saat menambahkan data siswa, Anda perlu mengisi **Telegram Chat ID** dari akun orang tua tersebut. 

Cara agar orang tua bisa mengetahui Chat ID mereka:
1. Minta orang tua untuk mencari bot yang Anda buat di Telegram (misal: `@absensismabackbot`).
2. Minta mereka klik **START** atau mengetik `/start` di chat dengan bot tersebut.
3. Setelah itu, minta mereka mencari bot bernama `@userinfobot` atau `@getmyid_bot` di Telegram.
4. Teruskan (Forward) salah satu pesan dari bot tersebut ke Anda, ATAU jika mereka menekan `/start` pada `@userinfobot`, mereka akan mendapatkan "ID" berbentuk angka (contoh: `1234567890`).
5. **ID Angka** inilah yang dimasukkan oleh Admin ke dalam kolom **Telegram Chat ID** saat mengisi data siswa (di menu Data Siswa).

## Selesai!
Sekarang setiap kali siswa melakukan *Scan QR* (masuk maupun pulang), sistem akan mengirimkan dua pesan sekaligus jika no HP dan Telegram ID tersedia: 
1. Terbuka pop-up WhatsApp web/aplikasi otomatis ke nomor WA Ortu.
2. Pesan terkirim otomatis di latar belakang ke aplikasi Telegram orang tua.

*Pastikan orang tua sudah menekan **START** di bot Anda sebelumnya; jika belum, bot tidak bisa mengirimkan pesan apa pun ke mereka karena aturan keamanan Telegram.*
