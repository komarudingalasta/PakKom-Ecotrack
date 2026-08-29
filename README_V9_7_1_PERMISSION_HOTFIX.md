# PakKom EcoTrack v9.7.1 Permission Hotfix

Perbaikan:
- assignments: student list permission dikembalikan ke pola stabil agar query collection targetClasses tidak memblokir halaman Tugas.
- cocurricularPrograms: nama koleksi sesuai frontend dan aturan list sesuai query active==true.
- halaman Tugas siswa sekarang memuat tiap sumber data secara terpisah; satu query gagal tidak lagi menutup seluruh halaman.
- program di sisi siswa tetap menyaring archived.

Wajib publish firestore.rules versi ini.
