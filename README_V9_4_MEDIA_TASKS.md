# PakKom EcoTrack v9.4 - Media Task Builder

- Admin Task Builder mendukung komponen: Jawaban Teks, Link, Foto, Video, Dokumen.
- Setiap komponen dapat diatur label, wajib/opsional, jumlah item 1-10, dan keterangan wajib untuk media/link.
- Foto/video/dokumen disimpan sebagai link; file tidak diunggah ke Firebase.
- Siswa mendapat form dinamis sesuai komponen tugas.
- Validasi komponen wajib dan URL dilakukan saat Kumpulkan; Draf boleh belum lengkap.
- Wali/Admin melihat tombol Buka Foto, Tonton Video, Buka Dokumen, atau Buka Link.
- Revision workflow v9.3 tetap dipertahankan.
- Firestore Rules tidak berubah dari v9.2/v9.3 karena struktur answers tetap berada pada field yang sudah diizinkan.
