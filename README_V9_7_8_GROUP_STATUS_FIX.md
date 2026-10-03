# PakKom EcoTrack v9.7.8 — Group Status Fix

Perbaikan utama:
- Status submission tugas kelompok dibaca berdasarkan `taskId + groupKey`, bukan NIS pengunggah.
- Semua anggota kelompok melihat status pengumpulan yang sama.
- Jalur direct-get submission ditambahkan agar tidak bergantung pada query `memberNis`.
- Kompatibel dengan dokumen submission lama ber-ID `groupKey` dan baru ber-ID `taskId_groupKey`.
- Anggota selain pengunggah melihat tombol **Lihat Pengumpulan** dan nama siswa yang mengumpulkan.
- Anggota selain pengunggah tidak dapat menimpa submission melalui UI.
- Firestore Rules mengizinkan anggota kelompok saat ini membaca submission kelompok berdasarkan `taskGroups/{groupKey}`.
