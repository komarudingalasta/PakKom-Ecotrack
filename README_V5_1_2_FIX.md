# v5.1.2
Perbaikan:
1. `sha256Text is not defined` diperbaiki dengan helper SHA-256 global.
2. Race condition Anonymous Auth diperbaiki: dashboard tidak dirender sebelum NIS/password selesai diverifikasi.
3. Tampilan login siswa dibersihkan: tidak ada logo/judul Portal Siswa yang menimpa form.
4. `appView.hidden` dipaksa benar-benar tersembunyi saat login.
5. Firestore Rules tidak berubah.
