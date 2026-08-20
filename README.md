# Pak Kom Eco Track v2.6

Web pendataan wadah makan dan tumbler siswa berbasis Firebase.

## Perubahan v2.5

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

## Baru di v2.6
- Tidak ada integrasi atau akun Exambro.
- Dashboard harian lebih informatif.
- Kartu khusus Kelas Saya untuk wali kelas.
- Rekap dapat difilter berdasarkan tanggal dan kelas.
- Status kelas sudah/belum input tetap terlihat jelas.
