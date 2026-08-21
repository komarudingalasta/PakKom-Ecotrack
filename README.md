# PakKom Eco Track — Scheduled Analysis & Sharing

Periode Analisis:
- Admin menjadwalkan nama, tanggal mulai, tanggal selesai.
- Status otomatis: Terjadwal → Sedang Berjalan → Selesai.
- Saat periode sudah lewat, snapshot hasil final dibuat pada sinkronisasi Admin berikutnya dan disimpan permanen di Firestore.
- Hasil tidak otomatis terlihat Wali Kelas.
- Admin menekan `Bagikan Hasil ke Wali Kelas` setelah review.
- Admin dapat `Tarik Akses` tanpa menghapus snapshot.
- Wali Kelas hanya melihat hasil kelas walinya + apresiasi umum, bukan nilai lengkap kelas lain.
- Riwayat/koreksi tetap hanya berada di menu Kelola Data yang hanya dapat dibuka Admin.

Catatan teknis: GitHub Pages tidak memiliki proses server yang berjalan 24 jam. Karena itu finalisasi otomatis dilakukan pada sinkronisasi pertama setelah periode berakhir (saat Admin membuka modul), lalu snapshot tersimpan permanen.

Firestore Rules tetap menggunakan koleksi `analysisPeriods`; gunakan rules yang disertakan.
