# Class lifecycle and membership service

**Source:** `lib/api/services/classLifecycleService.js`  
**Evidence:** SQL and transaction behavior verified in source; constraints verified in `new_schema.sql`. Called from `lib/api/controllers/teacherController.js` (excluded).

## Exports and contracts

CommonJS exports the `classLifecycleService` object: `transition({ classId, teacherId, status, startsAt, endsAt })`, `addMembership({ classId, studentId, teacherId, actorId })`, `endMembership({ classId, studentId, teacherId, status = 'ended' })`, and `getClass(classId)`.

## Step-by-step behavior

- `transition` accepts only `active`, `completed`, or `archived`; in a write transaction it selects the class by both ID and owning teacher, errors if absent, updates status and nonempty supplied start/end dates using `COALESCE`, and when leaving/entering any non-active status marks all currently active class memberships ended with an end timestamp. It returns the pre-update class row spread with the requested status; returned start/end values are therefore not refreshed.
- `addMembership` transactionally requires an active class owned by the teacher and an active student. It upserts `class_memberships` as active, clearing its `ended_at`, then upserts the compatibility teacher/student row in `teacher_students`; it returns only `{ classId, studentId, status: 'active' }`.
- `endMembership` accepts `ended` or `withdrawn`. In a transaction it changes the matching active membership and errors if `rowsAffected` is falsey. It then selects the most recently updated remaining active class membership (class ID is a deterministic tie-breaker) and updates `teacher_students` to the replacement class and active status, or to `null` and the terminal status with an ISO end timestamp. It returns the requested IDs and status.
- `getClass` does a direct ID lookup and returns the row or `null`; it does not scope by teacher.

## DB contract and consistency

Uses `getDatabaseClient` and `withTransaction` from `database/services/dbService.js`; writes `classes`, `class_memberships`, and `teacher_students`. Membership primary keys are `(teacher_id, student_id, class_id)`; `teacher_students` is one teacher/student compatibility record while class memberships permit multiple classes. Each multi-row lifecycle operation is transactional. The class table's allowed lifecycle values and membership table's allowed membership values are schema checks.

## Errors and edge cases

Invalid statuses and absent/unauthorized class/student/membership produce explicit errors. Adding an existing membership reactivates it. Class transition to any non-active status ends active memberships but does **not** update the corresponding `teacher_students` row in this service; callers may therefore observe compatibility state that does not mirror lifecycle membership state. `getClass` is an unrestricted data helper; access checks must be provided by its caller.

**Verified:** operations, filters, upserts, transaction wrappers, and stale-return shape above. **Unknown:** any higher-level reconciliation outside this module.
