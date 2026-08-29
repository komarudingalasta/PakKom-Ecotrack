# PakKom EcoTrack v4.7 — Student Login Activation Fix

Perbaikan utama:
- Firebase Auth REST `accounts:signUp` sekarang menggunakan `returnSecureToken: true` sesuai API Firebase.
- UID hasil pembuatan akun digunakan untuk membuat `users/{uid}` role siswa dan menautkan `students/{studentId}.authUid`.
- Aktivasi tetap melalui Admin → Kelola Data → Data Siswa.
- Tidak menggunakan `signIn` pada default Firebase Auth, sehingga sesi Admin tidak berubah.

Update dari v4.6: cukup ganti `main.js`.
Firestore Rules tidak perlu berubah jika sudah menggunakan Rules final siswa.
