# PakKom EcoTrack — Chat & Analysis Fix

## EcoChat
- Reaksi chat diperbaiki. Sistem tidak lagi melakukan GET terhadap dokumen reaksi yang belum ada.
- Menekan menu EcoChat selalu kembali ke daftar semua grup.
- Shortcut EcoChat dari Beranda juga kembali ke daftar semua grup.
- Kolom tulis pesan di HP dipasang tepat di atas bottom navigation.
- Saat keyboard terbuka, bottom navigation disembunyikan dan composer turun ke tepi keyboard.
- Badge unread tetap aktif.
- Notifikasi dalam aplikasi aktif melalui polling setiap 20 detik.
- Pengguna dapat menekan tombol `🔔 Notifikasi` di EcoChat untuk mengizinkan notifikasi browser.
- Notifikasi browser pada build ini bekerja selama web masih terbuka/aktif di browser. Push saat web benar-benar tertutup membutuhkan Firebase Cloud Messaging + service worker.

## Jadwal Analisis Admin
Admin dapat membuat:
- periode masa depan;
- periode yang sedang berjalan;
- periode historis yang sudah terlewat.

Jika Admin membuat periode historis (tanggal selesai sebelum hari ini), sistem langsung menghitung dan menyimpan snapshot hasilnya.

## File Repository
Wajib diganti:
- `main.js`
- `styles.css`

`firestore.rules` tidak berubah pada update ini.
Tidak ada file yang perlu dihapus.
