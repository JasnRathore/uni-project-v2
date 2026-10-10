# Key-value store to SQL migration guide

This guide describes the migration to `new_schema.sql`. The snapshot importer
can populate a new local SQLite database, but it does **not** change the
application or connect to/migrate the configured live database. Keep the
current application and database unchanged until the migration has been tested
against a complete backup and explicitly approved for cutover.

## Target model

The schema is SQLite/Turso-compatible and replaces JSON arrays keyed by owner or
email with relational records:

- `users` holds authentication identities and retains unmodeled account fields
  in `metadata_json`. The legacy `users.password` value is already a password
  hash; copy it to `password_hash`, never hash it again.
- `teacher_profiles` holds teacher-specific profile fields.
- `students` holds both registered student accounts and manual roster students.
  `user_id` is nullable for students without a portal account. `email` is the
  canonical case-insensitive identity used to reconcile profiles, rosters,
  tasks, grades, notifications, and activity.
- `classes`, `teacher_students`, and `tasks` represent teacher-owned classes,
  rosters/class assignment, and tasks.
- `task_assignments` contains student-specific completion and grading state
  instead of copying full task objects into each student's record.
- `grades` is the canonical grade history; `notifications` and
  `student_activity` / `student_activity_days` replace their corresponding
  arrays and streak objects.
- `daily_quests` and `daily_quest_views` replace the quest and seen-state keys.
- Legacy username-index keys are retained only as provenance in
  `legacy_record_map`; there is no active username lookup table.
- `legacy_record_map` records each source key and array position for audit and
  duplicate reconciliation. It is provenance data, not a replacement KV store.

The `source_json`/`profile_json` columns retain fields not yet represented by
the relational model. Keep them through the first cutover; remove or narrow
them only in a later, separately reviewed migration.

## Legacy key mapping

| Legacy key pattern | Target |
| --- | --- |
| `users` table rows | `users`; map `password` to `password_hash`, parse `metadata` into `metadata_json` |
| `teacher:<userId>` | `teacher_profiles`, linked by `user_id` |
| `student:<id>` | `students`; attach a matching `users` row when one exists |
| `student_profile:<email>` | Merge into the matching `students` row; preserve all original fields in `profile_json` and provenance |
| `students:<teacherId>` | `teacher_students`, one membership per distinct student/teacher |
| `teacher_students:<teacherId>` | `teacher_students`; reconcile with `students:<teacherId>` rather than importing duplicate memberships |
| `classes:<teacherId>` | `classes`, with `teacher_id` taken from the key suffix |
| `tasks:<teacherId>` | `tasks`, with `teacher_id` taken from the key suffix |
| `student_tasks:<email>` | Resolve/create `task_assignments`; resolve task IDs against `tasks`, creating a documented imported task record if no canonical task exists |
| `dental_college_grades:<teacherId>` | Reconcile into `grades` using student/task identity; retain teacher ownership in `graded_by` where known |
| `student_grades:<email>` | Reconcile into `grades`; preserve answers and original fields in `answers_json`/`source_json` |
| `task_grades:<taskId>` | Reconcile the email-to-grade map into `grades` for the corresponding task |
| `notifications:<email>` | `notifications`, preserving notification IDs and read state |
| `student_activity:<email>` / `student_streak:<email>` | `student_activity` plus one `student_activity_days` row per date |
| `daily_quest` | `daily_quests` |
| `daily_quest_seen:<suffix>` | `daily_quest_views`; resolve the suffix to a student and retain the exact key in `legacy_key` |
| `username:<username>` | `legacy_record_map` provenance only; username indexes are not imported |

Key suffixes and row fields can be inconsistent. Parse prefixes using the first
colon only; emails themselves may contain punctuation and must not be split
further. Preserve original key strings in the provenance map.

## Recommended migration sequence

1. **Inventory and back up.** Take a consistent Turso backup/export of both
   `users` and `kv_store`. Save the exact source key/value bytes and a row count.
   Protect the backup as credential-bearing data. Record the target database
   URL/environment and the backup timestamp.
