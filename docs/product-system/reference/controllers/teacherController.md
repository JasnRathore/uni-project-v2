# Teacher controller

## Scope and evidence

Source: `lib\api\controllers\teacherController.js`. Routes are registered in `lib\api\routeRegistry.ts`; shared authorization/dispatch logic is in `app\api\[...route]\route.ts`. Directly called service behavior was checked in `classLifecycleService.js`, `taskAssignmentService.js`, `gradeRecordingService.js`, and `studentState.js`.

## Exports, routes, and access assumptions

All 27 exported handlers are registered. Routes are protected but not marked `studentOnly`; dispatcher rejects users whose role is `student` at any `/teacher` path, but there is no teacher-only equality check, so other signed-in roles reach handlers unless a method has additional checks. The authenticated `user.id` scopes portal keys and DB ownership checks where explicitly used.

| Export | Method and path |
| --- | --- |
| `getProfile` | `GET /teacher/profile` |
| `getData` | `GET /teacher/data` |
| `saveStudents` | `POST /teacher/students` |
| `saveClasses` | `POST /teacher/classes` |
| `createClass` | `POST /teacher/classes/create` |
| `deleteClass` | `DELETE /teacher/classes/:classId` |
| `updateManualStudent` | `PUT /teacher/students/:studentId` |
| `createTask` | `POST /teacher/tasks` |
| `addTask` | `POST /teacher/add-task`, `POST /teacher/quest` |
| `updateTask` | `PUT /teacher/tasks/:taskId` |
| `deleteTask` | `DELETE /teacher/tasks/:taskId` |
| `getTaskStudents` | `POST /teacher/task-students` |
| `getTaskGrades` | `GET /teacher/task-grades/:taskId` |
| `saveGrades` | `POST /teacher/grades` |
| `getAllStudents` | `GET /teacher/all-students` |
| `getTaskStats` | `GET /teacher/task-stats` |
| `updateProfile` | `POST /teacher/profile/update` |
| `deactivateAccount` | `POST /teacher/account/deactivate` |
| `deleteAccount` | `DELETE /teacher/account` |
| `getStudentStreak` | `GET /teacher/student-streak/:email` |
| `getStudentTasks` | `GET /teacher/student-tasks/:email` |
| `assignStudent` | `POST /teacher/assign-student` |
| `unassignStudent` | `POST /teacher/unassign-student` |
| `batchStudentData` | `POST /teacher/students-batch-data` |
| `saveSingleTaskGrade` | `POST /teacher/task-grade` |
| `updateClassLifecycle` | `PUT /teacher/classes/:classId/lifecycle` |
| `addClassMembership` | `POST /teacher/classes/:classId/memberships` |
| `endClassMembership` | `DELETE /teacher/classes/:classId/memberships/:studentId` |

`runWithConcurrency`, `getOwnedStudent`, and `getOwnedClass` are internal helpers, not route exports. The former runs indexed operations with a worker limit and propagates the first rejected worker.

## Method-by-method behavior

Unless a method says otherwise, caught exceptions return `500 { error: err.message }`; successful methods are `200` unless another code is specified. Portal storage calls use per-teacher/student keys via `dbService`; direct SQL/auth calls are called out.

