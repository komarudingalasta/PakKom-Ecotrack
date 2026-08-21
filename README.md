# PakKom Eco Track v3.3.3 — Unified Core Stable Fix

Perbaikan kritis dari v3.3.2:
- Menghapus bootstrap Direct Login lama yang masih memanggil `setPersistence` dan `inMemoryPersistence`.
- Login sekarang hanya diinisialisasi oleh satu Auth Core.
- Memperbaiki referensi logout ke `PAKKOM_COMPAT_CORE`.
- Authentication dan Application Core tetap berada dalam satu `main.js`.
- Tidak ada `auth.js`, `app.js`, `auth-core.js`, atau `app-core.js`.

Struktur utama:
- `index.html`
- `main.js`
- `firebase-config.js`
- `styles.css`
- `firestore.rules`
