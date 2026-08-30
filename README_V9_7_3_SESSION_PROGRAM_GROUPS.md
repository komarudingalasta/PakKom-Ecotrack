# v9.7.3
- Student Firebase Auth uses a named Firebase app (`PAKKOM_STUDENT`) so student login does not replace Admin/Guru authentication on the same browser origin.
- Student-created groups are scoped to `programId` when a task belongs to a Program Kokurikuler. The same group is reused across group assignments in that program/theme.
- Legacy tasks without programId keep task-specific groups.
- Staff monitoring reads program-scoped groups for program tasks.
- Firestore Rules updated for program-scoped student group creation/submission.
