# Pak Kom Eco Track v2 — Firebase

Versi ini memakai Firebase Authentication + Cloud Firestore agar semua guru memakai database yang sama.

## Fitur
- Login Guru/Admin dengan ID sederhana (tanpa perlu mengetik email)
- Role Guru dan Admin dari Firestore
- Pendataan seluruh kelas 7A–9I
- Hadir / Izin / Sakit / Alpa
- Wadah makan dan tumbler
- Semua Hadir / Semua Bawa Wadah / Semua Bawa Tumbler
- Status kelas sudah/belum didata
- Koreksi data guru lain dengan audit pengguna/waktu
- Rekap harian
- Admin import siswa dari Excel (.xlsx/.xls/.csv)
- Admin membuat akun guru
- Seed kelas 7A–9I
- Firestore Security Rules
- Responsif HP/tablet/PC

## Setup Firebase
1. Buat project Firebase khusus Pak Kom Eco Track.
2. Tambahkan Web App.
3. Buka Authentication > Sign-in method > aktifkan Email/Password.
4. Buka Firestore Database > Create database.
5. Salin konfigurasi Web App ke `firebase-config.js`.
6. Buka Firestore > Rules, salin seluruh isi `firestore.rules`, lalu Publish.
7. Buat akun Admin awal secara manual di Firebase Authentication:
   - email: `admin@pakkom-ecotrack.app`
   - password: buat password minimal 6 karakter.
8. Salin UID akun Admin dari Authentication.
9. Di Firestore buat collection `users`, document ID = UID Admin, isi field:
   - `loginId` (string): `ADMIN`
   - `name` (string): `Administrator`
   - `role` (string): `admin`
   - `active` (boolean): `true`
10. Login ke web dengan ID `ADMIN` + password akun tadi.
11. Masuk Kelola Data > klik `Pastikan 7A–9I Tersedia`.
12. Buat akun guru dari menu `+ Guru`.
13. Import siswa dari Excel.

## Format Excel siswa
Baris pertama harus memiliki header berikut:

| NIS | Nama | Kelas |
|---|---|---|
| 12345 | Ahmad Fauzan | 7A |
| 12346 | Alya Putri | 7A |

Import menggunakan NIS sebagai ID unik. Jika NIS sudah ada, nama/kelas akan diperbarui.

## Login ID tanpa email
Guru mengetik misalnya `G001`. Aplikasi secara internal mengubahnya menjadi `g001@pakkom-ecotrack.app` untuk Firebase Authentication. Guru tidak perlu mengetahui mekanisme ini.

## Struktur Firestore
- `users/{uid}` — akun dan role
- `classes/{classId}` — master kelas
- `students/{nis}` — master siswa
- `records/{YYYY-MM-DD_KELAS}` — data pendataan harian
- `settings/{id}` — cadangan pengaturan aplikasi

## Catatan keamanan
Jangan memakai Firestore Rules `allow read, write: if true`. Versi ini memakai role dari `users/{uid}`. Guru dapat membaca master data dan membuat/mengoreksi record, tetapi tidak dapat mengubah siswa, kelas, akun guru, settings, atau menghapus record. Admin memiliki hak pengelolaan tersebut.
