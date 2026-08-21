# PakKom Eco Track v3.0 — Stable Structure

Versi ini merombak alur aplikasi agar login tidak bergantung pada query dashboard.

## Struktur proses
1. Boot halaman
2. Firebase Authentication
3. Baca profil `users/{uid}`
4. Tampilkan aplikasi
5. Muat kelas, pendataan, kebersihan, kalender secara background

Kegagalan salah satu query data tidak membatalkan login.

## Modul
- Wadah & Tumbler
- Kebersihan Kelas
- Rekap
- Kelola Siswa
- Kelola Guru & Wali Kelas
- Kelola Kelas & Import
- Kalender Sekolah
- Approval akun guru/wali kelas

## Penting
Gunakan `firestore.rules` yang disertakan dan upload seluruh isi repository agar cache versi lama tidak terbaca.
