# Snapshot migration utility

**Source:** `database/migrations/migrate_snapshot.py`  
**Evidence:** CLI, transformations, SQL import sequence, reporting, and failure handling verified in source. The canonical schema is `new_schema.sql`.

## Purpose, command, and safety contract

This Python 3 CLI imports a namespaced KV CSV and an optional SQLite users backup into a **new isolated local SQLite database**. Required flags are `--source-csv` and `--target-db`; `--users-db` is optional. It refuses missing source/schema/user files and refuses to overwrite an existing target. It creates the target parent directory, reads the source CSV as UTF-8 with BOM support, requires `key` and `value` columns, rejects blank keys with row number, and parses each value as JSON when possible or retains its raw string. The target is initialized from root `new_schema.sql`, with foreign keys enabled. No remote database connection is made.

## Import sequence

1. Group source records by the namespace before the first colon, preserving each key and suffix. Keep parse-mode counts.
2. Optionally open users DB read-only. If a `users` table exists it must contain ID/email. Rows without ID/email/password hash are counted unresolved and skipped; password comes from `password_hash` or legacy `password`, metadata is parsed/coerced to an object, and inserts preserve IDs/email/name/role/hash with `ON CONFLICT(id) DO NOTHING`.
3. Index users/departments. Import teacher profiles only for known user IDs; resolve department by valid ID then case-insensitive name, stripping textual department from profile source and counting unresolved department references.
4. Canonicalize student identities by case-folded email. Merge users with student profiles/records, assign deterministic UUIDv5 IDs if absent/colliding, normalize `rollNumber` to `prn`, and preserve other profile JSON. Import catalog degrees, program years, and subjects only when IDs and parent relationships can be validated.
5. Import classes only for known teachers and resolvable subjects. A legacy subject name can resolve only when the optional degree/year qualifiers leave exactly one subject; old class labels do not create catalog entries.
6. Import teacher rosters from `students` and `teacher_students`, retaining canonical student identity and only class IDs imported in step 5. Collect tasks from teacher task arrays and student task snapshots; import only when class exists, then import assignment rows for known students/tasks.
7. Reconcile grade rows from student, teacher, and task grade namespaces into one grade table. Missing student/class/task relationships are counted unresolved; a task's class is inferred when omitted and mismatches are rejected. Deterministic UUIDv5 fallback IDs are used where needed.
8. Import notifications, activity/streaks and activity dates, quests, and seen-state keys. Task/user references are retained only if corresponding imported entities exist; unresolved references are counted.
9. Add one `legacy_record_map` provenance row for each source KV record (item index is currently always zero), classify unknown namespaces as unrecognized, count every normalized table, run `PRAGMA foreign_key_check`, and abort/rollback if any FK violation exists. On success commit and print a JSON report.

The import is enclosed in one SQLite transaction after schema initialization. Errors roll back data changes and exit nonzero with `migration dry run failed: ...`; the newly created target file may remain after failure. It does not overwrite/merge into an existing target.

## Normalization and omissions

Helpers serialize JSON deterministically, preserve Unicode, coerce finite numbers, normalize only `active`/`inactive` statuses (invalid becomes active), and filter list inputs to objects. Unresolved rows are counted by reason instead of necessarily aborting. The report includes source row counts, parsed/raw counts, normalized table counts, unresolved reason counts, zero FK violations on success, and the target path.

This utility imports users, teacher profiles, students, academic catalog, classes/rosters/memberships, tasks/assignments, grades, notifications, activity, quests, and source provenance. It does **not** import `xp_events` or `progression_states`; legacy `totalPoints` may populate student totals but is not reconstructed into the XP ledger. It is a dry-run/import-to-new-file tool, not a production remote migration framework.

**Verified:** all paths and behaviors from the script. **Unknown:** operational safeguards external to this script (backup retention, invocation process, and approval workflow).
