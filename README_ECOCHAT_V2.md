# PakKom EcoTrack — EcoChat v2 Smart Coordination

## Fitur Baru
- Reply pesan dengan kutipan pesan asal.
- Mention sederhana menggunakan `@nama` (ditampilkan dengan highlight).
- Admin dapat edit pesan siapa pun.
- Edit Admin dicatat ke Audit Log dengan isi lama dan baru.
- Admin dapat menghapus pesan siapa pun.
- Pesan yang dihapus Admin menjadi tombstone: `Pesan dihapus oleh Admin`.
- Isi asli pesan yang dihapus dicatat di Audit Log Admin.
- Admin dapat Pin / Lepas Pin pesan.
- Pesan pin tampil di bagian atas grup.
- Guru/Wali Kelas dapat menghapus pesan sendiri.
- Reaksi 👍 ✅ 👀 tetap tersedia.
- Unread badge dan status baca tetap tersedia.

## EcoBot
EcoBot memakai data EcoTrack, bukan AI berbayar.
Saat Admin membuka grup `Semua Guru`, EcoBot:
1. membuat ringkasan harian Wadah + Kebersihan maksimal 1x/hari;
2. mengecek ulang setiap 1 menit selama Admin berada di grup;
3. jika tersisa <=45 menit sebelum Wadah ditutup dan masih ada kelas belum input, EcoBot mengirim satu pengingat deadline.

Karena web berada di GitHub Pages, EcoBot versi ini berjalan saat Admin sedang membuka EcoChat. Agar bot berjalan 24 jam tanpa pengguna online, tahap selanjutnya memerlukan Scheduled Firebase Cloud Function.

## Hak Akses
- Pengumuman: semua akun aktif membaca, hanya Admin mengirim.
- Semua Guru: Admin + Guru + Wali Kelas.
- Wali Kelas: Admin + seluruh Wali Kelas.
- Jenjang 7/8/9: Admin + Wali Kelas sesuai jenjang.
- Admin: edit/hapus/pin seluruh pesan.
- Guru/Wali: reply, reaction, mention, kirim pada grup yang diizinkan, dan hapus pesan sendiri.

## Firebase
`firestore.rules` berubah. Wajib Publish rules terbaru.