| Handler | Inputs, validation, and flow | Response and effects |
| --- | --- | --- |
| `getProfile` | Auth user; explicitly rejects role `student`. Reads `teacher:<user.id>`, merges metadata and saved profile. | `{ teacher }` containing auth ID/email, display name/avatar and role. Caught failures 500. |
| `getData` | No body. Concurrently reads `students:<id>`, `classes:<id>`, `tasks:<id>`, `dental_college_grades:<id>`. | `{ students,classes,tasks,grades }`, each defaulting to `[]`; read-only; failures 500. |
| `saveStudents` | Body `students` must be array. | Writes `students:<id>`; `{ success:true }`; bad type 400. |
| `saveClasses` | Body `classes` must be array. | Writes `classes:<id>`; `{ success:true }`; bad type 400. |
| `deleteClass` | Path `classId`. Reads roster; returns 409 if any student’s `classId` or `classIds` includes it. Then verifies it exists in this teacher’s saved class list (404 otherwise). | Rewrites `classes:<id>` without that entry; `{ success:true }`. Only portal data is checked; no relational class deletion here. |
| `updateManualStudent` | Path `studentId`; searches teacher roster. Missing is 404; registered student is 403. Allows only name, PRN, class ID/name, phone, address, bio; `rollNumber` aliases PRN. | Rewrites roster entry, preserving ID/email and existing fields; returns `{ success:true,student }`. |
| `createClass` | Body `class` requires ID, name, subjectId; duplicate saved ID is 409. | Saves to `classes:<id>` with `grade` copied from `programYearLabel`, reads created row, returns `201 { class }`. Existing related-database validation can surface as 400 when error text matches subject/class ID/name; other errors 500. |
| `createTask` | Body task requires nonblank title and class ID (`classId` or `class_id`) owned by teacher’s stored class list; missing class 404. | Builds task defaults and class/catalog metadata, saves it in `tasks:<id>`, then calls task assignment service to fan out to eligible active roster students. Assignment failure removes the new task from the teacher task list and rethrows; student/notification writes are not visibly rolled back. Returns task fields plus `assignedCount` (200). Other errors 500. |
| `addTask` | Similar required title/class checks; reads title, description, points, date, type, priority. | Creates simpler task object, persists then assigns to students; on assignment failure removes task from teacher list and rethrows. Returns `{ success:true,task,assignedCount }`; validation errors 400, missing class 404, caught downstream errors 500. |
| `updateTask` | Path task ID; title, if supplied, must be nonblank. Existing task must exist (404), class is required and must be in teacher’s stored classes (404). | Merges body while protecting task ID/teacher ID and refreshing class fields. Updates matching student task entries for eligible students, removes entries for ineligible emails, reassigns via service, then saves teacher task list. On caught failure restores only the teacher’s previous task list and returns 500; previous fan-out updates are not visibly rolled back. Success `{ task }`. |
| `deleteTask` | Path task ID must exist or 404. | Scans portal prefixes for student tasks, student grades and notifications; removes records for that task, filters teacher grade list, deletes `task_grades:<taskId>`, and removes teacher task. Bulk writes use concurrency 20. Returns `{ success:true }`; no cross-key transaction/rollback is visible. |
| `getTaskStudents` | Body `taskId`. Loads teacher roster/task; selects roster students assigned to task class; reads `task_grades:<taskId>`. Does not explicitly return 404 for unknown task. | `{ students:[{id,name,email,avatar,classId,className,grade}] }`, unmatched grade null. Read-only. |
| `getTaskGrades` | Path `taskId`; task must exist in teacher’s tasks or 404. | `{ grades }` from `task_grades:<taskId>`, default `{}`. |
| `saveGrades` | Body `grades` must be an array; each requires studentId, classId, assignment. Verifies roster student, teacher-owned saved class, student class membership, and if supplied taskId, task exists and class matches. Returns 403 for non-owned student/class/membership, 404 missing task, 400 task/class mismatch. | Normalizes IDs and sets teacher/student/class display data. Replaces `dental_college_grades:<teacherId>`; removes old grade IDs from affected student grade lists; upserts new entries to `student_grades:<email>`, `task_grades:<taskId>`, and marks matching student task complete. Returns `{ success:true,grades:normalizedGrades }`. Multi-key portal writes are sequential and not transaction-wrapped; other errors 500. |
| `getAllStudents` | No input. Paginates auth admin users in pages of 1000 until short page; keeps student-role users. Reads relational student identity/cohort data, all `student_profile:` portal records, and this teacher’s roster. | Returns `{ students }` assembled for active relational lifecycle records, with identity, contact/profile, class membership, registration and assignment fields. Uses `normalizeLifecycleState`. Auth/DB/storage failures 500. Reads only. |
| `getTaskStats` | No inputs. Loads teacher tasks and roster; concurrently reads grade maps and student task lists (limit 20). | `{ taskStats }`, keyed by task ID with `totalStudents`, `completed`, `attempted`, `completionRate`, `attemptRate`. Completion is grade presence or completed student task; percentages are rounded. Read-only; errors 500. |
| `updateProfile` | Body is filtered to name, phone, departmentId, specialization, qualification, experience, bio, address, joinDate, notifications, preferences. | Updates auth user metadata via admin API, removing `department`, then returns `{ success:true,profile }` merged with saved `teacher:<id>` portal profile. Auth error 400; caught errors 500. Does not write that merged profile back to portal storage. |
| `deactivateAccount` | No body. | Sets `app_metadata.accountDisabled:true` using auth admin API; returns `{ success:true }`, auth error 400, exceptions 500. Dispatcher subsequently rejects disabled accounts except reactivation. |
| `deleteAccount` | No body. | Collects owned task/grade IDs and roster; cleans associated student task, grade, notification and task-grade portal keys, clears matching class references in student profiles, deletes teacher task/class/student/grade keys, then deletes auth user. Returns `{ success:true }`; auth error 400; caught errors 500. No relational transaction or rollback across cleanup and deletion. |
| `getStudentStreak` | Path email; requires case-insensitive match in this teacher’s saved roster or 404. | Reads `student_streak:<email>`, default zero streak/date object; returns `{ streakData }`. |
| `getStudentTasks` | Path email; same roster ownership check or 404. | Reads `student_tasks:<email>`, default `[]`; returns `{ tasks }`. |
| `assignStudent` | Body studentEmail/classId required. Checks active relational student by email, class row owned by current teacher, fetches auth user by supplied studentId and verifies ID lookup’s email and student role. | Upserts/updates teacher roster portal entry and class membership fields; returns `{ success:true }`. Missing active student/class 404; identity or role mismatch 400; other errors 500. This legacy portal assignment does not call relational lifecycle membership service. |
| `unassignStudent` | Body studentId; optional classId. Student must exist in this teacher roster (404). With classId, it must appear in `classIds` or 404. | Removes selected class and membership fields, or removes student entirely when classId absent; writes teacher roster and returns `{ success:true }`. |
| `batchStudentData` | Body accepts `studentIds` array or (when absent) `emails`/`studentEmails` array; otherwise 400. Filters requested users against this teacher’s roster. | Returns aliases `{ students: results,studentsData: results }` keyed by student ID; each has streak, task/grade counts/data and computed average grade. If a grade references a teacher task missing from student task list, it appends a completed task and persists that list. Requests for unowned IDs/emails are omitted, not errors. |
| `saveSingleTaskGrade` | Body taskId, studentId, grade required; task and assigned student must exist, and student must belong to task class; errors 400/404. | Calls `recordGrade` with task, student, teacher/class IDs, normalized score and max score 100. Returns `{ success:true,grade:entry }`. Grade service validates active database student/class and score bounds, writes grade/task/notification/streak portal data and awards XP. Caught downstream failures 500. |
| `updateClassLifecycle` | Path classId; body status, optional startsAt/endsAt. Service accepts `active`, `completed`, `archived` and checks relational class ownership. | Calls transactional `classLifecycle.transition`; returns `{ class }`. Missing class 404; invalid status/other service errors 400. Transition updates class status/dates and ends active memberships when status is not active. |
| `addClassMembership` | Path classId; body studentId. Service checks active class owned by teacher and active student. | Calls transactional membership service with actor=user.id; returns `201 { membership:{classId,studentId,status:"active"} }`. Service upserts relational `class_memberships` and `teacher_students`; caught errors 400. |
| `endClassMembership` | Path classId and studentId; body optional status defaults to `ended`. Service accepts `ended` or `withdrawn` and requires an active matching membership. | Calls transactional membership service; returns `{ membership:{classId,studentId,status} }`. Validation/not-found service errors return 400. Service ends row, chooses a replacement active class if one exists, and updates teacher-student mapping. |

