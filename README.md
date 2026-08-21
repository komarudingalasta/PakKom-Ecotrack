# PakKom Eco Track v2.7 — UI & Cleanliness Module

## Modul utama
- **Wadah & Tumbler** — pendataan siswa per kelas, satu record kelas per hari.
- **Kebersihan Kelas** — pemeriksaan per kelas dan JP, boleh berkali-kali dalam sehari.
- **Rekap** — data wadah/tumbler dan fondasi rekap kebersihan.
- **Kelola** (Admin) — siswa, guru/wali kelas, kelas, import, dan riwayat.

## Kebersihan
Empat aspek:
1. Lantai
2. Meja & Kursi
3. Tempat Sampah
4. Perlengkapan Kelas

Masing-masing memakai tiga kategori: **Baik / Cukup / Perlu**.
Guru memilih kelas dan JP. Hanya pemeriksaan yang sudah dilakukan yang ditampilkan; JP yang belum diperiksa tidak ditampilkan sebagai kekurangan.

## Branding
Nama antarmuka telah diubah menjadi **PakKom Eco Track**.

## Firebase
Publish `firestore.rules` versi ini sebelum memakai modul kebersihan karena terdapat collection baru `cleanliness`.

Konfigurasi project tetap berada di `firebase-config.js`.
