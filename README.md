# PakKom Eco Track v3.3.2 — Unified Core

Versi ini menyederhanakan struktur aplikasi menjadi satu file JavaScript utama.

## Struktur
- `index.html`
- `firebase-config.js`
- `main.js`
- `styles.css`
- `firestore.rules`
- file format Excel

`main.js` berisi Application Core dan Auth Core sekaligus.

## Tujuan perubahan
Pada versi sebelumnya, login berhasil tetapi `app-core.js` kadang belum tersedia saat Auth selesai. v3.3.2 menghilangkan ketergantungan antar-file tersebut.

Urutan:
Firebase Compat → firebase-config.js → main.js → Login → Dashboard.

Tidak ada lagi:
- `auth.js`
- `app.js`
- `auth-core.js`
- `app-core.js`

## Fitur tetap
- Login Admin/Guru
- Pendaftaran Guru/Wali Kelas + approval
- Wadah & Tumbler
- Kebersihan Kelas
- Rekap
- Kelola Siswa/Guru/Kelas
- Import preview
- Kalender Sekolah
