# PakKom EcoTrack v9.7.11 — Group Maximum Settings

- Admin dapat mengubah maksimal anggota kelompok dari menu Tugas > Atur Maks. Anggota.
- Nilai default tetap 6 siswa.
- Admin dapat memilih batas 2–36 siswa.
- Batas berlaku untuk kelompok baru dan saat Admin mengubah anggota kelompok.
- Kelompok lama yang melebihi batas baru tidak diubah otomatis.
- Siswa melihat batas terbaru saat membuat kelompok.
- Firestore Rules membaca settings/taskGroup.maxMembers, default 6 bila pengaturan belum dibuat.
