# PakKom EcoTrack v8 Stable Core

Tujuan v8: menstabilkan Tugas Siswa tanpa mengubah data Firebase yang sudah ada.

Perbaikan utama:
- satu jalur navigasi Tugas (handler ganda dihapus),
- halaman Tugas dirender sebelum pembacaan Firestore,
- query pengumpulan Wali Kelas dibatasi taskId + classId agar sesuai Rules,
- cache asset dinaikkan ke v8.0.0,
- EcoChat tetap tidak aktif,
- Firebase/Auth/Wadah/Kebersihan/Analisis/Data Kelas tetap memakai basis yang sama.

Urutan tes:
1. Admin login dan buka Tugas; harus terlihat Task Core v8.0.
2. Buat tugas individu sederhana untuk satu kelas.
3. Login siswa kelas tersebut; tugas harus muncul.
4. Siswa kirim satu link.
5. Wali kelas buka Pengumpulan.
6. Wali beri nilai dan siswa cek status.

Catatan: query Wali `taskId + classId` dapat meminta composite index Firestore. Jika Firebase menampilkan tautan Create index, buat index tersebut satu kali.
