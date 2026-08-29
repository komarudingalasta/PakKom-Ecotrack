# EcoChat v3 — Keyboard Fix

Masalah:
Keyboard virtual mengubah tinggi viewport. Handler resize EcoChat sebelumnya merender ulang halaman,
menyebabkan textarea kehilangan fokus dan keyboard langsung menutup.

Perbaikan:
- Resize EcoChat hanya merender ulang jika lebar layar/orientasi benar-benar berubah.
- Jika textarea sedang fokus, resize karena keyboard diabaikan.
- `visualViewport` digunakan untuk menyesuaikan tinggi chat tanpa render ulang.
- Bottom navigation disembunyikan sementara saat keyboard terbuka agar composer tetap terlihat.
- Fokus input tidak hilang saat keyboard muncul.

File yang berubah:
- `main.js`
- `styles.css`

Rules tidak berubah.
Tidak ada file yang perlu dihapus.
