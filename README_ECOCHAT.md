# EcoChat Core

## Navigasi baru
HP: Beranda | Wadah | Kebersihan | EcoChat | Lainnya
Lainnya berisi Rekap & Analisis, Kelola Data (Admin), Akun, dan Keluar.

## Grup bawaan
- Pengumuman Sekolah — semua akun aktif membaca, hanya Admin mengirim.
- Semua Guru — seluruh akun aktif.
- Wali Kelas — Admin + Wali Kelas.
- Jenjang 7/8/9 — Admin + Wali Kelas sesuai jenjang.

## Fitur Core
- Chat realtime Firestore.
- Badge pesan belum dibaca.
- Status baca per pengguna.
- Reaksi 👍 ✅ 👀.
- Pengumuman resmi.
- UI responsive:
  - HP: daftar grup → chat layar penuh.
  - Tablet/desktop: daftar grup + chat.
- Akun dan data EcoTrack lama tetap digunakan.

## Koleksi Firestore baru
- `chatMessages`
- `chatReactions`
- `chatReads`

Wajib Publish `firestore.rules` terbaru.

Core v1 belum mencakup:
- private chat;
- upload file/foto;
- grup custom;
- pencarian pesan global;
- EcoBot otomatis.
Fitur tersebut disarankan setelah Core stabil.
