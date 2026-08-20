# Pak Kom Eco Track v1

Web pendataan wadah makan dan tumbler siswa.

## Demo login
- Guru: `G001` / `123456`
- Admin: `ADMIN` / `admin123`

## Fitur v1
- Login role Guru/Admin.
- Guru dapat memilih semua kelas 7A–9I.
- Pendataan hadir/izin/sakit/alpa.
- Toggle wadah dan tumbler.
- Tombol massal Semua Hadir / Semua Bawa.
- Status kelas sudah/belum didata.
- Data dari guru lain tampil read-only terlebih dahulu.
- Koreksi data tercatat di riwayat internal.
- Rekap harian per kelas.
- Admin memiliki menu Kelola Data.
- Responsive HP, tablet, dan desktop.

## Penyimpanan
Versi ini menggunakan `localStorage` agar dapat langsung diuji di GitHub Pages tanpa backend.
Untuk pemakaian sekolah sungguhan, tahap berikutnya disarankan memakai Firebase Authentication + Firestore agar data tersimpan lintas perangkat.

## Deploy GitHub Pages
Upload `index.html`, `styles.css`, dan `app.js` ke root repository lalu aktifkan GitHub Pages dari branch utama.
