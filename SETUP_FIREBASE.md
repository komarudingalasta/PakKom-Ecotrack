# Setup Firebase — Pak Kom Eco Track v2.1

## A. Buat project Firebase
1. Buka Firebase Console dan buat project baru, misalnya `pak-kom-eco-track`.
2. Tambahkan aplikasi **Web** (`</>`).
3. Tidak perlu mengaktifkan Firebase Hosting jika web akan dipasang di GitHub Pages.
4. Setelah app terdaftar, salin objek `firebaseConfig`.

## B. Pasang firebaseConfig
Buka `firebase-config.js`, lalu ganti semua nilai `GANTI_...` dengan konfigurasi dari Firebase Console.

Contoh bentuknya:

```js
window.PAKKOM_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

`firebaseConfig` bukan password database. Keamanan data tetap ditentukan oleh Authentication dan Firestore Security Rules.

## C. Aktifkan Authentication
1. Firebase Console > **Build > Authentication**.
2. Klik **Get started**.
3. Buka **Sign-in method**.
4. Aktifkan **Email/Password**.
5. Simpan.

Guru tetap login memakai ID seperti `G001`. Aplikasi mengubahnya secara internal menjadi `g001@pakkom-ecotrack.app`.

## D. Buat Cloud Firestore
1. Firebase Console > **Build > Firestore Database**.
2. Klik **Create database**.
3. Gunakan database `(default)`.
4. Pilih lokasi yang dekat dengan pengguna Indonesia bila tersedia/tepat untuk project Anda.
5. Setelah database dibuat, buka tab **Rules**.
6. Hapus rules sementara lalu tempel seluruh isi file `firestore.rules`.
7. Klik **Publish**.

Jangan membiarkan rules `allow read, write: if true` pada web produksi.

## E. Buat Admin pertama
Admin pertama dibuat manual karena belum ada admin lain yang boleh membuat profil admin.

### 1. Authentication
Firebase Console > Authentication > Users > Add user.

- Email: `admin@pakkom-ecotrack.app`
- Password: tentukan password admin minimal 6 karakter.

Setelah dibuat, salin **User UID**.

### 2. Firestore
Firestore > Data > Start collection:

- Collection ID: `users`
- Document ID: **UID admin yang baru disalin**

Tambahkan field:

| Field | Type | Value |
|---|---|---|
| loginId | string | ADMIN |
| name | string | Administrator |
| role | string | admin |
| active | boolean | true |

Sekarang admin dapat login ke web menggunakan:

- ID: `ADMIN`
- Password: password yang dibuat di Authentication

## F. Inisialisasi data sekolah
Setelah login Admin:
1. Buka **Kelola Data**.
2. Klik **Pastikan 7A–9I Tersedia**.
3. Tambahkan akun Guru.
4. Import file siswa Excel.

Format minimal Excel:

| NIS | Nama | Kelas |
|---|---|---|
| 12345 | Ahmad Fauzan | 7A |
| 12346 | Alya Putri | 7A |

Import v2.1 diproses per kelompok sehingga daftar siswa sekolah yang melebihi 500 baris tetap dapat dimasukkan.

## G. Struktur data Firestore

### `users/{uid}`
- `loginId`
- `name`
- `role`: `admin` / `guru`
- `active`

### `classes/{classId}`
- `name`
- `active`

### `students/{nis}`
- `nis`
- `name`
- `classId`
- `active`
- `updatedAt`

### `records/{YYYY-MM-DD_KELAS}`
Satu dokumen untuk satu kelas per tanggal. Menyimpan daftar siswa, kehadiran, wadah, tumbler, guru pembuat, guru terakhir yang mengoreksi, dan audit perubahan.

## H. GitHub Pages
Upload semua file di folder ini ke repository GitHub, termasuk:
- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`

File `firestore.rules` dan `SETUP_FIREBASE.md` tidak harus disajikan ke pengguna web, tetapi sebaiknya tetap disimpan di repository sebagai dokumentasi konfigurasi.

## I. Catatan keamanan akun Guru
Menu Admin membuat akun Guru menggunakan Firebase Authentication pada instance aplikasi kedua agar sesi Admin tidak terlogout. Pengguna yang hanya berhasil membuat akun Authentication sendiri **tidak otomatis memperoleh akses data**, karena Firestore Rules mensyaratkan dokumen profil aktif di `users/{uid}` dengan role yang sah. Dokumen profil tersebut hanya dapat dikelola Admin.


## Status v2.2

`firebase-config.js` sudah diisi menggunakan project `pakkom-ecotrack`, jadi langkah menempelkan konfigurasi web tidak diperlukan lagi.
