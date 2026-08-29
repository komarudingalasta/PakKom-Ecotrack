# Reset Password Guru/Wali Kelas oleh Admin
Firebase Authentication tidak mengizinkan browser Admin biasa mengubah password akun pengguna lain secara aman.
Implementasikan salah satu:
1. Firebase Admin SDK / Cloud Function callable khusus admin untuk menetapkan password sementara; atau
2. kirim password-reset email Firebase Authentication.
Jangan simpan password plaintext di Firestore.
Versi ini sudah menyediakan ubah password sendiri (reauthentication + updatePassword).
