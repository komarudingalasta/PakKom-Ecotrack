# PakKom EcoTrack v6.4 — Task Core Stable

Tujuan versi ini adalah mengisolasi modul Tugas tanpa mengubah fitur lama EcoTrack.

Perubahan:
- Navigasi Tugas memakai satu fungsi navigateToPage().
- Halaman Tugas dirender sinkron sebelum membaca Firestore.
- Tombol + Buat Tugas selalu tersedia untuk Admin walau daftar Firestore gagal dimuat.
- Banner Task Core v6.4 memudahkan verifikasi bahwa file live terbaru benar-benar termuat.
- Pembacaan daftar tugas dipisah ke loadTaskManagementList().

Update repository: replace main.js, index.html, siswa/index.html, styles.css.
Firestore Rules tidak berubah dari Rules v6.1 yang sudah dipublish.
