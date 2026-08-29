# EcoChat v3

## Perbaikan stabilitas
- EcoChat sekarang mengikuti `data-layout` dari Responsive 3 Mode, bukan breakpoint CSS terpisah.
- Mobile: Daftar Grup -> Chat -> kembali ke Daftar Grup.
- Tablet/Desktop tetap menggunakan panel grup + ruang chat.
- Badge unread per grup dan total dipertahankan.

## Fitur
- Cari grup.
- Filter Semua / Belum Dibaca.
- Reply + jump ke pesan asal.
- Mention visual @nama.
- Reaksi.
- Pengirim dapat edit pesan teks selama 15 menit pada UI.
- Penghapusan pesan sendiri menjadi soft-delete.
- Admin: edit, hapus/tombstone, pin.
- Pengumuman Admin.
- EcoBot status operasional.
- Pusat Aktivitas EcoChat untuk Admin.

## Rules
`firestore.rules` BERUBAH karena pengguna sekarang membutuhkan update terbatas pada pesan teks miliknya sendiri.
Publish rules baru saat deploy.

Catatan keamanan:
Batas 15 menit divalidasi UI. Rules membatasi pengguna hanya mengubah field edit/soft-delete dan tidak mengizinkan perubahan identitas, grup, tipe, atau timestamp awal pesan.
