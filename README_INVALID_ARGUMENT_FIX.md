# Analysis v2 — invalid-argument fix

Penyebab:
Project memakai Firebase compat wrapper:
`function doc(db, ...parts) { return db.doc(parts.join('/')); }`

Kode sebelumnya membuat dokumen baru dengan:
`doc(collection(db,'analysisPeriods'))`

Itu tidak valid untuk wrapper compat dan menghasilkan Firebase `invalid-argument`.

Perbaikan:
Dokumen baru sekarang dibuat dengan:
`collection(db,'analysisPeriods').doc()`

Ini menghasilkan DocumentReference dengan auto-ID yang valid.

File repository yang berubah:
- `main.js`

`styles.css` tidak perlu diganti untuk fix ini.
Firestore Rules tidak berubah.
Tidak ada file yang perlu dihapus.
