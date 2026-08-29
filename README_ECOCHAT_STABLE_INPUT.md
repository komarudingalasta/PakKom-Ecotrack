# EcoChat v3 — Stable Input Final Fix

Perubahan:
- Menekan menu EcoChat selalu mereset `state.chatGroup` dan kembali ke daftar semua grup.
- Tidak ada lagi auto-select grup pertama pada desktop/tablet.
- Event resize khusus EcoChat tidak lagi merender ulang halaman.
- Responsive global tidak boleh `renderShell()` ketika INPUT/TEXTAREA sedang fokus.
- `scrollIntoView()` saat fokus textarea dihapus.
- Composer dibuat sticky saat input aktif.
- Listener grup lama dibersihkan ketika menu EcoChat ditekan ulang.

File yang berubah:
- `main.js`
- `styles.css`

Firestore Rules tidak berubah.
Tidak ada file repository yang perlu dihapus.
