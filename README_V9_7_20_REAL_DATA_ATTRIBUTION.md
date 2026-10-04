# PakKom EcoTrack v9.7.20

## Perubahan
- Unduh Data / Template mengambil data aktual `records` sesuai rentang tanggal dan kelas.
- Data yang sudah ada otomatis dikonversi kembali ke kode L/W/T/X/S/I/A.
- Tanggal tanpa data dapat dibiarkan kosong (default) atau diisi L.
- Sebelum Terapkan Import, Admin memilih pengisi/petugas: Admin atau akun Guru/Wali Kelas aktif.
- Record menyimpan `inputBy*` sebagai petugas yang dipilih dan `importedBy*` sebagai Admin yang menjalankan import.
- Audit mencatat import admin dan `onBehalfOf*`.
- Record tetap memakai ID `tanggal_kelas`, sehingga update tidak membuat duplikat.

## Firestore Rules
Tidak diubah. Operasi import tetap dijalankan oleh akun Admin terhadap koleksi `records` dan pembacaan `users` yang sudah digunakan aplikasi.
