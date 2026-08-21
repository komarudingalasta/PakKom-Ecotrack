# Setup Firebase — PakKom Eco Track v3.3.1

1. Firebase Authentication → Email/Password harus aktif.
2. Firestore Database → publish `firestore.rules`.
3. Admin Authentication: `komarudingalasta@gmail.com`.
4. Firestore `users/{UID_ADMIN}`:
   - loginId: ADMIN
   - name: administrator
   - role: admin
   - active: true
5. Upload seluruh isi v3.3.1 ke root repository GitHub Pages.
6. Pastikan file `auth-core.js` dan `app-core.js` ada di root.
7. Hapus file lama `auth.js` dan `app.js` dari repository agar tidak membingungkan.
