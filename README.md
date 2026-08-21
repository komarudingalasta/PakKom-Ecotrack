# PakKom Eco Track — Session & Header Polish

Perubahan:
- Nomor versi tidak ditampilkan di UI.
- Saat refresh, Login tidak berkedip. Aplikasi menampilkan splash PakKom Eco Track singkat sambil Firebase memulihkan sesi.
- Splash memiliki fallback maksimum ±1,8 detik agar tidak menggantung.
- Jika sesi masih aktif, pengguna langsung kembali ke dashboard.
- Header menggunakan profile chip: inisial, nama, dan role Guru / Wali Kelas • Kelas / Administrator.
- Tombol keluar dipindahkan ke menu profil dengan ikon logout SVG standar.
- Logout memiliki dialog konfirmasi Batal/Keluar.
- Setelah logout, halaman Login tampil langsung.
