# PakKom EcoTrack v9.7.2

Perbaikan:
- Halaman Tugas siswa memvalidasi status aktif dari `studentAccess/{nis}` sebagai sumber utama.
- NIS sesi siswa disimpan di `sessionStorage` agar halaman `/siswa/tugas/` tidak kehilangan konteks siswa.
- Cache-buster halaman siswa/tugas diperbarui ke v9.7.2.
- Firestore helper `isStudent()` memeriksa `studentAccess.active`, sehingga profil sesi anonim yang stale tidak langsung membuat siswa aktif ditolak.

Tugas kelompok:
- Admin tidak lagi meng-generate kelompok otomatis.
- Siswa membentuk kelompok sendiri dari teman satu kelas.
- Kelompok berisi 2–6 siswa.
- Sistem mencegah pemilihan siswa yang sudah berada di kelompok lain pada tugas yang sama (client check).
- Firestore Rules memvalidasi kelompok dibuat untuk tugas bertipe `group`, kelas sesuai, pembuat termasuk anggota, dan jumlah anggota 2–6.
- Anggota kelompok dikunci setelah dibuat; perubahan/hapus sementara hanya Admin.
- Guru/Wali/Admin dapat melihat siswa yang belum membentuk kelompok serta kelompok yang sudah/belum mengumpulkan.

Firestore Rules berubah dan wajib dipublish.
