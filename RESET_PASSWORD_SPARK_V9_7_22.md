# PakKom EcoTrack v9.7.22 — Reset password Firebase Spark

## Mengapa tombol reset di web tidak dapat langsung bekerja?
Firebase Authentication hanya mengizinkan pergantian password akun lain oleh lingkungan tepercaya dengan Firebase Admin SDK. Cloud Functions yang disertakan versi lama membutuhkan paket Blaze untuk deployment. Jangan menaruh service account atau password admin dalam aplikasi web.

## Cara reset satu guru (gratis, dari komputer pemilik proyek)
1. Instal Node.js (versi LTS).
2. Firebase Console > Project settings > Service accounts > Generate new private key. Simpan JSON sebagai `serviceAccountKey.json` dalam folder proyek ini, hanya di komputer Anda. Jangan unggah ke GitHub, Firebase Hosting, atau bagikan ke siapa pun.
3. Buka terminal di folder proyek, jalankan `npm install firebase-admin`.
4. Jalankan `node reset-password-guru.js NIP_GURU` (ganti NIP_GURU dengan NIP yang benar).
5. Guru login memakai NIP dan password sementara `123456`, kemudian segera mengganti passwordnya.
6. Hapus/arsipkan file private key dengan aman setelah selesai. Jika kunci bocor, cabut melalui Google Cloud IAM.

Skrip hanya memproses satu NIP dan memeriksa bahwa akun berperan `guru`. Akun admin tidak ikut direset. Tidak mengubah Firestore records. Tidak memerlukan perubahan Firestore Rules.

**Catatan:** tombol reset langsung di web tetap memerlukan backend tepercaya. Versi ini menampilkan pesan yang benar saat backend tidak tersedia; tidak mengklaim bahwa reset telah berhasil.