2. **Run against a copy first.** Restore the backup to a disposable database,
   execute `new_schema.sql`, and implement a repeatable importer that can be
   restarted safely. Do not point the importer at production during testing.
3. **Normalize source values.** `kv_store.value` is normally JSON text, but
   older exports/rows may be plain strings. Decode JSON when valid; otherwise
   preserve the literal string and record the parse mode. Do not silently
   replace malformed values with empty objects or arrays.
4. **Import identities first.** Import `users`, preserving user IDs and role
   metadata. Then import teacher profiles and construct one `students` row per
   canonical email. Match email case-insensitively after trimming whitespace;
   preserve the original email spelling in provenance. Link a student to a
   portal `user_id` only when the identity is unambiguous. Give manual-only
   students stable IDs and retain their legacy IDs in `legacy_record_map`.
5. **Import classes and rosters.** Import classes before memberships. Reconcile
   the `students:<teacherId>` and `teacher_students:<teacherId>` sources by
   normalized email/student ID. Keep one `(teacher_id, student_id)` membership;
   preserve class assignment and differing source objects in provenance.
6. **Import tasks and assignments.** Import teacher task records first.
   Reconcile per-student task snapshots by task ID and student email. A task
   present only in a student snapshot must not be dropped: create an imported
   task row with nullable `teacher_id` if ownership cannot be resolved, and
   preserve its original content in `source_json`. Import completion/score
   state to `task_assignments`.
7. **Reconcile grades before inserting.** The teacher grade list, student
   grade list, task grade map, and task snapshot can be mirrors of one grade.
   Use normalized student identity plus task ID as the primary match. Prefer
   the most complete/latest record, but preserve every conflicting source in
   `legacy_record_map`; do not sum or create multiple canonical grades for a
   mirrored submission. Rows without a resolvable student should be reported
   and held for manual resolution, not discarded.
8. **Import secondary data.** Import notifications, activity/streak dates,
   quests, and seen state. Preserve legacy username-index source keys as
   provenance only; do not create a username lookup.
9. **Validate before cutover.** Compare source and target counts by namespace
   and entity, unique normalized emails, class/task/grade totals, assigned
   memberships, and streak dates. Also compare sampled records field by field
   and verify every foreign key with `PRAGMA foreign_key_check`.
10. **Cut over with rollback available.** Deploy application code that reads
    and writes the relational tables only after the dry run meets agreed
    acceptance checks. Keep a final pre-cutover backup and a documented
    rollback point. Do not delete `kv_store` until the new application has
    operated successfully and the rollback window has closed.

## Local snapshot importer

`database/migrations/migrate_snapshot.py` is a standard-library Python importer
for an offline CSV export of `kv_store` and an optional SQLite `users` backup.
It creates a **new** target database, applies `new_schema.sql`, imports
normalizable records, and preserves each KV key/value in `legacy_record_map`.
It refuses to overwrite an existing target. It does not accept a Turso URL or
make network connections.

Example from the repository root (choose a target path that does not already
exist):

```powershell
python database\migrations\migrate_snapshot.py `
  --source-csv kv_store_2fad19e1_rows.csv `
  --target-db migration-dry-run.db
```

Add `--users-db <backup.db>` only when that SQLite file is a consistent backup
of the same source environment as the KV export. The current `local.db` has
already been reset to the new empty schema, so it is not a source users backup.
Omitting `--users-db` leaves accounts unresolved; it does not create
placeholder authentication users. Review `unresolved_counts_by_reason` in the
JSON report before considering a data cutover.

### Dry-run performed

The local dry run used the checked-in 170-row CSV and the repository's local
SQLite database as the available account snapshot. Its source database had
only one user row, and none of the eight teacher IDs present in the export
matched that user's ID. The target database was created under the Copilot
session files directory, not in the repository or configured Turso database.

