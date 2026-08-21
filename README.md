# PakKom Eco Track v2.7.1 — Authentication & Cleanliness Fix

Perbaikan penting:
- Login salah tidak dapat memakai sesi login lama.
- Firebase Auth memakai local persistence secara eksplisit.
- Saat refresh aplikasi menampilkan splash “Memeriksa sesi”, bukan halaman login sementara.
- UI login dibuat ulang mengikuti rancangan modern PakKom Eco Track.
- Bottom navigation HP disederhanakan menjadi tepat 5 menu.
- Menu Kebersihan tampil sebagai modul utama.
- Kebersihan dapat diperiksa berkali-kali per hari berdasarkan kelas + JP.
- Hanya pemeriksaan yang sudah tersimpan yang ditampilkan.
- Rekap mempunyai tab Wadah & Tumbler dan Kebersihan Kelas.

## WAJIB sebelum uji Kebersihan
Paste dan Publish `firestore.rules` dari paket ini di Firebase Console.

## Catatan cache GitHub Pages
`styles.css` dan `app.js` dipanggil dengan versi `?v=2.7.1` untuk mengurangi risiko browser memakai file versi lama.
