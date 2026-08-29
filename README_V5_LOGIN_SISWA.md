# PakKom EcoTrack v5 — Login Siswa via Upload

Perubahan utama:
- Admin/Guru tetap Firebase Email/Password.
- Siswa memakai Firebase Anonymous Authentication + akses login dari file Excel.
- Tidak ada lagi generate 900 akun Email/Password.
- Admin: Data Siswa → Unduh Template Akses → Upload Akses Login.
- Password disimpan sebagai SHA-256 hash pada `studentAccess`, bukan teks biasa.
- Setelah login siswa, aplikasi membuat profil sesi sementara `users/{anonymousUid}` agar Rules tugas tetap ketat.
- Saat logout, profil sesi siswa dihapus, Firebase signOut dijalankan, lalu halaman reload agar dashboard lama tidak tertinggal.
- Wajib aktifkan Firebase Authentication → Anonymous.
- Wajib publish FIRESTORE_RULES_V5.txt.
