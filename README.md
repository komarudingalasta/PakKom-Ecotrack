# PakKom Eco Track — Layout Consistency & Bulk Approval Polish

Perbaikan layout:
- Semua menu memakai satu tinggi header dan satu padding konten.
- Beranda, Wadah, Kebersihan, Rekap, Akun, dan Kelola selalu mulai dari titik vertikal yang sama.
- Saat berpindah menu, halaman otomatis kembali ke posisi paling atas.
- Scroll anchoring dinonaktifkan pada Rekap agar data Firestore yang selesai dimuat tidak membuat halaman turun/naik.
- Area Rekap memiliki tinggi minimum stabil selama proses pemuatan.
- Akun tidak lagi memakai lebar/posisi khusus yang berbeda dari menu lain.
- Bottom navigation memiliki tinggi dan safe-area yang konsisten.

Approval akun:
- Checkbox pada setiap akun pending.
- Pilih Semua / Batal Pilih Semua.
- Approve Terpilih.
- Approve Semua.
- Konflik Wali Kelas atau kelas yang belum tersedia dilewati otomatis dan akun lain tetap diproses.
