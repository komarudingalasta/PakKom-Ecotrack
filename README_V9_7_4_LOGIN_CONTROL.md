# PakKom EcoTrack v9.7.4 — Student Login Control

- Edit Data Siswa now separates **Status Siswa** and **Akses Login**.
- Status Siswa: Aktif / Tidak Aktif.
- Akses Login: Aktif Login / Nonaktif Login.
- Tidak Aktif automatically forces login off.
- Student login and task pages respect `studentAccess.loginEnabled`.
- Legacy studentAccess documents without `loginEnabled` remain compatible (treated as enabled when `active == true`).
- Excel access template adds a `Login` column for bulk control.
- Firestore Rules updated so disabled-login students cannot use student privileges.
