# PakKom EcoTrack v9.7.9 — Group Revision Fix

Perbaikan:
- Tugas kelompok berstatus **Perlu Perbaikan** dapat diperbaiki dan dikirim ulang oleh anggota kelompok aktif, tidak hanya siswa yang terakhir mengunggah.
- Anggota kelompok lain tetap hanya dapat melihat pengumpulan ketika status masih **Sudah Dikumpulkan**.
- Snapshot `memberNis/memberNames` pada submission lama dipertahankan saat kirim ulang.
- Firestore Rules mengizinkan anggota kelompok aktif memperbarui submission kelompok yang belum dinilai tanpa mengubah identitas/snapshot submission.
- Tugas yang sudah `graded` tetap terkunci.
