# PakKom EcoTrack v8.2 Router Fix

Perbaikan utama:
- Semua submenu Lainnya sekarang menggunakan URL router, bukan state.page langsung.
- Tugas Siswa dihapus dari Lainnya karena sudah menjadi menu utama Admin/Wali.
- Menu Tugas tetap route #tasks.
- Navigasi internal data-go dan data-more-go disatukan melalui navigateToPage().
- Firestore Rules tidak berubah dari v8.
