# Setup Firebase Pak Kom Eco Track v2.5

1. Aktifkan Authentication > Email/Password.
2. Pastikan akun Admin dan dokumen `users/{UID_ADMIN}` sudah tersedia.
3. Publish `firestore.rules` dari paket ini.
4. Upload seluruh file v2.5 ke GitHub Pages.
5. Login ADMIN.
6. Buka **Kelola Data**.
7. Import siswa menggunakan sheet `Siswa`.
8. Import akun guru menggunakan sheet `Guru`.

## Struktur profil guru

```text
users/{uid}
  loginId: "G001"
  name: "Rina Kartika"
  role: "guru"
  active: true
  isHomeroom: true
  homeroomClass: "7A"
```

Guru biasa:

```text
isHomeroom: false
homeroomClass: ""
```

Tidak ada akun Firebase Authentication untuk siswa.
