# Student dashboard calculations

**Source:** `lib/api/services/studentDashboardService.js`  
**Evidence:** Both pure functions verified in source. `lib/api/controllers/studentController.js` calls them; controller and UI behavior are excluded.

## Exports and contracts

CommonJS exports `mergeTaskCompletion(tasks, grades)` and `calculateStats(grades, tasks, streak)`. Neither function performs I/O or mutates the input arrays/objects.

## Behavior

- `mergeTaskCompletion` treats non-array tasks/grades as empty arrays. For every task it finds the first grade whose `taskId` or `task_id` equals `task.id`, returns a copied task with `completed` true if either prior completion or a matching grade exists, and exposes matching grade label or existing task grade. A grade only marks completion; its score is not copied.
- `calculateStats` likewise normalizes non-arrays to empty lists. For every grade, if score is finite and `maxScore > 0`, percentage is score/maxScore; otherwise it uses the A+/A/A-/B+/B/B-/C+/C/C-/D/F map or zero. It adds floored percentage plus score bonus (15/10/5 at 95/90/80 thresholds) to `totalEXP`. Assignment count is task-list length; completed count uses truthy `completed`. It returns EXP, `floor(EXP / 500) + 1` level, modulo-500 current-level EXP, constant next-level EXP 500, `streak.currentStreak || 0`, total assignments, and completed assignments.

## Important distinction and edge cases

This is a display/stat calculation from grades and task snapshots, not the XP ledger. It can diverge from `xpService`/leaderboard totals: it recomputes every grade on each call and always adds the percentage bonus. A grade with numeric score but missing/invalid maximum falls back to its letter grade; unknown letter grades contribute zero. Negative/over-maximum percentages are not clamped. `currentStreak` may be any truthy value in the returned field; no numeric validation occurs.

**Verified:** pure transformations above. **Unknown:** exact upstream data freshness and how displayed stats are reconciled with progression state.
