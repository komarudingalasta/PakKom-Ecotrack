# PakKom EcoTrack v9.7.5 — Monitoring Submission Fix

Perbaikan khusus monitoring tugas Admin/Wali/Guru.

- NIS dan classId dinormalisasi sebelum pencocokan.
- Master siswa dibaca lalu difilter berdasarkan kelas ter-normalisasi.
- Submission aktual tetap ditampilkan bila tidak dapat dipasangkan dengan master siswa/kelompok.
- Tugas kelompok dapat memulihkan submission meski relasi taskGroups tidak terbaca sempurna.
- Anggota pada submission kelompok ikut dianggap sudah berkelompok.
- Query Wali tidak lagi bergantung pada kecocokan classId mentah.
- Firestore Rules tidak berubah; tetap gunakan Rules v9.7.4.
