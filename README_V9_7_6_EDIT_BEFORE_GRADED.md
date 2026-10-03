# PakKom EcoTrack v9.7.6 — Edit/Kirim Ulang Sebelum Dinilai

Perubahan utama:
- Siswa dapat memperbaiki pengumpulan yang berstatus `submitted` selama belum `graded`.
- Tombol `Perbaiki Pengumpulan` muncul setelah tugas dikirim dan belum dinilai.
- Pengiriman ulang memperbarui dokumen submission yang sama, bukan membuat duplikat.
- Dicatat `firstSubmittedAt`, `lastSubmittedAt`, dan `resubmissionCount`.
- Setelah status `graded`, pengumpulan dikunci untuk siswa.
- Alur `revision` dari Wali/Admin tetap dipertahankan; siswa dapat `Kirim Ulang`.
- Perbaikan monitoring v9.7.5 tetap dipertahankan.
- Perbaikan penting tugas kelompok: submission sekarang unik per `taskId + groupKey` agar satu kelompok yang dipakai pada beberapa tugas dalam program yang sama tidak saling menimpa.
- Pembacaan submission kelompok siswa sekarang mencocokkan `taskId` dan `groupKey`, sehingga status satu tugas tidak bocor ke tugas kelompok lain pada program yang sama.

Firestore Rules BERUBAH pada v9.7.6. Publish `firestore.rules` secara penuh.
