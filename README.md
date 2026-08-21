# PakKom Eco Track v2.8 — Data Management & Teacher Approval

## Perubahan utama
- Admin dapat **menghapus siswa** dari master. Riwayat pendataan lama tidak ikut dihapus.
- Admin dapat **menghapus kelas**. Kelas yang masih memiliki siswa aktif tidak dapat dihapus sebelum siswa dipindahkan/dihapus.
- Kelas yang dihapus **tidak dibuat kembali otomatis** saat Admin login. Tombol pembuatan kelas standar 7A–9I tetap tersedia bila diperlukan.
- Halaman login memiliki **Daftar sebagai Guru**. Pendaftar memilih **Guru** atau **Wali Kelas**; wali kelas memilih kelas binaan.
- Akun hasil pendaftaran dibuat dengan status **Menunggu Persetujuan** (`approved:false`, `active:false`). Admin harus menekan **Approve** sebelum akun dapat digunakan.
- Admin dapat menolak pendaftaran.
- Import siswa dan guru sekarang dua tahap: **Upload File → Preview/Validasi → Import Sekarang**. Memilih file tidak langsung menulis data ke Firestore.
- Siswa tetap tidak memiliki akun/password. Password hanya untuk akun guru.

## Format import siswa
`NIS | Nama | Kelas | Status`

## Format import guru
`ID Guru | Nama | Password Awal | Jenis | Kelas Wali | Status`

Nilai `Jenis`: `Guru` atau `Wali Kelas`. `Kelas Wali` wajib untuk Wali Kelas.

## Penting
Publish `firestore.rules` v2.8 sebelum menggunakan fitur pendaftaran mandiri guru. Rules ini mengizinkan akun baru membuat **hanya profil pending miliknya sendiri**; akun pending tidak dapat membaca data siswa, kelas, pendataan, atau kebersihan sampai di-approve Admin.
