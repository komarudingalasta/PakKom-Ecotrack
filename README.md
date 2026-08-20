# Pak Kom Eco Track v2.2 — Firebase Ready

Web pendataan wadah makan dan tumbler siswa untuk penggunaan bersama oleh Guru dan Admin.

## Fitur utama
- Login Guru/Admin dengan ID sederhana
- Firebase Authentication + Cloud Firestore
- Role Guru dan Admin dari Firestore
- Pendataan kelas 7A–9I
- Hadir / Izin / Sakit / Alpa
- Wadah makan dan tumbler
- Input massal untuk mempercepat pendataan
- Status kelas sudah/belum didata
- Koreksi dengan audit pengguna dan waktu
- Rekap harian
- Admin import Excel siswa, termasuk data >500 siswa
- Admin membuat akun Guru
- Firestore Security Rules
- Responsif HP, tablet, dan PC

## Mulai pemasangan
Ikuti panduan lengkap pada `SETUP_FIREBASE.md`.

## Struktur file
- `index.html` — tampilan utama
- `styles.css` — desain responsif
- `app.js` — logika aplikasi + Firebase
- `firebase-config.js` — tempat konfigurasi project Firebase Anda
- `firestore.rules` — Security Rules
- `SETUP_FIREBASE.md` — panduan dari nol sampai login Admin

## Catatan
Jangan mengunggah project dengan Firestore dalam mode terbuka. Gunakan `firestore.rules` yang disertakan sebelum web dipakai oleh guru.


## Firebase project terhubung

Versi v2.2 sudah berisi konfigurasi project Firebase `pakkom-ecotrack`. Sebelum digunakan, aktifkan Email/Password pada Firebase Authentication, buat Cloud Firestore, lalu publish `firestore.rules` yang disertakan.
