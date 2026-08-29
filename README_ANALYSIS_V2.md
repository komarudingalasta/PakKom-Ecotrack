# Analysis Period v2

Arsitektur baru memisahkan:
1. Simpan Jadwal
2. Hitung Hasil
3. Bagikan ke Wali Kelas

Simpan Jadwal tidak lagi menghitung snapshot atau menunggu audit berhasil.
Admin boleh menyimpan tanggal masa lalu, hari ini, atau masa depan selama tanggal mulai <= tanggal selesai.

Status UI:
- Terjadwal
- Berjalan
- Menunggu Hasil
- Hasil Tersimpan
- Dibagikan
- Arsip

Jenis periode:
- Harian
- Mingguan
- Bulanan
- Custom

Periode selesai dihitung dengan tombol Hitung Hasil. Hitung ulang menyimpan snapshot sebelumnya ke analysisPeriodRevisions.

File repository yang berubah:
- main.js
- styles.css

Firestore Rules tidak berubah pada build ini.
Tidak ada file yang perlu dihapus.
