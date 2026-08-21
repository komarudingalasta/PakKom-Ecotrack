# Setup Firebase — PakKom Eco Track v3.0

1. Authentication → aktifkan Email/Password.
2. Firestore Database → publish `firestore.rules`.
3. Pastikan dokumen Admin berada di `users/{UID_ADMIN}` dengan:
   - loginId: ADMIN
   - role: admin
   - active: true
4. `firebase-config.js` harus menunjuk ke project `pakkom-ecotrack`.
5. Upload seluruh file v3.0 ke root GitHub Pages.

Pada v3.0, login hanya memerlukan Authentication + profil user. Data dashboard dimuat sesudah aplikasi terbuka.
