# Task assignment service

**Source:** `lib/api/services/taskAssignmentService.js`  
**Evidence:** Assignment loop verified; portal mappings and schema joins documented in [relational data service](relational-data-service.md). Teacher controller is the caller and remains out of scope.

## Exports and contract

Exports `assignTaskToStudents(teacherId, task)`. The function returns the count of eligible roster entries, not the count of newly inserted assignments.

## Behavior

1. Reads `students:<teacherId>` through `readPortalData`; non-array/absent roster becomes empty.
2. Keeps students accepted by `isActiveStudent`. With `task.classId`, a student must have matching `classId` or include the class in `classIds`, and must have an email. Without a class ID, any active student with email is eligible.
3. Processes eligible students sequentially. It reads that student's task list and skips if the task ID is already present. Otherwise it appends a task copy with `completed: false` and `grade: null`, then writes the list.
4. Reads notification list, appends a new unread task notification with generated time/random ID, assignment title and task ID, and writes it.
5. Returns eligible-list length, including duplicates skipped at step 3.

## Dependencies, data, side effects

Depends on `readPortalData`, `portalStore`, and `isActiveStudent`; effects are SQL-backed legacy stores. The adapter stores student assignments in `task_assignments` and user-facing notifications in `notifications`. Each portal write is separately transactional, but the sequence is not atomic; partial task/notification updates and cross-call duplicate races are possible. No direct validation checks task ID/title or class ownership here; the roster filter is the only eligibility check.

## Errors and edge cases

Read/write errors propagate and stop the sequential loop, leaving earlier student writes in place. Duplicate IDs are detected by strict equality against existing `id`; no validation or canonical task existence check is performed. Random notification IDs use `Date.now()` and `Math.random()`.

**Verified:** exact eligibility, sequencing, skip behavior, and returned count. **Unknown:** whether the calling controller separately validates task ownership/content.