| Target table | Rows imported |
| --- | ---: |
| `users` | 1 |
| `teacher_profiles` | 0 |
| `students` | 28 |
| `classes` | 0 |
| `teacher_students` | 0 |
| `tasks` | 22 |
| `task_assignments` | 96 |
| `grades` | 57 |
| `notifications` | 105 |
| `student_activity` / `student_activity_days` | 1 / 1 |
| `daily_quests` / `daily_quest_views` | 1 / 3 |
| `legacy_record_map` | 170 |

The SQL import completed with no foreign-key violations, but it is **not ready
for cutover**. Teacher profiles, classes, and roster memberships were held back
because their owners are absent from the supplied account snapshot. Legacy
username index values reference user IDs not present in that snapshot and are
kept only as provenance, not as active lookup records. Task ownership and the
daily quest owner also remain unresolved; the three daily-quest seen flags
could not be linked to a student. Fifteen student records had no resolvable
email and remain available in the provenance map rather than being assigned
invented identities. Supply a consistent full users/KV backup, resolve these
records, and rerun to a fresh target before proceeding.

## Current local database state

After the dry run, the repository's `local.db` was reset at the user's request
and initialized with the empty schema from `new_schema.sql`. The previous file
(one user row and two KV rows) was preserved as a private session backup outside
the repository. The initialized database passed `PRAGMA integrity_check` and
`PRAGMA foreign_key_check`; all target tables were empty at initialization.

The application now targets the local SQLite database when
`DATABASE_TARGET=local` and uses the relational tables for authentication and
portal data. The server-side relational data adapter preserves existing API
payloads while storing classes, memberships, tasks, assignments, grades,
notifications, profiles, activity, and quests in their target tables. It does
not create or query a `kv_store` or username lookup table. Root `.env.local`
selects local mode for this checkout and is git-ignored.

The configured Turso database (`main-jasnrathore`, `aws-ap-south-1`) received
the username-removal schema migration on 2026-10-10. The obsolete `usernames`
table and its one index record were removed transactionally; the two user
accounts and existing catalog rows were preserved (9 departments, 2 degrees,
3 cohorts, 8 program years, and 41 subjects). A post-migration foreign-key
check returned no violations. This was a schema cleanup only: it did not import
or reconcile the legacy snapshot data described above. The runtime deliberately
does not bootstrap or rewrite a remote database automatically.

## Data-quality and reconciliation notes

- Do not assume every teacher-owned key belongs to the currently logged-in
  teacher. Seed snapshots can contain records owned by older teacher IDs. Check
  each owner against `users`; only reassign data after confirming the intended
  owner. Preserve original owner IDs in provenance.
- A registered student may also appear in one or more teacher rosters. This is
  one `students` row and multiple `teacher_students` memberships, not duplicate
  student records.
- Do not infer a student account from a profile or roster entry alone. Manual
  students are valid and have `user_id = NULL`.
- Current code stores task completion in student task snapshots and quiz
  results in student grade snapshots. Reconcile these states into assignments
  and grades; a table-by-table blind copy can create conflicting records.
- Normalize the `class` metadata field and profile `className`/`classId` against
  imported classes. Keep unresolved class values in source JSON and report
  them; do not invent a class.
- `createdAt`, `updatedAt`, `registeredAt`, and date-only values can have
  different formats. Preserve their source text and normalize to ISO-8601 only
  when parsing is valid.
- The uploaded CSV is only a snapshot of KV rows. Its namespace totals are not
  guaranteed to match the live database at migration time; take fresh counts
  from the backup used by the importer.

## Minimum verification checklist

- Imported user IDs and password hashes match the backup exactly.
- No duplicate `users.email` or `students.email` values remain after
  case-insensitive normalization.
- Every imported class/task owner maps to a user or is explicitly reported.
- Every roster membership resolves to a student; class assignments point to
  imported classes.
- Every task assignment resolves to a student and task; orphan source records
  are retained and reported.
- Grade reconciliation results and conflicts are auditable by source key and
  item index.
- Notification totals/read states and activity streak/date sets match the
  chosen reconciliation rules.
- `PRAGMA foreign_key_check` returns no rows, and application smoke tests pass
  against the migrated copy before production cutover.
