# PakKom EcoTrack – Student Access v4

## Perubahan
- Data `students` tetap data induk.
- Admin memiliki tab **Akses Login Siswa**.
- Aktivasi login dapat dilakukan per kelas atau semua siswa yang belum aktif.
- Siswa login di `/siswa/` dengan NIS sebagai username dan password.
- Untuk NIS 5 digit, password Firebase internal adalah `S+NIS`; siswa tetap mengetik NIS.
- Aktivasi tidak membuat data siswa baru.
- Setiap akun Authentication ditautkan kembali lewat `students.authUid`.
- Hasil aktivasi menampilkan NIS, nama, kelas, status, dan pesan error.
- Sinkronkan Kelas memperbarui profil `users/{uid}` dari data induk siswa.

## Uji aman
Aktifkan satu kelas atau beberapa siswa terlebih dahulu sebelum menjalankan Aktivasi Semua. Pastikan Email/Password provider Firebase Authentication telah Enabled.
