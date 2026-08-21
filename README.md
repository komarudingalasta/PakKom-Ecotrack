# PakKom Eco Track — Periode Analisis Tersimpan

Fitur baru:
- Admin membuat kategori periode dengan nama, tanggal mulai, dan tanggal selesai.
- `Hitung & Preview` menghitung analisis berdasarkan rentang tersebut.
- `Simpan Hasil Periode` menyimpan snapshot hasil per kelas ke Firestore.
- Snapshot tidak berubah otomatis saat data harian kemudian berubah.
- Admin dapat membuka/menutup akses analisis untuk wali kelas.
- Wali kelas hanya melihat periode yang sudah disimpan dan dipublikasikan.
- Wali kelas melihat hasil kelas walinya dari snapshot.
- Periode lama tetap tersimpan sebagai riwayat.

PENTING: deploy `firestore.rules` terbaru karena terdapat koleksi baru `analysisPeriods`.
