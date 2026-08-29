# Mengaktifkan Reset Password oleh Admin

Fitur tombol **Reset Password** di Kelola Guru/Wali Kelas membutuhkan Firebase Cloud Functions.

## Persiapan
1. Install Node.js 20 dan Firebase CLI di PC.
2. Login:
   `firebase login`
3. Dari folder project ini, salin `.firebaserc.example` menjadi `.firebaserc`.
4. Jalankan:
   `cd functions`
   `npm install`
   `cd ..`
5. Deploy:
   `firebase deploy --only functions:adminResetTeacherPassword`

Function menggunakan region `us-central1` dan memverifikasi bahwa pemanggil mempunyai dokumen
`users/{uid}` dengan `role: admin` dan `active: true`.

Password tidak pernah disimpan ke Firestore atau audit log.
Audit log hanya mencatat bahwa reset dilakukan, bukan nilai password.
