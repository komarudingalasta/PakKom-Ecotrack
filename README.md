# PakKom Eco Track v2.9.4

## Perubahan utama
- Kalender operasional sekolah.
- Senin–Kamis: JP 1–9.
- Jumat: JP 1–5.
- Sabtu–Minggu otomatis OFF.
- Libur nasional Indonesia otomatis OFF melalui kalender hari libur nasional.
- Admin dapat override tanggal tertentu dari **Kelola → Kalender Sekolah** untuk libur sekolah atau kegiatan khusus, termasuk jumlah JP.
- Pada hari OFF, Wadah & Tumbler dan Pemeriksaan Kebersihan tidak dapat diinput dan dashboard tidak menandai kelas sebagai belum didata.
- Penilaian kebersihan diperjelas:
  - Lantai: Bersih / Cukup Bersih / Kotor
  - Meja & Kursi: Rapi / Cukup Rapi / Berantakan
  - Tempat Sampah: Terkelola / Hampir Penuh / Penuh / Meluber
  - Perlengkapan Kelas: Rapi / Cukup Rapi / Berantakan
- Tombol cepat menjadi **Semua Bersih & Rapi**.

## Catatan Firebase
Tidak ada collection baru. Pengaturan kalender khusus disimpan pada `settings/calendar`, yang sudah tercakup oleh Firestore Rules v2.9.

Upload seluruh file repository agar cache version v2.9.4 ikut terpasang.
