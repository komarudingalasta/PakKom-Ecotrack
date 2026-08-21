# PakKom Eco Track v3.1.1 — Direct Login

## Perubahan utama
- Tidak ada lagi layar **Memeriksa sesi**.
- Halaman Login langsung tampil saat web dibuka.
- Firebase Authentication hanya dijalankan setelah tombol **MASUK** ditekan.
- Sesi menggunakan `inMemoryPersistence`.
- Refresh halaman akan kembali ke Login.
- Login berhasil hanya jika:
  1. ID/password valid di Firebase Authentication.
  2. Dokumen `users/{uid}` ada.
  3. Role dan status akun valid.
- Data dashboard dimuat setelah login dan tidak menghalangi proses autentikasi.

## Alasan
Arsitektur ini lebih sederhana dan stabil untuk penggunaan sekolah karena tidak ada pemulihan sesi yang dapat membuat halaman tersangkut saat startup.
