# v9.7.12 Admin Backdate & Daily Trend

- Admin dapat memilih tanggal pendataan Wadah Makan & Tumbler sampai hari ini, termasuk Sabtu/Minggu/libur dan tanggal lampau.
- Guru/Wali tetap dibatasi kalender operasional dan jam tutup.
- Rekap seluruh kelas menampilkan persentase Wadah, Tumbler, dan keduanya secara tertimbang berdasarkan seluruh siswa hadir.
- Perbandingan otomatis memakai tanggal pendataan sebelumnya yang memiliki data.
- Menampilkan kenaikan/penurunan dalam poin persentase serta cakupan kelas/data lengkap.
- Tidak ada perubahan Firestore Rules dari v9.7.11 karena Admin memang sudah memiliki izin create/update records; pembatasan tanggal adalah logika aplikasi.
