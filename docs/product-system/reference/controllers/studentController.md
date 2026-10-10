# Student controller

## Scope and evidence

Source: `lib\api\controllers\studentController.js`. Routes are registered in `lib\api\routeRegistry.ts`; dispatcher access gates are in `app\api\[...route]\route.ts`. Supporting functions referenced below are in `studentService.js`, `studentDashboardService.js`, and `gradeRecordingService.js`.

## Exports and entrypoints

All nine exports are registered. Every route is protected and marked student-only; the dispatcher requires `user_metadata.role === "student"` and also confirms an active `students` row matching user ID or email before calling a handler.

| Export | Route |
| --- | --- |
| `getProfile` | `GET /student/profile` |
| `getData` | `GET /student/data` |
| `getDashboard` | `GET /student/dashboard` |
| `getLeaderboard` | `GET /student/leaderboard` |
| `getNotifications` | `GET /student/notifications` |
| `markNotificationRead` | `POST /student/notifications/read` |
| `updateProfile` | `POST /student/profile/update` |
| `submitQuiz` | `POST /student/quiz/submit` |
| `getQuest` | `GET /student/quest`, `GET /quest` |

## Handler responsibilities and data flow

| Handler | Inputs/validation and flow | Response, side effects, and errors |
| --- | --- | --- |
| `getProfile` | Uses authenticated user metadata and reads `student_profile:<email>`. Explicitly rejects a `teacher` metadata role with 403 (the dispatcher already rejects non-students). Removes legacy `rollNumber`; fills defaults and derives avatar initials. | `200 { student }`, with ID/email from auth identity, profile/meta fallback for name, PRN, username, class information, and defaults for points, level and progress. Caught errors return 500. Read-only portal storage. |
| `getData` | Reads `student_tasks:<email>`, `student_grades:<email>`, and profile. Normalizes non-array task/grade values to empty arrays; merges completion based on matching task IDs/grades; gets streak and computes stats. | `200 { tasks,grades,streakData,stats,assignedClass,adminMessage }`. `assignedClass` is profile class ID/name or null; `adminMessage` defaults null. `getStudentStreak` may reset persisted current streak to zero when an overdue incomplete task is detected. Caught errors return 500. |
| `getDashboard` | Same task/grade/profile reads and completion merge; gets streak; derives pending tasks. | `200 { tasks,streak,stats,quest,profile }`; quest is first incomplete task or null. A missing profile fallback contains totalPoints 0/currentLevel 1. Streak read can mutate storage as above; caught errors return 500. |
| `getLeaderboard` | No request inputs. Queries current active student where both user ID and email match; missing row returns 404. Parses profile JSON, reads one class membership, takes cohort from DB or profile fallback, then fetches peers and their grades. | Returns `200 { leaderboard,scope }`, or empty leaderboard with explanatory message if no class/cohort exists. Builds score from numeric score/max score with percentage bonus, otherwise letter-grade map; sorts by experience/name/ID, assigns tie ranks and marks current student. SQL/profile errors are caught as 500. Read-only direct database queries; this implementation’s grade-derived score is distinct from game leaderboard XP-event totals. |
| `getNotifications` | No inputs; reads `notifications:<email>`, default `[]`. | `200 { notifications }`; caught storage errors return 500. |
| `markNotificationRead` | Body `notificationId`; no required-ID validation. Reads notifications, maps matching IDs to `{...notification,read:true}`; non-array value becomes `[]`. | Writes complete notification list and returns `{ success:true }`; unknown ID still succeeds. Caught errors return 500. |
| `updateProfile` | Requires metadata role exactly `student`, otherwise 403. Accepts only `name`, `prn`, `phone`, `address`, `bio`; supports `rollNumber` as PRN fallback when `prn` absent. | Merges allowed changes into profile while preserving other existing fields, saves `student_profile:<email>`, and if name is truthy calls auth admin `updateUserById` with `{user_metadata:{name}}`. Returns `{ success:true,profile }`. Auth update occurs after portal write and is not transactionally coupled; caught errors, including auth update failures, return 500. |
| `submitQuiz` | Body `taskId`, `score`, `maxScore`, `answers`; finds task in `student_tasks:<email>`. Missing task returns 404. No controller numeric/range validation. | Calls `recordGrade` with task defaults for subject/title, student auth user details, `studentId:user.id`, task class, grade/score, `maxScore || 100`, and answers. Success `{ success:true,percentage }`, with percentage rounded when `maxScore>0`, otherwise 0. Errors return 500. The grade service validates active database student/class, score bounds and task-class consistency and writes associated grade/progression data. |
| `getQuest` | No inputs; reads student task list and normalizes to array. | Returns `{ quest:first incomplete task or null,tasks }`. Read-only. Caught errors return 500. |

## Storage and database calls

- Portal keys: `student_profile:<email>`, `student_tasks:<email>`, `student_grades:<email>`, `notifications:<email>`, and (through streak service) `student_streak:<email>`.
- Database-backed leaderboard reads `students`, `graduation_cohorts`, `degrees`, `class_memberships`, `classes`, `teacher_students`, `users`, and `grades`.
- `recordGrade` uses `gradeRecordingService`: checks the active student and class, writes student/teacher/task grade lists and notifications, tracks activity, then awards XP. Its XP update is transactional in `xpService`; the surrounding portal writes are not in a shared transaction.
- `studentDashboardService` performs in-memory completion/stat calculations only.
- Direct callers evidenced are route registry/dispatcher. The controller does not provide pagination or an independent response wrapper.

## Error boundary and unknowns

The shared dispatcher returns 401/403 before the controller for missing, wrong-role, disabled, or inactive users. Controller-specific status behavior is shown above; other thrown handler errors become 500 `{ error }`. There is no schema validation layer in this file. Profile/task source-data shape beyond the guarded array fallbacks is not guaranteed here.
