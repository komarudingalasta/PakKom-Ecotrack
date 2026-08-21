# PakKom Eco Track v3.2.2 — Classic Auth Core

Login dibangun ulang memakai Firebase Compat sebagai script biasa:
- tidak memakai ES module untuk proses login;
- tidak ada session-check splash;
- login ADMIN diverifikasi langsung ke Firebase Authentication;
- profil dibaca dari `users/{UID}`;
- aplikasi utama baru dimuat setelah login valid.

File penting baru: `auth-core.js`.
