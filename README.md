# PakKom Eco Track — Completion Build

Build ini menyelesaikan fitur kontrol yang sebelumnya masih terpisah/setengah terhubung.

## Akun
- Guru/Wali Kelas dapat mengubah password sendiri dari halaman Akun.
- Perubahan password memerlukan password lama (reauthentication).
- Setelah berhasil pengguna diminta login kembali.
- Admin memiliki tombol Reset Password untuk Guru/Wali Kelas.
- Reset password Admin menggunakan Firebase Cloud Function agar password akun lain tidak pernah disimpan di Firestore.

## Pendataan Wadah Makan & Tumbler
- Guru hanya dapat mengisi sampai jam tutup pembelajaran.
- Default Senin–Kamis 14.10, Jumat 11.30.
- Admin dapat mengubah jam tutup melalui Kelola → Operasional.
- Admin dapat Reset pendataan menjadi Belum Pendataan.
- Data sebelum reset masuk `recordResetArchive`, jadi tidak hilang.
- Alasan reset dan tindakan Admin masuk `auditLogs`.
- Edit Guru tetap 1× sesuai aturan sebelumnya.

## Kebersihan
- Jadwal JP dapat dikonfigurasi Admin melalui Kelola → Operasional.
- Default:
  - Senin–Kamis JP1 07.10, durasi 40 menit, istirahat setelah JP4 20 menit dan JP7 40 menit.
  - Jumat JP1 07.50, durasi 40 menit, istirahat setelah JP3 20 menit.
- Aturan kunci JP dan edit 1× tetap dipertahankan.

## Riwayat Admin
- Kelola → Riwayat menampilkan `auditLogs`.
- Hanya Admin yang dapat membaca audit log.
- Audit mencakup reset pendataan, perubahan role, jadwal operasional, reset password, publikasi hasil, dan koreksi analisis.

## Periode Analisis
- Terjadwal → Berjalan → Selesai → snapshot.
- Setelah snapshot: Review Admin → Bagikan/Tarik Akses Wali Kelas.
- Wali Kelas hanya dapat membaca periode yang sudah dibagikan.
- Koreksi final:
  1. Tarik akses (jika sedang dibagikan).
  2. Buka Koreksi Hasil.
  3. Perbaiki/reset data sumber.
  4. Hitung Ulang & Kunci Hasil.
- Snapshot lama sebelum hitung ulang disimpan di `analysisPeriodRevisions`.

## Firebase
Wajib Publish `firestore.rules` terbaru.

Untuk tombol Reset Password Admin, deploy Firebase Function sesuai `SETUP_RESET_PASSWORD.md`.
