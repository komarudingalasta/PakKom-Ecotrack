# PakKom EcoTrack v9.7.18 — Import Cepat Wadah & Tumbler

Perubahan:
- Menghapus UI Input Massal model kalender dari Wadah & Tumbler.
- Menggantinya dengan Import Cepat khusus Admin.
- Admin memilih periode, kelas / Semua Kelas, dan template Default L atau Kosong.
- Template Excel otomatis mengambil NIS dan nama siswa aktif dari Data Siswa.
- Semua Kelas dibuat sebagai sheet per kelas.
- Hari Sabtu, Minggu, libur nasional, dan hari yang dinonaktifkan lewat kalender tidak dimasukkan ke template.
- Kode: L lengkap; W hanya wadah; T hanya tumbler; X tidak keduanya; S sakit; I izin; A alpa.
- Upload memiliki validasi NIS, kelas, tanggal, kode, dan pratinjau sebelum simpan.
- Record tanggal/kelas yang sudah ada diperbarui, bukan diduplikasi; audit source = import-cepat.
- Rekap & Analisis v9.7.17 tetap dipertahankan.

Firestore Rules: tidak berubah dari v9.7.17/v9.7.11 task rules.
