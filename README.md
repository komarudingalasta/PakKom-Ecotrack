# PakKom Eco Track v3.3 — Application Core Rebuild

Versi ini mempertahankan login Classic Auth yang sudah berhasil dan merombak seluruh aplikasi setelah login.

## Struktur
- `index.html` — tampilan Login & shell aplikasi
- `firebase-config.js` — konfigurasi Firebase
- `auth-core.js` — login Firebase Compat
- `app-core.js` — seluruh dashboard dan fitur PakKom Eco Track
- `styles.css` — UI responsive

## Perbaikan utama
- Tidak ada campuran Firebase Compat dan Modular.
- Authentication dan Firestore memakai instance Firebase yang sama.
- Setelah login, Dashboard, Wadah, Kebersihan, Rekap, dan Kelola dirender oleh Application Core yang konsisten.
- `auth.js` dan `app.js` lama tidak digunakan lagi.
- Data dashboard dimuat setelah shell aplikasi tampil.
- Jika satu query data gagal, login tidak dibatalkan.

## Modul
- Wadah & Tumbler
- Kebersihan Kelas
- Rekap
- Data Siswa
- Guru & Wali Kelas
- Kelas & Import
- Kalender Sekolah
- Approval akun
- Riwayat
