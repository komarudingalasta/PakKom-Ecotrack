# PakKom EcoTrack - Login Siswa v2

## URL
- Guru/Admin: `/PakKom-Ecotrack/`
- Siswa: `/PakKom-Ecotrack/siswa/`

## Login siswa
- Username: NIS
- Password: NIS
- Password siswa tidak dapat diubah dari UI siswa.
- Akun siswa dibuat Admin melalui menu Data Siswa > Buat Akun Siswa.

## Pembatasan
- Halaman `/siswa/` hanya menerima role `siswa`.
- Jika akun siswa masuk dari halaman utama, sistem mengarahkannya ke `/siswa/`.
- Menu Tugas Siswa di sisi staf hanya terlihat untuk Admin dan Wali Kelas.
- Firestore Rules membatasi Wali Kelas hanya ke submission kelas walinya.
- Siswa hanya membaca submission miliknya dan data siswa miliknya.

## Media
Upload foto/video ke Google Drive belum aktif sebelum URL Apps Script dikonfigurasi.
