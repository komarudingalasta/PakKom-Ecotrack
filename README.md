# PakKom Eco Track — Wali Kelas Access & One Edit Policy

## Kebersihan Wali Kelas
Default akses kelas sendiri = DITUTUP.
- Wali Kelas tetap dapat menilai semua kelas lain.
- Wali Kelas tidak dapat menilai kelas walinya sendiri.
- Jika Admin membuka `Izinkan Wali Kelas Menilai Kelasnya Sendiri`, wali kelas dapat menilai semua kelas termasuk kelasnya sendiri.
- Guru biasa tetap dapat menilai semua kelas.
- Admin tetap dapat menilai semua kelas.

## Wadah Makan & Tumbler
- Guru yang pertama kali mengirim pendataan kelas menjadi pembuat data.
- Guru tersebut mendapat tepat 1 kali kesempatan edit setelah pengiriman pertama.
- Setelah edit pertama disimpan, data terkunci untuk guru.
- Guru lain tidak dapat mengedit data tersebut.
- Administrator tetap dapat melakukan koreksi.
- Field `teacherEditCount` disimpan pada record agar aturan 1× dapat ditegakkan di Firestore.

PENTING: Firestore Rules berubah dan harus dipublish.