## Storage, database, and service boundaries

- Legacy/aggregated portal keys include `teacher:<id>`, `students:<id>`, `classes:<id>`, `tasks:<id>`, `dental_college_grades:<id>`, `task_grades:<taskId>`, `student_tasks:<email>`, `student_grades:<email>`, `notifications:<email>`, `student_streak:<email>`, and `student_profile:<email>`.
- Direct relational database access occurs in `assignStudent`, `getAllStudents`, and grade/lifecycle service calls. Auth admin operations are used for student identity verification, profile updates, account deactivation/deletion, and global student listing.
- `recordGrade` performs grade/activity portal writes and awards XP; only the XP-event/student-total update is within its own DB transaction. `classLifecycleService` explicitly wraps status and membership mutations in database transactions. Task assignment writes each eligible student’s task and notification separately.
- Route registry and catch-all dispatcher are the only callers established by the inspected files. There are no explicit role checks in all handlers; ownership is based on authenticated teacher key/ID and the validations described above.

## Response/error handling and unknowns

Validation/status codes are called out per handler. Most handlers catch failures and return 500; service methods for class lifecycle have specific 404/400 translation. The shared dispatcher also returns 401/403 before entry and generic 500 if a handler throws past its local catch. There is no controller-wide schema validation, pagination except auth user listing, or transaction for multi-key portal updates. Storage consistency/atomicity beyond the explicit service transactions cannot be inferred from these controller files.
