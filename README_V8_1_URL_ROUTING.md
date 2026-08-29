# PakKom EcoTrack v8.1 — URL Routing

Versi ini mengubah menu utama menjadi URL/hash routing sehingga halaman tidak bergantung pada onclick.

Admin/Wali:
- #home
- #wadah
- #clean
- #tasks
- #more

Siswa:
- #home
- #tasks
- #saya

Tes utama: setelah login Admin, buka langsung `#tasks`. Halaman harus merender Task Core sebelum pembacaan Firestore.

Tidak ada perubahan database. Firestore Rules v8 tetap dapat digunakan.
