# PakKom Eco Track v3.3.6 — Session & Account Management

Perubahan:
- Tombol 🚪 Keluar langsung mengembalikan pengguna ke Login dan menghapus sesi Firebase.
- Refresh mempertahankan login menggunakan Firebase LOCAL persistence secara diam-diam, tanpa layar "Memeriksa sesi".
- Label role lebih jelas:
  - Guru
  - Wali Kelas • 7A
  - Administrator
- Admin mendapat tombol **Hapus Akun** pada Guru/Wali Kelas.
- Istilah akun guru tetap menggunakan **NIP Guru**.

Catatan teknis:
Penghapusan dari menu Admin menghapus profil akses di Firestore sehingga akun tidak dapat menggunakan PakKom Eco Track. Penghapusan identitas Firebase Authentication milik pengguna lain memerlukan Firebase Admin SDK/backend.
