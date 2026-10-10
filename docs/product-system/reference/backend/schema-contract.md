# Canonical backend schema contract

**Source:** `new_schema.sql`  
**Evidence:** DDL verified in the SQL file. The script is executed by `database/services/schemaService.js` and also by `database/migrations/migrate_snapshot.py`.

## Core table families

- **Identity/catalog:** `users`, `departments`, `teacher_profiles`, `students`, `degrees`, `graduation_cohorts`, `program_years`, `subjects`, `academic_identity_events`. A user has an ID, unique case-insensitive email, password hash, name, role, and metadata; a student has its own ID, optional linked user ID, unique case-insensitive email, name, optional PRN, optional cohort, and lifecycle state. A student can exist without a linked user. Cohort/degree and program-year/degree consistency are FK-constrained; subjects have a composite FK ensuring their year belongs to the same degree. Cohort/degree, year/degree, and subject catalog relationships restrict parent deletion. Student cohort and identity-event references can be nulled on parent deletion.
- **Teaching:** `classes`, `teacher_students`, `class_memberships`. Class IDs have a `(id, teacher_id)` unique key; class status is constrained to active/completed/archived. `teacher_students` is a teacher-level roster key; `class_memberships` allows multiple class relationships per student/teacher and constrains membership status to active/ended/withdrawn. FKs cascade or set null according to the column.
- **Work and grades:** `tasks`, `task_assignments`, `grades`. Assignments use `(task_id, student_id)` primary key, completion is boolean constrained, and grade rows have a partial unique index for `(student_id, task_id)`. Deleting classes/tasks/students cascades where specified; deleting a referenced task/teacher on grade rows sets the FK null.
- **Student activity and game:** `notifications`, `student_activity`, `student_activity_days`, `xp_events`, `progression_states`, `daily_quests`, `daily_quest_views`. XP events have unique idempotency keys, points and source metadata; progression state is one row per student. Notification seen flags and activity booleans are checked.
- **Migration provenance:** `legacy_record_map` stores imported source keys/entity descriptors and JSON provenance.

## Initialization and consistency implications

The script begins with `PRAGMA foreign_keys = ON`, creates tables and indexes idempotently, and seeds the standard department catalog with `INSERT OR IGNORE`. It is a schema initializer, not a versioned migration history. API services still add application-level invariants that the DDL does not express (for example verifying class teacher ownership and checking active parent records before creates).

## Verified / unknown

**Verified:** table relationships and key constraints summarized above. More detailed field-by-field contracts are in the DDL source itself and in the corresponding service references. **Unknown:** which SQL versions/deployment environments have applied later compatibility changes; the schema initializer does not record a version number.
