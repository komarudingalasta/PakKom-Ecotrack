# Student Access v4.8

Perbaikan fokus:
- Tombol **Aktifkan Login Terpilih** memakai event delegation sehingga tetap bekerja setelah tabel/DOM dirender ulang.
- Tombol **Aktifkan** per siswa memakai handler stabil yang sama.
- Setelah aktivasi berhasil, data siswa dibaca ulang dari Firestore sehingga status **Login Aktif** tampil tanpa refresh halaman.
- Logout memaksa `appView` tersembunyi dan `loginView` tampil sebelum dan sesudah Firebase signOut, sehingga dashboard lama tidak tertinggal.
- Tidak mengubah Firestore Rules.
