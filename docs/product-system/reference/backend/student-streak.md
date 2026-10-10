# Student activity and streak service

**Source:** `lib/api/services/studentService.js`  
**Evidence:** Date and persistence logic verified; `readPortalData`/`writePortalData` behavior documented in the relational adapter page. Used by grade recording and student/teacher controllers (excluded).

## Exports and contracts

Exports `trackStudentActivity(email, dueDate)` and `getStudentStreak(email, tasks = [])`. The date helper `getToday` and `hasMissedDeadline` are private.

## Behavior

- Activity dates use `new Date().toISOString().split('T')[0]` (UTC calendar date).
- `trackStudentActivity` reads key `student_streak:<email>`; absent state defaults to zero current/longest streak, null last date, and empty date array. If already active today and the new activity is not late, it returns without writing.
- A due date before today counts as late and resets current streak to one. Otherwise yesterday's last date increments the streak; any other prior date starts at one. Longest is max(old, current), last activity is today, today is appended once, then the object is persisted and returned.
- `getStudentStreak` reads/defaults the same key. If any task is incomplete, has a due date before today, and streak is nonzero, it resets only current streak to zero and persists. It returns the resulting record.

## Dependencies, consistency, and edge cases

Depends on `readPortalData` and `writePortalData` from `database/services/dbService.js`; the relational adapter maps this key to `student_activity` and `student_activity_days`. Each write uses the adapter's transaction, but the read/modify/write is not a single transaction: simultaneous activity calls can race and lose increments. The dates array grows without a retention bound. Missing/invalid `dates` in persisted data may throw at `.includes`/`.push`; this module assumes its stored shape. `hasMissedDeadline` normalizes non-array task lists to empty and compares the first ten due-date characters lexically to the ISO UTC date.

**Verified:** logic and key strings. **Unknown:** handling of malformed legacy rows beyond the adapter's parsing errors.
