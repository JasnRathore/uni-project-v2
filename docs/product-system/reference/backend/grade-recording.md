# Grade recording service

**Source:** `lib/api/services/gradeRecordingService.js`  
**Evidence:** Grade transformations and writes verified in source; storage mappings in `database/services/relationalDataService.js`; schema constraints in `new_schema.sql`. Called by teacher and student controllers; their contracts are excluded.

## Exports and contracts

Exports `normalizeScore(grade, score)` and async `recordGrade({ task = null, assignment, student, studentId, classId, teacherId, grade, score, maxScore, answers })`. `recordGrade` resolves student ID from `studentId` or `student.id`, class ID from explicit `classId` or `task.classId`, and returns a legacy-shaped grade entry.

## Behavior

1. Resolve IDs; reject missing student/class IDs. If a task object is supplied it must have an ID and its `classId` string must match the resolved class.
2. Normalize score by taking `Number(score ?? grade)` when finite, otherwise map letter grades A+ through F to 100, 95, 90, 85, 80, 75, 70, 65, 60, 50, and 0. Anything else throws.
3. In parallel, read the active student and class joined to its subject. Reject inactive/missing student, missing class, or teacher mismatch when a teacher ID was supplied. The class row itself is not required to be active.
4. Require a finite positive maximum (`maxScore || task.maxPoints || task.points || 100`); build the entry with task/student/class/teacher fields, assignment fallback, score, max score/points, UTC date and timestamp, and optional `answers`. Reject scores below zero or above the maximum.
5. Read student grades and optional tasks via `portalStore`; upsert by task identity (or by synthetic ID without a task), mark the task complete with grade/score, and schedule student grades, tasks, and activity-streak writes. If `teacherId` exists, also read/update teacher grades and task-grade index. Append a grade notification. Await all queued legacy-store writes with `Promise.all`.
6. Compute rounded percentage and award percentage-plus-bonus XP (15 at >=95%, 10 at >=90%, 5 at >=80%, otherwise zero) via `awardXp`, with deterministic grade idempotency key and source type quiz only for a quiz task. Return the entry only after the XP call succeeds.

## Persistence, atomicity, and effects

Direct DB reads use `getDatabaseClient`; legacy grade/task/notification stores use `portalStore`, and activity uses `trackStudentActivity`. XP writes use its own transaction. `writePortalData` runs each write in its own transaction, but these writes are launched concurrently; **there is no single transaction for the grade, mirrored records, notification, streak, and XP as a whole**. Failure can leave partial mirrors; XP failure occurs after legacy writes and may leave the grade persisted without its XP event. The grade relation is canonicalized by the adapter into `grades`, while notification/task/grade arrays are compatibility views.

## Errors and edge cases

Validation messages cover IDs/task-class mismatch, supported grade format, active student, class/teacher existence, positive maximum, and score bounds. Numeric strings are accepted by `Number`; maximum uses `||`, so zero/empty values fall through to a task/default maximum. For no task the synthetic ID uses the current millisecond and is not stable across calls. Teacher mirror writes occur only when teacher ID is supplied. Duplicate task grades are replaced in the in-memory list; the relational unique student/task index provides canonical uniqueness.

**Verified:** behavior above is explicit source logic. **Unknown:** whether the caller's task object is fresh/canonical and whether failures are retried by controllers.
