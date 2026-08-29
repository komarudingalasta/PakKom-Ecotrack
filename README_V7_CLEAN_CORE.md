# PakKom EcoTrack v7 Clean Core

Tujuan versi ini adalah menyederhanakan runtime EcoTrack dengan mengeluarkan EcoChat dari aplikasi aktif, tanpa mengubah modul inti yang sudah dipakai.

## Modul aktif
- Login Admin/Guru
- Login Siswa (/siswa/)
- Wadah Makan & Tumbler
- Kebersihan Kelas
- Rekap & Analisis
- Data Kelas Saya
- Kelola Data Admin
- Tugas Siswa

## EcoChat
EcoChat dihapus dari navigasi, runtime JavaScript, polling notifikasi, route, dan Firestore Rules aktif. Collection chat lama tidak dihapus otomatis. Default deny membuat aplikasi v7 tidak dapat membacanya.

## Tugas Siswa
Route `tasks` dirender sinkron terlebih dahulu. Admin harus selalu melihat `Task Core v7.0` dan tombol `+ Buat Tugas` sebelum pembacaan Firestore dilakukan.

## Deployment paling aman
Ganti file berikut:
- main.js
- styles.css
- index.html
- siswa/index.html
- firestore.rules (atau copy FIRESTORE_RULES_V7.txt ke Firebase Console lalu Publish)

Firebase config, folder functions, dan template Excel tetap dipertahankan.
