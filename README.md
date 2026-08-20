# Pak Kom Eco Track v2.5

Web pendataan wadah makan dan tumbler siswa berbasis Firebase.

## Perubahan v2.5

- Sinkronisasi PakKom Exambro dihapus.
- Master siswa menggunakan Import Excel atau edit langsung oleh Admin.
- Siswa tidak memiliki akun dan tidak membutuhkan password.
- Format import siswa: `NIS | Nama | Kelas | Status`.
- Import akun guru ditambahkan.
- Guru dibedakan menjadi **Guru** dan **Wali Kelas** pada informasi akun.
- Wali Kelas tetap memiliki role `guru`, ditambah `isHomeroom: true` dan `homeroomClass`.
- Format import guru: `ID Guru | Nama | Password Awal | Jenis | Kelas Wali | Status`.
- Password awal guru boleh kosong; sistem menggunakan `123456`.
- Admin dapat mengedit nama, jenis Guru/Wali Kelas, kelas wali, dan status akun.
- Tombol download format import tersedia pada halaman Kelola Data.

## Format Siswa

| NIS | Nama | Kelas | Status |
|---|---|---|---|
| 24001 | Ahmad Fauzan | 7A | Aktif |

`NIS`, `Nama`, dan `Kelas` wajib. `Status` boleh kosong dan dianggap Aktif.

## Format Guru

| ID Guru | Nama | Password Awal | Jenis | Kelas Wali | Status |
|---|---|---|---|---|---|
| G001 | Rina Kartika | 123456 | Wali Kelas | 7A | Aktif |
| G002 | Dedi Pratama | 123456 | Guru | | Aktif |

- `Jenis`: `Guru` atau `Wali Kelas`.
- `Kelas Wali` wajib jika Jenis = `Wali Kelas`.
- ID Guru dipakai untuk login.

## File format

`format-import-pak-kom-eco-track.xlsx` sudah disertakan dalam folder dan dapat diunduh dari halaman Admin.
