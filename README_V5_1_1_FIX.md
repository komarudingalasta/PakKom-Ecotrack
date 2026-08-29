# v5.1.1 Student Login Fix
Masalah v5.1: path CSS dan main.js di siswa/index.html menjadi ../../../ sehingga GitHub Pages gagal memuat stylesheet dan JavaScript.
v5.1.1 mengembalikan path yang benar:
- ../styles.css?v=5.1.1
- ../main.js?v=5.0.0
- ../firebase-config.js
Tidak ada perubahan Firestore Rules.
