# v9.7.21 — Penugasan Perekap

- Pilihan Admin, guru manual, Acak Guru/Wali Kelas, Wali Kelas Otomatis.
- Data lama mempertahankan identitas perekap tersimpan; data lama yang kehilangan identitas tidak ditebak.
- Data baru dapat diberi penanggung jawab rekap secara acak per tanggal+kelas atau wali kelas terkait. Penanggung jawab yang ditetapkan bukan bukti bahwa orang tersebut benar-benar menginput.
- Jejak admin pengunggah dipisahkan.
- Perhatian: data yang sudah ditimpa pada versi sebelumnya tidak otomatis dapat dipulihkan.
- Tidak ada perubahan Firestore Rules. Uji pada salinan data sebelum deployment produksi.
