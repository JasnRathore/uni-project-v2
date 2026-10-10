# Relational data service

**Source:** `database/services/relationalDataService.js`  
**Evidence:** All exported functions, read/write/delete mappings, SQL, and transaction behavior verified in this file. Table definitions are in `new_schema.sql`. The service is the persistence compatibility layer between former namespaced portal records and normalized tables.

## Exports and shared helpers

Exports `readPortalData(key)`, `writePortalData(key, value)`, `deletePortalData(key)`, `listPortalDataByPrefix(prefix)`, `withTransaction(operation)`, and `ensureStudent(executor, email, record = {})`. Keys split at the first colon into namespace and suffix; a colonless key has an empty suffix. Unknown read/write/delete/list namespaces throw descriptive errors. JSON columns are parsed when strings; malformed JSON throws `Invalid relational JSON value`. Write collections require arrays except object-valued namespace cases.

`withTransaction` serializes all transactions in this JS module instance on a promise queue, opens a libSQL write transaction, commits on success and rolls back/rethrows on failure. A rejected operation does not poison the queue. Reads are not queued. This is process-local serialization, not cross-process locking.

## Canonical student handling and read mappings

`ensureStudent` requires nonblank email, trims it, associates a matching user case-insensitively, and reuses an existing canonical student by email. Otherwise it prefers supplied ID, then user ID, then a deterministic email-derived ID. It merges the existing profile and source record after stripping deprecated identity/profile keys, normalizes lifecycle state to active only for exact `'active'`, and maps legacy roll number to PRN. Existing rows are updated; new rows are inserted. Numeric profile values are converted to finite numbers, with existing/default fallbacks. This helper runs on the transaction executor supplied by its caller.

Read namespaces and their normalized sources:

| Namespace | Read contract / source |
| --- | --- |
| `classes:<teacherId>` | Teacher's classes joined to subject/degree/program year, returned in legacy field names and row order. |
| `students:<teacherId>`, `teacher_students:<teacherId>` | Active students in that teacher's roster plus all class membership IDs/details; legacy single class fields remain as compatibility fields. |
| `tasks:<teacherId>` | Teacher tasks joined to class and subject. |
| `student_tasks:<email>` | Active student's assignments joined with canonical task, class, and subject; task identity plus assignment completion/grade state. |
| `student_profile:<email>` | Canonical student/profile and cross-teacher class membership summary. |
| `student:<id>` | One canonical student mapped to legacy field names. |
| `teacher:<id>` | User, teacher profile, and department joined; metadata/profile `department` is removed and canonical department label/ID returned. |
| `student_grades:<email>` | Grades for a student's email joined to class and subject. |
| `dental_college_grades:<teacherId>` | Grades graded by the teacher, joined to class and subject. |
| `task_grades:<taskId>` | Object mapping student IDs to grade label or numeric score. |
| `notifications:<email>` | Notifications ordered by rowid, mapped to legacy `read` and `createdAt`. |
| `student_streak:<email>`, `student_activity:<email>` | One activity row plus ordered activity dates, or `null` if absent. |
| `daily_quest` | Most recently inserted quest, or `null`. |
| `daily_quest_seen:<...>` | Boolean `has_seen` for the complete key, or `null`. |

## Write mappings and invariants

Every `writePortalData` mapping executes inside `withTransaction`:

- `classes` requires an existing teacher, array records with ID/name/catalog `subjectId`, and active subject/year/degree. It upserts only rows owned by that teacher and then deletes that teacher's classes omitted from the submitted snapshot.
- `students` / `teacher_students` are full teacher-roster snapshots. Every item requires email; `ensureStudent` runs and inactive students are rejected. Requested classes must be active and owned by the teacher. Existing memberships for the teacher/student are deleted and requested memberships are inserted; a compatibility `teacher_students` row is upserted. Active roster rows omitted from the full snapshot are removed with memberships; inactive roster rows are skipped during omission cleanup.
- `tasks` requires ID/title/class, verifies class ownership, upserts teacher-owned tasks, rejects ID collisions owned by another teacher, and removes omitted tasks for that teacher.
- `student_tasks` requires an active student and each assignment ID/title/class. It normalizes an invalid/missing teacher to null, verifies the class exists and, if a teacher ID resolved, that it belongs to that teacher. It creates a task only if absent, upserts `task_assignments`, then deletes that student's assignments omitted from the supplied snapshot. An unresolved teacher means class-owner matching is not enforced.
- `student_profile` requires an object and ensures/updates canonical student fields and profile.
- `student` requires an object with email and ensures the row, using the key suffix as fallback ID.
- `teacher` requires an object and an existing non-student user, strips legacy department text from source JSON, and upserts department ID/profile.
- `student_grades`, `dental_college_grades`, and `task_grades` canonicalize into `grades`. Student-grade writes delete that student's existing grades first; teacher-grade writes delete grades graded by that teacher first; task-grade object writes delete task grades absent from the supplied map. Each incoming grade requires an active student, valid task if specified, class, and teacher ownership when a teacher resolves; a grade's class must equal its task class. Existing student/task grade with a different ID is removed before upsert.
- `notifications` ensures the student, replaces all notifications for the email, and keeps a task FK only if that task exists.
- `student_streak` / `student_activity` require an object, upsert streak values and replace that student's activity-day set.
- `daily_quest` requires object and ID; optional class must belong to supplied teacher; then upserts quest fields/source JSON.
- `daily_quest_seen` writes the full legacy key and booleanized value with a null student ID.

## Delete and prefix-list behavior

`deletePortalData` uses a transaction and deletes the corresponding canonical scope: a teacher's classes/roster/tasks, a student's assignments/profile/grades/notifications/activity, a teacher profile or grade set, one task's grades, all daily quests, or a quest-view key. In particular, deleting `students:<teacherId>` directly removes `teacher_students` rows only; it does not directly remove `class_memberships`. Database FK cascade/restrict/set-null behavior applies; deleting classes/tasks/students may therefore affect related rows beyond the direct DELETE.

`listPortalDataByPrefix` accepts a namespace with or without trailing colon, gets distinct suffixes from its table, then reads each key in sequence and returns `{key, value}`. Special cases enumerate matching daily-quest view keys or return only the latest daily quest. Supported lists include classes, rosters, tasks, student collections/profile/activity, grades by teacher/task, teachers, students, daily quests, and seen flags. Unsupported namespace listing throws.

## Consistency and edge cases

Each individual facade write is atomic, including full-snapshot deletes, but multi-key workflows (for example `recordGrade`) invoke multiple transactions and can partially succeed. DB uniqueness/FKs/checks remain the final guard. Prefix reads are sequential and not snapshot-consistent. Read projections differ intentionally from stored row shapes; legacy fields may come from `source_json`, while relational columns override canonical identity/status fields.

**Verified:** all namespace mappings above and the source-level invariants. **Unknown:** behavior of individual libSQL transaction methods under network interruption and cross-process transaction ordering.
