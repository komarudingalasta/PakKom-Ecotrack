# PakKom EcoTrack v9.6 — Rentang Nilai & Skema Tugas Kelompok

Perubahan utama:
- Admin dapat mengubah batas rentang empat kategori nilai melalui halaman Tugas.
- Rentang disimpan pada `settings/taskAssessment` dan otomatis digunakan Wali/Admin serta siswa.
- Tugas kelompok diaktifkan dengan pembagian otomatis 6 kelompok per kelas.
- Keanggotaan disimpan pada `taskGroups/{taskId_classId_Gn}`.
- Cukup satu anggota mengumpulkan; seluruh anggota kelompok membaca status/pengumpulan yang sama.
- Wali melihat enam kelompok beserta anggota, termasuk kelompok yang belum mengumpulkan.
- Dashboard siswa ikut membaca pengumpulan kelompok yang dibuat anggota lain.
- Normalisasi kelas Wali diperbaiki untuk menghindari mismatch seperti `9 F` vs `9F`.
- Badge versi hanya tampil untuk Admin; Wali dan siswa tidak menampilkan versi.

## Firestore Rules
Rules berubah pada v9.6. Publish `firestore.rules` terbaru karena ada:
- read `settings/taskAssessment` untuk siswa aktif,
- collection `taskGroups`,
- create/update submission kelompok.

## Pengujian minimum
1. Admin ubah rentang nilai dan simpan.
2. Buat tugas kelompok untuk satu kelas.
3. Pastikan halaman Pengumpulan menampilkan 6 kelompok dan anggota.
4. Login anggota kelompok A, kumpulkan tugas.
5. Login anggota lain kelompok A, pastikan status sudah dikumpulkan oleh anggota pertama.
6. Wali kelas periksa dan beri nilai; siswa melihat kategori sesuai rentang Admin.
