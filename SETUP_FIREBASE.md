# Setup Firebase — PakKom Eco Track v2.9

1. Pastikan **Authentication → Email/Password** aktif.
2. Gunakan project Firebase `pakkom-ecotrack` pada `firebase-config.js`.
3. Buka **Firestore Database → Rules**, ganti dengan isi `firestore.rules` dari paket v2.9, lalu **Publish**.
4. Admin tetap login dengan ID `ADMIN` sesuai akun Firebase Admin yang sudah dibuat.
5. Guru dapat dibuat oleh Admin/import, atau mendaftar sendiri dari halaman login. Pendaftaran mandiri harus di-approve Admin di **Kelola → Akun Guru & Wali Kelas**.
6. Import tidak langsung menyimpan data: pilih file, periksa preview, lalu tekan **Import Sekarang**.

### Catatan hapus kelas
Kelas tidak dapat dihapus jika masih mempunyai siswa aktif. Riwayat pendataan lama tidak dihapus ketika siswa/kelas dihapus dari master.
