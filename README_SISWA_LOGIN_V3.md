# Login Siswa v3

- Siswa tetap mengetik NIS sebagai ID dan password.
- Untuk NIS 5 digit, aplikasi menambahkan prefix internal `S` hanya saat berkomunikasi dengan Firebase Authentication.
- Contoh: siswa mengetik 24001 / 24001, Firebase menerima email internal 24001@pakkom-ecotrack.app dan password internal S24001.
- Akun Admin/Guru tidak berubah.
- Login siswa mencoba format internal baru terlebih dahulu dan fallback ke password lama untuk kompatibilitas akun siswa 6+ digit yang mungkin sudah pernah dibuat.
