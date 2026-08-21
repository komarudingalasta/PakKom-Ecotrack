# PakKom Eco Track v2.9

## Perubahan utama
- Hapus beberapa siswa sekaligus memakai checkbox dan tombol **Hapus Terpilih**.
- Hapus kelas bersifat cascade pada master: seluruh siswa di kelas ikut dihapus dan wali kelas dilepas menjadi Guru biasa. Riwayat pendataan lama tidak dihapus.
- Admin dapat upload pendataan **Wadah & Tumbler** dari Excel. Alurnya selalu **Upload → Preview → Import Sekarang**.
- Format upload pendataan tersedia sebagai `format-upload-pendataan-wadah.xlsx`.
- Kelola Data dibagi menjadi tab: **Data Siswa**, **Guru & Wali Kelas**, **Kelas & Import**, dan **Riwayat** agar halaman tidak penuh.
- Upload master siswa dan guru tetap menggunakan preview sebelum import.

## Format pendataan wadah
Kolom: `Tanggal | Kelas | NIS | Nama | Kehadiran | Wadah | Tumbler`.
NIS harus sudah ada pada Data Siswa. Nama bersifat informasi.

## Catatan keamanan data
Menghapus siswa/kelas dari master tidak menghapus dokumen riwayat `records` lama.
