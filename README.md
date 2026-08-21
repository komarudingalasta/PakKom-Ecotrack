# PakKom Eco Track v3.2.1 — Auth Core Rebuild

## Struktur baru

`index.html`
→ `auth.js`
→ Firebase Authentication
→ `users/{UID}`
→ baru memuat `app.js`

Login tidak lagi berada di dalam file aplikasi utama.

## Dampak
- Bug dashboard, kalender, import, kebersihan, atau menu Kelola tidak dapat mencegah tombol Login bekerja.
- Tidak ada "Memeriksa sesi".
- Refresh kembali ke Login.
- Password visibility tetap bekerja langsung dari HTML.
- Setelah Authentication + profil valid, aplikasi utama baru dimuat.

## Admin
ID: `ADMIN`
dipetakan ke akun Firebase `komarudingalasta@gmail.com`.
