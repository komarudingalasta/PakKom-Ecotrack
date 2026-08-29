# PakKom EcoTrack v9.2 — Student Portal Stable

Perubahan utama:
- `/siswa/` tidak lagi memuat `main.js` EcoTrack Admin/Guru.
- Portal siswa memiliki `siswa.js` dan `siswa.css` sendiri.
- Login siswa tetap Firebase Anonymous + `studentAccess/{NIS}`.
- `classId` dinormalisasi saat sesi siswa dibuat (contoh `9 F`, `9f`, `Kelas 9F` menjadi `9F`).
- Dashboard Beranda menampilkan ringkasan tugas.
- Halaman Saya menampilkan Nama, NIS, Kelas, Status.
- Menu Tugas menuju `/siswa/tugas/` dan memakai sesi siswa yang sama.
- Rules `students` diperketat: anonymous yang belum terverifikasi tidak lagi dapat membaca seluruh master siswa.

## WAJIB
Karena Firestore Rules berubah, deploy `firestore.rules` versi ini.

## Pengujian
1. Buka `/siswa/`.
2. Keluar jika masih ada sesi lama, lalu login ulang.
3. Pastikan Beranda menampilkan Nama/NIS/Kelas dan ringkasan tugas.
4. Buka Saya dan cek profil.
5. Buka Tugas. Assignment terbit untuk kelas siswa harus tampil.
6. Isi jawaban lalu Simpan Draf/Kumpulkan.
