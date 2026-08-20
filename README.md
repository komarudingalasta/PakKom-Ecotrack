# Pak Kom Eco Track v2.4

Fokus versi 2.4:
- Sinkron master siswa dari Firebase PakKom Exambro.
- Edit nama, kelas, dan status aktif siswa langsung di Eco Track.
- Edit lokal tidak langsung ditimpa saat sinkronisasi berikutnya.
- Tombol **Ikuti Exambro** untuk mengembalikan siswa ke data sumber terakhir.
- Tambah siswa lokal dan Import Excel tetap tersedia.
- Kelas baru dari data siswa otomatis dibuat pada collection `classes`.

## Cara sinkronisasi
1. Login sebagai ADMIN Eco Track.
2. Buka **Kelola Data**.
3. Tekan **Sinkron Exambro**.
4. Eco Track masuk secara anonim ke project Firebase PakKom Exambro dan membaca collection `students`.
5. NIS digunakan sebagai kunci sinkronisasi.

PakKom Exambro saat ini menggunakan project `pakkom-exambro-643f6` dan collection `students` dengan field utama `nis`, `name`, `classId`, `active`, dan `approved`.

## Catatan Firebase Exambro
Anonymous Authentication perlu aktif karena Firestore Rules Exambro mensyaratkan `request.auth != null` untuk membaca `students`.

## Perilaku edit + sinkron
- Belum pernah diedit di Eco Track: nama/kelas mengikuti Exambro pada setiap sinkron.
- Pernah diedit di Eco Track: nama/kelas lokal dipertahankan; data sumber terbaru tetap disimpan sebagai `sourceName` dan `sourceClassId`.
- Tekan **Ikuti Exambro** untuk membuang override lokal dan kembali ke data Exambro terakhir.
