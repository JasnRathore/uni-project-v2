# Leaderboard service

**Source:** `lib/api/services/leaderboardService.js`  
**Evidence:** Query logic and output contracts verified in source; schema relationships verified in `new_schema.sql`. Called by `lib/api/controllers/gameController.js` (excluded).

## Exports and contracts

Exports `getLeaderboard({ studentId, scope, scopeId })` and `getActiveClasses(studentId)`. `getActiveClasses` returns distinct active class IDs/names for the active student, based on active memberships and active classes, ordered by class name and ID.

## Leaderboard behavior

`getLeaderboard` first fetches the active student plus cohort/degree labels, throwing `Student not found` if absent. For `cohort`, it uses the student's own cohort rather than caller-supplied `scopeId`; no cohort returns a successful empty `v1` payload with null `scopeId`/name. For `class`, it requires the target to be active and the requesting student to have an active membership, or throws access denied. Other scope values throw.

It selects active students in the chosen cohort or with an active membership for the selected class, left-joins XP events, sums points (zero for none), and sorts by XP descending, case-insensitive student name, then ID. Competition ranking is applied: ties share the first row's rank, and the next distinct score gets its one-based row index, leaving rank gaps. Entries include student ID, name fallback, numeric XP, rank, and current-student flag. The result includes scope, scope ID/name, `rulesetVersion: 'v1'`, calculation timestamp, and entries.

## Data and consistency

Uses `getDatabaseClient` only; reads `students`, `graduation_cohorts`, `degrees`, `classes`, `class_memberships`, and `xp_events`. XP totals come from the event ledger, not `students.total_points` or `progression_states`. Reads are not wrapped in a transaction, so the current-student, access, and ranking queries can observe different snapshots.

## Edge cases

Class membership join in `getActiveClasses` and the class access check also require class teacher identity to match membership teacher. The ranking query's class `EXISTS` filters membership status and class ID but does not recheck that join's teacher consistency; schema does not encode that cross-table ownership relation. Student without cohort receives empty data rather than error. No pagination or maximum class size is enforced here.

**Verified:** filters, sorting, competition rank, output metadata, and query snapshot boundaries. **Unknown:** how the caller maps scope/query parameters or serializes errors.
