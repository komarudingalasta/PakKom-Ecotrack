# Control & Security update
- Guru/Wali Kelas: ubah password sendiri dengan verifikasi password lama.
- Wadah: guru tidak dapat mengisi setelah 14.10 Senin–Kamis / 11.30 Jumat.
- Admin tetap dapat koreksi.
- Reset Wadah: data lama diarsipkan ke recordResetArchive lalu kelas kembali Belum Pendataan.
- Audit Log: auditLogs hanya dapat dibaca Admin.
- Reset password akun lain memerlukan Firebase Admin SDK/Cloud Function atau reset-email; tidak dilakukan dengan menyimpan password Firestore.
- Periode analisis tetap memakai snapshot + review + share/unshare.
Firestore Rules berubah: publish firestore.rules terbaru.
