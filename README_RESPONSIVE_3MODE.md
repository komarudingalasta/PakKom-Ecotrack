# Responsive 3-Mode Fix

## Mode
- Mobile: bottom navigation penuh lebar.
- Tablet: floating bottom navigation, konten lebih lebar dan dapat 2 kolom.
- Desktop: sidebar asli 260px dengan menu vertikal, bukan bottom-nav yang diputar ke kiri.

## Desktop Site pada HP
Perangkat touch/coarse tidak diberi layout sidebar PC hanya karena browser mengaktifkan "Situs desktop".
Ini mencegah tampilan sidebar sangat tinggi dengan menu kecil seperti bug sebelumnya.

## File repository
File yang DIGANTI:
- `main.js`
- `styles.css`

File yang TIDAK perlu dihapus:
- `index.html`
- `firebase-config.js`
- `firestore.rules`
- seluruh file format Excel
- folder `functions`

Tidak ada file repository lama yang wajib dihapus untuk update ini.
